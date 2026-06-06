'use server'

import { z } from 'zod'
import { revalidatePath, revalidateTag } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import {
  ResearchDecisionCreateSchema,
  ResearchDecisionUpdateSchema,
  DECISION_STATUS,
} from '@/lib/pipeline/research-schemas'
import { DECISION_STATUS_META } from '@/lib/pipeline/research-types'

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
// createResearchDecision
// ---------------------------------------------------------------------------

export async function createResearchDecision(
  input: Record<string, unknown>,
): Promise<ActionResult> {
  const parsed = ResearchDecisionCreateSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }

  const { siteId } = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { source_research_ids, source_notes, ...decisionFields } = parsed.data

  // Default the display date so the fullscreen eyebrow always shows something.
  const dateLabel = decisionFields.date_label ?? 'hoje'

  // Seed history with the initial status entry when none was provided. Store a
  // real ISO timestamp on `date` so the timeline can render chronologically;
  // the UI keeps a 'hoje'-style display fallback.
  const seededHistory =
    decisionFields.history && decisionFields.history.length > 0
      ? decisionFields.history
      : [
          {
            label: DECISION_STATUS_META[decisionFields.status].label,
            date: new Date().toISOString(),
            note: 'Decisão registrada.',
          },
        ]

  const { data: decision, error } = await supabase
    .from('research_decisions')
    .insert({
      site_id: siteId,
      ...decisionFields,
      date_label: dateLabel,
      history: seededHistory,
    })
    .select()
    .single()

  if (error || !decision) return { ok: false, error: error?.message ?? 'Insert failed' }

  // Link research items via junction table
  if (source_research_ids.length > 0) {
    // Verify all research items belong to the same site
    const { data: validItems } = await supabase
      .from('research_items')
      .select('id')
      .eq('site_id', siteId)
      .in('id', source_research_ids)

    const validIds = new Set((validItems ?? []).map((r: { id: string }) => r.id))
    const filteredIds = source_research_ids.filter((id) => validIds.has(id))

    if (filteredIds.length > 0) {
      const junctionRows = filteredIds.map((researchId) => ({
        decision_id: decision.id as string,
        research_id: researchId,
        note: source_notes?.[researchId] ?? null,
      }))

      const { error: junctionError } = await supabase
        .from('research_decision_sources')
        .insert(junctionRows)

      if (junctionError) return { ok: false, error: junctionError.message }
    }
  }

  revalidateResearch()
  return { ok: true, data: decision as Record<string, unknown> }
}

// ---------------------------------------------------------------------------
// updateResearchDecision
// ---------------------------------------------------------------------------

export async function updateResearchDecision(
  id: string,
  input: Record<string, unknown>,
): Promise<ActionResult> {
  if (!UUID_RE.test(id)) return { ok: false, error: 'Invalid id' }

  const parsed = ResearchDecisionUpdateSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }

  const { siteId } = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { source_research_ids, source_notes, ...decisionFields } = parsed.data

  // Filter out undefined scalar fields
  const updateData: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(decisionFields)) {
    if (value !== undefined) updateData[key] = value
  }

  if (Object.keys(updateData).length > 0) {
    const { data: updated, error } = await supabase
      .from('research_decisions')
      .update(updateData)
      .eq('id', id)
      .eq('site_id', siteId)
      .select()
      .single()

    if (error || !updated) return { ok: false, error: 'Decision not found' }
  }

  // Diff-sync junction table when source_research_ids is provided
  if (source_research_ids !== undefined) {
    // Fetch existing links
    const { data: existing } = await supabase
      .from('research_decision_sources')
      .select('research_id')
      .eq('decision_id', id)

    const existingIds = new Set((existing ?? []).map((r: { research_id: string }) => r.research_id))
    const desiredIds = new Set(source_research_ids)

    const toAdd = source_research_ids.filter((rid) => !existingIds.has(rid))
    const toRemove = [...existingIds].filter((rid) => !desiredIds.has(rid))

    if (toRemove.length > 0) {
      const { error } = await supabase
        .from('research_decision_sources')
        .delete()
        .eq('decision_id', id)
        .in('research_id', toRemove)

      if (error) return { ok: false, error: error.message }
    }

    if (toAdd.length > 0) {
      // Verify all new research items belong to the same site
      const { data: validItems } = await supabase
        .from('research_items')
        .select('id')
        .eq('site_id', siteId)
        .in('id', toAdd)

      const validIds = new Set((validItems ?? []).map((r: { id: string }) => r.id))
      const safeToAdd = toAdd.filter((rid) => validIds.has(rid))

      if (safeToAdd.length > 0) {
        const junctionRows = safeToAdd.map((researchId) => ({
          decision_id: id,
          research_id: researchId,
          note: source_notes?.[researchId] ?? null,
        }))

        const { error } = await supabase
          .from('research_decision_sources')
          .insert(junctionRows)

        if (error) return { ok: false, error: error.message }
      }
    }
  }

  revalidateResearch()
  return { ok: true }
}

// ---------------------------------------------------------------------------
// patchDecisionStatus — change status + append a history row
// ---------------------------------------------------------------------------

type DecisionHistoryEntry = { label: string; date: string; note: string | null }

export async function patchDecisionStatus(
  id: string,
  status: (typeof DECISION_STATUS)[number],
): Promise<ActionResult> {
  if (!UUID_RE.test(id)) return { ok: false, error: 'Invalid id' }
  if (!DECISION_STATUS.includes(status)) return { ok: false, error: 'Invalid status' }

  const { siteId } = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  // Fetch current history so we can append rather than overwrite
  const { data: current } = await supabase
    .from('research_decisions')
    .select('history')
    .eq('id', id)
    .eq('site_id', siteId)
    .single()

  if (!current) return { ok: false, error: 'Decision not found' }

  const prevHistory = Array.isArray((current as { history?: unknown }).history)
    ? ((current as { history: DecisionHistoryEntry[] }).history)
    : []

  const nextHistory: DecisionHistoryEntry[] = [
    ...prevHistory,
    {
      label: DECISION_STATUS_META[status].label,
      date: new Date().toISOString(),
      note: null,
    },
  ]

  const { data: updated, error } = await supabase
    .from('research_decisions')
    .update({ status, history: nextHistory })
    .eq('id', id)
    .eq('site_id', siteId)
    .select('id, status')
    .single()

  if (error || !updated) return { ok: false, error: 'Decision not found' }

  revalidateResearch()
  return { ok: true, data: updated as Record<string, unknown> }
}

// ---------------------------------------------------------------------------
// deleteResearchDecision — soft archive, not hard delete
// ---------------------------------------------------------------------------

export async function deleteResearchDecision(id: string): Promise<ActionResult> {
  if (!UUID_RE.test(id)) return { ok: false, error: 'Invalid id' }

  const { siteId } = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { data: updated, error } = await supabase
    .from('research_decisions')
    .update({ status: 'arquivado' })
    .eq('id', id)
    .eq('site_id', siteId)
    .select('id, status')
    .single()

  if (error || !updated) return { ok: false, error: 'Decision not found' }

  revalidateResearch()
  return { ok: true, data: updated as Record<string, unknown> }
}

// ---------------------------------------------------------------------------
// linkDecisionToResearch — insert single junction row
// ---------------------------------------------------------------------------

export async function linkDecisionToResearch(
  decisionId: string,
  researchId: string,
  note?: string,
): Promise<ActionResult> {
  if (!UUID_RE.test(decisionId)) return { ok: false, error: 'Invalid decisionId' }
  if (!UUID_RE.test(researchId)) return { ok: false, error: 'Invalid researchId' }

  const { siteId } = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  // Verify ownership: decision must belong to this site
  const { data: decision } = await supabase
    .from('research_decisions')
    .select('id')
    .eq('id', decisionId)
    .eq('site_id', siteId)
    .single()

  if (!decision) return { ok: false, error: 'Decision not found' }

  // Verify research item also belongs to the same site
  const { data: researchItem } = await supabase
    .from('research_items')
    .select('id')
    .eq('id', researchId)
    .eq('site_id', siteId)
    .single()

  if (!researchItem) return { ok: false, error: 'Research item not found' }

  const { data: link, error } = await supabase
    .from('research_decision_sources')
    .insert({ decision_id: decisionId, research_id: researchId, note: note ?? null })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return { ok: false, error: 'Already linked' }
    return { ok: false, error: error.message }
  }

  revalidateResearch()
  return { ok: true, data: link as Record<string, unknown> }
}

// ---------------------------------------------------------------------------
// unlinkDecisionFromResearch — delete single junction row
// ---------------------------------------------------------------------------

export async function unlinkDecisionFromResearch(
  decisionId: string,
  researchId: string,
): Promise<ActionResult> {
  if (!UUID_RE.test(decisionId)) return { ok: false, error: 'Invalid decisionId' }
  if (!UUID_RE.test(researchId)) return { ok: false, error: 'Invalid researchId' }

  const { siteId } = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  // Verify ownership via decision
  const { data: decision } = await supabase
    .from('research_decisions')
    .select('id')
    .eq('id', decisionId)
    .eq('site_id', siteId)
    .single()

  if (!decision) return { ok: false, error: 'Decision not found' }

  const { error } = await supabase
    .from('research_decision_sources')
    .delete()
    .eq('decision_id', decisionId)
    .eq('research_id', researchId)

  if (error) return { ok: false, error: error.message }

  revalidateResearch()
  return { ok: true }
}
