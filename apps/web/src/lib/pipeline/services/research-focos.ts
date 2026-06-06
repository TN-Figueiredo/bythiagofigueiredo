/**
 * Shared service layer for research focos (estratégico "foco").
 *
 * Additive and self-contained: mirrors the conventions of
 * `services/research.ts` (ServiceContext, supabase from ctx, Zod validation,
 * ServiceResult return shape) and replicates the exact business logic of the
 * web server actions in `pipeline/research/foco-actions.ts` — without touching
 * them (they keep working for the web UI).
 *
 * The single-active-foco invariant is owned by the DB:
 *   - partial unique index on (site_id) WHERE active = true
 *   - RPC `activate_research_foco(p_foco_id, p_site_id)` is the controlled path
 *     that atomically demotes the previous active foco and activates the target.
 * This service NEVER reimplements that demotion — it delegates to the RPC.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { UUID_REGEX } from '@/lib/pipeline/auth'
import {
  ResearchFocoCreateSchema,
  ResearchFocoUpdateSchema,
  ResearchFocoFullSchema,
  FOCO_STATE,
  THEME_IDS,
  DECISION_HORIZON,
} from '@/lib/pipeline/research-schemas'
import type { ServiceContext, ServiceResult } from './types'
import { ok, err } from './types'

// ---------------------------------------------------------------------------
// Result shapes
// ---------------------------------------------------------------------------

interface FocoRow {
  id: string
  site_id: string
  title: string
  description: string | null
  state: string
  horizon: string
  active: boolean
  author: string
  rationale: string | null
  metric: string | null
  window_label: string | null
  started_at: string | null
  ended_at: string | null
  created_at: string
  updated_at: string
}

interface FocoPinnedResearch {
  item_id: string
  title: string
  summary: string | null
  status: string | null
  note: string | null
}

interface FocoLinkedDecision {
  decision_id: string
  title: string
  horizon: string
  status: string
}

interface FocoDetailResult {
  data: FocoRow & {
    themes: string[]
    pinned_research: FocoPinnedResearch[]
    linked_decisions: FocoLinkedDecision[]
  }
  meta: { updated_at: string }
}

interface FocoListResult {
  data: FocoRow[]
  meta: { total: number; has_next: boolean; next_cursor?: string; limit: number }
}

// ---------------------------------------------------------------------------
// Filter options
// ---------------------------------------------------------------------------

interface ListFocosOptions {
  state?: string
  limit?: number
  offset?: number
}

interface ProposeFocoInput {
  title?: unknown
  description?: unknown
  rationale?: unknown
  metric?: unknown
  horizon?: unknown
  theme_ids?: unknown
  pinned_research_ids?: unknown
}

const FOCO_SELECT =
  'id, site_id, title, description, state, horizon, active, author, rationale, metric, window_label, started_at, ended_at, created_at, updated_at'

/**
 * Strategic activation must ONLY happen through `activateResearchFoco` (which
 * flips `active=true` atomically). A create/update that sets `state:'ativo'`
 * without `active=true` would produce a phantom foco — state 'ativo' but
 * invisible to `getActiveFoco` (which requires active=true). To prevent that,
 * we coerce any incoming `state:'ativo'` to `'proposto'` before validation.
 */
function coerceAtivoState<T extends { state?: unknown }>(input: T): T {
  if (input && typeof input === 'object' && input.state === 'ativo') {
    return { ...input, state: 'proposto' }
  }
  return input
}

// ---------------------------------------------------------------------------
// Helpers — diff-sync junction tables (replicated from foco-actions.ts)
// ---------------------------------------------------------------------------

/** Diff-sync the `research_foco_themes` junction for a foco. */
export async function syncFocoThemes(
  supabase: SupabaseClient,
  focoId: string,
  siteId: string,
  themeIds: string[],
): Promise<void> {
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

/** Diff-sync the `research_foco_sources` junction, validating items belong to the site. */
export async function syncFocoSources(
  supabase: SupabaseClient,
  focoId: string,
  siteId: string,
  itemIds: string[],
  notes?: Record<string, string>,
): Promise<void> {
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
    // Verify all items belong to the same site to prevent cross-site linking.
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
// Read
// ---------------------------------------------------------------------------

/** List focos for a site, newest-updated first, with optional state filter + offset pagination. */
export async function listResearchFocos(
  ctx: ServiceContext,
  opts: ListFocosOptions = {},
): Promise<ServiceResult<FocoListResult>> {
  const limit = Math.min(opts.limit ?? 50, 200)
  const offset = Math.max(opts.offset ?? 0, 0)
  const { supabase, siteId } = ctx

  let query = supabase
    .from('research_focos')
    .select(FOCO_SELECT, { count: 'exact' })
    .eq('site_id', siteId)
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit) // limit + 1 to detect has_next

  if (opts.state) {
    if (!FOCO_STATE.includes(opts.state as (typeof FOCO_STATE)[number])) {
      return err('VALIDATION_ERROR', `Invalid state. Must be one of: ${FOCO_STATE.join(', ')}`, 400)
    }
    query = query.eq('state', opts.state)
  }

  const { data, error, count } = await query
  if (error) {
    console.error('[focos/list]', error.message)
    return err('DB_ERROR', 'Failed to load focos', 500)
  }

  const rows = (data ?? []) as unknown as FocoRow[]
  const hasNext = rows.length > limit
  const page = hasNext ? rows.slice(0, limit) : rows

  return ok({
    data: page,
    meta: {
      total: count ?? 0,
      has_next: hasNext,
      next_cursor: hasNext ? String(offset + limit) : undefined,
      limit,
    },
  })
}

/** Internal: hydrate a foco row with themes, pinned_research and (theme-derived) linked decisions. */
async function hydrateFoco(
  ctx: ServiceContext,
  foco: FocoRow,
): Promise<FocoDetailResult> {
  const { supabase, siteId } = ctx
  const focoId = foco.id

  // Themes
  const { data: themeRows } = await supabase
    .from('research_foco_themes')
    .select('theme_id')
    .eq('foco_id', focoId)
  const themes = (themeRows ?? []).map((t: { theme_id: string }) => t.theme_id)

  // Pinned research (junction → items, resolved titles within the site)
  const { data: sourceRows } = await supabase
    .from('research_foco_sources')
    .select('item_id, note')
    .eq('foco_id', focoId)

  const pinnedItemIds = (sourceRows ?? []).map((s: { item_id: string }) => s.item_id)
  let itemMap = new Map<string, { title: string; summary: string | null; status: string | null }>()
  if (pinnedItemIds.length > 0) {
    const { data: items } = await supabase
      .from('research_items')
      .select('id, title, summary, status')
      .eq('site_id', siteId)
      .in('id', pinnedItemIds)
    itemMap = new Map(
      (items ?? []).map((i: { id: string; title: string; summary: string | null; status: string | null }) => [
        i.id,
        { title: i.title, summary: i.summary, status: i.status },
      ]),
    )
  }

  const pinned_research: FocoPinnedResearch[] = (sourceRows ?? []).map(
    (s: { item_id: string; note: string | null }) => {
      const item = itemMap.get(s.item_id)
      return {
        item_id: s.item_id,
        title: item?.title ?? 'Pesquisa removida',
        summary: item?.summary ?? null,
        status: item?.status ?? null,
        note: s.note,
      }
    },
  )

  // Linked decisions: derived by shared theme (no foco↔decision junction exists;
  // the web UI surfaces decisions alongside the foco by theme).
  let linked_decisions: FocoLinkedDecision[] = []
  if (themes.length > 0) {
    const { data: decisions } = await supabase
      .from('research_decisions')
      .select('id, title, horizon, status, theme_id')
      .eq('site_id', siteId)
      .in('theme_id', themes)
      .neq('status', 'arquivado')
    linked_decisions = (decisions ?? []).map(
      (d: { id: string; title: string; horizon: string; status: string }) => ({
        decision_id: d.id,
        title: d.title,
        horizon: d.horizon,
        status: d.status,
      }),
    )
  }

  return {
    data: { ...foco, themes, pinned_research, linked_decisions },
    meta: { updated_at: foco.updated_at },
  }
}

/** Get a single foco with themes, pinned_research and linked decisions. */
export async function getResearchFoco(
  ctx: ServiceContext,
  id: string,
): Promise<ServiceResult<FocoDetailResult>> {
  if (!UUID_REGEX.test(id)) {
    return err('VALIDATION_ERROR', 'Invalid foco ID', 400)
  }

  const { supabase, siteId } = ctx
  const { data: foco, error } = await supabase
    .from('research_focos')
    .select(FOCO_SELECT)
    .eq('id', id)
    .eq('site_id', siteId)
    .single()

  if (error || !foco) {
    return err('NOT_FOUND', 'Foco not found', 404)
  }

  return ok(await hydrateFoco(ctx, foco as unknown as FocoRow))
}

/** Get the single active foco (state 'ativo' && active true) with relations, or null. */
export async function getActiveFoco(
  ctx: ServiceContext,
): Promise<ServiceResult<FocoDetailResult | null>> {
  const { supabase, siteId } = ctx
  const { data: foco } = await supabase
    .from('research_focos')
    .select(FOCO_SELECT)
    .eq('site_id', siteId)
    .eq('active', true)
    .eq('state', 'ativo')
    .maybeSingle()

  if (!foco) return ok(null)

  return ok(await hydrateFoco(ctx, foco as unknown as FocoRow))
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/** Create a foco (always inactive), then diff-sync themes + sources. */
export async function createResearchFoco(
  ctx: ServiceContext,
  input: unknown,
): Promise<ServiceResult<FocoRow>> {
  const parsed = ResearchFocoCreateSchema.safeParse(
    coerceAtivoState(input as { state?: unknown }),
  )
  if (!parsed.success) {
    return err('VALIDATION_ERROR', parsed.error.issues.map((i) => i.message).join(', '), 400)
  }

  const { supabase, siteId } = ctx
  const { theme_ids, pinned_research_ids, pinned_notes, ...focoFields } = parsed.data

  const { data: foco, error } = await supabase
    .from('research_focos')
    .insert({ site_id: siteId, active: false, ...focoFields })
    .select(FOCO_SELECT)
    .single()

  if (error || !foco) {
    console.error('[focos/create]', error?.message)
    return err('DB_ERROR', error?.message ?? 'Failed to create foco', 500)
  }

  const focoId = (foco as { id: string }).id
  await syncFocoThemes(supabase, focoId, siteId, theme_ids)
  await syncFocoSources(supabase, focoId, siteId, pinned_research_ids, pinned_notes)

  return ok(foco as unknown as FocoRow, 201)
}

/** Update a foco's scalar fields, then optionally diff-sync themes + sources. */
export async function updateResearchFoco(
  ctx: ServiceContext,
  id: string,
  input: unknown,
): Promise<ServiceResult<{ id: string; updated_at?: string }>> {
  if (!UUID_REGEX.test(id)) {
    return err('VALIDATION_ERROR', 'Invalid foco ID', 400)
  }

  const parsed = ResearchFocoUpdateSchema.safeParse(
    coerceAtivoState(input as { state?: unknown }),
  )
  if (!parsed.success) {
    return err('VALIDATION_ERROR', parsed.error.issues.map((i) => i.message).join(', '), 400)
  }

  const { supabase, siteId } = ctx
  const { theme_ids, pinned_research_ids, pinned_notes, ...focoFields } = parsed.data

  // Verify ownership before any mutation.
  const { data: owned } = await supabase
    .from('research_focos')
    .select('id')
    .eq('id', id)
    .eq('site_id', siteId)
    .single()

  if (!owned) return err('NOT_FOUND', 'Foco not found', 404)

  const updateData: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(focoFields)) {
    if (value !== undefined) updateData[key] = value
  }

  let updatedAt: string | undefined
  if (Object.keys(updateData).length > 0) {
    const { data: updated, error } = await supabase
      .from('research_focos')
      .update(updateData)
      .eq('id', id)
      .eq('site_id', siteId)
      .select('updated_at')
      .single()

    if (error) {
      console.error('[focos/update]', error.message)
      return err('DB_ERROR', 'Failed to update foco', 500)
    }
    updatedAt = (updated as { updated_at: string } | null)?.updated_at
  }

  if (theme_ids !== undefined) await syncFocoThemes(supabase, id, siteId, theme_ids)
  if (pinned_research_ids !== undefined) {
    await syncFocoSources(supabase, id, siteId, pinned_research_ids, pinned_notes)
  }

  return ok({ id, updated_at: updatedAt })
}

/**
 * Upsert a foco plus full theme/source lists.
 * Tries the atomic RPC `save_research_foco_full` first, falls back to manual
 * insert/update + diff-sync if the RPC is not deployed (replicates foco-actions).
 */
export async function saveFocoFull(
  ctx: ServiceContext,
  input: unknown,
): Promise<ServiceResult<{ id: string }>> {
  const parsed = ResearchFocoFullSchema.safeParse(
    coerceAtivoState(input as { state?: unknown }),
  )
  if (!parsed.success) {
    return err('VALIDATION_ERROR', parsed.error.issues.map((i) => i.message).join(', '), 400)
  }

  const { supabase, siteId } = ctx
  const { id, theme_ids, pinned_research_ids, pinned_notes, ...focoFields } = parsed.data

  // Try DB RPC first (atomic upsert + diff-sync).
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
    const rpcId = (rpcResult as { id?: string }).id ?? id ?? ''
    return ok({ id: rpcId })
  }

  // Fallback: manual insert/update + sync (when RPC not yet deployed).
  let focoId: string

  if (id) {
    // Verify ownership before updating existing foco.
    const { data: existing } = await supabase
      .from('research_focos')
      .select('id')
      .eq('id', id)
      .eq('site_id', siteId)
      .single()

    if (!existing) return err('NOT_FOUND', 'Foco not found', 404)

    const { error: updateError } = await supabase
      .from('research_focos')
      .update(focoFields)
      .eq('id', id)
      .eq('site_id', siteId)

    if (updateError) {
      console.error('[focos/saveFull]', updateError.message)
      return err('DB_ERROR', updateError.message, 500)
    }
    focoId = id
  } else {
    const { data: foco, error: insertError } = await supabase
      .from('research_focos')
      .insert({ site_id: siteId, active: false, ...focoFields })
      .select('id')
      .single()

    if (insertError || !foco) {
      console.error('[focos/saveFull]', insertError?.message)
      return err('DB_ERROR', insertError?.message ?? 'Insert failed', 500)
    }
    focoId = (foco as { id: string }).id
  }

  await syncFocoThemes(supabase, focoId, siteId, theme_ids ?? [])
  await syncFocoSources(supabase, focoId, siteId, pinned_research_ids ?? [], pinned_notes)

  return ok({ id: focoId })
}

/**
 * Propose a foco (README §"Foco — propose").
 * Creates a foco with state:'proposto', author:'cowork', grounded in current
 * research, in `proximo` by default (or whatever horizon the caller passes).
 */
export async function proposeFoco(
  ctx: ServiceContext,
  input: ProposeFocoInput,
): Promise<ServiceResult<FocoRow>> {
  const { supabase, siteId } = ctx

  // Validate the proposable subset via the create schema, then override
  // state/author to enforce the propose semantics.
  const parsed = ResearchFocoCreateSchema.safeParse({
    title: input.title,
    description: input.description ?? undefined,
    rationale: input.rationale ?? undefined,
    metric: input.metric ?? undefined,
    horizon: input.horizon ?? 'proximo',
    state: 'proposto',
    theme_ids: input.theme_ids ?? [],
    pinned_research_ids: input.pinned_research_ids ?? [],
  })
  if (!parsed.success) {
    return err('VALIDATION_ERROR', parsed.error.issues.map((i) => i.message).join(', '), 400)
  }

  const { theme_ids, pinned_research_ids, pinned_notes, ...focoFields } = parsed.data

  const { data: foco, error } = await supabase
    .from('research_focos')
    .insert({
      site_id: siteId,
      active: false,
      author: 'cowork',
      ...focoFields,
      state: 'proposto',
      horizon: (input.horizon as string | undefined) ?? 'proximo',
    })
    .select(FOCO_SELECT)
    .single()

  if (error || !foco) {
    console.error('[focos/propose]', error?.message)
    return err('DB_ERROR', error?.message ?? 'Failed to propose foco', 500)
  }

  const focoId = (foco as { id: string }).id
  await syncFocoThemes(supabase, focoId, siteId, theme_ids)
  await syncFocoSources(supabase, focoId, siteId, pinned_research_ids, pinned_notes)

  return ok(foco as unknown as FocoRow, 201)
}

/**
 * Activate a foco — promote it to the single active foco for the site,
 * demoting whichever foco was previously active.
 *
 * Tries the DB RPC `activate_research_foco(p_foco_id, p_site_id)` first (the
 * controlled, atomic path for the web/RLS flow). That RPC is SECURITY DEFINER
 * and gates on `can_edit_site`, which evaluates against `auth.uid()`. The MCP
 * path uses a service-role client where `auth.uid()` IS NULL, so the RPC raises
 * 'permission denied' (42501) every time. On any RPC failure (permission or
 * RPC-not-deployed) we fall back to `activate_research_foco_service`, a second
 * SECURITY DEFINER RPC that performs the demote + promote in ONE atomic
 * function body (no auth check — site scoping is enforced by the resolved
 * p_site_id we pass). This replaces the previous two non-transactional UPDATEs
 * that could leave the site with ZERO active focos on partial failure.
 */
export async function activateResearchFoco(
  ctx: ServiceContext,
  id: string,
): Promise<ServiceResult<{ id: string; active: boolean; state: string }>> {
  if (!UUID_REGEX.test(id)) {
    return err('VALIDATION_ERROR', 'Invalid foco ID', 400)
  }

  const { supabase, siteId } = ctx

  // Verify ownership before activating.
  const { data: foco } = await supabase
    .from('research_focos')
    .select('id')
    .eq('id', id)
    .eq('site_id', siteId)
    .single()

  if (!foco) return err('NOT_FOUND', 'Foco not found', 404)

  // Preferred path: atomic RPC.
  const { data: activated, error: rpcError } = await supabase.rpc('activate_research_foco', {
    p_foco_id: id,
    p_site_id: siteId,
  })

  if (!rpcError && activated) {
    const row = activated as { id?: string; active?: boolean; state?: string } | null
    return ok({ id: row?.id ?? id, active: row?.active ?? true, state: row?.state ?? 'ativo' })
  }

  // Fallback (e.g. service-role client where auth.uid() IS NULL → 42501, or
  // RPC not deployed): the service RPC demotes the prior active foco and
  // promotes the target in ONE atomic function body, so a partial failure can
  // never leave the site with zero active focos.
  const { data: promoted, error: serviceError } = await supabase.rpc(
    'activate_research_foco_service',
    { p_foco_id: id, p_site_id: siteId },
  )

  if (serviceError || !promoted) {
    console.error('[focos/activate/service]', serviceError?.message)
    return err('DB_ERROR', serviceError?.message ?? 'Failed to activate foco', 500)
  }

  const row = promoted as { id?: string; active?: boolean; state?: string }
  return ok({ id: row.id ?? id, active: row.active ?? true, state: row.state ?? 'ativo' })
}

/** Archive a foco: state:'arquivado', active:false. */
export async function archiveResearchFoco(
  ctx: ServiceContext,
  id: string,
): Promise<ServiceResult<{ id: string; state: string; active: boolean }>> {
  if (!UUID_REGEX.test(id)) {
    return err('VALIDATION_ERROR', 'Invalid foco ID', 400)
  }

  const { supabase, siteId } = ctx
  const { data: updated, error } = await supabase
    .from('research_focos')
    .update({ state: 'arquivado', active: false })
    .eq('id', id)
    .eq('site_id', siteId)
    .select('id, state, active')
    .single()

  if (error || !updated) {
    return err('NOT_FOUND', 'Foco not found', 404)
  }

  return ok(updated as { id: string; state: string; active: boolean })
}

// ---------------------------------------------------------------------------
// Junction links (single-row insert / delete on research_foco_sources)
// ---------------------------------------------------------------------------

/** Pin a single research item to a foco. */
export async function linkFocoToResearch(
  ctx: ServiceContext,
  focoId: string,
  researchId: string,
  note?: string,
): Promise<ServiceResult<Record<string, unknown>>> {
  if (!UUID_REGEX.test(focoId)) return err('VALIDATION_ERROR', 'Invalid focoId', 400)
  if (!UUID_REGEX.test(researchId)) return err('VALIDATION_ERROR', 'Invalid researchId', 400)

  const { supabase, siteId } = ctx

  // Verify ownership: foco must belong to this site.
  const { data: foco } = await supabase
    .from('research_focos')
    .select('id')
    .eq('id', focoId)
    .eq('site_id', siteId)
    .single()

  if (!foco) return err('NOT_FOUND', 'Foco not found', 404)

  // Verify research item also belongs to the same site.
  const { data: researchItem } = await supabase
    .from('research_items')
    .select('id')
    .eq('id', researchId)
    .eq('site_id', siteId)
    .single()

  if (!researchItem) return err('NOT_FOUND', 'Research item not found', 404)

  const { data: link, error } = await supabase
    .from('research_foco_sources')
    .insert({ foco_id: focoId, item_id: researchId, note: note ?? null })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return err('VALIDATION_ERROR', 'Already linked', 409)
    console.error('[focos/link]', error.message)
    return err('DB_ERROR', error.message, 500)
  }

  return ok(link as Record<string, unknown>, 201)
}

/** Unpin a research item from a foco. */
export async function unlinkFocoFromResearch(
  ctx: ServiceContext,
  focoId: string,
  researchId: string,
): Promise<ServiceResult<{ deleted: boolean }>> {
  if (!UUID_REGEX.test(focoId)) return err('VALIDATION_ERROR', 'Invalid focoId', 400)
  if (!UUID_REGEX.test(researchId)) return err('VALIDATION_ERROR', 'Invalid researchId', 400)

  const { supabase, siteId } = ctx

  // Verify ownership via foco.
  const { data: foco } = await supabase
    .from('research_focos')
    .select('id')
    .eq('id', focoId)
    .eq('site_id', siteId)
    .single()

  if (!foco) return err('NOT_FOUND', 'Foco not found', 404)

  const { error } = await supabase
    .from('research_foco_sources')
    .delete()
    .eq('foco_id', focoId)
    .eq('item_id', researchId)

  if (error) {
    console.error('[focos/unlink]', error.message)
    return err('DB_ERROR', error.message, 500)
  }

  return ok({ deleted: true })
}

// Re-export enum constants used by callers (MCP adapter / tool shapes).
export { FOCO_STATE, THEME_IDS, DECISION_HORIZON }
