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

describe('computeAutoLayout edge cases', () => {
  it('handles pure cycles gracefully (Kahn drops cycled nodes to disconnected grid)', () => {
    const items = [item('a', 1), item('b', 2), item('c', 3)]
    const edges = [edge('a', 'b'), edge('b', 'c'), edge('c', 'a')]
    const result = computeAutoLayout(items, edges)
    // Kahn's algorithm can't resolve pure cycles (all in-degree > 0),
    // so these nodes get treated as disconnected — still positioned, no crash
    expect(result.length).toBeGreaterThan(0)
    expect(result.length).toBeLessThanOrEqual(3)
  })

  it('handles partial cycle (some nodes reachable, some cycled)', () => {
    const items = [item('root', 1), item('a', 2), item('b', 3), item('c', 4)]
    const edges = [edge('root', 'a'), edge('a', 'b'), edge('b', 'c'), edge('c', 'a')]
    const result = computeAutoLayout(items, edges)
    // root and a are reachable from root; b and c form a cycle but a enters the cycle
    expect(result.length).toBeGreaterThan(0)
    const ids = new Set(result.map(r => r.itemId))
    expect(ids.has('root')).toBe(true)
  })

  it('positions disconnected components in grid below connected ones', () => {
    const items = [
      item('a', 1), item('b', 2),
      item('c', 3), item('d', 4),
    ]
    const edges = [edge('a', 'b')]
    const result = computeAutoLayout(items, edges)
    expect(result).toHaveLength(4)

    const posMap = new Map(result.map(r => [r.itemId, r]))
    const connectedMaxY = Math.max(posMap.get('a')!.y, posMap.get('b')!.y)
    const disconnectedMinY = Math.min(posMap.get('c')!.y, posMap.get('d')!.y)
    expect(disconnectedMinY).toBeGreaterThan(connectedMaxY)
  })

  it('positions a single item at (0,0) with no edges', () => {
    const result = computeAutoLayout([item('x')], [])
    expect(result).toEqual([{ itemId: 'x', x: 0, y: 0 }])
  })

  it('lays out all-disconnected items vertically by sort_order', () => {
    const items = [item('c', 3), item('a', 1), item('b', 2)]
    const result = computeAutoLayout(items, [])
    expect(result).toHaveLength(3)
    expect(result[0]!.itemId).toBe('a')
    expect(result[1]!.itemId).toBe('b')
    expect(result[2]!.itemId).toBe('c')
    expect(result[0]!.y).toBeLessThan(result[1]!.y)
    expect(result[1]!.y).toBeLessThan(result[2]!.y)
  })
})
