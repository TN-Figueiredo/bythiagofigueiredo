'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import {
  ResearchItemUpdateSchema,
  ResearchTopicCreateSchema,
  ResearchTopicUpdateSchema,
  ResearchLinkSchema,
  type ResearchStatus,
} from '@/lib/pipeline/research-schemas'

type ActionResult = { ok: true; data?: Record<string, unknown> } | { ok: false; error: string }

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
  revalidatePath('/cms/library/research')
  return { ok: true, data: updated }
}

export async function updateResearchStatus(
  id: string,
  status: ResearchStatus,
  version?: number,
): Promise<ActionResult> {
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
  revalidatePath('/cms/library/research')
  return { ok: true, data: updated }
}

export async function moveResearchToTopic(
  id: string,
  topicId: string,
): Promise<ActionResult> {
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
  revalidatePath('/cms/library/research')
  return { ok: true, data: updated }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
  revalidatePath('/cms/library/research')
  return { ok: true }
}

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

  revalidatePath('/cms/library/research')
  return { ok: true, data: topic }
}

export async function updateResearchTopic(
  id: string,
  input: Record<string, unknown>,
): Promise<ActionResult> {
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
  revalidatePath('/cms/library/research')
  return { ok: true, data: updated }
}

export async function deleteResearchTopic(id: string): Promise<ActionResult> {
  const { siteId } = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { error } = await supabase
    .from('research_topics')
    .delete()
    .eq('id', id)
    .eq('site_id', siteId)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/library/research')
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

  revalidatePath('/cms/library/research')
  return { ok: true, data: link }
}

export async function unlinkResearchFromItem(linkId: string): Promise<ActionResult> {
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
  revalidatePath('/cms/library/research')
  return { ok: true }
}
