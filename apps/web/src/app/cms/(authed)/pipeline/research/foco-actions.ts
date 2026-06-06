'use server'

import { z } from 'zod'
import { revalidatePath, revalidateTag } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import {
  ResearchFocoCreateSchema,
  ResearchFocoUpdateSchema,
  ResearchFocoFullSchema,
} from '@/lib/pipeline/research-schemas'

type ActionResult = { ok: true; data?: Record<string, unknown> } | { ok: false; error: string }

function zodError(err: z.ZodError): string {
  return err.issues.map((i) => i.message).join(', ') || 'Validation failed'
}

async function requireEditAccess() {
  const { siteId } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')
  return { siteId }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function revalidateResearch() {
  revalidateTag('layout-counts')
  revalidatePath('/cms/pipeline/research')
}

// ---------------------------------------------------------------------------
// Helpers — diff-sync junction tables
// ---------------------------------------------------------------------------

async function syncFocoThemes(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  focoId: string,
  siteId: string,
  themeIds: string[],
) {
  const { data: existing } = await supabase
    .from('research_foco_themes')
    .select('theme_id')
    .eq('foco_id', focoId)

  const existingSet = new Set((existing ?? []).map((r: { theme_id: string }) => r.theme_id))
  const desiredSet = new Set(themeIds)

  const toAdd = themeIds.filter((t) => !existingSet.has(t))
  const toRemove = [...existingSet].filter((t) => !desiredSet.has(t))

  if (toRemove.length > 0) {
    await supabase.from('research_foco_themes').delete().eq('foco_id', focoId).in('theme_id', toRemove)
  }

  if (toAdd.length > 0) {
    await supabase
      .from('research_foco_themes')
      .insert(toAdd.map((theme_id) => ({ foco_id: focoId, theme_id, site_id: siteId })))
  }
}

async function syncFocoSources(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  focoId: string,
  siteId: string,
  itemIds: string[],
  notes?: Record<string, string>,
) {
  const { data: existing } = await supabase
    .from('research_foco_sources')
    .select('item_id')
    .eq('foco_id', focoId)

  const existingSet = new Set((existing ?? []).map((r: { item_id: string }) => r.item_id))
  const desiredSet = new Set(itemIds)

  const toAdd = itemIds.filter((id) => !existingSet.has(id))
  const toRemove = [...existingSet].filter((id) => !desiredSet.has(id))

  if (toRemove.length > 0) {
    await supabase.from('research_foco_sources').delete().eq('foco_id', focoId).in('item_id', toRemove)
  }

  if (toAdd.length > 0) {
    // Verify all items belong to the same site to prevent cross-site linking
    const { data: validItems } = await supabase
      .from('research_items')
      .select('id')
      .eq('site_id', siteId)
      .in('id', toAdd)

    const validIds = new Set((validItems ?? []).map((r: { id: string }) => r.id))
    const safeToAdd = toAdd.filter((id) => validIds.has(id))

    if (safeToAdd.length > 0) {
      await supabase.from('research_foco_sources').insert(
        safeToAdd.map((item_id) => ({
          foco_id: focoId,
          item_id,
          note: notes?.[item_id] ?? null,
        })),
      )
    }
  }
}

// ---------------------------------------------------------------------------
// createResearchFoco
// ---------------------------------------------------------------------------

export async function createResearchFoco(
  input: Record<string, unknown>,
): Promise<ActionResult> {
  const parsed = ResearchFocoCreateSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }

  const { siteId } = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { theme_ids, pinned_research_ids, pinned_notes, ...focoFields } = parsed.data

  const { data: foco, error } = await supabase
    .from('research_focos')
    .insert({ site_id: siteId, active: false, ...focoFields })
    .select()
    .single()

  if (error || !foco) return { ok: false, error: error?.message ?? 'Insert failed' }

  const focoId = (foco as Record<string, unknown>).id as string

  await syncFocoThemes(supabase, focoId, siteId, theme_ids)
  await syncFocoSources(supabase, focoId, siteId, pinned_research_ids, pinned_notes)

  revalidateResearch()
  return { ok: true, data: foco as Record<string, unknown> }
}

// ---------------------------------------------------------------------------
// updateResearchFoco
// ---------------------------------------------------------------------------

export async function updateResearchFoco(
  id: string,
  input: Record<string, unknown>,
): Promise<ActionResult> {
  if (!UUID_RE.test(id)) return { ok: false, error: 'Invalid id' }

  const parsed = ResearchFocoUpdateSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }

  const { siteId } = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { theme_ids, pinned_research_ids, pinned_notes, ...focoFields } = parsed.data

  // Verify ownership before any mutation
  const { data: owned } = await supabase
    .from('research_focos')
    .select('id')
    .eq('id', id)
    .eq('site_id', siteId)
    .single()

  if (!owned) return { ok: false, error: 'Foco not found' }

  const updateData: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(focoFields)) {
    if (value !== undefined) updateData[key] = value
  }

  if (Object.keys(updateData).length > 0) {
    const { error } = await supabase
      .from('research_focos')
      .update(updateData)
      .eq('id', id)
      .eq('site_id', siteId)

    if (error) return { ok: false, error: 'Update failed' }
  }

  if (theme_ids !== undefined) await syncFocoThemes(supabase, id, siteId, theme_ids)
  if (pinned_research_ids !== undefined) await syncFocoSources(supabase, id, siteId, pinned_research_ids, pinned_notes)

  revalidateResearch()
  return { ok: true }
}

// ---------------------------------------------------------------------------
// activateResearchFoco — calls atomic DB RPC to demote previous + activate
// ---------------------------------------------------------------------------

export async function activateResearchFoco(id: string): Promise<ActionResult> {
  if (!UUID_RE.test(id)) return { ok: false, error: 'Invalid id' }

  const { siteId } = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  // Verify ownership before calling RPC
  const { data: foco } = await supabase
    .from('research_focos')
    .select('id')
    .eq('id', id)
    .eq('site_id', siteId)
    .single()

  if (!foco) return { ok: false, error: 'Foco not found' }

  const { error } = await supabase.rpc('activate_research_foco', {
    p_foco_id: id,
    p_site_id: siteId,
  })

  if (error) return { ok: false, error: error.message }

  revalidateResearch()
  return { ok: true }
}

// ---------------------------------------------------------------------------
// archiveResearchFoco
// ---------------------------------------------------------------------------

export async function archiveResearchFoco(id: string): Promise<ActionResult> {
  if (!UUID_RE.test(id)) return { ok: false, error: 'Invalid id' }

  const { siteId } = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { data: updated, error } = await supabase
    .from('research_focos')
    .update({ state: 'arquivado', active: false })
    .eq('id', id)
    .eq('site_id', siteId)
    .select('id, state, active')
    .single()

  if (error || !updated) return { ok: false, error: 'Foco not found' }

  revalidateResearch()
  return { ok: true, data: updated as Record<string, unknown> }
}

// ---------------------------------------------------------------------------
// saveFocoFull — upsert + full junction diff-sync via RPC
// Falls back to manual upsert + sync if RPC not available.
// ---------------------------------------------------------------------------

export async function saveFocoFull(input: Record<string, unknown>): Promise<ActionResult> {
  const parsed = ResearchFocoFullSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }

  const { siteId } = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { id, theme_ids, pinned_research_ids, pinned_notes, ...focoFields } = parsed.data

  // Try DB RPC first (atomic upsert + diff-sync)
  const { data: rpcResult, error: rpcError } = await supabase.rpc('save_research_foco_full', {
    p_site_id: siteId,
    p_foco_id: id ?? null,
    p_title: focoFields.title,
    p_description: focoFields.description ?? null,
    p_state: focoFields.state ?? 'rascunho',
    p_rationale: focoFields.rationale ?? null,
    p_metric: focoFields.metric ?? null,
    p_window_label: focoFields.window_label ?? null,
    p_horizon: focoFields.horizon ?? 'agora',
    p_theme_ids: theme_ids ?? [],
    p_item_ids: pinned_research_ids ?? [],
    p_item_notes: pinned_notes ?? {},
    p_activate: false,
  })

  if (!rpcError && rpcResult) {
    revalidateResearch()
    return { ok: true, data: rpcResult as Record<string, unknown> }
  }

  // Fallback: manual insert/update + sync (when RPC not yet deployed)
  let focoId: string

  if (id) {
    // Verify ownership before updating existing foco
    const { data: existing } = await supabase
      .from('research_focos')
      .select('id')
      .eq('id', id)
      .eq('site_id', siteId)
      .single()

    if (!existing) return { ok: false, error: 'Foco not found' }

    const { error: updateError } = await supabase
      .from('research_focos')
      .update(focoFields)
      .eq('id', id)
      .eq('site_id', siteId)

    if (updateError) return { ok: false, error: updateError.message }
    focoId = id
  } else {
    const { data: foco, error: insertError } = await supabase
      .from('research_focos')
      .insert({ site_id: siteId, active: false, ...focoFields })
      .select('id')
      .single()

    if (insertError || !foco) return { ok: false, error: insertError?.message ?? 'Insert failed' }
    focoId = (foco as Record<string, unknown>).id as string
  }

  await syncFocoThemes(supabase, focoId, siteId, theme_ids ?? [])
  await syncFocoSources(supabase, focoId, siteId, pinned_research_ids ?? [], pinned_notes)

  revalidateResearch()
  return { ok: true, data: { id: focoId } }
}
