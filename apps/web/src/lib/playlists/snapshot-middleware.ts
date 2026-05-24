import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { computeGraphHash } from '@/lib/playlists/canvas/graph-hash'
import type { SnapshotType, SnapshotItem, SnapshotEdge } from '@/lib/playlists/types'

const EXPIRY_DAYS: Record<SnapshotType, number | null> = {
  auto: 30,
  manual: null,
  pre_destructive: 90,
  session_start: null,
}

const MAX_AUTO_PER_PLAYLIST = 100

interface SnapshotResult {
  id: string | null
  deduplicated: boolean
}

export async function createSnapshot(
  playlistId: string,
  siteId: string,
  userId: string | null,
  type: SnapshotType,
  label: string,
): Promise<SnapshotResult> {
  const supabase = getSupabaseServiceClient()

  const { data: items } = await supabase
    .from('playlist_items')
    .select('id, blog_post_id, newsletter_edition_id, pipeline_id, sort_order, position_x, position_y')
    .eq('playlist_id', playlistId)

  const { data: edges } = await supabase
    .from('playlist_edges')
    .select('id, source_item_id, target_item_id, edge_type, label')
    .eq('playlist_id', playlistId)

  const safeItems: SnapshotItem[] = (items ?? []).map(i => ({
    id: i.id,
    blog_post_id: i.blog_post_id,
    newsletter_edition_id: i.newsletter_edition_id,
    pipeline_id: i.pipeline_id,
    sort_order: i.sort_order,
    position_x: i.position_x,
    position_y: i.position_y,
  }))

  const safeEdges: SnapshotEdge[] = (edges ?? []).map(e => ({
    id: e.id,
    source_item_id: e.source_item_id,
    target_item_id: e.target_item_id,
    edge_type: e.edge_type,
    label: e.label,
  }))

  const contentHash = computeGraphHash(
    safeItems.map(i => ({ id: i.id, position_x: i.position_x, position_y: i.position_y, sort_order: i.sort_order })),
    safeEdges.map(e => ({ source_item_id: e.source_item_id, target_item_id: e.target_item_id, edge_type: e.edge_type })),
  )

  const contentTypes: Record<string, number> = {}
  for (const item of safeItems) {
    const ct = item.blog_post_id ? 'blog_post' : item.newsletter_edition_id ? 'newsletter' : item.pipeline_id ? 'pipeline' : 'unknown'
    contentTypes[ct] = (contentTypes[ct] ?? 0) + 1
  }

  const stats = {
    item_count: safeItems.length,
    edge_count: safeEdges.length,
    content_types: contentTypes,
  }

  const expiryDays = EXPIRY_DAYS[type]
  const expiresAt = expiryDays
    ? new Date(Date.now() + expiryDays * 86400000).toISOString()
    : null

  const { data: inserted, error } = await supabase
    .from('playlist_snapshots')
    .insert({
      playlist_id: playlistId,
      site_id: siteId,
      type,
      label,
      graph_data: { items: safeItems, edges: safeEdges },
      stats,
      content_hash: contentHash,
      created_by: userId,
      expires_at: expiresAt,
    })
    .select('id')
    .maybeSingle()

  if (error) {
    if (error.code === '23505') {
      return { id: null, deduplicated: true }
    }
    console.error('[snapshot] insert error:', error.message)
    return { id: null, deduplicated: false }
  }

  if (type === 'auto' && inserted) {
    const { data: excess } = await supabase
      .from('playlist_snapshots')
      .select('id')
      .eq('playlist_id', playlistId)
      .eq('type', 'auto')
      .order('created_at', { ascending: true })
      .limit(1000)

    if (excess && excess.length > MAX_AUTO_PER_PLAYLIST) {
      const idsToDelete = excess.slice(0, excess.length - MAX_AUTO_PER_PLAYLIST).map(r => r.id)
      await supabase.from('playlist_snapshots').delete().in('id', idsToDelete)
    }
  }

  return { id: inserted?.id ?? null, deduplicated: false }
}

const THROTTLE_MS = 5000
const MAX_THROTTLE_ENTRIES = 200
const recentSnapshots = new Map<string, number>()

function throttleKey(playlistId: string, trigger: SnapshotType): string {
  return `${playlistId}:${trigger}`
}

function isThrottled(key: string): boolean {
  const lastTime = recentSnapshots.get(key)
  if (!lastTime) return false
  return Date.now() - lastTime < THROTTLE_MS
}

function recordThrottle(key: string): void {
  if (recentSnapshots.size >= MAX_THROTTLE_ENTRIES) {
    const firstKey = recentSnapshots.keys().next().value
    if (firstKey) recentSnapshots.delete(firstKey)
  }
  recentSnapshots.set(key, Date.now())
}

export async function withSnapshot<T>(
  playlistId: string,
  siteId: string,
  userId: string | null,
  trigger: SnapshotType,
  label: string,
  fn: () => Promise<T>,
): Promise<T> {
  const key = throttleKey(playlistId, trigger)

  if (!isThrottled(key)) {
    recordThrottle(key)
    await createSnapshot(playlistId, siteId, userId, trigger, label)
  }

  return fn()
}
