// apps/web/src/app/cms/(authed)/pipeline/actions.ts
'use server'

import { z } from 'zod'
import { revalidatePath, revalidateTag } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { PipelineItemCreateSchema, PipelineItemUpdateSchema } from '@/lib/pipeline/schemas'
import { generateCode, DEFAULT_CHECKLISTS, getNextStage, getPreviousStage } from '@/lib/pipeline/workflows'
import type { Format } from '@/lib/pipeline/schemas'
import type { PipelineItem } from '@/lib/pipeline/graduation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ActionResult = { ok: true; data?: any } | { ok: false; error: string }

function zodError(err: z.ZodError): string {
  return err.issues.map((i) => i.message).join(', ') || 'Validation failed'
}

async function requireEditAccess() {
  const { siteId, timezone } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')
  return { siteId, timezone }
}

export async function reorderPipelineItem(
  id: string,
  version: number,
  input: { stage?: string; sort_order: number }
): Promise<ActionResult> {
  const { siteId } = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const updateData: Record<string, unknown> = { sort_order: input.sort_order }
  if (input.stage) updateData.stage = input.stage

  const { data: updated, error } = await supabase
    .from('content_pipeline')
    .update(updateData)
    .eq('id', id)
    .eq('site_id', siteId)
    .eq('version', version)
    .select('id, version, stage, sort_order')
    .single()

  if (error || !updated) return { ok: false, error: 'Version conflict or item not found' }
  return { ok: true, data: updated }
}

export async function createPipelineItem(input: Record<string, unknown>): Promise<ActionResult> {
  const parsed = PipelineItemCreateSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }

  const { siteId } = await requireEditAccess()
  const supabase = getSupabaseServiceClient()
  const data = parsed.data
  const format = data.format as Format
  const title = data.title_pt || data.title_en || 'untitled'
  const code = data.code || generateCode(format, title, data.format_metadata)
  const stage = data.stage || 'idea'

  const { data: maxOrder } = await supabase
    .from('content_pipeline')
    .select('sort_order')
    .eq('site_id', siteId)
    .eq('format', format)
    .eq('stage', stage)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single()

  const newSortOrder = (maxOrder?.sort_order ?? 0) + 1000

  const { data: item, error } = await supabase
    .from('content_pipeline')
    .insert({
      site_id: siteId,
      code,
      title_pt: data.title_pt || null,
      title_en: data.title_en || null,
      format,
      stage,
      language: data.language,
      priority: data.priority,
      parent_id: data.parent_id || null,
      hook: data.hook || null,
      synopsis: data.synopsis || null,
      body_content: data.body_content || null,
      format_metadata: data.format_metadata,
      production_checklist: data.production_checklist || DEFAULT_CHECKLISTS[format],
      tags: data.tags,
      assigned_to: data.assigned_to || null,
      sort_order: newSortOrder,
    })
    .select()
    .single()

  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/pipeline')
  revalidateTag('pipeline-blog')
  return { ok: true, data: item }
}

export async function updatePipelineItem(id: string, version: number, input: Record<string, unknown>): Promise<ActionResult> {
  const parsed = PipelineItemUpdateSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }

  const { siteId } = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const updateData: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value !== undefined) updateData[key] = value
  }

  const { data: updated, error } = await supabase
    .from('content_pipeline')
    .update(updateData)
    .eq('id', id)
    .eq('site_id', siteId)
    .eq('version', version)
    .select()
    .single()

  if (error || !updated) return { ok: false, error: 'Version conflict or item not found' }
  revalidatePath('/cms/pipeline')
  revalidateTag('pipeline-blog')
  return { ok: true, data: updated }
}

export async function advancePipelineItem(id: string, version: number): Promise<ActionResult> {
  const { siteId, timezone } = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { data: item } = await supabase
    .from('content_pipeline')
    .select('id, format, stage, version, social_config, social_post_id')
    .eq('id', id)
    .eq('site_id', siteId)
    .single()

  if (!item) return { ok: false, error: 'Item not found' }
  if (item.version !== version) return { ok: false, error: 'Version conflict' }

  const next = getNextStage(item.format as Format, item.stage)
  if (!next) return { ok: false, error: 'Already at final stage' }

  const { data: updated, error } = await supabase
    .from('content_pipeline')
    .update({ stage: next })
    .eq('id', id)
    .eq('site_id', siteId)
    .eq('version', version)
    .select()
    .single()

  if (error || !updated) return { ok: false, error: 'Version conflict' }

  let graduationResult: { postId: string; isDraft: boolean } | null = null
  const isFinal = getNextStage(item.format as Format, next) === null
  const socialConfig = item.social_config as Record<string, unknown> | null
  if (isFinal && socialConfig?.enabled === true && !item.social_post_id) {
    try {
      const { graduateToSocialPost } = await import('@/lib/pipeline/graduation')
      const result = await graduateToSocialPost(supabase, updated as unknown as PipelineItem, siteId, timezone)
      if (result.ok) {
        graduationResult = result.data
      }
    } catch (err) {
      const Sentry = await import('@sentry/nextjs')
      Sentry.captureException(err, {
        tags: { component: 'pipeline-actions', action: 'auto-graduation' },
        extra: { pipelineId: id, stage: next },
      })
    }
  }

  revalidatePath('/cms/pipeline')
  revalidateTag('pipeline-blog')
  if (graduationResult) revalidatePath('/cms/social')
  return { ok: true, data: { ...updated, graduationResult } }
}

export async function movePipelineItemToStage(
  id: string,
  version: number,
  targetStage: string,
): Promise<ActionResult> {
  const { siteId } = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const validStages = ['idea', 'draft', 'ready']
  if (!validStages.includes(targetStage)) {
    return { ok: false, error: `Invalid stage: ${targetStage}` }
  }

  const { data: updated, error } = await supabase
    .from('content_pipeline')
    .update({ stage: targetStage })
    .eq('id', id)
    .eq('site_id', siteId)
    .eq('version', version)
    .select('id, version, stage, sort_order')
    .single()

  if (error || !updated) return { ok: false, error: 'Version conflict or item not found' }
  revalidatePath('/cms/pipeline')
  revalidateTag('pipeline-blog')
  revalidatePath('/cms/blog')
  return { ok: true, data: updated }
}

export async function retreatPipelineItem(id: string, version: number): Promise<ActionResult> {
  const { siteId } = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { data: item } = await supabase
    .from('content_pipeline')
    .select('id, format, stage, version')
    .eq('id', id)
    .eq('site_id', siteId)
    .single()

  if (!item) return { ok: false, error: 'Item not found' }
  if (item.version !== version) return { ok: false, error: 'Version conflict' }

  const prev = getPreviousStage(item.format as Format, item.stage)
  if (!prev) return { ok: false, error: 'Already at first stage' }

  const { data: updated, error } = await supabase
    .from('content_pipeline')
    .update({ stage: prev })
    .eq('id', id)
    .eq('site_id', siteId)
    .eq('version', version)
    .select()
    .single()

  if (error || !updated) return { ok: false, error: 'Version conflict' }
  revalidatePath('/cms/pipeline')
  revalidateTag('pipeline-blog')
  return { ok: true, data: updated }
}

export async function archivePipelineItem(id: string): Promise<ActionResult> {
  const { siteId } = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { error } = await supabase
    .from('content_pipeline')
    .update({ is_archived: true, archived_at: new Date().toISOString() })
    .eq('id', id)
    .eq('site_id', siteId)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/pipeline')
  revalidateTag('pipeline-blog')
  return { ok: true }
}

export async function restorePipelineItem(id: string): Promise<ActionResult> {
  const { siteId } = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { data: updated, error } = await supabase
    .from('content_pipeline')
    .update({ is_archived: false, archived_at: null, archive_reason: null })
    .eq('id', id)
    .eq('site_id', siteId)
    .select()
    .single()

  if (error || !updated) return { ok: false, error: 'Item not found' }
  revalidatePath('/cms/pipeline')
  revalidateTag('pipeline-blog')
  return { ok: true, data: updated }
}

export async function toggleChecklist(id: string, index: number, done: boolean): Promise<ActionResult> {
  const { siteId } = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { data: item } = await supabase
    .from('content_pipeline')
    .select('id, production_checklist')
    .eq('id', id)
    .eq('site_id', siteId)
    .single()

  if (!item) return { ok: false, error: 'Item not found' }

  const checklist = [...((item.production_checklist ?? []) as Array<{ label: string; done: boolean; toggled_at?: string }>)]
  if (index >= checklist.length) return { ok: false, error: 'Index out of bounds' }
  const current = checklist[index]!
  checklist[index] = { label: current.label, done, toggled_at: new Date().toISOString() }

  const { data: updated, error } = await supabase
    .from('content_pipeline')
    .update({ production_checklist: checklist })
    .eq('id', id)
    .select()
    .single()

  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/pipeline')
  revalidateTag('pipeline-blog')
  return { ok: true, data: updated }
}

export async function searchBlogPostsAction(siteId: string, query: string): Promise<Array<{
  id: string
  title: string
  locale: string
  status: string
  linked_to_code: string | null
}>> {
  await requireEditAccess()
  const { searchBlogPostsForLink } = await import('@/lib/pipeline/blog-link')
  return searchBlogPostsForLink(siteId, query)
}

export async function upsertReference(key: string, input: { title: string; content_md?: string; content_compact?: Record<string, unknown>; ref_group?: string; sort_order?: number }): Promise<ActionResult> {
  const { siteId } = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const upsertData: Record<string, unknown> = {
    site_id: siteId,
    key,
    title: input.title,
    content_md: input.content_md ?? null,
    content_compact: input.content_compact ?? null,
    updated_at: new Date().toISOString(),
  }
  if (input.ref_group !== undefined) upsertData.ref_group = input.ref_group
  if (input.sort_order !== undefined) upsertData.sort_order = input.sort_order

  const { data, error } = await supabase
    .from('reference_content')
    .upsert(upsertData, { onConflict: 'site_id,key' })
    .select()
    .single()

  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/pipeline/reference')
  return { ok: true, data }
}
