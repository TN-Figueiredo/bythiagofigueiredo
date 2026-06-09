/**
 * Shared service layer for per-beat recording status (the recording ledger).
 *
 * Lives under the recording route directory (not `lib/pipeline/services/`) so it can
 * import the server-only Supabase client without poisoning the client editor bundle
 * that consumes `lib/pipeline/video-recording.ts` (which stays pure / client-safe).
 *
 * Mirrors the conventions of `lib/pipeline/services/links.ts`: takes a ServiceContext,
 * validates with Zod, scopes everything to ctx.siteId, returns ServiceResult, throws
 * PipelineServiceError. Status is durable per (pipeline_id, lang, beat_id) in the
 * `video_recording_status` table — NOT inside the roteiro JSONB (which churns the item
 * version-lock and is blocked by the published-freeze).
 *
 * Reconciliation (carry / stale / orphan) is delegated to the pure
 * `reconcileRecording()` in `lib/pipeline/video-recording.ts`.
 *
 * PUBLISHED-FREEZE: recording status is intentionally NOT frozen by publish. The creator
 * records BEFORE publish and may mark `refazer` AFTER it. So none of these writes apply
 * the roteiro published-readonly guard — by design.
 */
import { z } from 'zod'
import { UUID_REGEX } from '@/lib/pipeline/auth'
import { getSectionKey } from '@/lib/pipeline/sections'
import type { SectionData } from '@/lib/pipeline/sections'
import type { Format } from '@/lib/pipeline/schemas'
import { readRoteiro, type RoteiroBeatV3 } from '@/lib/pipeline/roteiro-schemas'
import { beatKind } from '@/lib/pipeline/video-perform'
import {
  beatContentHash,
  ensureBeatIds,
  reconcileRecording,
  type RecStatus,
  type StoredRecRow,
  type ReconciledBeat,
} from '@/lib/pipeline/video-recording'
import type { ServiceContext, ServiceResult } from '@/lib/pipeline/services/types'
import { ok, err, PipelineServiceError } from '@/lib/pipeline/services/types'

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

export type RecLang = 'pt' | 'en'

/** A persisted recording-status row as returned to clients. */
export interface RecordingRow extends StoredRecRow {
  id: string
  site_id: string
  pipeline_id: string
  lang: RecLang
  source: 'user' | 'cowork' | 'cron'
  updated_at: string
  modified_by: string | null
}

const ROW_COLS =
  'id, site_id, pipeline_id, lang, beat_id, status, retake_note, beat_name, content_hash, source, updated_at, modified_by'

export interface RecordingViewResult {
  beats: ReconciledBeat[]
  orphans: StoredRecRow[]
  roteiro_present: boolean
}

// ---------------------------------------------------------------------------
// Zod schemas (request bodies)
// ---------------------------------------------------------------------------

const RecStatusSchema = z.enum(['pendente', 'gravada', 'refazer'])

// NOTE: `source` is intentionally NOT accepted from the request body — it is forgeable
// (a caller could mislabel a 'cowork' write as 'user' or vice-versa). The service derives
// it from the authenticated channel (ctx.source) instead. See deriveSource().
export const RecordingPutSchema = z.object({
  beat_id: z.string().min(1),
  status: RecStatusSchema,
  retake_note: z.string().max(500).optional(),
  beat_name: z.string().max(500).optional(),
  content_hash: z.string().max(64).optional(),
  if_unmodified_since: z.string().datetime().optional(),
})
export type RecordingPut = z.infer<typeof RecordingPutSchema>

export const RecordingBatchSchema = z.object({
  updates: z.array(z.object({
    beat_id: z.string().min(1),
    status: RecStatusSchema,
    retake_note: z.string().max(500).optional(),
    beat_name: z.string().max(500).optional(),
    content_hash: z.string().max(64).optional(),
  })).min(1).max(100),
})
export type RecordingBatch = z.infer<typeof RecordingBatchSchema>

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function assertWrite(ctx: ServiceContext): void {
  const hasWrite = ctx.permissions.includes('write') || ctx.permissions.includes('admin')
  if (!hasWrite) err('FORBIDDEN', 'Insufficient permissions', 403)
}

function assertValidId(id: string): void {
  if (!UUID_REGEX.test(id)) err('VALIDATION_ERROR', 'Invalid item ID format', 400)
}

export function asRecLang(raw: string | null | undefined): RecLang {
  return raw === 'en' ? 'en' : 'pt'
}

interface ItemRow {
  id: string
  format: string
  version: number
  sections: Record<string, SectionData> | null
}

/** Load the item (site-scoped) or throw NOT_FOUND. */
async function loadItem(ctx: ServiceContext, id: string): Promise<ItemRow> {
  const { data, error } = await ctx.supabase
    .from('content_pipeline')
    .select('id, format, version, sections')
    .eq('id', id)
    .eq('site_id', ctx.siteId)
    .single()
  if (error || !data) err('NOT_FOUND', 'Item not found', 404)
  return data as ItemRow
}

/**
 * Derive the current `fala` beats for a lang from the item's roteiro section. Returns
 * `present: false` when the roteiro section is absent. Beat ids are stamped in-memory
 * (ensureBeatIds) so reconciliation can match — this does NOT persist (no version bump).
 */
function deriveFalaBeats(item: ItemRow, lang: RecLang): { beats: RoteiroBeatV3[]; present: boolean } {
  const sectionKey = getSectionKey('roteiro', lang, item.format as Format)
  const sections = item.sections ?? {}
  const section = sections[sectionKey]
  if (!section || section.content == null) return { beats: [], present: false }

  const content = readRoteiro(section.content)
  const { content: stamped } = ensureBeatIds(content)
  const fala = stamped.beats.filter((b) => beatKind(b) === 'fala')
  return { beats: fala, present: true }
}

/** Fetch the stored rows for (pipeline_id, lang). */
async function fetchRows(ctx: ServiceContext, pipelineId: string, lang: RecLang): Promise<RecordingRow[]> {
  const { data, error } = await ctx.supabase
    .from('video_recording_status')
    .select(ROW_COLS)
    .eq('site_id', ctx.siteId)
    .eq('pipeline_id', pipelineId)
    .eq('lang', lang)
  if (error) err('INTERNAL_ERROR', `Failed to load recording rows: ${error.message}`, 500)
  return (data ?? []) as RecordingRow[]
}

/**
 * The persisted `source` attribution for a write. Derived from the AUTHENTICATED channel —
 * never from the request body (which is forgeable). API-key writes are Cowork; session
 * writes are the human creator. ('cron' is reserved for internal jobs and is never set here.)
 */
function deriveSource(ctx: ServiceContext): 'cowork' | 'user' {
  return ctx.source === 'api_key' ? 'cowork' : 'user'
}

/** Map current fala beat_id → its server-computed content hash (for stale detection). */
function buildHashByBeatId(item: ItemRow, lang: RecLang): Map<string, string> {
  const { beats } = deriveFalaBeats(item, lang)
  const map = new Map<string, string>()
  for (const beat of beats) {
    if (beat.id) map.set(beat.id, beatContentHash(beat))
  }
  return map
}

/**
 * Resolve the content_hash to persist for a beat write. A recorded beat (gravada/refazer)
 * MUST carry a non-null hash, otherwise stale detection is permanently disabled (reconcile
 * only flags stale when the stored hash is non-null → a null hash is a silent ✓ forever).
 * Precedence: client-supplied hash → server-derived hash from the live roteiro beat →
 * null only for `pendente` or for an orphan write (beat_id absent from the current roteiro,
 * where there's nothing to derive — existing behavior preserved).
 */
function resolveContentHash(
  status: RecStatus,
  clientHash: string | undefined,
  beatId: string,
  hashByBeatId: Map<string, string>,
): string | null {
  if (clientHash) return clientHash
  if (status === 'pendente') return null
  return hashByBeatId.get(beatId) ?? null
}

// ---------------------------------------------------------------------------
// GET — derive + reconcile
// ---------------------------------------------------------------------------

export async function getRecording(
  ctx: ServiceContext,
  id: string,
  langRaw: string | null,
): Promise<ServiceResult<RecordingViewResult>> {
  assertValidId(id)
  const lang = asRecLang(langRaw)

  const item = await loadItem(ctx, id)
  const { beats, present } = deriveFalaBeats(item, lang)
  const rows = await fetchRows(ctx, id, lang)

  const { beats: reconciled, orphans } = reconcileRecording(beats, rows)

  return {
    data: { beats: reconciled, orphans, roteiro_present: present },
    meta: { item_version: item.version },
  }
}

// ---------------------------------------------------------------------------
// PUT — upsert one beat
// ---------------------------------------------------------------------------

/** Thrown to signal a 412 precondition failure carrying the current row. */
export class RecordingPreconditionError extends PipelineServiceError {
  constructor(public current: RecordingRow) {
    super('PRECONDITION_FAILED', 'Recording row was modified since if_unmodified_since', 412, { current })
  }
}

export async function putRecording(
  ctx: ServiceContext,
  id: string,
  langRaw: string | null,
  body: unknown,
): Promise<ServiceResult<{ row: RecordingRow }>> {
  assertValidId(id)
  assertWrite(ctx)
  const lang = asRecLang(langRaw)

  const parsed = RecordingPutSchema.safeParse(body)
  if (!parsed.success) {
    err('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid request body', 400)
  }
  const input = parsed.data

  // Item must exist + be in this site (FK + scope guard).
  const item = await loadItem(ctx, id)

  // Server-derived hash for the live roteiro beat — never persist a null hash for a
  // recorded beat (that would permanently disable stale detection).
  const hashByBeatId = buildHashByBeatId(item, lang)
  const contentHash = resolveContentHash(input.status, input.content_hash, input.beat_id, hashByBeatId)

  const payload = {
    site_id: ctx.siteId,
    pipeline_id: id,
    lang,
    beat_id: input.beat_id,
    status: input.status,
    retake_note: input.status === 'refazer' ? (input.retake_note ?? null) : null,
    beat_name: input.beat_name ?? null,
    content_hash: contentHash,
    source: deriveSource(ctx),
    updated_at: new Date().toISOString(),
  }

  // Per-row optimistic concurrency. When `if_unmodified_since` is given we do an ATOMIC
  // conditional update gated on `updated_at == expected` (closes the read-then-write TOCTOU):
  //   0 rows + an existing row that moved on → 412 PRECONDITION_FAILED carrying the current row;
  //   0 rows + no existing row               → first write, fall through to upsert (insert).
  if (input.if_unmodified_since) {
    const { data: updated, error: updErr } = await ctx.supabase
      .from('video_recording_status')
      .update(payload)
      .eq('site_id', ctx.siteId)
      .eq('pipeline_id', id)
      .eq('lang', lang)
      .eq('beat_id', input.beat_id)
      .eq('updated_at', input.if_unmodified_since)
      .select(ROW_COLS)
      .maybeSingle()
    if (updErr) err('INTERNAL_ERROR', `Failed to update recording row: ${updErr.message}`, 500)
    if (updated) return ok({ row: updated as RecordingRow })

    // No row matched the precondition. If a row exists at all, it moved on → 412.
    const { data: existing } = await ctx.supabase
      .from('video_recording_status')
      .select(ROW_COLS)
      .eq('site_id', ctx.siteId)
      .eq('pipeline_id', id)
      .eq('lang', lang)
      .eq('beat_id', input.beat_id)
      .maybeSingle()
    if (existing) throw new RecordingPreconditionError(existing as RecordingRow)
    // else: no row yet → fall through to the upsert (first write for this beat).
  }

  const { data, error } = await ctx.supabase
    .from('video_recording_status')
    .upsert(payload, { onConflict: 'pipeline_id,lang,beat_id' })
    .select(ROW_COLS)
    .single()
  if (error || !data) err('INTERNAL_ERROR', `Failed to upsert recording row: ${error?.message ?? 'no row'}`, 500)

  return ok({ row: data as RecordingRow })
}

// ---------------------------------------------------------------------------
// PATCH — batch upsert
// ---------------------------------------------------------------------------

export async function batchRecording(
  ctx: ServiceContext,
  id: string,
  langRaw: string | null,
  body: unknown,
): Promise<ServiceResult<{ rows: RecordingRow[]; updated: number }>> {
  assertValidId(id)
  assertWrite(ctx)
  const lang = asRecLang(langRaw)

  const parsed = RecordingBatchSchema.safeParse(body)
  if (!parsed.success) {
    err('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid request body', 400)
  }
  const input = parsed.data

  const item = await loadItem(ctx, id)

  const now = new Date().toISOString()
  const source = deriveSource(ctx)
  const hashByBeatId = buildHashByBeatId(item, lang)
  const payload = input.updates.map((u) => ({
    site_id: ctx.siteId,
    pipeline_id: id,
    lang,
    beat_id: u.beat_id,
    status: u.status,
    retake_note: u.status === 'refazer' ? (u.retake_note ?? null) : null,
    beat_name: u.beat_name ?? null,
    content_hash: resolveContentHash(u.status, u.content_hash, u.beat_id, hashByBeatId),
    source,
    updated_at: now,
  }))

  const { data, error } = await ctx.supabase
    .from('video_recording_status')
    .upsert(payload, { onConflict: 'pipeline_id,lang,beat_id' })
    .select(ROW_COLS)
  if (error) err('INTERNAL_ERROR', `Failed to batch upsert recording rows: ${error.message}`, 500)

  const rows = (data ?? []) as RecordingRow[]
  return ok({ rows, updated: rows.length })
}

// ---------------------------------------------------------------------------
// DELETE — purge orphans (recomputed server-side, never trust a client list)
// ---------------------------------------------------------------------------

export async function purgeOrphans(
  ctx: ServiceContext,
  id: string,
  langRaw: string | null,
): Promise<ServiceResult<{ purged: number; orphan_beat_ids: string[] }>> {
  assertValidId(id)
  assertWrite(ctx)
  const lang = asRecLang(langRaw)

  const item = await loadItem(ctx, id)
  const { beats } = deriveFalaBeats(item, lang)
  const rows = await fetchRows(ctx, id, lang)

  const { orphans } = reconcileRecording(beats, rows)
  const orphanIds = orphans.map((o) => o.beat_id)

  if (orphanIds.length === 0) {
    return ok({ purged: 0, orphan_beat_ids: [] })
  }

  const { error } = await ctx.supabase
    .from('video_recording_status')
    .delete()
    .eq('site_id', ctx.siteId)
    .eq('pipeline_id', id)
    .eq('lang', lang)
    .in('beat_id', orphanIds)
  if (error) err('INTERNAL_ERROR', `Failed to purge orphan rows: ${error.message}`, 500)

  return ok({ purged: orphanIds.length, orphan_beat_ids: orphanIds })
}

export type { RecStatus }
