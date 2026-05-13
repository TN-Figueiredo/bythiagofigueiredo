import type { PlaylistItemEnriched, PlaylistEdgeRow } from '../types'

const LAYER_GAP_X = 200
const NODE_GAP_Y = 120

interface LayoutPosition {
  itemId: string
  x: number
  y: number
}

export function computeAutoLayout(
  items: PlaylistItemEnriched[],
  edges: PlaylistEdgeRow[],
): LayoutPosition[] {
  if (items.length === 0) return []

  const sequenceEdges = edges.filter(e => e.edge_type === 'sequence')

  const inDegree = new Map<string, number>()
  const adjacency = new Map<string, string[]>()

  for (const item of items) {
    inDegree.set(item.id, 0)
    adjacency.set(item.id, [])
  }

  for (const edge of sequenceEdges) {
    if (!inDegree.has(edge.source_item_id) || !inDegree.has(edge.target_item_id)) continue
    adjacency.get(edge.source_item_id)!.push(edge.target_item_id)
    inDegree.set(edge.target_item_id, (inDegree.get(edge.target_item_id) ?? 0) + 1)
  }

  // Kahn's algorithm — topological sort for layer assignment
  const layers = new Map<string, number>()
  const queue: string[] = []

  for (const [id, deg] of inDegree) {
    if (deg === 0) {
      queue.push(id)
      layers.set(id, 0)
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!
    const currentLayer = layers.get(current)!

    for (const next of adjacency.get(current) ?? []) {
      const newLayer = currentLayer + 1
      layers.set(next, Math.max(layers.get(next) ?? 0, newLayer))

      const newDeg = (inDegree.get(next) ?? 1) - 1
      inDegree.set(next, newDeg)
      if (newDeg === 0) {
        queue.push(next)
      }
    }
  }

  // Items not reached by sequence edges go to layer 0
  for (const item of items) {
    if (!layers.has(item.id)) {
      layers.set(item.id, 0)
    }
  }

  // Distribute disconnected nodes (no sequence edges) after the main graph
  const MAX_PER_COLUMN = 5
  const connectedIds = new Set<string>()
  for (const e of sequenceEdges) {
    if (items.some(i => i.id === e.source_item_id)) connectedIds.add(e.source_item_id)
    if (items.some(i => i.id === e.target_item_id)) connectedIds.add(e.target_item_id)
  }

  if (connectedIds.size > 0) {
    const disconnected = items.filter(i => !connectedIds.has(i.id))
    if (disconnected.length > MAX_PER_COLUMN) {
      const maxConnectedLayer = Math.max(...[...layers.entries()]
        .filter(([id]) => connectedIds.has(id))
        .map(([, l]) => l), 0)
      const startLayer = maxConnectedLayer + 2
      for (let i = 0; i < disconnected.length; i++) {
        layers.set(disconnected[i]!.id, startLayer + Math.floor(i / MAX_PER_COLUMN))
      }
    }
  }

  // Group by layer, sort within each layer by sort_order
  const layerGroups = new Map<number, PlaylistItemEnriched[]>()
  for (const item of items) {
    const layer = layers.get(item.id) ?? 0
    if (!layerGroups.has(layer)) layerGroups.set(layer, [])
    layerGroups.get(layer)!.push(item)
  }

  for (const group of layerGroups.values()) {
    group.sort((a, b) => a.sort_order - b.sort_order)
  }

  const sortedLayers = [...layerGroups.entries()].sort(([a], [b]) => a - b)

  const positions: LayoutPosition[] = []
  for (const [layerIndex, group] of sortedLayers) {
    for (let i = 0; i < group.length; i++) {
      positions.push({
        itemId: group[i]!.id,
        x: layerIndex * LAYER_GAP_X,
        y: i * NODE_GAP_Y,
      })
    }
  }

  return positions
}
