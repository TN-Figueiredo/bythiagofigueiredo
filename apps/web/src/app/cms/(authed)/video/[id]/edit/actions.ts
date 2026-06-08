'use server'

import { z } from 'zod'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'

const TitleSchema = z.string().max(500)

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
