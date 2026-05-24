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
import { createSnapshot, withSnapshot } from '@/lib/playlists/snapshot-middleware'
import type { SnapshotType, SnapshotRow, RestoreMode } from '@/lib/playlists/types'

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

  const { name_en, name_pt, slug, description_pt, description_en, category, status } = parsed.data

  const existing = await getPlaylistBySlug(slug, siteId)
  if (existing) {
    return { ok: false, error: 'slug_already_exists' }
  }

  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('playlists')
    .insert({
      site_id: siteId,
      name_pt,
      name_en,
      slug,
      description_pt: description_pt ?? null,
      description_en: description_en ?? null,
      category: category ?? null,
      status,
    })
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
  const { data: { user } } = await supabase.auth.getUser()

  return withSnapshot(playlistId, siteId, user?.id ?? null, 'pre_destructive', 'Antes de deletar playlist', async () => {
    const { error } = await supabase
      .from('playlists')
      .delete()
      .eq('id', playlistId)
      .eq('site_id', siteId)

    if (error) return { ok: false, error: error.message } as ActionResult<void>

    revalidatePlaylists()
    return { ok: true, data: undefined } as ActionResult<void>
  })
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
    .select('id, playlist_id')
    .eq('id', playlistItemId)
    .maybeSingle()

  if (!item) return { ok: false, error: 'not_found' }

  const { data: playlist } = await supabase
    .from('playlists')
    .select('site_id')
    .eq('id', item.playlist_id)
    .single()

  if (!playlist || playlist.site_id !== siteId) return { ok: false, error: 'forbidden' }

  const { data: { user } } = await supabase.auth.getUser()

  return withSnapshot(item.playlist_id, siteId, user?.id ?? null, 'pre_destructive', 'Antes de remover item', async () => {
    const { error } = await supabase
      .from('playlist_items')
      .delete()
      .eq('id', playlistItemId)

    if (error) return { ok: false, error: error.message } as ActionResult<void>

    revalidatePlaylists()
    return { ok: true, data: undefined } as ActionResult<void>
  })
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
    .select('id, playlist_id')
    .eq('id', edgeId)
    .maybeSingle()

  if (!edge) return { ok: false, error: 'not_found' }

  const { data: edgePlaylist } = await supabase
    .from('playlists')
    .select('site_id')
    .eq('id', edge.playlist_id)
    .single()

  if (!edgePlaylist || edgePlaylist.site_id !== siteId) return { ok: false, error: 'forbidden' }

  const { data: { user } } = await supabase.auth.getUser()

  return withSnapshot(edge.playlist_id, siteId, user?.id ?? null, 'pre_destructive', 'Antes de remover edge', async () => {
    const { error } = await supabase
      .from('playlist_edges')
      .delete()
      .eq('id', edgeId)

    if (error) return { ok: false, error: error.message } as ActionResult<void>

    revalidatePlaylists()
    return { ok: true, data: undefined } as ActionResult<void>
  })
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

  if (itemsUpserted.length > 500) return { ok: false, error: 'payload_too_large' }
  if (itemsRemoved.length > 500) return { ok: false, error: 'payload_too_large' }
  if (edgesCreated.length > 200) return { ok: false, error: 'payload_too_large' }
  if (edgesRemoved.length > 200) return { ok: false, error: 'payload_too_large' }

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

// ─── Content picker (read-only) ──────────────────────────────────────────────

export interface PickerItem {
  id: string
  title: string
  type: 'blog_post' | 'newsletter' | 'pipeline'
  status: string | null
  category: string | null
  updatedAt: string
}

export async function getAvailableContent(
  siteId: string,
  playlistId: string,
): Promise<ActionResult<PickerItem[]>> {
  await requireEditScope()

  const supabase = getSupabaseServiceClient()

  const [blogRes, newsletterRes, pipelineRes, existingRes] = await Promise.all([
    supabase
      .from('blog_posts')
      .select('id, status, category, updated_at, blog_translations!inner(title, locale)')
      .eq('site_id', siteId)
      .order('updated_at', { ascending: false }),
    supabase
      .from('newsletter_editions')
      .select('id, subject, status, updated_at')
      .eq('site_id', siteId)
      .order('updated_at', { ascending: false }),
    supabase
      .from('content_pipeline')
      .select('id, title_pt, title_en, format, stage, updated_at')
      .eq('site_id', siteId)
      .eq('is_archived', false)
      .order('updated_at', { ascending: false }),
    supabase
      .from('playlist_items')
      .select('blog_post_id, newsletter_edition_id, pipeline_id')
      .eq('playlist_id', playlistId),
  ])

  const existing = new Set<string>()
  for (const row of (existingRes.data ?? []) as { blog_post_id: string | null; newsletter_edition_id: string | null; pipeline_id: string | null }[]) {
    if (row.blog_post_id) existing.add(row.blog_post_id)
    if (row.newsletter_edition_id) existing.add(row.newsletter_edition_id)
    if (row.pipeline_id) existing.add(row.pipeline_id)
  }

  const items: PickerItem[] = []

  for (const b of (blogRes.data ?? []) as { id: string; status: string | null; category: string | null; updated_at: string; blog_translations: { title: string; locale: string }[] }[]) {
    if (existing.has(b.id)) continue
    items.push({
      id: b.id,
      title: b.blog_translations?.[0]?.title ?? 'Untitled',
      type: 'blog_post',
      status: b.status,
      category: b.category,
      updatedAt: b.updated_at,
    })
  }

  for (const n of (newsletterRes.data ?? []) as { id: string; subject: string; status: string | null; updated_at: string }[]) {
    if (existing.has(n.id)) continue
    items.push({
      id: n.id,
      title: n.subject || 'Untitled',
      type: 'newsletter',
      status: n.status,
      category: null,
      updatedAt: n.updated_at,
    })
  }

  for (const p of (pipelineRes.data ?? []) as { id: string; title_pt: string | null; title_en: string | null; format: string | null; stage: string | null; updated_at: string }[]) {
    if (existing.has(p.id)) continue
    items.push({
      id: p.id,
      title: p.title_en || p.title_pt || 'Untitled',
      type: 'pipeline',
      status: p.stage,
      category: p.format,
      updatedAt: p.updated_at,
    })
  }

  return { ok: true, data: items }
}

// ─── Notes ───────────────────────────────────────────────────────────────────

export async function updatePlaylistNotes(
  playlistId: string,
  siteId: string,
  notes: Record<string, unknown> | null,
): Promise<ActionResult<void>> {
  await requireEditScope()

  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('playlists')
    .update({ notes, updated_at: new Date().toISOString() })
    .eq('id', playlistId)
    .eq('site_id', siteId)

  if (error) return { ok: false, error: error.message }
  return { ok: true, data: undefined }
}

// ─── Reuse candidates ────────────────────────────────────────────────────────

export interface ReuseCandidateItem {
  id: string
  title: string
  format: string
  language: string
  stage: string
  tags: string[]
}

export async function getReuseCandidates(
  siteId: string,
  playlistId: string,
): Promise<ActionResult<ReuseCandidateItem[]>> {
  await requireEditScope()

  const supabase = getSupabaseServiceClient()

  const [pipelineRes, playlistItemsRes] = await Promise.all([
    supabase
      .from('content_pipeline')
      .select('id, title_pt, title_en, format, stage, language, tags')
      .eq('site_id', siteId)
      .eq('is_archived', false)
      .limit(200),
    supabase
      .from('playlist_items')
      .select('pipeline_id, content_pipeline(tags)')
      .eq('playlist_id', playlistId)
      .not('pipeline_id', 'is', null),
  ])

  const existingIds = new Set(
    ((playlistItemsRes.data ?? []) as { pipeline_id: string }[]).map(r => r.pipeline_id),
  )

  const playlistTagSet = new Set<string>()
  for (const row of (playlistItemsRes.data ?? []) as unknown as {
    pipeline_id: string
    content_pipeline: { tags: string[] }[] | null
  }[]) {
    for (const tag of row.content_pipeline?.[0]?.tags ?? []) {
      playlistTagSet.add(tag)
    }
  }

  type PipelineRow = {
    id: string
    title_pt: string | null
    title_en: string | null
    format: string
    stage: string
    language: string
    tags: string[]
  }

  const scored: Array<{ item: ReuseCandidateItem; score: number }> = []
  for (const p of (pipelineRes.data ?? []) as PipelineRow[]) {
    if (existingIds.has(p.id)) continue
    if ((p.tags ?? []).length === 0) continue

    const score = p.tags.filter(t => playlistTagSet.has(t)).length

    scored.push({
      item: {
        id: p.id,
        title: p.title_en || p.title_pt || 'Untitled',
        format: p.format,
        language: p.language,
        stage: p.stage,
        tags: p.tags,
      },
      score,
    })
  }

  scored.sort((a, b) => b.score - a.score)

  return { ok: true, data: scored.slice(0, 15).map(s => s.item) }
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

// ─── Snapshot Actions ────────────────────────────────────────────────────────

export async function createPlaylistSnapshot(
  siteId: string,
  playlistId: string,
  type: SnapshotType,
  label: string,
): Promise<ActionResult<{ id: string | null; deduplicated: boolean }>> {
  const { siteId: authSiteId } = await requireEditScope()
  if (authSiteId !== siteId) return { ok: false, error: 'forbidden' }

  const supabase = getSupabaseServiceClient()
  const { data: { user } } = await supabase.auth.getUser()

  const result = await createSnapshot(playlistId, siteId, user?.id ?? null, type, label)
  return { ok: true, data: result }
}

export async function listPlaylistSnapshots(
  siteId: string,
  playlistId: string,
  cursor?: string,
  limit = 50,
): Promise<ActionResult<{ snapshots: SnapshotRow[]; hasMore: boolean }>> {
  await requireEditScope()

  const supabase = getSupabaseServiceClient()
  let query = supabase
    .from('playlist_snapshots')
    .select('*')
    .eq('playlist_id', playlistId)
    .eq('site_id', siteId)
    .order('created_at', { ascending: false })
    .limit(limit + 1)

  if (cursor) {
    query = query.lt('created_at', cursor)
  }

  const { data, error } = await query

  if (error) return { ok: false, error: error.message }

  const hasMore = (data?.length ?? 0) > limit
  const snapshots = (data ?? []).slice(0, limit) as SnapshotRow[]

  return { ok: true, data: { snapshots, hasMore } }
}

export async function restorePlaylistSnapshot(
  siteId: string,
  playlistId: string,
  snapshotId: string,
  mode: RestoreMode,
): Promise<ActionResult<void>> {
  const { siteId: authSiteId } = await requireEditScope()
  if (authSiteId !== siteId) return { ok: false, error: 'forbidden' }

  const supabase = getSupabaseServiceClient()
  const { data: { user } } = await supabase.auth.getUser()

  await createSnapshot(playlistId, siteId, user?.id ?? null, 'pre_destructive', `Antes de restaurar (${mode})`)

  const { error } = await supabase.rpc('restore_playlist_snapshot', {
    p_playlist_id: playlistId,
    p_snapshot_id: snapshotId,
    p_mode: mode,
  })

  if (error) return { ok: false, error: error.message }

  revalidatePlaylists()
  return { ok: true, data: undefined }
}

export async function renamePlaylistSnapshot(
  siteId: string,
  snapshotId: string,
  label: string,
): Promise<ActionResult<void>> {
  await requireEditScope()

  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('playlist_snapshots')
    .update({ label })
    .eq('id', snapshotId)
    .eq('site_id', siteId)

  if (error) return { ok: false, error: error.message }
  return { ok: true, data: undefined }
}

export async function deletePlaylistSnapshot(
  siteId: string,
  snapshotId: string,
): Promise<ActionResult<void>> {
  await requireEditScope()

  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('playlist_snapshots')
    .delete()
    .eq('id', snapshotId)
    .eq('site_id', siteId)
    .in('type', ['manual', 'session_start'])

  if (error) return { ok: false, error: error.message }
  return { ok: true, data: undefined }
}

export async function getItemEdgeCount(
  siteId: string,
  playlistId: string,
  itemId: string,
): Promise<ActionResult<{ count: number; edges: Array<{ id: string; target_title: string; edge_type: string }> }>> {
  await requireEditScope()

  const supabase = getSupabaseServiceClient()

  const { data: edges, error } = await supabase
    .from('playlist_edges')
    .select('id, source_item_id, target_item_id, edge_type')
    .eq('playlist_id', playlistId)
    .or(`source_item_id.eq.${itemId},target_item_id.eq.${itemId}`)

  if (error) return { ok: false, error: error.message }

  const connectedItemIds = (edges ?? []).map(e =>
    e.source_item_id === itemId ? e.target_item_id : e.source_item_id,
  )

  let edgeDetails: Array<{ id: string; target_title: string; edge_type: string }> = []
  if (connectedItemIds.length > 0) {
    const { data: items } = await supabase
      .from('playlist_items')
      .select('id, blog_post_id, pipeline_id, newsletter_edition_id')
      .in('id', connectedItemIds.slice(0, 5))

    edgeDetails = (edges ?? []).slice(0, 5).map(e => {
      const otherId = e.source_item_id === itemId ? e.target_item_id : e.source_item_id
      const item = items?.find(i => i.id === otherId)
      const title = item?.blog_post_id ?? item?.pipeline_id ?? item?.newsletter_edition_id ?? 'Item'
      return { id: e.id, target_title: title as string, edge_type: e.edge_type }
    })
  }

  return { ok: true, data: { count: (edges ?? []).length, edges: edgeDetails } }
}

export async function ensureSessionSnapshot(
  siteId: string,
  playlistId: string,
): Promise<ActionResult<void>> {
  await requireEditScope()

  const supabase = getSupabaseServiceClient()

  const oneHourAgo = new Date(Date.now() - 3600000).toISOString()
  const { data: recent } = await supabase
    .from('playlist_snapshots')
    .select('id')
    .eq('playlist_id', playlistId)
    .gt('created_at', oneHourAgo)
    .limit(1)

  if (recent && recent.length > 0) {
    return { ok: true, data: undefined }
  }

  const { data: { user } } = await supabase.auth.getUser()
  await createSnapshot(playlistId, siteId, user?.id ?? null, 'session_start', 'Início da sessão')

  return { ok: true, data: undefined }
}
