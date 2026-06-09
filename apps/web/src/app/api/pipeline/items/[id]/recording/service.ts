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

export const RecordingPutSchema = z.object({
  beat_id: z.string().min(1),
  status: RecStatusSchema,
  retake_note: z.string().max(500).optional(),
  beat_name: z.string().max(500).optional(),
  content_hash: z.string().max(64).optional(),
  source: z.enum(['user', 'cowork']).optional(),
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
  source: z.enum(['user', 'cowork']).optional(),
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
  await loadItem(ctx, id)

  // Per-row optimistic concurrency: reject if the existing row is newer than the
  // caller's snapshot, returning the current row so the caller can re-reconcile.
  if (input.if_unmodified_since) {
    const { data: existing } = await ctx.supabase
      .from('video_recording_status')
      .select(ROW_COLS)
      .eq('site_id', ctx.siteId)
      .eq('pipeline_id', id)
      .eq('lang', lang)
      .eq('beat_id', input.beat_id)
      .maybeSingle()
    if (existing) {
      const row = existing as RecordingRow
      if (new Date(row.updated_at) > new Date(input.if_unmodified_since)) {
        throw new RecordingPreconditionError(row)
      }
    }
  }

  const payload = {
    site_id: ctx.siteId,
    pipeline_id: id,
    lang,
    beat_id: input.beat_id,
    status: input.status,
    retake_note: input.status === 'refazer' ? (input.retake_note ?? null) : null,
    beat_name: input.beat_name ?? null,
    content_hash: input.content_hash ?? null,
    source: input.source ?? (ctx.source === 'api_key' ? 'cowork' : 'user'),
    updated_at: new Date().toISOString(),
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

  await loadItem(ctx, id)

  const now = new Date().toISOString()
  const source = input.source ?? (ctx.source === 'api_key' ? 'cowork' : 'user')
  const payload = input.updates.map((u) => ({
    site_id: ctx.siteId,
    pipeline_id: id,
    lang,
    beat_id: u.beat_id,
    status: u.status,
    retake_note: u.status === 'refazer' ? (u.retake_note ?? null) : null,
    beat_name: u.beat_name ?? null,
    content_hash: u.content_hash ?? null,
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
