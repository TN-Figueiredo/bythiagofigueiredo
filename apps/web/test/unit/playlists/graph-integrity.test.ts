import { describe, it, expect } from 'vitest'
import { checkGraphIntegrity } from '@/lib/playlists/canvas/graph-integrity'
import type { PlaylistItemRow, PlaylistEdgeRow } from '@/lib/playlists/types'

const makeItem = (id: string, x = 100, y = 200): PlaylistItemRow => ({
  id,
  playlist_id: 'pl-1',
  blog_post_id: null,
  newsletter_edition_id: null,
  pipeline_id: null,
  sort_order: 1000,
  position_x: x,
  position_y: y,
  created_at: '2026-01-01',
})

const makeEdge = (id: string, src: string, tgt: string): PlaylistEdgeRow => ({
  id,
  playlist_id: 'pl-1',
  source_item_id: src,
  target_item_id: tgt,
  edge_type: 'sequence',
  label: null,
  created_at: '2026-01-01',
})

describe('checkGraphIntegrity', () => {
  it('returns valid for a healthy graph', () => {
    const items = [makeItem('a'), makeItem('b')]
    const edges = [makeEdge('e1', 'a', 'b')]
    const report = checkGraphIntegrity(items, edges)
    expect(report.valid).toBe(true)
    expect(report.orphanedEdges).toHaveLength(0)
    expect(report.invalidPositions).toHaveLength(0)
    expect(report.duplicateEdges).toHaveLength(0)
  })

  it('detects orphaned edges (source missing)', () => {
    const items = [makeItem('b')]
    const edges = [makeEdge('e1', 'gone', 'b')]
    const report = checkGraphIntegrity(items, edges)
    expect(report.valid).toBe(false)
    expect(report.orphanedEdges).toHaveLength(1)
    expect(report.orphanedEdges[0]!.id).toBe('e1')
  })

  it('detects orphaned edges (target missing)', () => {
    const items = [makeItem('a')]
    const edges = [makeEdge('e1', 'a', 'gone')]
    const report = checkGraphIntegrity(items, edges)
    expect(report.valid).toBe(false)
    expect(report.orphanedEdges).toHaveLength(1)
  })

  it('detects NaN positions', () => {
    const items = [makeItem('a', NaN, 200)]
    const report = checkGraphIntegrity(items, [])
    expect(report.valid).toBe(false)
    expect(report.invalidPositions).toHaveLength(1)
  })

  it('detects Infinity positions', () => {
    const items = [makeItem('a', 100, Infinity)]
    const report = checkGraphIntegrity(items, [])
    expect(report.valid).toBe(false)
    expect(report.invalidPositions).toHaveLength(1)
  })

  it('detects duplicate edges (same source+target+type)', () => {
    const items = [makeItem('a'), makeItem('b')]
    const edges = [makeEdge('e1', 'a', 'b'), makeEdge('e2', 'a', 'b')]
    const report = checkGraphIntegrity(items, edges)
    expect(report.valid).toBe(false)
    expect(report.duplicateEdges).toHaveLength(1)
  })

  it('allows same source+target with different edge_type', () => {
    const items = [makeItem('a'), makeItem('b')]
    const e1: PlaylistEdgeRow = { ...makeEdge('e1', 'a', 'b'), edge_type: 'sequence' }
    const e2: PlaylistEdgeRow = { ...makeEdge('e2', 'a', 'b'), edge_type: 'related' }
    const report = checkGraphIntegrity(items, [e1, e2])
    expect(report.valid).toBe(true)
    expect(report.duplicateEdges).toHaveLength(0)
  })

  it('handles empty graph', () => {
    const report = checkGraphIntegrity([], [])
    expect(report.valid).toBe(true)
  })
})
