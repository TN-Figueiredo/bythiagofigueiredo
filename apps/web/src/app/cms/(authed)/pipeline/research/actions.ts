'use server'

import { z } from 'zod'
import { revalidatePath, revalidateTag } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import {
  ResearchItemUpdateSchema,
  ResearchTopicCreateSchema,
  ResearchTopicUpdateSchema,
  ResearchLinkSchema,
  RESEARCH_STATUS,
  type ResearchStatus,
} from '@/lib/pipeline/research-schemas'
import type { ResearchItemFull, ResearchLinkedItem } from '@/lib/pipeline/research-types'

type ActionResult = { ok: true; data?: Record<string, unknown> } | { ok: false; error: string }
type ActionResultTyped<T> = { ok: true; data: T } | { ok: false; error: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function zodError(err: z.ZodError): string {
  return err.issues.map((i) => i.message).join(', ') || 'Validation failed'
}

async function requireEditAccess() {
  const { siteId, timezone } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')
  return { siteId, timezone }
}

export async function saveResearchItem(
  id: string,
  version: number,
  input: Record<string, unknown>,
): Promise<ActionResult> {
  if (!UUID_RE.test(id)) return { ok: false, error: 'Invalid id' }
  const parsed = ResearchItemUpdateSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }

  const { siteId } = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const updateData: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value !== undefined) updateData[key] = value
  }

  if (parsed.data.content_md !== undefined && !parsed.data.content_json) {
    updateData.content_json = null
  }

  const { data: updated, error } = await supabase
    .from('research_items')
    .update(updateData)
    .eq('id', id)
    .eq('site_id', siteId)
    .eq('version', version)
    .select()
    .single()

  if (error || !updated) return { ok: false, error: 'Version conflict or item not found' }
  revalidateTag('layout-counts')
  revalidatePath('/cms/pipeline/research')
  return { ok: true, data: updated }
}

export async function updateResearchStatus(
  id: string,
  status: ResearchStatus,
  version?: number,
): Promise<ActionResult> {
  if (!UUID_RE.test(id)) return { ok: false, error: 'Invalid id' }
  if (!RESEARCH_STATUS.includes(status)) return { ok: false, error: `Invalid status: ${status}` }
  const { siteId } = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  let query = supabase
    .from('research_items')
    .update({ status })
    .eq('id', id)
    .eq('site_id', siteId)

  if (version !== undefined) {
    query = query.eq('version', version)
  }

  const { data: updated, error } = await query
    .select('id, status, version')
    .single()

  if (error || !updated) return { ok: false, error: version !== undefined ? 'Version conflict or item not found' : 'Item not found' }
  revalidateTag('layout-counts')
  revalidatePath('/cms/pipeline/research')
  return { ok: true, data: updated }
}

/**
 * @deprecated The topic-tree hierarchy is being replaced by the 3-tab
 * strategic system (Foco / Pesquisas / Decisões). This action is kept only
 * for backward compatibility with research-picker.tsx. Use theme_id on the
 * research item instead of topic_id going forward.
 */
export async function moveResearchToTopic(
  id: string,
  topicId: string,
): Promise<ActionResult> {
  if (!UUID_RE.test(id)) return { ok: false, error: 'Invalid id' }
  const { siteId } = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { data: topic } = await supabase
    .from('research_topics')
    .select('id')
    .eq('id', topicId)
    .eq('site_id', siteId)
    .single()

  if (!topic) return { ok: false, error: 'Target topic not found' }

  const { data: updated, error } = await supabase
    .from('research_items')
    .update({ topic_id: topicId })
    .eq('id', id)
    .eq('site_id', siteId)
    .select('id, topic_id, version')
    .single()

  if (error || !updated) return { ok: false, error: 'Item not found' }
  revalidatePath('/cms/pipeline/research')
  return { ok: true, data: updated }
}

/**
 * Create a blank research item and return its id, so the caller can open it
 * immediately in edit mode ("Nova pesquisa"). Defaults: source 'thiago',
 * status 'fresca', empty content. theme_id is required NOT NULL on the table,
 * so we seed the catch-all 'canal' theme; the user can change it in the editor.
 */
export async function createBlankResearchItem(): Promise<ActionResultTyped<{ id: string }>> {
  const { siteId } = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  // UNIQUE(site_id, theme_id, title) — disambiguate the default title so two
  // rapid "Nova pesquisa" clicks don't collide.
  const title = `Nova pesquisa ${new Date().toISOString().slice(11, 19)}`

  const { data: created, error } = await supabase
    .from('research_items')
    .insert({
      site_id: siteId,
      theme_id: 'canal',
      title,
      source: 'thiago',
      status: 'fresca',
      content_md: '',
      content_json: null,
      summary: null,
      sources: [],
      takeaways: [],
      pinned: false,
    })
    .select('id')
    .single()

  if (error || !created) return { ok: false, error: error?.message ?? 'Insert failed' }

  revalidateTag('layout-counts')
  revalidatePath('/cms/pipeline/research')
  return { ok: true, data: { id: created.id as string } }
}

export async function deleteResearchItem(id: string): Promise<ActionResult> {
  if (!UUID_RE.test(id)) return { ok: false, error: 'Invalid id' }
  const { siteId } = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { error } = await supabase
    .from('research_items')
    .delete()
    .eq('id', id)
    .eq('site_id', siteId)

  if (error) return { ok: false, error: error.message }
  revalidateTag('layout-counts')
  revalidatePath('/cms/pipeline/research')
  return { ok: true }
}

/** @deprecated Topic tree hierarchy replaced by theme-based filtering in the 3-tab redesign. */
export async function createResearchTopic(
  input: Record<string, unknown>,
): Promise<ActionResult> {
  const parsed = ResearchTopicCreateSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }

  const { siteId } = await requireEditAccess()
  const supabase = getSupabaseServiceClient()
  const { name, slug, parent_id, color, icon } = parsed.data

  let parentPath = ''
  let depth = 0

  if (parent_id) {
    const { data: parent } = await supabase
      .from('research_topics')
      .select('path, depth')
      .eq('id', parent_id)
      .eq('site_id', siteId)
      .single()

    if (!parent) return { ok: false, error: 'Parent topic not found' }
    if (parent.depth >= 2) return { ok: false, error: 'Max 3 levels' }
    parentPath = parent.path
    depth = parent.depth + 1
  }

  const path = parentPath ? `${parentPath}/${slug}` : slug

  const { data: topic, error } = await supabase
    .from('research_topics')
    .insert({ site_id: siteId, name, slug, path, depth, parent_id: parent_id ?? null, color, icon })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return { ok: false, error: 'Topic already exists at this path' }
    return { ok: false, error: error.message }
  }

  revalidatePath('/cms/pipeline/research')
  return { ok: true, data: topic }
}

/** @deprecated Topic tree hierarchy replaced by theme-based filtering in the 3-tab redesign. */
export async function updateResearchTopic(
  id: string,
  input: Record<string, unknown>,
): Promise<ActionResult> {
  if (!UUID_RE.test(id)) return { ok: false, error: 'Invalid id' }
  const parsed = ResearchTopicUpdateSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }

  const { siteId } = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const updateData: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value !== undefined) updateData[key] = value
  }

  if (Object.keys(updateData).length === 0) return { ok: false, error: 'No fields to update' }

  const { data: updated, error } = await supabase
    .from('research_topics')
    .update(updateData)
    .eq('id', id)
    .eq('site_id', siteId)
    .select()
    .single()

  if (error || !updated) return { ok: false, error: 'Topic not found' }
  revalidatePath('/cms/pipeline/research')
  return { ok: true, data: updated }
}

/** @deprecated Topic tree hierarchy replaced by theme-based filtering in the 3-tab redesign. */
export async function deleteResearchTopic(id: string): Promise<ActionResult> {
  if (!UUID_RE.test(id)) return { ok: false, error: 'Invalid id' }
  const { siteId } = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { error } = await supabase
    .from('research_topics')
    .delete()
    .eq('id', id)
    .eq('site_id', siteId)

  if (error) return { ok: false, error: error.message }
  revalidateTag('layout-counts')
  revalidatePath('/cms/pipeline/research')
  return { ok: true }
}

export async function linkResearchToItem(
  researchId: string,
  pipelineItemId: string,
  note?: string,
): Promise<ActionResult> {
  const { siteId } = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const parsed = ResearchLinkSchema.safeParse({ pipeline_item_id: pipelineItemId, note })
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }

  const { data: researchItem } = await supabase
    .from('research_items')
    .select('id')
    .eq('id', researchId)
    .eq('site_id', siteId)
    .single()

  if (!researchItem) return { ok: false, error: 'Research item not found' }

  const { data: pipelineCheck } = await supabase
    .from('content_pipeline')
    .select('id')
    .eq('id', pipelineItemId)
    .eq('site_id', siteId)
    .single()

  if (!pipelineCheck) return { ok: false, error: 'Pipeline item not found' }

  const { data: link, error } = await supabase
    .from('research_links')
    .insert({
      research_id: researchId,
      pipeline_item_id: pipelineItemId,
      note: note ?? null,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return { ok: false, error: 'Already linked' }
    return { ok: false, error: error.message }
  }

  revalidatePath('/cms/pipeline/research')
  return { ok: true, data: link }
}

export async function unlinkResearchFromItem(linkId: string): Promise<ActionResult> {
  if (!UUID_RE.test(linkId)) return { ok: false, error: 'Invalid id' }
  const { siteId } = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { data: link } = await supabase
    .from('research_links')
    .select('id, research_items!inner(site_id)')
    .eq('id', linkId)
    .single()

  const linkWithResearch = link as { id: string; research_items?: { site_id: string } } | null
  if (!linkWithResearch || linkWithResearch.research_items?.site_id !== siteId) {
    return { ok: false, error: 'Link not found' }
  }

  const { error } = await supabase
    .from('research_links')
    .delete()
    .eq('id', linkId)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/pipeline/research')
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Supabase row shapes for getResearchItemFull — cast once after .single()
// ---------------------------------------------------------------------------

/** Shape returned by the research_items .select() with joined research_topics. */
interface ResearchItemRow {
  id: string
  title: string
  topic_id: string | null
  theme_id: string
  source: string
  summary: string | null
  content_json: Record<string, unknown> | null
  content_md: string | null
  content_html: string | null
  status: string
  word_count: number | null
  read_min: number | null
  pinned: boolean | null
  takeaways: string[] | null
  sources: ResearchItemFull['sources'] | null
  version: number
  created_at: string
  updated_at: string
  research_topics: { path: string; name: string; icon: string | null } | null
}

/** Shape returned by the research_links .select() with joined content_pipeline. */
interface ResearchLinkRow {
  id: string
  pipeline_item_id: string
  note: string | null
  content_pipeline: {
    id: string
    title_pt: string | null
    title_en: string | null
    format: string | null
    stage: string | null
  } | null
}

/**
 * Fetch a full research item by ID for the CMS document view.
 * Unlike the pipeline API route (which uses pipeline key auth and returns
 * a different shape), this action uses CMS session auth and returns data
 * matching the ResearchItemFull type expected by ResearchDoc.
 */
export async function getResearchItemFull(
  id: string,
): Promise<ActionResultTyped<ResearchItemFull>> {
  if (!UUID_RE.test(id)) return { ok: false, error: 'Invalid id' }

  const { siteId } = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { data: raw, error } = await supabase
    .from('research_items')
    .select('id, title, topic_id, theme_id, source, summary, content_json, content_md, content_html, status, word_count, read_min, pinned, takeaways, sources, version, created_at, updated_at, research_topics(path, name, icon)')
    .eq('id', id)
    .eq('site_id', siteId)
    .single()

  if (error || !raw) return { ok: false, error: 'Item not found' }

  const item = raw as unknown as ResearchItemRow

  // Fetch linked pipeline items
  const { data: rawLinks } = await supabase
    .from('research_links')
    .select('id, pipeline_item_id, note, content_pipeline(id, title_pt, title_en, format, stage)')
    .eq('research_id', id)

  const links = (rawLinks ?? []) as unknown as ResearchLinkRow[]

  const linkedItems: ResearchLinkedItem[] = links.map((l) => ({
    link_id: l.id,
    pipeline_item_id: l.pipeline_item_id,
    note: l.note,
    title: l.content_pipeline?.title_pt ?? l.content_pipeline?.title_en ?? '',
    format: l.content_pipeline?.format ?? undefined,
    stage: l.content_pipeline?.stage ?? undefined,
  }))

  const topic = item.research_topics

  const full: ResearchItemFull = {
    id: item.id,
    title: item.title,
    topic_id: item.topic_id,
    theme_id: item.theme_id as ResearchItemFull['theme_id'],
    source: item.source as ResearchItemFull['source'],
    summary: item.summary,
    content_json: item.content_json,
    content_md: item.content_md,
    content_html: item.content_html,
    status: item.status as ResearchItemFull['status'],
    word_count: item.word_count ?? 0,
    read_min: item.read_min ?? 0,
    pinned: item.pinned ?? false,
    takeaways: Array.isArray(item.takeaways) ? item.takeaways : [],
    sources: Array.isArray(item.sources) ? item.sources : [],
    version: item.version,
    created_at: item.created_at,
    updated_at: item.updated_at,
    topic_path: topic?.path,
    topic_name: topic?.name,
    topic_icon: topic?.icon ?? undefined,
    linked_items: linkedItems,
  }

  return { ok: true, data: full }
}
