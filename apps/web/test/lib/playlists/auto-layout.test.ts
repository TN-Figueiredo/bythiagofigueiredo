import { describe, it, expect } from 'vitest'
import { computeAutoLayout, DIMMED_OFFSET_Y } from '@/lib/playlists/canvas/auto-layout'
import type { PlaylistItemEnriched } from '@/lib/playlists/types'
import type { PlaylistEdgeRow } from '@/lib/playlists/types'

function item(id: string, order = 1000): PlaylistItemEnriched {
  return {
    id,
    playlist_id: 'p1',
    blog_post_id: null,
    newsletter_edition_id: null,
    pipeline_id: null,
    sort_order: order,
    position_x: 0,
    position_y: 0,
    created_at: '2026-01-01',
    content_type: 'blog_post',
    title: id,
    status: null,
    category: null,
    metadata: null,
    is_ghost: false,
    other_playlist_count: 0,
    language: null,
  }
}

function edge(source: string, target: string): PlaylistEdgeRow {
  return {
    id: `${source}-${target}`,
    playlist_id: 'p1',
    source_item_id: source,
    target_item_id: target,
    edge_type: 'sequence',
    label: null,
    created_at: '2026-01-01',
  }
}

describe('computeAutoLayout', () => {
  it('returns empty for no items', () => {
    expect(computeAutoLayout([], [])).toEqual([])
  })

  it('places single node at origin', () => {
    const result = computeAutoLayout([item('a')], [])
    expect(result).toEqual([{ itemId: 'a', x: 0, y: 0 }])
  })

  it('assigns layers left-to-right based on sequence edges', () => {
    const items = [item('a', 1000), item('b', 2000), item('c', 3000)]
    const edges = [edge('a', 'b'), edge('b', 'c')]
    const result = computeAutoLayout(items, edges)

    const posMap = new Map(result.map(r => [r.itemId, r]))
    expect(posMap.get('a')!.x).toBeLessThan(posMap.get('b')!.x)
    expect(posMap.get('b')!.x).toBeLessThan(posMap.get('c')!.x)
  })

  it('sorts within layers by sort_order', () => {
    const items = [item('a', 2000), item('b', 1000)]
    const result = computeAutoLayout(items, [])

    const posMap = new Map(result.map(r => [r.itemId, r]))
    expect(posMap.get('b')!.y).toBeLessThan(posMap.get('a')!.y)
  })

  it('ignores non-sequence edges for layout', () => {
    const items = [item('a'), item('b')]
    const edges: PlaylistEdgeRow[] = [{
      ...edge('a', 'b'),
      edge_type: 'related',
    }]
    const result = computeAutoLayout(items, edges)
    const posMap = new Map(result.map(r => [r.itemId, r]))
    expect(posMap.get('a')!.x).toBe(posMap.get('b')!.x)
  })
})

describe('computeAutoLayout constants', () => {
  it('uses 480px horizontal gap between layers', () => {
    const items = [item('a', 1), item('b', 2)]
    const edges = [edge('a', 'b')]
    const positions = computeAutoLayout(items, edges)
    const posA = positions.find(p => p.itemId === 'a')!
    const posB = positions.find(p => p.itemId === 'b')!
    expect(posB.x - posA.x).toBe(480)
  })

  it('uses 160px vertical gap within layers', () => {
    const items = [item('a', 1), item('b', 2), item('c', 3)]
    const edges = [edge('a', 'b'), edge('a', 'c')]
    const positions = computeAutoLayout(items, edges)
    const layer1 = positions.filter(p => p.itemId === 'b' || p.itemId === 'c').sort((a, b) => a.y - b.y)
    expect(layer1[1]!.y - layer1[0]!.y).toBe(160)
  })

  it('positions all-disconnected items with NODE_GAP_Y (160px)', () => {
    const items = [item('a', 1), item('b', 2)]
    const positions = computeAutoLayout(items, [])
    expect(positions[1]!.y - positions[0]!.y).toBe(160)
  })

  it('exports DIMMED_OFFSET_Y as 120', () => {
    expect(DIMMED_OFFSET_Y).toBe(120)
  })
})
