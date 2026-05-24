import { describe, it, expect } from 'vitest'
import { computeGraphHash } from '@/lib/playlists/canvas/graph-hash'

describe('computeGraphHash', () => {
  const items = [
    { id: 'a', position_x: 100.12, position_y: 200.34, sort_order: 1000 },
    { id: 'b', position_x: 300.56, position_y: 400.78, sort_order: 2000 },
  ]
  const edges = [
    { source_item_id: 'a', target_item_id: 'b', edge_type: 'sequence' },
  ]

  it('produces a deterministic string hash', () => {
    const h1 = computeGraphHash(items, edges)
    const h2 = computeGraphHash(items, edges)
    expect(h1).toBe(h2)
    expect(typeof h1).toBe('string')
    expect(h1.length).toBeGreaterThan(0)
  })

  it('is order-independent (items/edges sorted internally)', () => {
    const reversed = [...items].reverse()
    expect(computeGraphHash(reversed, edges)).toBe(computeGraphHash(items, edges))
  })

  it('changes when an edge is added', () => {
    const moreEdges = [
      ...edges,
      { source_item_id: 'b', target_item_id: 'a', edge_type: 'related' },
    ]
    expect(computeGraphHash(items, moreEdges)).not.toBe(computeGraphHash(items, edges))
  })

  it('changes when a position changes by >= 0.1', () => {
    const moved = [{ ...items[0]!, position_x: 100.22 }, items[1]!]
    expect(computeGraphHash(moved, edges)).not.toBe(computeGraphHash(items, edges))
  })

  it('ignores sub-0.1 position noise (rounds to 1 decimal)', () => {
    const noisy = [{ ...items[0]!, position_x: 100.14 }, items[1]!]
    expect(computeGraphHash(noisy, edges)).toBe(computeGraphHash(items, edges))
  })

  it('changes when sort_order changes', () => {
    const reordered = [{ ...items[0]!, sort_order: 500 }, items[1]!]
    expect(computeGraphHash(reordered, edges)).not.toBe(computeGraphHash(items, edges))
  })

  it('produces empty-safe hash for no items/edges', () => {
    const hash = computeGraphHash([], [])
    expect(typeof hash).toBe('string')
    expect(hash.length).toBeGreaterThan(0)
  })
})
