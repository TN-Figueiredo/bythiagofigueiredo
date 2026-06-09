'use server'

import { z } from 'zod'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSectionKey } from '@/lib/pipeline/sections'
import type { SectionData } from '@/lib/pipeline/sections'
import { readRoteiro } from '@/lib/pipeline/roteiro-schemas'
import { ensureBeatIds, type RecStatus, type StoredRecRow } from '@/lib/pipeline/video-recording'

/**
 * Session-authed recording-status read/write for the LOGGED-IN editor.
 *
 * This is the editor's path to the durable `video_recording_status` ledger — NOT the
 * `X-Pipeline-Key` REST endpoints under `/api/pipeline/items/[id]/recording` (those are
 * Cowork-only, keyed on an API key). Here we authenticate with the user's CMS session:
 * `getSiteContext()` resolves the request's site from middleware, `requireSiteScope`
 * checks the user's `mode:'edit'` permission for that site, and ONLY THEN do we touch the
 * service-role client — every query is additionally scoped by `site_id`, so a forged item
 * id from another ring is a no-op (mirrors `saveVideoTitle` / `advanceToRecorded` in
 * ./actions.ts). The service client is never obtained before the guard passes.
 *
 * Status is durable per `(pipeline_id, lang, beat_id)` — see
 * docs/superpowers/specs/2026-06-08-gravacao-por-beat-design.md.
 */

export type RecLang = 'pt' | 'en'

export type RecordingActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

const LangSchema = z.enum(['pt', 'en'])
const RecStatusSchema = z.enum(['pendente', 'gravada', 'refazer'])

const SaveBeatSchema = z.object({
  beatId: z.string().min(1),
  status: RecStatusSchema,
  retakeNote: z.string().max(500).optional(),
  beatName: z.string().max(500).optional(),
  contentHash: z.string().max(64).optional(),
})
export type SaveRecordingBeatInput = z.infer<typeof SaveBeatSchema>

/** Columns selected from `video_recording_status` for the editor's reconciliation. */
const ROW_COLS = 'beat_id, status, retake_note, beat_name, content_hash'

function scopeError(reason: string): string {
  return reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden'
}

/**
 * Load the durable recording rows for one `(item, lang)`, RLS-scoped to the logged-in
 * user's site. Returns the raw `StoredRecRow[]` so the caller can run the pure
 * `reconcileRecording()` against the live roteiro beats (server is the source of truth
 * for clean local rows). The `(site_id, pipeline_id, lang)` filter mirrors the service-
 * layer `fetchRows` shape.
 */
export async function loadRecording(
  videoId: string,
  langRaw: string,
): Promise<RecordingActionResult<StoredRecRow[]>> {
  const lang = LangSchema.safeParse(langRaw)
  if (!lang.success) return { ok: false, error: 'invalid_lang' }

  const { siteId } = await getSiteContext()
  const scope = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!scope.ok) return { ok: false, error: scopeError(scope.reason) }

  const supabase = getSupabaseServiceClient()

  // Guard the item exists in this site BEFORE returning rows (a forged cross-ring id
  // yields not_found, never another site's status).
  const { data: item } = await supabase
    .from('content_pipeline')
    .select('id')
    .eq('id', videoId)
    .eq('site_id', siteId)
    .eq('format', 'video')
    .single()
  if (!item) return { ok: false, error: 'not_found' }

  const { data, error } = await supabase
    .from('video_recording_status')
    .select(ROW_COLS)
    .eq('site_id', siteId)
    .eq('pipeline_id', videoId)
    .eq('lang', lang.data)

  if (error) return { ok: false, error: 'load_failed' }
  return { ok: true, data: (data ?? []) as StoredRecRow[] }
}

/**
 * Upsert the durable status of a single beat (session-authed, `source:'user'`). Clears the
 * `retake_note` unless the status is `refazer` (mirrors the REST `putRecording` contract).
 * Per-row last-write-wins — no version lock; the editor is the live owner and the local-
 * first store reconciles concurrent edits. Scoped to `site_id` so a forged id is a no-op.
 */
export async function saveRecordingBeat(
  videoId: string,
  langRaw: string,
  input: SaveRecordingBeatInput,
): Promise<RecordingActionResult<{ updatedAt: string }>> {
  const lang = LangSchema.safeParse(langRaw)
  if (!lang.success) return { ok: false, error: 'invalid_lang' }

  const parsed = SaveBeatSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'invalid_input' }
  const beat = parsed.data

  const { siteId } = await getSiteContext()
  const scope = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!scope.ok) return { ok: false, error: scopeError(scope.reason) }

  const supabase = getSupabaseServiceClient()

  // FK + scope guard: the item must exist in this site.
  const { data: item } = await supabase
    .from('content_pipeline')
    .select('id')
    .eq('id', videoId)
    .eq('site_id', siteId)
    .eq('format', 'video')
    .single()
  if (!item) return { ok: false, error: 'not_found' }

  const updatedAt = new Date().toISOString()
  const payload = {
    site_id: siteId,
    pipeline_id: videoId,
    lang: lang.data,
    beat_id: beat.beatId,
    status: beat.status satisfies RecStatus,
    retake_note: beat.status === 'refazer' ? (beat.retakeNote ?? null) : null,
    beat_name: beat.beatName ?? null,
    content_hash: beat.contentHash ?? null,
    source: 'user' as const,
    updated_at: updatedAt,
  }

  const { error } = await supabase
    .from('video_recording_status')
    .upsert(payload, { onConflict: 'pipeline_id,lang,beat_id' })
  if (error) return { ok: false, error: 'save_failed' }

  return { ok: true, data: { updatedAt } }
}

// ---------------------------------------------------------------------------
// persistBeatIds — the linchpin: stamp stable beat ids ONCE so status keys survive reloads.
// ---------------------------------------------------------------------------

/**
 * Stamp stable `id`s onto the roteiro's `fala` beats and PERSIST them, so per-beat
 * recording status (keyed `${lang}:${beat.id}`) survives reloads instead of regenerating.
 *
 * Idempotent + cheap: reads the `roteiro_<lang>` section envelope, runs the pure
 * `ensureBeatIds()`, and writes back ONLY when ids were actually assigned (`changed`).
 * When nothing changed it returns `{ persisted: false }` without a write — safe to call
 * on every load. The write:
 *   • preserves the section `rev` lock (CAS via `.eq('rev', existing.rev)` inside the
 *     `sections` JSONB) — a concurrent in-flight roteiro edit just loses the CAS and we
 *     return `conflict` (caller skips/retries; ids get stamped on the next clean load).
 *   • does NOT flip `edited` (a system id-stamp is not a user content edit) and does NOT
 *     change performer text, so `content_hash`/status reconciliation is unaffected.
 *   • bumps the item `version` (a normal section save) under the optimistic lock.
 *
 * Returns the new item version on a successful persist so the caller can re-sync its lock.
 */
export async function persistBeatIds(
  videoId: string,
  langRaw: string,
  expectedVersion: number,
): Promise<RecordingActionResult<{ persisted: boolean; version: number }>> {
  const lang = LangSchema.safeParse(langRaw)
  if (!lang.success) return { ok: false, error: 'invalid_lang' }

  const { siteId } = await getSiteContext()
  const scope = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!scope.ok) return { ok: false, error: scopeError(scope.reason) }

  const supabase = getSupabaseServiceClient()

  const { data: item } = await supabase
    .from('content_pipeline')
    .select('id, version, sections')
    .eq('id', videoId)
    .eq('site_id', siteId)
    .eq('format', 'video')
    .single()
  if (!item) return { ok: false, error: 'not_found' }
  if (item.version !== expectedVersion) return { ok: false, error: 'version_conflict' }

  const sectionKey = getSectionKey('roteiro', lang.data, 'video')
  const sections = (item.sections ?? {}) as Record<string, SectionData>
  const existing = sections[sectionKey]
  if (!existing || existing.content == null) {
    // No roteiro for this lang → nothing to stamp.
    return { ok: true, data: { persisted: false, version: item.version as number } }
  }

  const content = readRoteiro(existing.content)
  const { content: stamped, changed } = ensureBeatIds(content)
  if (!changed) {
    return { ok: true, data: { persisted: false, version: item.version as number } }
  }

  // Bump the section rev like a normal save, but keep `edited`/`source` as-is (system stamp).
  const updatedSection: SectionData = {
    ...existing,
    rev: (existing.rev ?? 0) + 1,
    content: stamped as unknown as SectionData['content'],
    updated_at: new Date().toISOString(),
  }
  const newSections = { ...sections, [sectionKey]: updatedSection }

  const { data: updated, error } = await supabase
    .from('content_pipeline')
    .update({ sections: newSections, updated_at: new Date().toISOString() })
    .eq('id', videoId)
    .eq('site_id', siteId)
    .eq('version', expectedVersion)
    .select('version')
    .single()

  // A concurrent roteiro save won the version CAS — don't crash, just skip; ids get
  // stamped on the next clean load.
  if (error || !updated) return { ok: false, error: 'version_conflict' }

  return { ok: true, data: { persisted: true, version: updated.version as number } }
}
