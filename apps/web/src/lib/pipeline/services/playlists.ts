/**
 * Transport-agnostic service layer for the Playlists domain (DAG-based playlist management).
 *
 * Extracted from route handlers — all Supabase queries and business logic live here.
 * Route handlers become thin adapters that parse HTTP, call the service, and format responses.
 */

import { getSupabaseServiceClient } from '@/lib/supabase/service'
import {
  listPlaylists as queryListPlaylists,
  getPlaylistItemCounts,
  getPlaylistGraph,
  getNextSortOrder,
  resolveUniqueSlug,
} from '@/lib/playlists/queries'
import {
  PipelineCreatePlaylistSchema,
  PipelineUpdatePlaylistSchema,
  PipelineAddItemSchema,
  PipelineBulkAddItemsSchema,
  PipelineCreateEdgeSchema,
  PipelineBulkCreateEdgesSchema,
  PipelineReorderSchema,
} from '@/lib/pipeline/schemas'
import { withSnapshot } from '@/lib/playlists/snapshot-middleware'
import { computeAutoLayout } from '@/lib/playlists/canvas/auto-layout'
import type { ServiceContext, ServiceResult } from './types'
import { PipelineServiceError } from './types'

// ─── Response shapes ────────────────────────────────────────────────────────

interface PlaylistSummary {
  id: string
  name_pt: string
  name_en: string
  slug: string
  status: string
  category: string | null
  description_pt: string | null
  description_en: string | null
  cover_image_url: string | null
  item_count: number
  created_at: string
  updated_at: string
}

interface PlaylistDetail {
  id: string
  name_pt: string
  name_en: string
  slug: string
  status: string
  category: string | null
  description_pt: string | null
  description_en: string | null
  cover_image_url: string | null
  created_at: string
  updated_at: string
}

interface PlaylistGraphResult {
  playlist: PlaylistDetail
  items: Array<{
    id: string
    title: string
    content_type: string | null
    status: string | null
    category: string | null
    metadata: string | null
    position_x: number
    position_y: number
    sort_order: number
    is_ghost: boolean
    other_playlist_count: number
  }>
  edges: Array<{
    id: string
    source_item_id: string
    target_item_id: string
    edge_type: string
    label: string | null
  }>
}

interface AddItemResult {
  id: string
  already_existed: boolean
}

interface BulkAddItemsResult {
  items: AddItemResult[]
  added: number
  skipped: number
  errors: Array<{ index: number; code: string; message: string }>
}

interface CreateEdgeResult {
  id: string
  already_existed: boolean
}

interface BulkCreateEdgesResult {
  edges: CreateEdgeResult[]
  created: number
  skipped: number
  errors: Array<{
    index: number
    source_item_id: string
    target_item_id: string
    code: string
    message: string
  }>
}

interface ReorderResult {
  reordered: boolean
  count: number
}

interface AutoLayoutPosition {
  item_id: string
  position_x: number
  position_y: number
}

interface AutoLayoutResult {
  positions: AutoLayoutPosition[]
  layers: number
}

interface DeleteResult {
  deleted: true
}

interface DryRunDeletePlaylistResult {
  would_delete: true
  playlist_id: string
  item_count: number
  edge_count: number
}

interface DryRunDeleteItemResult {
  would_delete: true
  item_id: string
  playlist_id: string
}

interface DryRunDeleteEdgeResult {
  would_delete: true
  edge_id: string
  playlist_id: string
}

// ─── Filter types ───────────────────────────────────────────────────────────

interface ListPlaylistsFilters {
  status?: string
  category?: string
  search?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Validate parsed Zod result, throw PipelineServiceError on failure. */
function assertValid<T>(result: { success: true; data: T } | { success: false; error: { issues: Array<{ message: string }> } }): T {
  if (!result.success) {
    throw new PipelineServiceError(
      'VALIDATION_ERROR',
      result.error.issues.map(i => i.message).join(', '),
      400,
    )
  }
  return result.data
}

/** Verify a playlist exists for the given site, throw NOT_FOUND if missing. */
async function requirePlaylist(playlistId: string, siteId: string): Promise<{ id: string }> {
  const supabase = getSupabaseServiceClient()
  const { data } = await supabase
    .from('playlists')
    .select('id')
    .eq('id', playlistId)
    .eq('site_id', siteId)
    .maybeSingle()

  if (!data) throw new PipelineServiceError('NOT_FOUND', 'Playlist not found', 404)
  return data as { id: string }
}

// ─── Service functions ──────────────────────────────────────────────────────

/** List all playlists for a site with optional filters, enriched with item counts. */
export async function listPlaylistsService(
  ctx: ServiceContext,
  filters: ListPlaylistsFilters,
): Promise<ServiceResult<PlaylistSummary[]>> {
  const [playlists, counts] = await Promise.all([
    queryListPlaylists(ctx.siteId, filters),
    getPlaylistItemCounts(ctx.siteId),
  ])

  const data: PlaylistSummary[] = playlists.map(p => ({
    id: p.id,
    name_pt: p.name_pt,
    name_en: p.name_en,
    slug: p.slug,
    status: p.status,
    category: p.category,
    description_pt: p.description_pt,
    description_en: p.description_en,
    cover_image_url: p.cover_image_url,
    item_count: counts.get(p.id) ?? 0,
    created_at: p.created_at,
    updated_at: p.updated_at,
  }))

  return { data }
}

/** Create a new playlist with auto-generated unique slug. */
export async function createPlaylistService(
  ctx: ServiceContext,
  body: unknown,
): Promise<ServiceResult<PlaylistDetail>> {
  const parsed = assertValid(PipelineCreatePlaylistSchema.safeParse(body))

  let slug: string
  try {
    slug = await resolveUniqueSlug(parsed.name_en, ctx.siteId)
  } catch {
    throw new PipelineServiceError('ALREADY_EXISTS', 'Could not generate unique slug after 99 attempts', 409)
  }

  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('playlists')
    .insert({
      site_id: ctx.siteId,
      name_en: parsed.name_en,
      name_pt: parsed.name_pt,
      slug,
      description_en: parsed.description_en ?? null,
      description_pt: parsed.description_pt ?? null,
      category: parsed.category ?? null,
      status: parsed.status,
    })
    .select('id, name_en, name_pt, slug, status, category, description_en, description_pt, cover_image_url, created_at, updated_at')
    .single()

  if (error) {
    console.error('[playlists/createPlaylistService]', error)
    throw new PipelineServiceError('DB_ERROR', 'Failed to create playlist', 500)
  }

  return {
    data: {
      id: data.id,
      name_en: data.name_en,
      name_pt: data.name_pt,
      slug: data.slug,
      status: data.status,
      category: data.category,
      description_en: data.description_en,
      description_pt: data.description_pt,
      cover_image_url: data.cover_image_url,
      created_at: data.created_at,
      updated_at: data.updated_at,
    },
  }
}

/** Get a single playlist with its full DAG graph (items + edges). */
export async function getPlaylistService(
  ctx: ServiceContext,
  playlistId: string,
): Promise<ServiceResult<PlaylistGraphResult>> {
  const graph = await getPlaylistGraph(playlistId, ctx.siteId)
  if (!graph) throw new PipelineServiceError('NOT_FOUND', 'Playlist not found', 404)

  return {
    data: {
      playlist: {
        id: graph.playlist.id,
        name_pt: graph.playlist.name_pt,
        name_en: graph.playlist.name_en,
        slug: graph.playlist.slug,
        status: graph.playlist.status,
        category: graph.playlist.category,
        description_pt: graph.playlist.description_pt,
        description_en: graph.playlist.description_en,
        cover_image_url: graph.playlist.cover_image_url,
        created_at: graph.playlist.created_at,
        updated_at: graph.playlist.updated_at,
      },
      items: graph.items.map(i => ({
        id: i.id,
        title: i.title,
        content_type: i.content_type,
        status: i.status,
        category: i.category,
        metadata: i.metadata,
        position_x: i.position_x,
        position_y: i.position_y,
        sort_order: i.sort_order,
        is_ghost: i.is_ghost,
        other_playlist_count: i.other_playlist_count,
      })),
      edges: graph.edges.map(e => ({
        id: e.id,
        source_item_id: e.source_item_id,
        target_item_id: e.target_item_id,
        edge_type: e.edge_type,
        label: e.label,
      })),
    },
  }
}

/** Partially update a playlist's metadata fields. */
export async function updatePlaylistService(
  ctx: ServiceContext,
  playlistId: string,
  body: unknown,
): Promise<ServiceResult<PlaylistDetail>> {
  const parsed = assertValid(PipelineUpdatePlaylistSchema.safeParse(body))

  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('playlists')
    .update({ ...parsed, updated_at: new Date().toISOString() })
    .eq('id', playlistId)
    .eq('site_id', ctx.siteId)
    .select('*')
    .single()

  if (error || !data) throw new PipelineServiceError('NOT_FOUND', 'Playlist not found', 404)

  return {
    data: {
      id: data.id,
      name_en: data.name_en,
      name_pt: data.name_pt,
      slug: data.slug,
      status: data.status,
      category: data.category,
      description_en: data.description_en,
      description_pt: data.description_pt,
      cover_image_url: data.cover_image_url,
      created_at: data.created_at,
      updated_at: data.updated_at,
    },
  }
}

/** Delete a playlist with pre-destructive snapshot; supports dryRun preview. */
export async function deletePlaylistService(
  ctx: ServiceContext,
  playlistId: string,
  options?: { dryRun?: boolean },
): Promise<ServiceResult<DeleteResult | DryRunDeletePlaylistResult>> {
  const supabase = getSupabaseServiceClient()

  if (options?.dryRun) {
    await requirePlaylist(playlistId, ctx.siteId)

    const [itemsRes, edgesRes] = await Promise.all([
      supabase.from('playlist_items').select('id').eq('playlist_id', playlistId),
      supabase.from('playlist_edges').select('id').eq('playlist_id', playlistId),
    ])

    return {
      data: {
        would_delete: true as const,
        playlist_id: playlistId,
        item_count: (itemsRes.data ?? []).length,
        edge_count: (edgesRes.data ?? []).length,
      },
    }
  }

  return withSnapshot(playlistId, ctx.siteId, null, 'pre_destructive', 'API: antes de deletar playlist', async () => {
    const { data } = await supabase
      .from('playlists')
      .delete()
      .eq('id', playlistId)
      .eq('site_id', ctx.siteId)
      .select('id')
      .maybeSingle()

    if (!data) throw new PipelineServiceError('NOT_FOUND', 'Playlist not found', 404)

    return { data: { deleted: true as const } }
  })
}

/** Add a single content item to a playlist (idempotent — returns existing if duplicate). */
export async function addItemService(
  ctx: ServiceContext,
  playlistId: string,
  body: unknown,
): Promise<ServiceResult<AddItemResult>> {
  const supabase = getSupabaseServiceClient()

  await requirePlaylist(playlistId, ctx.siteId)

  const parsed = assertValid(PipelineAddItemSchema.safeParse(body))
  const { blog_post_id, newsletter_edition_id, pipeline_id, sort_order, position_x, position_y } = parsed

  // Check for duplicate
  let dupQuery = supabase.from('playlist_items').select('id').eq('playlist_id', playlistId)
  if (blog_post_id) dupQuery = dupQuery.eq('blog_post_id', blog_post_id)
  else if (newsletter_edition_id) dupQuery = dupQuery.eq('newsletter_edition_id', newsletter_edition_id)
  else if (pipeline_id) dupQuery = dupQuery.eq('pipeline_id', pipeline_id)

  const { data: existing } = await dupQuery.maybeSingle()
  if (existing) return { data: { id: (existing as { id: string }).id, already_existed: true } }

  const resolvedSortOrder = sort_order ?? (await getNextSortOrder(playlistId))

  const { data, error } = await supabase
    .from('playlist_items')
    .insert({
      playlist_id: playlistId,
      blog_post_id: blog_post_id ?? null,
      newsletter_edition_id: newsletter_edition_id ?? null,
      pipeline_id: pipeline_id ?? null,
      sort_order: resolvedSortOrder,
      position_x: position_x ?? 0,
      position_y: position_y ?? 0,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23503') {
      throw new PipelineServiceError('VALIDATION_ERROR', 'Referenced content does not exist', 400)
    }
    throw new PipelineServiceError('DB_ERROR', 'Failed to create playlist item', 500)
  }

  return { data: { id: data.id, already_existed: false } }
}

/** Remove a single item from a playlist; supports dryRun preview. */
export async function removeItemService(
  ctx: ServiceContext,
  playlistId: string,
  itemId: string,
  options?: { dryRun?: boolean },
): Promise<ServiceResult<DeleteResult | DryRunDeleteItemResult>> {
  const supabase = getSupabaseServiceClient()

  await requirePlaylist(playlistId, ctx.siteId)

  const { data: item } = await supabase
    .from('playlist_items')
    .select('id')
    .eq('id', itemId)
    .eq('playlist_id', playlistId)
    .maybeSingle()
  if (!item) throw new PipelineServiceError('NOT_FOUND', 'Item not found in playlist', 404)

  if (options?.dryRun) {
    return {
      data: {
        would_delete: true as const,
        item_id: itemId,
        playlist_id: playlistId,
      },
    }
  }

  const { error } = await supabase
    .from('playlist_items')
    .delete()
    .eq('id', itemId)

  if (error) throw new PipelineServiceError('DB_ERROR', 'Failed to delete playlist item', 500)

  return { data: { deleted: true as const } }
}

/** Bulk add multiple items to a playlist with per-item error reporting (snapshot-wrapped). */
export async function bulkAddItemsService(
  ctx: ServiceContext,
  playlistId: string,
  body: unknown,
): Promise<ServiceResult<BulkAddItemsResult>> {
  const supabase = getSupabaseServiceClient()

  await requirePlaylist(playlistId, ctx.siteId)

  return withSnapshot(playlistId, ctx.siteId, null, 'pre_destructive', 'API: bulk add items', async () => {
    const parsed = assertValid(PipelineBulkAddItemsSchema.safeParse(body))

    for (const item of parsed.items) {
      const refs = [item.blog_post_id, item.newsletter_edition_id, item.pipeline_id].filter(Boolean)
      if (refs.length !== 1) {
        throw new PipelineServiceError('VALIDATION_ERROR', 'Each item must have exactly one content reference', 400)
      }
    }

    let nextSort = await getNextSortOrder(playlistId)
    const results: AddItemResult[] = []
    const errors: Array<{ index: number; code: string; message: string }> = []
    let added = 0
    let skipped = 0

    for (let i = 0; i < parsed.items.length; i++) {
      const item = parsed.items[i]!

      let dupQuery = supabase.from('playlist_items').select('id').eq('playlist_id', playlistId)
      if (item.blog_post_id) dupQuery = dupQuery.eq('blog_post_id', item.blog_post_id)
      else if (item.newsletter_edition_id) dupQuery = dupQuery.eq('newsletter_edition_id', item.newsletter_edition_id)
      else if (item.pipeline_id) dupQuery = dupQuery.eq('pipeline_id', item.pipeline_id)

      const { data: existing } = await dupQuery.maybeSingle()
      if (existing) {
        results.push({ id: (existing as { id: string }).id, already_existed: true })
        skipped++
        continue
      }

      const resolvedSort = item.sort_order ?? nextSort
      if (!item.sort_order) nextSort += 1000

      const { data, error } = await supabase
        .from('playlist_items')
        .insert({
          playlist_id: playlistId,
          blog_post_id: item.blog_post_id ?? null,
          newsletter_edition_id: item.newsletter_edition_id ?? null,
          pipeline_id: item.pipeline_id ?? null,
          sort_order: resolvedSort,
          position_x: item.position_x ?? 0,
          position_y: item.position_y ?? 0,
        })
        .select('id')
        .single()

      if (error) {
        console.error('[playlists/bulkAddItemsService]', error)
        const isFk = error.code === '23503'
        errors.push({
          index: i,
          code: isFk ? 'INVALID_REFERENCE' : 'VALIDATION_ERROR',
          message: isFk ? 'Referenced content does not exist' : 'Failed to insert item',
        })
        continue
      }

      results.push({ id: data.id, already_existed: false })
      added++
    }

    return { data: { items: results, added, skipped, errors } }
  })
}

/** Create a single DAG edge between two playlist items (cycle detection via DB trigger). */
export async function createEdgeService(
  ctx: ServiceContext,
  playlistId: string,
  body: unknown,
): Promise<ServiceResult<CreateEdgeResult>> {
  const supabase = getSupabaseServiceClient()

  await requirePlaylist(playlistId, ctx.siteId)

  const parsed = assertValid(PipelineCreateEdgeSchema.safeParse(body))
  const { source_item_id, target_item_id, edge_type, label } = parsed

  if (source_item_id === target_item_id) {
    throw new PipelineServiceError('VALIDATION_ERROR', 'Self-loops are not allowed', 400)
  }

  // Check for existing identical edge (idempotent)
  const { data: existing } = await supabase
    .from('playlist_edges')
    .select('id')
    .eq('playlist_id', playlistId)
    .eq('source_item_id', source_item_id)
    .eq('target_item_id', target_item_id)
    .eq('edge_type', edge_type)
    .maybeSingle()
  if (existing) return { data: { id: (existing as { id: string }).id, already_existed: true } }

  const { data, error } = await supabase
    .from('playlist_edges')
    .insert({ playlist_id: playlistId, source_item_id, target_item_id, edge_type, label: label ?? null })
    .select('id')
    .single()

  if (error) {
    if (error.message.includes('cycle') || error.code === 'P0001') {
      throw new PipelineServiceError('CYCLE_DETECTED', 'Sequence edge would create a cycle', 422)
    }
    console.error('[playlists/createEdgeService]', error)
    throw new PipelineServiceError('DB_ERROR', 'Failed to create edge', 500)
  }

  return { data: { id: data.id, already_existed: false } }
}

/** Delete a single edge from a playlist; supports dryRun preview. */
export async function deleteEdgeService(
  ctx: ServiceContext,
  playlistId: string,
  edgeId: string,
  options?: { dryRun?: boolean },
): Promise<ServiceResult<DeleteResult | DryRunDeleteEdgeResult>> {
  const supabase = getSupabaseServiceClient()

  await requirePlaylist(playlistId, ctx.siteId)

  const { data: edge } = await supabase
    .from('playlist_edges')
    .select('id')
    .eq('id', edgeId)
    .eq('playlist_id', playlistId)
    .maybeSingle()
  if (!edge) throw new PipelineServiceError('NOT_FOUND', 'Edge not found in playlist', 404)

  if (options?.dryRun) {
    return {
      data: {
        would_delete: true as const,
        edge_id: edgeId,
        playlist_id: playlistId,
      },
    }
  }

  const { error } = await supabase
    .from('playlist_edges')
    .delete()
    .eq('id', edgeId)

  if (error) throw new PipelineServiceError('DB_ERROR', 'Failed to delete edge', 500)

  return { data: { deleted: true as const } }
}

/** Bulk create edges with per-edge error reporting and cycle detection (snapshot-wrapped). */
export async function bulkCreateEdgesService(
  ctx: ServiceContext,
  playlistId: string,
  body: unknown,
): Promise<ServiceResult<BulkCreateEdgesResult>> {
  const supabase = getSupabaseServiceClient()

  await requirePlaylist(playlistId, ctx.siteId)

  return withSnapshot(playlistId, ctx.siteId, null, 'pre_destructive', 'API: bulk create edges', async () => {
    const parsed = assertValid(PipelineBulkCreateEdgesSchema.safeParse(body))

    const results: CreateEdgeResult[] = []
    const errors: Array<{
      index: number
      source_item_id: string
      target_item_id: string
      code: string
      message: string
    }> = []
    let created = 0
    let skipped = 0

    for (let i = 0; i < parsed.edges.length; i++) {
      const edge = parsed.edges[i]!

      if (edge.source_item_id === edge.target_item_id) {
        errors.push({
          index: i,
          source_item_id: edge.source_item_id,
          target_item_id: edge.target_item_id,
          code: 'VALIDATION_ERROR',
          message: 'Self-loops are not allowed',
        })
        continue
      }

      const { data: existing } = await supabase
        .from('playlist_edges')
        .select('id')
        .eq('playlist_id', playlistId)
        .eq('source_item_id', edge.source_item_id)
        .eq('target_item_id', edge.target_item_id)
        .eq('edge_type', edge.edge_type)
        .maybeSingle()

      if (existing) {
        results.push({ id: (existing as { id: string }).id, already_existed: true })
        skipped++
        continue
      }

      const { data, error } = await supabase
        .from('playlist_edges')
        .insert({
          playlist_id: playlistId,
          source_item_id: edge.source_item_id,
          target_item_id: edge.target_item_id,
          edge_type: edge.edge_type,
          label: edge.label ?? null,
        })
        .select('id')
        .single()

      if (error) {
        console.error('[playlists/bulkCreateEdgesService]', error)
        const isCycle = error.message?.includes('cycle') || error.code === 'P0001'
        errors.push({
          index: i,
          source_item_id: edge.source_item_id,
          target_item_id: edge.target_item_id,
          code: isCycle ? 'CYCLE_DETECTED' : 'VALIDATION_ERROR',
          message: isCycle ? 'Sequence edge would create a cycle' : 'Failed to create edge',
        })
        continue
      }

      results.push({ id: data.id, already_existed: false })
      created++
    }

    return { data: { edges: results, created, skipped, errors } }
  })
}

/** Reorder playlist items by assigning new sort_order values based on the provided ID sequence. */
export async function reorderItemsService(
  ctx: ServiceContext,
  playlistId: string,
  body: unknown,
): Promise<ServiceResult<ReorderResult>> {
  const supabase = getSupabaseServiceClient()

  await requirePlaylist(playlistId, ctx.siteId)

  const parsed = assertValid(PipelineReorderSchema.safeParse(body))

  const { data: items } = await supabase
    .from('playlist_items')
    .select('id')
    .eq('playlist_id', playlistId)
    .in('id', parsed.item_ids)

  const foundIds = new Set((items ?? []).map(i => (i as { id: string }).id))
  const missing = parsed.item_ids.filter(id => !foundIds.has(id))
  if (missing.length > 0) {
    throw new PipelineServiceError(
      'VALIDATION_ERROR',
      `Items not found in playlist: ${missing.join(', ')}`,
      400,
    )
  }

  const errors: string[] = []
  await Promise.all(
    parsed.item_ids.map((id, index) =>
      supabase
        .from('playlist_items')
        .update({ sort_order: (index + 1) * 1000 })
        .eq('id', id)
        .eq('playlist_id', playlistId)
        .then(({ error }) => { if (error) errors.push(error.code ?? 'unknown') }),
    ),
  )

  if (errors.length > 0) {
    throw new PipelineServiceError('DB_ERROR', 'Failed to reorder items', 500)
  }

  return { data: { reordered: true, count: parsed.item_ids.length } }
}

/** Compute and persist a Sugiyama-based auto-layout for all items in the DAG (snapshot-wrapped). */
export async function autoLayoutService(
  ctx: ServiceContext,
  playlistId: string,
): Promise<ServiceResult<AutoLayoutResult>> {
  const graph = await getPlaylistGraph(playlistId, ctx.siteId)
  if (!graph) throw new PipelineServiceError('NOT_FOUND', 'Playlist not found', 404)

  return withSnapshot(playlistId, ctx.siteId, null, 'pre_destructive', 'API: auto-layout', async () => {
    if (graph.items.length === 0) {
      return { data: { positions: [], layers: 0 } }
    }

    const positions = computeAutoLayout(graph.items, graph.edges)

    const supabase = getSupabaseServiceClient()
    const errors: string[] = []
    await Promise.all(
      positions.map(p =>
        supabase
          .from('playlist_items')
          .update({ position_x: p.x, position_y: p.y })
          .eq('id', p.itemId)
          .eq('playlist_id', playlistId)
          .then(({ error }) => { if (error) errors.push(error.message) }),
      ),
    )

    if (errors.length > 0) {
      throw new PipelineServiceError('VALIDATION_ERROR', errors[0]!, 400)
    }

    const maxLayer = positions.reduce((max, p) => Math.max(max, p.x), 0)
    const layerCount = positions.length > 0 ? Math.floor(maxLayer / 200) + 1 : 0

    return {
      data: {
        positions: positions.map(p => ({
          item_id: p.itemId,
          position_x: p.x,
          position_y: p.y,
        })),
        layers: layerCount,
      },
    }
  })
}
