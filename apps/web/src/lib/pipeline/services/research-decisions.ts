import { UUID_REGEX } from '@/lib/pipeline/auth'
import {
  ResearchDecisionCreateSchema,
  ResearchDecisionUpdateSchema,
} from '@/lib/pipeline/research-schemas'
import { DECISION_STATUS_META } from '@/lib/pipeline/research-types'
import type { ServiceContext, ServiceResult } from './types'
import { ok, err } from './types'

// ---------------------------------------------------------------------------
// Internal row shapes (untyped Supabase — no generated DB types)
// ---------------------------------------------------------------------------

interface DecisionRow {
  id: string
  title: string
  rationale: string | null
  horizon: string
  status: string
  theme_id: string | null
  date_label: string | null
  drives: string[]
  created_at: string
  updated_at: string
}

interface DecisionSourceRow {
  decision_id: string
  research_id: string
  note: string | null
}

// ---------------------------------------------------------------------------
// Public result shapes
// ---------------------------------------------------------------------------

interface DecisionSource {
  research_id: string
  research_title: string | null
  note: string | null
}

interface DecisionListItem extends DecisionRow {
  source_research_ids: string[]
}

interface DecisionListResult {
  data: DecisionListItem[]
  meta: { total: number; limit: number; offset: number; has_next: boolean }
}

interface DecisionWithSources extends DecisionRow {
  sources: DecisionSource[]
}

interface DecisionDetailResult {
  data: DecisionWithSources
}

// ---------------------------------------------------------------------------
// Filter options
// ---------------------------------------------------------------------------

interface ListDecisionsOptions {
  horizon?: string
  status?: string | string[]
  theme_id?: string
  limit?: number
  offset?: number
}

const DECISION_SELECT =
  'id, title, rationale, horizon, status, theme_id, date_label, drives, created_at, updated_at'

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

/** List research decisions (newest first) with their source_research junction ids. */
export async function listResearchDecisions(
  ctx: ServiceContext,
  opts: ListDecisionsOptions = {},
): Promise<ServiceResult<DecisionListResult>> {
  const { supabase, siteId } = ctx
  const limit = Math.min(opts.limit ?? 50, 200)
  const offset = Math.max(opts.offset ?? 0, 0)

  let query = supabase
    .from('research_decisions')
    .select(DECISION_SELECT, { count: 'exact' })
    .eq('site_id', siteId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + limit - 1)

  if (opts.horizon) {
    query = query.eq('horizon', opts.horizon)
  }

  if (opts.theme_id) {
    query = query.eq('theme_id', opts.theme_id)
  }

  if (opts.status) {
    const statuses = Array.isArray(opts.status) ? opts.status : [opts.status]
    if (statuses.length > 0) query = query.in('status', statuses)
  }

  const { data, error, count } = await query
  if (error) {
    console.error('[decisions/list]', error.message)
    return err('DB_ERROR', 'Failed to load research decisions', 500)
  }

  const decisions = (data ?? []) as unknown as DecisionRow[]

  // Attach source_research ids via junction table
  let sourcesByDecision: Record<string, string[]> = {}
  if (decisions.length > 0) {
    const { data: sources } = await supabase
      .from('research_decision_sources')
      .select('decision_id, research_id, note')
      .in(
        'decision_id',
        decisions.map((d) => d.id),
      )

    sourcesByDecision = (sources ?? []).reduce<Record<string, string[]>>((acc, raw) => {
      const s = raw as DecisionSourceRow
      ;(acc[s.decision_id] ??= []).push(s.research_id)
      return acc
    }, {})
  }

  const mapped: DecisionListItem[] = decisions.map((d) => ({
    ...d,
    source_research_ids: sourcesByDecision[d.id] ?? [],
  }))

  const total = count ?? 0
  return ok({
    data: mapped,
    meta: { total, limit, offset, has_next: offset + mapped.length < total },
  })
}

// ---------------------------------------------------------------------------
// Get single
// ---------------------------------------------------------------------------

/** Get a single research decision by ID, including its linked research sources. */
export async function getResearchDecision(
  ctx: ServiceContext,
  id: string,
): Promise<ServiceResult<DecisionDetailResult>> {
  if (!id) {
    return err('VALIDATION_ERROR', 'Decision ID is required', 400)
  }
  if (!UUID_REGEX.test(id)) {
    return err('VALIDATION_ERROR', 'Invalid decision ID', 400)
  }

  const { supabase, siteId } = ctx

  const { data: decision, error } = await supabase
    .from('research_decisions')
    .select(DECISION_SELECT)
    .eq('id', id)
    .eq('site_id', siteId)
    .single()

  if (error || !decision) {
    return err('NOT_FOUND', 'Research decision not found', 404)
  }

  const { data: rawSources } = await supabase
    .from('research_decision_sources')
    .select('research_id, note')
    .eq('decision_id', id)

  const sourceRows = (rawSources ?? []).map(
    (raw) => raw as Pick<DecisionSourceRow, 'research_id' | 'note'>,
  )

  // Resolve research_title per source so Cowork sees names, not opaque UUIDs.
  let titleMap = new Map<string, string>()
  if (sourceRows.length > 0) {
    const { data: items } = await supabase
      .from('research_items')
      .select('id, title')
      .eq('site_id', siteId)
      .in(
        'id',
        sourceRows.map((s) => s.research_id),
      )
    titleMap = new Map(
      (items ?? []).map((raw) => {
        const i = raw as { id: string; title: string }
        return [i.id, i.title]
      }),
    )
  }

  const sources: DecisionSource[] = sourceRows.map((s) => ({
    research_id: s.research_id,
    research_title: titleMap.get(s.research_id) ?? null,
    note: s.note ?? null,
  }))

  return ok({
    data: { ...(decision as unknown as DecisionRow), sources },
  })
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/**
 * Create a research decision, then populate research_decision_sources from
 * source_research_ids (only items that belong to the same site are linked).
 */
export async function createResearchDecision(
  ctx: ServiceContext,
  input: unknown,
): Promise<ServiceResult<Record<string, unknown>>> {
  const parsed = ResearchDecisionCreateSchema.safeParse(input)
  if (!parsed.success) {
    return err('VALIDATION_ERROR', parsed.error.issues.map((i) => i.message).join(', '), 400)
  }

  const { supabase, siteId } = ctx
  const { source_research_ids, source_notes, ...decisionFields } = parsed.data

  // Seed history with the initial status entry when none was provided, matching
  // the web decision-actions.ts so Cowork- and web-created decisions are
  // consistent (one entry: the status label + creation note).
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
    .insert({ site_id: siteId, ...decisionFields, history: seededHistory })
    .select()
    .single()

  if (error || !decision) {
    console.error('[decisions/create]', error?.message)
    return err('DB_ERROR', error?.message ?? 'Failed to create decision', 500)
  }

  // Link research items via junction table — only those owned by the site
  if (source_research_ids.length > 0) {
    const { data: validItems } = await supabase
      .from('research_items')
      .select('id')
      .eq('site_id', siteId)
      .in('id', source_research_ids)

    const validIds = new Set((validItems ?? []).map((r) => (r as { id: string }).id))
    const filteredIds = source_research_ids.filter((rid) => validIds.has(rid))

    if (filteredIds.length > 0) {
      const junctionRows = filteredIds.map((researchId) => ({
        decision_id: decision.id as string,
        research_id: researchId,
        note: source_notes?.[researchId] ?? null,
      }))

      const { error: junctionError } = await supabase
        .from('research_decision_sources')
        .insert(junctionRows)

      if (junctionError) {
        console.error('[decisions/create/sources]', junctionError.message)
        return err('DB_ERROR', junctionError.message, 500)
      }
    }
  }

  return ok(decision as Record<string, unknown>, 201)
}

// ---------------------------------------------------------------------------
// Update — scalar update + diff-sync junction
// ---------------------------------------------------------------------------

/**
 * Update a research decision's scalar fields, then diff-sync the
 * research_decision_sources junction when source_research_ids is provided.
 */
export async function updateResearchDecision(
  ctx: ServiceContext,
  id: string,
  input: unknown,
): Promise<ServiceResult<{ id: string }>> {
  if (!id) {
    return err('VALIDATION_ERROR', 'Decision ID is required', 400)
  }
  if (!UUID_REGEX.test(id)) {
    return err('VALIDATION_ERROR', 'Invalid decision ID', 400)
  }

  const parsed = ResearchDecisionUpdateSchema.safeParse(input)
  if (!parsed.success) {
    return err('VALIDATION_ERROR', parsed.error.issues.map((i) => i.message).join(', '), 400)
  }

  const { supabase, siteId } = ctx
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
      .select('id')
      .single()

    if (error || !updated) {
      return err('NOT_FOUND', 'Research decision not found', 404)
    }
  } else {
    // No scalar changes: still verify ownership before touching the junction
    const { data: existing } = await supabase
      .from('research_decisions')
      .select('id')
      .eq('id', id)
      .eq('site_id', siteId)
      .single()

    if (!existing) {
      return err('NOT_FOUND', 'Research decision not found', 404)
    }
  }

  // Diff-sync junction table when source_research_ids is provided
  if (source_research_ids !== undefined) {
    const { data: existing } = await supabase
      .from('research_decision_sources')
      .select('research_id')
      .eq('decision_id', id)

    const existingIds = new Set(
      (existing ?? []).map((r) => (r as { research_id: string }).research_id),
    )
    const desiredIds = new Set(source_research_ids)

    const toAdd = source_research_ids.filter((rid) => !existingIds.has(rid))
    const toRemove = [...existingIds].filter((rid) => !desiredIds.has(rid))

    if (toRemove.length > 0) {
      const { error } = await supabase
        .from('research_decision_sources')
        .delete()
        .eq('decision_id', id)
        .in('research_id', toRemove)

      if (error) return err('DB_ERROR', error.message, 500)
    }

    if (toAdd.length > 0) {
      const { data: validItems } = await supabase
        .from('research_items')
        .select('id')
        .eq('site_id', siteId)
        .in('id', toAdd)

      const validIds = new Set((validItems ?? []).map((r) => (r as { id: string }).id))
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

        if (error) return err('DB_ERROR', error.message, 500)
      }
    }
  }

  return ok({ id })
}

// ---------------------------------------------------------------------------
// Archive — soft delete (status: 'arquivado')
// ---------------------------------------------------------------------------

/** Soft-archive a research decision by setting its status to 'arquivado'. */
export async function archiveResearchDecision(
  ctx: ServiceContext,
  id: string,
): Promise<ServiceResult<Record<string, unknown>>> {
  if (!UUID_REGEX.test(id)) {
    return err('VALIDATION_ERROR', 'Invalid decision ID', 400)
  }

  const { supabase, siteId } = ctx

  const { data: updated, error } = await supabase
    .from('research_decisions')
    .update({ status: 'arquivado' })
    .eq('id', id)
    .eq('site_id', siteId)
    .select('id, status')
    .single()

  if (error || !updated) {
    return err('NOT_FOUND', 'Research decision not found', 404)
  }

  return ok(updated as Record<string, unknown>)
}

// ---------------------------------------------------------------------------
// Link / unlink single junction row
// ---------------------------------------------------------------------------

/** Link a single research item to a decision (single junction row insert). */
export async function linkDecisionToResearch(
  ctx: ServiceContext,
  decisionId: string,
  researchId: string,
  note?: string,
): Promise<ServiceResult<Record<string, unknown>>> {
  if (!UUID_REGEX.test(decisionId)) {
    return err('VALIDATION_ERROR', 'Invalid decision ID', 400)
  }
  if (!UUID_REGEX.test(researchId)) {
    return err('VALIDATION_ERROR', 'Invalid research item ID', 400)
  }

  const { supabase, siteId } = ctx

  // Verify ownership: decision must belong to this site
  const { data: decision } = await supabase
    .from('research_decisions')
    .select('id')
    .eq('id', decisionId)
    .eq('site_id', siteId)
    .single()

  if (!decision) {
    return err('NOT_FOUND', 'Research decision not found', 404)
  }

  // Verify research item also belongs to the same site
  const { data: researchItem } = await supabase
    .from('research_items')
    .select('id')
    .eq('id', researchId)
    .eq('site_id', siteId)
    .single()

  if (!researchItem) {
    return err('NOT_FOUND', 'Research item not found', 404)
  }

  const { data: link, error } = await supabase
    .from('research_decision_sources')
    .insert({ decision_id: decisionId, research_id: researchId, note: note ?? null })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return err('VALIDATION_ERROR', 'Already linked', 409)
    }
    console.error('[decisions/link]', error.message)
    return err('DB_ERROR', error.message, 500)
  }

  return ok(link as Record<string, unknown>, 201)
}

/** Remove a single research-source link from a decision (single junction row delete). */
export async function unlinkDecisionFromResearch(
  ctx: ServiceContext,
  decisionId: string,
  researchId: string,
): Promise<ServiceResult<{ deleted: boolean }>> {
  if (!UUID_REGEX.test(decisionId)) {
    return err('VALIDATION_ERROR', 'Invalid decision ID', 400)
  }
  if (!UUID_REGEX.test(researchId)) {
    return err('VALIDATION_ERROR', 'Invalid research item ID', 400)
  }

  const { supabase, siteId } = ctx

  // Verify ownership via decision
  const { data: decision } = await supabase
    .from('research_decisions')
    .select('id')
    .eq('id', decisionId)
    .eq('site_id', siteId)
    .single()

  if (!decision) {
    return err('NOT_FOUND', 'Research decision not found', 404)
  }

  const { error } = await supabase
    .from('research_decision_sources')
    .delete()
    .eq('decision_id', decisionId)
    .eq('research_id', researchId)

  if (error) {
    console.error('[decisions/unlink]', error.message)
    return err('DB_ERROR', error.message, 500)
  }

  return ok({ deleted: true })
}
