// apps/web/src/app/cms/(authed)/pipeline/actions.ts
'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { PipelineItemCreateSchema, PipelineItemUpdateSchema, CollectionCreateSchema, CollectionUpdateSchema } from '@/lib/pipeline/schemas'
import { generateCode, DEFAULT_CHECKLISTS, getNextStage, getPreviousStage } from '@/lib/pipeline/workflows'
import type { Format } from '@/lib/pipeline/schemas'

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

export async function createPipelineItem(input: Record<string, unknown>): Promise<ActionResult> {
  const parsed = PipelineItemCreateSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }

  const { siteId } = await requireEditAccess()
  const supabase = getSupabaseServiceClient()
  const data = parsed.data
  const format = data.format as Format
  const title = data.title_pt || data.title_en || 'untitled'
  const code = data.code || generateCode(format, title, data.format_metadata)

  const { data: item, error } = await supabase
    .from('content_pipeline')
    .insert({
      site_id: siteId,
      code,
      title_pt: data.title_pt || null,
      title_en: data.title_en || null,
      format,
      stage: data.stage || 'idea',
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
    })
    .select()
    .single()

  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/pipeline')
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
  return { ok: true, data: updated }
}

export async function advancePipelineItem(id: string, version: number): Promise<ActionResult> {
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

  const next = getNextStage(item.format as Format, item.stage)
  if (!next) return { ok: false, error: 'Already at final stage' }

  const { data: updated, error } = await supabase
    .from('content_pipeline')
    .update({ stage: next })
    .eq('id', id)
    .eq('version', version)
    .select()
    .single()

  if (error || !updated) return { ok: false, error: 'Version conflict' }
  revalidatePath('/cms/pipeline')
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
    .eq('version', version)
    .select()
    .single()

  if (error || !updated) return { ok: false, error: 'Version conflict' }
  revalidatePath('/cms/pipeline')
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

  const checklist = [...(item.production_checklist as any[] || [])]
  if (index >= checklist.length) return { ok: false, error: 'Index out of bounds' }
  checklist[index] = { ...checklist[index], done, toggled_at: new Date().toISOString() }

  const { data: updated, error } = await supabase
    .from('content_pipeline')
    .update({ production_checklist: checklist })
    .eq('id', id)
    .select()
    .single()

  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/pipeline')
  return { ok: true, data: updated }
}

export async function createCollection(input: Record<string, unknown>): Promise<ActionResult> {
  const parsed = CollectionCreateSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }

  const { siteId } = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { data, error } = await supabase
    .from('content_collections')
    .insert({ site_id: siteId, ...parsed.data })
    .select()
    .single()

  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/pipeline/collections')
  return { ok: true, data }
}

export async function updateCollection(id: string, input: Record<string, unknown>): Promise<ActionResult> {
  const parsed = CollectionUpdateSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }

  const { siteId } = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { data, error } = await supabase
    .from('content_collections')
    .update(parsed.data)
    .eq('id', id)
    .eq('site_id', siteId)
    .select()
    .single()

  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/pipeline/collections')
  return { ok: true, data }
}

export async function addToCollection(pipelineId: string, collectionId: string, position?: number): Promise<ActionResult> {
  await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { error } = await supabase
    .from('content_pipeline_memberships')
    .upsert(
      { pipeline_id: pipelineId, collection_id: collectionId, position: position ?? 0 },
      { onConflict: 'pipeline_id,collection_id' }
    )

  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/pipeline')
  return { ok: true }
}

export async function removeFromCollection(pipelineId: string, collectionId: string): Promise<ActionResult> {
  await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { error } = await supabase
    .from('content_pipeline_memberships')
    .delete()
    .eq('pipeline_id', pipelineId)
    .eq('collection_id', collectionId)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/pipeline')
  return { ok: true }
}

export async function upsertReference(key: string, input: { title: string; content_md?: string; content_compact?: Record<string, unknown> }): Promise<ActionResult> {
  const { siteId } = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { data, error } = await supabase
    .from('reference_content')
    .upsert(
      { site_id: siteId, key, title: input.title, content_md: input.content_md ?? null, content_compact: input.content_compact ?? null, updated_at: new Date().toISOString() },
      { onConflict: 'site_id,key' }
    )
    .select()
    .single()

  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/pipeline/reference')
  return { ok: true, data }
}
