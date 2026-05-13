import type { PlaylistItemEnriched, PlaylistEdgeRow } from '../types'

export interface GraphState {
  items: PlaylistItemEnriched[]
  edges: PlaylistEdgeRow[]
  selectedItemIds: Set<string>
  selectedEdgeIds: Set<string>
}

export function initialGraphState(): GraphState {
  return {
    items: [],
    edges: [],
    selectedItemIds: new Set(),
    selectedEdgeIds: new Set(),
  }
}

export type GraphAction =
  | { type: 'LOAD'; items: PlaylistItemEnriched[]; edges: PlaylistEdgeRow[] }
  | { type: 'ADD_ITEM'; item: PlaylistItemEnriched }
  | { type: 'REMOVE_ITEM'; itemId: string }
  | { type: 'MOVE_ITEM'; itemId: string; x: number; y: number }
  | { type: 'MOVE_ITEMS'; moves: Array<{ itemId: string; x: number; y: number }> }
  | { type: 'ADD_EDGE'; edge: PlaylistEdgeRow }
  | { type: 'REMOVE_EDGE'; edgeId: string }
  | { type: 'SET_SELECTION'; itemIds: string[]; edgeIds: string[] }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'REORDER_ITEMS'; itemIds: string[] }
  | { type: 'SET_POSITIONS'; positions: Array<{ itemId: string; x: number; y: number }> }

export function graphReducer(state: GraphState, action: GraphAction): GraphState {
  switch (action.type) {
    case 'LOAD':
      return {
        ...state,
        items: action.items,
        edges: action.edges,
        selectedItemIds: new Set(),
        selectedEdgeIds: new Set(),
      }

    case 'ADD_ITEM':
      return { ...state, items: [...state.items, action.item] }

    case 'REMOVE_ITEM': {
      const id = action.itemId
      return {
        ...state,
        items: state.items.filter(i => i.id !== id),
        edges: state.edges.filter(
          e => e.source_item_id !== id && e.target_item_id !== id,
        ),
        selectedItemIds: setWithout(state.selectedItemIds, id),
      }
    }

    case 'MOVE_ITEM':
      return {
        ...state,
        items: state.items.map(i =>
          i.id === action.itemId
            ? { ...i, position_x: action.x, position_y: action.y }
            : i,
        ),
      }

    case 'MOVE_ITEMS': {
      const moveMap = new Map(action.moves.map(m => [m.itemId, m]))
      return {
        ...state,
        items: state.items.map(i => {
          const move = moveMap.get(i.id)
          return move ? { ...i, position_x: move.x, position_y: move.y } : i
        }),
      }
    }

    case 'ADD_EDGE':
      return { ...state, edges: [...state.edges, action.edge] }

    case 'REMOVE_EDGE':
      return {
        ...state,
        edges: state.edges.filter(e => e.id !== action.edgeId),
        selectedEdgeIds: setWithout(state.selectedEdgeIds, action.edgeId),
      }

    case 'SET_SELECTION':
      return {
        ...state,
        selectedItemIds: new Set(action.itemIds),
        selectedEdgeIds: new Set(action.edgeIds),
      }

    case 'CLEAR_SELECTION':
      return {
        ...state,
        selectedItemIds: new Set(),
        selectedEdgeIds: new Set(),
      }

    case 'REORDER_ITEMS': {
      const orderMap = new Map(action.itemIds.map((id, i) => [id, (i + 1) * 1000]))
      return {
        ...state,
        items: state.items.map(item => {
          const newOrder = orderMap.get(item.id)
          return newOrder !== undefined ? { ...item, sort_order: newOrder } : item
        }),
      }
    }

    case 'SET_POSITIONS': {
      const posMap = new Map(action.positions.map(p => [p.itemId, p]))
      return {
        ...state,
        items: state.items.map(item => {
          const pos = posMap.get(item.id)
          return pos ? { ...item, position_x: pos.x, position_y: pos.y } : item
        }),
      }
    }
  }
}

function setWithout(set: Set<string>, value: string): Set<string> {
  if (!set.has(value)) return set
  const next = new Set(set)
  next.delete(value)
  return next
}
