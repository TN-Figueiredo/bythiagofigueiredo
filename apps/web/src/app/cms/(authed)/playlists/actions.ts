'use server'

import { revalidatePath } from 'next/cache'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import {
  CreatePlaylistSchema,
  UpdatePlaylistSchema,
  AddItemSchema,
  CreateEdgeSchema,
  SaveDeltaSchema,
  type ActionResult,
  type PlaylistRow,
  type PlaylistGraph,
} from '@/lib/playlists/types'
import { getPlaylistGraph, getPlaylistBySlug, getNextSortOrder } from '@/lib/playlists/queries'

// ─── Auth helpers ────────────────────────────────────────────────────────────

async function requireEditScope(): Promise<{ siteId: string }> {
  const { siteId } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) {
    throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')
  }
  return { siteId }
}

// ─── Cache invalidation ───────────────────────────────────────────────────────

function revalidatePlaylists(): void {
  revalidatePath('/cms/playlists')
}

// ─── Playlist CRUD ───────────────────────────────────────────────────────────

export async function createPlaylist(
  siteId: string,
  input: unknown,
): Promise<ActionResult<PlaylistRow>> {
  await requireEditScope()

  const parsed = CreatePlaylistSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join(', ') }
  }

  const { name, slug, description, category, status } = parsed.data

  const existing = await getPlaylistBySlug(slug, siteId)
  if (existing) {
    return { ok: false, error: 'slug_already_exists' }
  }

  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('playlists')
    .insert({ site_id: siteId, name, slug, description: description ?? null, category: category ?? null, status })
    .select('*')
    .single()

  if (error) return { ok: false, error: error.message }

  revalidatePlaylists()
  return { ok: true, data: data as PlaylistRow }
}

export async function updatePlaylist(
  playlistId: string,
  siteId: string,
  input: unknown,
): Promise<ActionResult<PlaylistRow>> {
  await requireEditScope()

  const parsed = UpdatePlaylistSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join(', ') }
  }

  const patch = parsed.data

  if (patch.slug) {
    const existing = await getPlaylistBySlug(patch.slug, siteId)
    if (existing && existing.id !== playlistId) {
      return { ok: false, error: 'slug_already_exists' }
    }
  }

  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('playlists')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', playlistId)
    .eq('site_id', siteId)
    .select('*')
    .single()

  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: false, error: 'not_found' }

  revalidatePlaylists()
  return { ok: true, data: data as PlaylistRow }
}

export async function deletePlaylist(
  playlistId: string,
  siteId: string,
): Promise<ActionResult<void>> {
  await requireEditScope()

  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('playlists')
    .delete()
    .eq('id', playlistId)
    .eq('site_id', siteId)

  if (error) return { ok: false, error: error.message }

  revalidatePlaylists()
  return { ok: true, data: undefined }
}

// ─── Playlist Items ───────────────────────────────────────────────────────────

export async function addItemToPlaylist(
  siteId: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  await requireEditScope()

  const parsed = AddItemSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join(', ') }
  }

  const { playlistId, blogPostId, newsletterEditionId, pipelineId, sortOrder, positionX, positionY } = parsed.data

  if (!blogPostId && !newsletterEditionId && !pipelineId) {
    return { ok: false, error: 'At least one content reference is required' }
  }

  const supabase = getSupabaseServiceClient()

  // Check if already in playlist
  let dupCheck = supabase.from('playlist_items').select('id').eq('playlist_id', playlistId)
  if (blogPostId) dupCheck = dupCheck.eq('blog_post_id', blogPostId)
  else if (newsletterEditionId) dupCheck = dupCheck.eq('newsletter_edition_id', newsletterEditionId)
  else if (pipelineId) dupCheck = dupCheck.eq('pipeline_id', pipelineId)

  const { data: existing } = await dupCheck.maybeSingle()
  if (existing) return { ok: false, error: 'already_in_playlist' }

  const resolvedSortOrder = sortOrder ?? (await getNextSortOrder(playlistId))

  const { data, error } = await supabase
    .from('playlist_items')
    .insert({
      playlist_id: playlistId,
      blog_post_id: blogPostId ?? null,
      newsletter_edition_id: newsletterEditionId ?? null,
      pipeline_id: pipelineId ?? null,
      sort_order: resolvedSortOrder,
      position_x: positionX ?? 0,
      position_y: positionY ?? 0,
    })
    .select('id')
    .single()

  if (error) return { ok: false, error: error.message }

  revalidatePlaylists()
  return { ok: true, data: { id: (data as { id: string }).id } }
}

export async function removeItemFromPlaylist(
  playlistItemId: string,
  siteId: string,
): Promise<ActionResult<void>> {
  await requireEditScope()

  const supabase = getSupabaseServiceClient()

  // Verify item belongs to a playlist owned by this site
  const { data: item } = await supabase
    .from('playlist_items')
    .select('id, playlist_id, playlists!inner(site_id)')
    .eq('id', playlistItemId)
    .maybeSingle()

  if (!item) return { ok: false, error: 'not_found' }

  const itemRow = item as unknown as { id: string; playlist_id: string; playlists: Array<{ site_id: string }> }
  const itemSiteId = itemRow.playlists[0]?.site_id
  if (itemSiteId !== siteId) return { ok: false, error: 'forbidden' }

  const { error } = await supabase
    .from('playlist_items')
    .delete()
    .eq('id', playlistItemId)

  if (error) return { ok: false, error: error.message }

  revalidatePlaylists()
  return { ok: true, data: undefined }
}

// ─── Playlist Edges ───────────────────────────────────────────────────────────

export async function createEdge(
  siteId: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  await requireEditScope()

  const parsed = CreateEdgeSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join(', ') }
  }

  const { playlistId, sourceItemId, targetItemId, edgeType, label } = parsed.data

  if (sourceItemId === targetItemId) {
    return { ok: false, error: 'cycle_detected' }
  }

  const supabase = getSupabaseServiceClient()

  // Check duplicate edge
  const { data: existingEdge } = await supabase
    .from('playlist_edges')
    .select('id')
    .eq('playlist_id', playlistId)
    .eq('source_item_id', sourceItemId)
    .eq('target_item_id', targetItemId)
    .maybeSingle()

  if (existingEdge) return { ok: false, error: 'edge_already_exists' }

  const { data, error } = await supabase
    .from('playlist_edges')
    .insert({
      playlist_id: playlistId,
      source_item_id: sourceItemId,
      target_item_id: targetItemId,
      edge_type: edgeType,
      label: label ?? null,
    })
    .select('id')
    .single()

  if (error) {
    // Postgres cycle detection (e.g. via trigger or constraint with specific code)
    if (error.message.includes('cycle') || error.code === 'P0001') {
      return { ok: false, error: 'cycle_detected' }
    }
    return { ok: false, error: error.message }
  }

  revalidatePlaylists()
  return { ok: true, data: { id: (data as { id: string }).id } }
}

export async function deleteEdge(
  edgeId: string,
  siteId: string,
): Promise<ActionResult<void>> {
  await requireEditScope()

  const supabase = getSupabaseServiceClient()

  // Verify edge belongs to a playlist owned by this site
  const { data: edge } = await supabase
    .from('playlist_edges')
    .select('id, playlist_id, playlists!inner(site_id)')
    .eq('id', edgeId)
    .maybeSingle()

  if (!edge) return { ok: false, error: 'not_found' }

  const edgeRow = edge as unknown as { id: string; playlist_id: string; playlists: Array<{ site_id: string }> }
  const edgeSiteId = edgeRow.playlists[0]?.site_id
  if (edgeSiteId !== siteId) return { ok: false, error: 'forbidden' }

  const { error } = await supabase
    .from('playlist_edges')
    .delete()
    .eq('id', edgeId)

  if (error) return { ok: false, error: error.message }

  revalidatePlaylists()
  return { ok: true, data: undefined }
}

// ─── Delta Save (batch canvas mutations) ────────────────────────────────────

export async function savePlaylistDelta(
  siteId: string,
  input: unknown,
): Promise<ActionResult<void>> {
  await requireEditScope()

  const parsed = SaveDeltaSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join(', ') }
  }

  const { playlistId, itemsUpserted, itemsRemoved, edgesCreated, edgesRemoved } = parsed.data

  const supabase = getSupabaseServiceClient()

  // Verify playlist belongs to this site
  const { data: playlist } = await supabase
    .from('playlists')
    .select('id')
    .eq('id', playlistId)
    .eq('site_id', siteId)
    .maybeSingle()

  if (!playlist) return { ok: false, error: 'not_found' }

  const errors: string[] = []

  // Batch update item positions
  await Promise.all(
    itemsUpserted.map((item) =>
      supabase
        .from('playlist_items')
        .update({ position_x: item.position_x, position_y: item.position_y, sort_order: item.sort_order })
        .eq('id', item.id)
        .eq('playlist_id', playlistId)
        .then(({ error }) => { if (error) errors.push(error.message) }),
    ),
  )

  // Batch delete removed items
  if (itemsRemoved.length > 0) {
    const { error } = await supabase
      .from('playlist_items')
      .delete()
      .in('id', itemsRemoved)
      .eq('playlist_id', playlistId)
    if (error) errors.push(error.message)
  }

  // Batch delete removed edges
  if (edgesRemoved.length > 0) {
    const { error } = await supabase
      .from('playlist_edges')
      .delete()
      .in('id', edgesRemoved)
      .eq('playlist_id', playlistId)
    if (error) errors.push(error.message)
  }

  // Create new edges
  await Promise.all(
    edgesCreated.map((edge) =>
      supabase
        .from('playlist_edges')
        .insert({
          playlist_id: playlistId,
          source_item_id: edge.source_item_id,
          target_item_id: edge.target_item_id,
          edge_type: edge.edge_type,
          label: edge.label ?? null,
        })
        .then(({ error }) => { if (error) errors.push(error.message) }),
    ),
  )

  if (errors.length > 0) return { ok: false, error: errors[0]! }

  revalidatePlaylists()
  return { ok: true, data: undefined }
}

// ─── Viewport state ───────────────────────────────────────────────────────────

export async function saveViewportState(
  playlistId: string,
  siteId: string,
  viewport: { zoom: number; x: number; y: number },
): Promise<ActionResult<void>> {
  await requireEditScope()

  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('playlists')
    .update({ viewport_state: viewport, updated_at: new Date().toISOString() })
    .eq('id', playlistId)
    .eq('site_id', siteId)

  if (error) return { ok: false, error: error.message }

  // No cache invalidation needed — viewport is ephemeral UI state
  return { ok: true, data: undefined }
}

// ─── Reorder items ────────────────────────────────────────────────────────────

export async function reorderPlaylistItems(
  siteId: string,
  playlistId: string,
  itemIds: string[],
): Promise<ActionResult<void>> {
  await requireEditScope()

  if (itemIds.length === 0) return { ok: true, data: undefined }

  const supabase = getSupabaseServiceClient()

  // Verify playlist belongs to this site
  const { data: playlist } = await supabase
    .from('playlists')
    .select('id')
    .eq('id', playlistId)
    .eq('site_id', siteId)
    .maybeSingle()

  if (!playlist) return { ok: false, error: 'not_found' }

  const errors: string[] = []
  await Promise.all(
    itemIds.map((id, index) =>
      supabase
        .from('playlist_items')
        .update({ sort_order: (index + 1) * 1000 })
        .eq('id', id)
        .eq('playlist_id', playlistId)
        .then(({ error }) => { if (error) errors.push(error.message) }),
    ),
  )

  if (errors.length > 0) return { ok: false, error: errors[0]! }

  revalidatePlaylists()
  return { ok: true, data: undefined }
}

// ─── Status update (delegates to updatePlaylist) ──────────────────────────────

export async function updatePlaylistStatus(
  playlistId: string,
  siteId: string,
  status: 'draft' | 'published' | 'archived',
): Promise<ActionResult<PlaylistRow>> {
  return updatePlaylist(playlistId, siteId, { status })
}

// ─── Cowork API (read-only) ───────────────────────────────────────────────────

export async function getPlaylistWithItems(
  playlistId: string,
  siteId: string,
): Promise<ActionResult<PlaylistGraph>> {
  await requireEditScope()

  const graph = await getPlaylistGraph(playlistId, siteId)
  if (!graph) return { ok: false, error: 'not_found' }

  return { ok: true, data: graph }
}
