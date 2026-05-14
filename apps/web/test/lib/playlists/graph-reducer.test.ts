import { describe, it, expect } from 'vitest'
import {
  graphReducer,
  initialGraphState,
  type GraphState,
  type GraphAction,
} from '@/lib/playlists/canvas/graph-reducer'

function makeItem(id: string, x = 0, y = 0, order = 1000) {
  return {
    id,
    playlist_id: 'p1',
    blog_post_id: null,
    newsletter_edition_id: null,
    pipeline_id: null,
    sort_order: order,
    position_x: x,
    position_y: y,
    created_at: '2026-01-01',
    content_type: 'blog_post' as const,
    title: `Item ${id}`,
    status: 'draft',
    category: null,
    metadata: null,
    is_ghost: false,
    other_playlist_count: 0,
    language: null,
  }
}

function makeEdge(id: string, source: string, target: string, type = 'sequence' as const) {
  return {
    id,
    playlist_id: 'p1',
    source_item_id: source,
    target_item_id: target,
    edge_type: type,
    label: null,
    created_at: '2026-01-01',
  }
}

describe('graphReducer', () => {
  it('ADD_ITEM adds an item to state', () => {
    const state = initialGraphState()
    const item = makeItem('a', 100, 200)
    const next = graphReducer(state, { type: 'ADD_ITEM', item })
    expect(next.items).toHaveLength(1)
    expect(next.items[0].id).toBe('a')
  })

  it('REMOVE_ITEM removes item and connected edges', () => {
    const state: GraphState = {
      ...initialGraphState(),
      items: [makeItem('a'), makeItem('b'), makeItem('c')],
      edges: [makeEdge('e1', 'a', 'b'), makeEdge('e2', 'b', 'c')],
    }
    const next = graphReducer(state, { type: 'REMOVE_ITEM', itemId: 'b' })
    expect(next.items).toHaveLength(2)
    expect(next.edges).toHaveLength(0)
  })

  it('MOVE_ITEM updates position', () => {
    const state: GraphState = {
      ...initialGraphState(),
      items: [makeItem('a', 0, 0)],
    }
    const next = graphReducer(state, { type: 'MOVE_ITEM', itemId: 'a', x: 300, y: 400 })
    expect(next.items[0].position_x).toBe(300)
    expect(next.items[0].position_y).toBe(400)
  })

  it('MOVE_ITEMS moves multiple items by delta', () => {
    const state: GraphState = {
      ...initialGraphState(),
      items: [makeItem('a', 100, 100), makeItem('b', 200, 200)],
    }
    const next = graphReducer(state, {
      type: 'MOVE_ITEMS',
      moves: [
        { itemId: 'a', x: 150, y: 150 },
        { itemId: 'b', x: 250, y: 250 },
      ],
    })
    expect(next.items[0].position_x).toBe(150)
    expect(next.items[1].position_x).toBe(250)
  })

  it('ADD_EDGE adds edge', () => {
    const state: GraphState = {
      ...initialGraphState(),
      items: [makeItem('a'), makeItem('b')],
    }
    const edge = makeEdge('e1', 'a', 'b')
    const next = graphReducer(state, { type: 'ADD_EDGE', edge })
    expect(next.edges).toHaveLength(1)
  })

  it('REMOVE_EDGE removes edge', () => {
    const state: GraphState = {
      ...initialGraphState(),
      items: [makeItem('a'), makeItem('b')],
      edges: [makeEdge('e1', 'a', 'b')],
    }
    const next = graphReducer(state, { type: 'REMOVE_EDGE', edgeId: 'e1' })
    expect(next.edges).toHaveLength(0)
  })

  it('SET_SELECTION selects items', () => {
    const state = initialGraphState()
    const next = graphReducer(state, { type: 'SET_SELECTION', itemIds: ['a', 'b'], edgeIds: [] })
    expect(next.selectedItemIds).toEqual(new Set(['a', 'b']))
  })

  it('CLEAR_SELECTION clears all', () => {
    const state: GraphState = {
      ...initialGraphState(),
      selectedItemIds: new Set(['a']),
      selectedEdgeIds: new Set(['e1']),
    }
    const next = graphReducer(state, { type: 'CLEAR_SELECTION' })
    expect(next.selectedItemIds.size).toBe(0)
    expect(next.selectedEdgeIds.size).toBe(0)
  })

  it('REORDER_ITEMS assigns sequential sort_order', () => {
    const state: GraphState = {
      ...initialGraphState(),
      items: [makeItem('a', 0, 0, 3000), makeItem('b', 0, 0, 1000), makeItem('c', 0, 0, 2000)],
    }
    const next = graphReducer(state, { type: 'REORDER_ITEMS', itemIds: ['b', 'c', 'a'] })
    const ordered = next.items.sort((a, b) => a.sort_order - b.sort_order)
    expect(ordered[0].id).toBe('b')
    expect(ordered[1].id).toBe('c')
    expect(ordered[2].id).toBe('a')
    expect(ordered[0].sort_order).toBe(1000)
    expect(ordered[1].sort_order).toBe(2000)
    expect(ordered[2].sort_order).toBe(3000)
  })

  it('SET_POSITIONS batch updates positions', () => {
    const state: GraphState = {
      ...initialGraphState(),
      items: [makeItem('a', 0, 0), makeItem('b', 0, 0)],
    }
    const next = graphReducer(state, {
      type: 'SET_POSITIONS',
      positions: [
        { itemId: 'a', x: 100, y: 200 },
        { itemId: 'b', x: 300, y: 400 },
      ],
    })
    expect(next.items.find(i => i.id === 'a')!.position_x).toBe(100)
    expect(next.items.find(i => i.id === 'b')!.position_x).toBe(300)
  })

  it('LOAD replaces state and clears selection', () => {
    const state: GraphState = {
      ...initialGraphState(),
      items: [makeItem('old')],
      selectedItemIds: new Set(['old']),
    }
    const newItems = [makeItem('new1'), makeItem('new2')]
    const next = graphReducer(state, { type: 'LOAD', items: newItems, edges: [] })
    expect(next.items).toHaveLength(2)
    expect(next.selectedItemIds.size).toBe(0)
  })
})
