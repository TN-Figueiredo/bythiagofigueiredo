'use server'

import { z } from 'zod'
import { revalidatePath, revalidateTag } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getStagePosition, getNextStage } from '@/lib/pipeline/workflows'
import { videoColumn } from '@/lib/pipeline/video-lifecycle'
import { loadVideoDetail } from '@/lib/pipeline/load-video-detail'
import { ABDraftSchema } from '@/lib/pipeline/video-schemas'
import { planAbMaterialization } from '@/lib/pipeline/video-ab-materialize'
import { abPublishCtaState } from '@/lib/pipeline/video-ab-precondition'
import { getSectionKey } from '@/lib/pipeline/sections'
import { createAbTest, updateTextVariant, createTextVariant } from '@/app/cms/(authed)/youtube/ab-lab/actions'

const TitleSchema = z.string().max(500)

export type VideoActionResult<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; error: string }

/** Position threshold that unlocks Pós + Publicação (§5.5). */
const GRAVACAO_POSITION = getStagePosition('video', 'gravacao')

function scopeError(reason: string): string {
  return reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden'
}

/**
 * Persists the working title of a video item.
 *
 * Writes the `title_<lang>` column on `content_pipeline` and mirrors the value
 * into the per-language ideia section payload (`sections.ideia_<lang>.content.title`)
 * so the kanban projection and the ideia canvas stay in sync.
 *
 * Guarded: resolves the request's site from middleware context and exercises
 * `requireSiteScope({ area: 'cms', mode: 'edit' })` BEFORE touching the
 * service-role client. The UPDATE is additionally scoped by `site_id` so a
 * forged item id from another ring is a no-op.
 */
export async function saveVideoTitle(
  itemId: string,
  lang: 'pt' | 'en',
  title: string,
  expectedVersion: number,
): Promise<{ ok: true; version: number } | { ok: false; error: string }> {
  const parsed = TitleSchema.safeParse(title)
  if (!parsed.success) return { ok: false, error: 'invalid_title' }
  // Never CLEAR a title: a blank save (e.g. a contentEditable firing with transient
  // empty content during a re-render) must NOT wipe the title_<lang> column. No-op.
  if (!parsed.data.trim()) return { ok: true, version: expectedVersion }

  const { siteId } = await getSiteContext()
  const scope = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!scope.ok) {
    return { ok: false, error: scope.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden' }
  }

  const supabase = getSupabaseServiceClient()
  const clean = parsed.data.trim()
  const titleCol = lang === 'pt' ? 'title_pt' : 'title_en'

  // Read current sections + version under the optimistic lock.
  const { data: row, error: readErr } = await supabase
    .from('content_pipeline')
    .select('sections, version')
    .eq('id', itemId)
    .eq('site_id', siteId)
    .single()

  if (readErr || !row) return { ok: false, error: 'not_found' }
  if (row.version !== expectedVersion) return { ok: false, error: 'version_conflict' }

  // Mirror the title into the ideia section payload, preserving the rest.
  const sectionKey = `ideia_${lang}`
  const sections = (row.sections ?? {}) as Record<string, { content?: Record<string, unknown> } & Record<string, unknown>>
  const existing = sections[sectionKey]
  if (existing && typeof existing.content === 'object' && existing.content !== null) {
    sections[sectionKey] = { ...existing, content: { ...existing.content, title: clean } }
  }

  const { data: updated, error: updErr } = await supabase
    .from('content_pipeline')
    .update({ [titleCol]: clean, sections })
    .eq('id', itemId)
    .eq('site_id', siteId)
    .eq('version', expectedVersion)
    .select('version')
    .single()

  if (updErr || !updated) return { ok: false, error: 'version_conflict' }
  return { ok: true, version: updated.version as number }
}

// ---------------------------------------------------------------------------
// advanceToRecorded (Task 6) — "marcar como gravado"
// ---------------------------------------------------------------------------

/**
 * "Marcar como gravado" (§5.5): advances the DB stage to `gravacao` ONLY when the
 * item is currently below it (never downgrades a further-along item). Reaching
 * `gravacao` unlocks the Pós + Publicação sections.
 *
 * Edit-scope transition — the target (`gravacao`) is NOT publish-equivalent, so the
 * scope check is `mode:'edit'`. The guard runs BEFORE any service-role client use,
 * and the UPDATE is version-checked (optimistic lock) + scoped to `site_id`.
 */
export async function advanceToRecorded(id: string, version: number): Promise<VideoActionResult> {
  const { siteId } = await getSiteContext()
  const scope = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!scope.ok) return { ok: false, error: scopeError(scope.reason) }

  const supabase = getSupabaseServiceClient()

  const { data: item } = await supabase
    .from('content_pipeline')
    .select('id, stage, version')
    .eq('id', id).eq('site_id', siteId).eq('format', 'video')
    .single()

  if (!item) return { ok: false, error: 'not_found' }
  if (item.version !== version) return { ok: false, error: 'version_conflict' }

  if (getStagePosition('video', item.stage as string) >= GRAVACAO_POSITION) {
    return { ok: true, data: item } // already recorded — no-op, never downgrade
  }

  const { data: updated, error } = await supabase
    .from('content_pipeline')
    .update({ stage: 'gravacao' })
    .eq('id', id).eq('site_id', siteId).eq('version', version)
    .select()
    .single()

  if (error || !updated) return { ok: false, error: 'version_conflict' }

  revalidatePath('/cms/video')
  revalidatePath(`/cms/video/${id}/edit`)
  revalidateTag('pipeline-blog')
  return { ok: true, data: updated }
}

// ---------------------------------------------------------------------------
// advanceVideoStage (Task 7) — publish-equivalent scope escalation
// ---------------------------------------------------------------------------

/**
 * General single-step video advance (§3.2/§9): computes the target stage FIRST, then
 * escalates the scope check to `mode:'publish'` when the target is publish-equivalent
 * (`videoColumn(target)==='published'`, i.e. `scheduled`/`published`), else `mode:'edit'`.
 *
 * Closes the hole where a generic `advancePipelineItem` advances INTO `published` under
 * `requireEditAccess` alone — a reporter (edit-own, no-publish) is now 403'd at the action
 * when the target is publish-equivalent. The service-role write is still preceded by the
 * scope check; the initial select is only the format/stage lookup needed to pick the mode.
 */
export async function advanceVideoStage(id: string, version: number): Promise<VideoActionResult> {
  const { siteId } = await getSiteContext()
  const supabase = getSupabaseServiceClient()

  const { data: item } = await supabase
    .from('content_pipeline')
    .select('id, stage, version, format')
    .eq('id', id).eq('site_id', siteId).eq('format', 'video')
    .single()

  if (!item) return { ok: false, error: 'not_found' }
  if (item.version !== version) return { ok: false, error: 'version_conflict' }

  const next = getNextStage('video', item.stage as string)
  if (!next) return { ok: false, error: 'already_final' }

  const mode: 'edit' | 'publish' = videoColumn(next) === 'published' ? 'publish' : 'edit'
  const scope = await requireSiteScope({ area: 'cms', siteId, mode })
  if (!scope.ok) return { ok: false, error: scopeError(scope.reason) }

  const { data: updated, error } = await supabase
    .from('content_pipeline')
    .update({ stage: next })
    .eq('id', id).eq('site_id', siteId).eq('version', version)
    .select()
    .single()

  if (error || !updated) return { ok: false, error: 'version_conflict' }

  revalidatePath('/cms/video')
  revalidatePath(`/cms/video/${id}/edit`)
  return { ok: true, data: updated }
}

// ---------------------------------------------------------------------------
// materializeAbDraft + publishVideo (Task 8) — publish-gated, ordered ab-lab materialize
// ---------------------------------------------------------------------------

/**
 * §3.8 materialization, executed in order while `ab_tests.status:'draft'`:
 *   1. createAbTest (direct FK to youtube_videos, seeds is_original row, test_type:'title')
 *   2. resolve the is_original variant id → updateTextVariant (createAbTest does NOT set title_text)
 *   3. createTextVariant ×3 (non-original challengers)
 * `uploadVariant` is NEVER used — the title-only flow has no thumbnail file.
 */
async function materializeAbDraft(
  supabase: SupabaseClient, siteId: string, youtubeVideoId: string,
  code: string, draft: z.infer<typeof ABDraftSchema>,
): Promise<{ ok: true; testId: string } | { ok: false; error: string }> {
  const plan = planAbMaterialization(draft)

  const created = await createAbTest({
    site_id: siteId,
    youtube_video_id: youtubeVideoId,
    name: `A/B ${code}`,
    test_type: 'title',
  })
  if (!created.ok || !created.id) return { ok: false, error: created.error ?? 'createAbTest failed' }
  const testId = created.id

  const { data: original } = await supabase
    .from('ab_test_variants')
    .select('id')
    .eq('test_id', testId).eq('is_original', true)
    .single()
  if (!original) return { ok: false, error: 'Original variant not found' }

  const upd = await updateTextVariant(original.id as string, plan.originalUpdate)
  if (!upd.ok) return { ok: false, error: upd.error ?? 'updateTextVariant failed' }

  for (const c of plan.challengers) {
    const r = await createTextVariant({ test_id: testId, title_text: c.title_text, metadata: c.metadata })
    if (!r.ok) return { ok: false, error: r.error ?? 'createTextVariant failed' }
  }
  return { ok: true, testId }
}

/**
 * Publish a video (§5.4/§9): explicit `mode:'publish'` scope check FIRST (the video module's
 * sole publish authorization — `enforce_publish_permission` does not attach to `content_pipeline`),
 * then the A/B data-precondition re-check (FK/thumbnail/Short via the youtube_videos join),
 * the ordered ab-lab materialization, and finally the version-checked `stage→'published'` write.
 *
 * A reporter (publish denied) is 403'd by the action itself — the service-role client is never
 * obtained and `createAbTest`/`createTextVariant` are never reached.
 */
export async function publishVideo(id: string, version: number): Promise<VideoActionResult<{ testId: string }>> {
  const { siteId } = await getSiteContext()
  const scope = await requireSiteScope({ area: 'cms', siteId, mode: 'publish' })
  if (!scope.ok) return { ok: false, error: scopeError(scope.reason) }

  const supabase = getSupabaseServiceClient()
  const detail = await loadVideoDetail(id, siteId)
  if (!detail) return { ok: false, error: 'not_found' }
  if (detail.version !== version) return { ok: false, error: 'version_conflict' }

  // Re-check the data preconditions server-side (mirror createAbTest's guards) before any insert.
  const cta = abPublishCtaState(detail.abJoinFacts, id)
  if (!cta.enabled) return { ok: false, error: cta.tooltip ?? 'A/B preconditions not met' }

  // The FK passed to createAbTest is content_pipeline.youtube_video_id (youtube_videos PK),
  // surfaced as detail.abJoinFacts.youtubeVideoId by load-video-detail. cta.enabled guarantees non-null.
  const fkVideoId = detail.abJoinFacts.youtubeVideoId
  if (!fkVideoId) return { ok: false, error: 'Vincule o vídeo do YouTube primeiro' }

  const sectionKey = getSectionKey('publish', detail.language === 'en' ? 'en' : 'pt', 'video')
  const rawDraft = (detail.sections as Record<string, unknown>)[sectionKey]
  const parsed = ABDraftSchema.safeParse(rawDraft)
  if (!parsed.success) return { ok: false, error: 'A/B draft inválido' }

  const mat = await materializeAbDraft(supabase, siteId, fkVideoId, detail.code, parsed.data)
  if (!mat.ok) return mat

  const { data: updated, error } = await supabase
    .from('content_pipeline')
    .update({ stage: 'published' })
    .eq('id', id).eq('site_id', siteId).eq('version', version)
    .select()
    .single()
  if (error || !updated) return { ok: false, error: 'version_conflict' }

  revalidatePath('/cms/video')
  revalidatePath(`/cms/video/${id}/edit`)
  revalidateTag('ab-tests')
  return { ok: true, data: { testId: mat.testId } }
}
