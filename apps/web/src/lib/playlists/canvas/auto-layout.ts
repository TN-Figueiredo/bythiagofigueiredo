import type { PlaylistItemEnriched, PlaylistEdgeRow } from '../types'
import { NODE_WIDTH } from './utils'

const LAYER_GAP_X = 480
const NODE_GAP_Y = 160
const ORPHAN_COLS = 4
const ORPHAN_GAP_Y = 200
export const DIMMED_OFFSET_Y = 120

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
  const validEdges = edges.filter(
    e => items.some(i => i.id === e.source_item_id) && items.some(i => i.id === e.target_item_id),
  )

  // Identify connected vs disconnected items
  const connectedIds = new Set<string>()
  for (const e of sequenceEdges) {
    if (items.some(i => i.id === e.source_item_id)) connectedIds.add(e.source_item_id)
    if (items.some(i => i.id === e.target_item_id)) connectedIds.add(e.target_item_id)
  }

  const connectedItems = items.filter(i => connectedIds.has(i.id))
  const disconnectedItems = items.filter(i => !connectedIds.has(i.id))

  if (connectedItems.length === 0) {
    const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order)
    return sorted.map((it, i) => ({ itemId: it.id, x: 0, y: i * NODE_GAP_Y }))
  }

  // ── Phase 1: Kahn's topological sort (connected items only) ──

  const inDegree = new Map<string, number>()
  const adjacency = new Map<string, string[]>()

  for (const item of connectedItems) {
    inDegree.set(item.id, 0)
    adjacency.set(item.id, [])
  }

  for (const edge of sequenceEdges) {
    if (!inDegree.has(edge.source_item_id) || !inDegree.has(edge.target_item_id)) continue
    adjacency.get(edge.source_item_id)!.push(edge.target_item_id)
    inDegree.set(edge.target_item_id, (inDegree.get(edge.target_item_id) ?? 0) + 1)
  }

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
      const newDeg = (inDegree.get(next) ?? 0) - 1
      inDegree.set(next, newDeg)
      if (newDeg === 0) queue.push(next)
    }
  }

  // Nodes trapped in cycles never reach in-degree 0, so Kahn's skips them.
  // Treat them as disconnected so they still get positioned.
  for (const item of connectedItems) {
    if (!layers.has(item.id)) {
      disconnectedItems.push(item)
    }
  }

  // ── Phase 2: Group by layer, sort by sort_order ──

  const layerGroups = new Map<number, string[]>()
  for (const [id, layer] of layers) {
    if (!layerGroups.has(layer)) layerGroups.set(layer, [])
    layerGroups.get(layer)!.push(id)
  }

  const sortOrderMap = new Map(items.map(i => [i.id, i.sort_order]))
  for (const group of layerGroups.values()) {
    group.sort((a, b) => (sortOrderMap.get(a) ?? 0) - (sortOrderMap.get(b) ?? 0))
  }

  // ── Phase 3: Barycenter cross-minimization ──

  const allNeighbors = new Map<string, Set<string>>()
  for (const item of items) allNeighbors.set(item.id, new Set())
  for (const edge of validEdges) {
    allNeighbors.get(edge.source_item_id)?.add(edge.target_item_id)
    allNeighbors.get(edge.target_item_id)?.add(edge.source_item_id)
  }

  const sortedLayerKeys = [...layerGroups.keys()].sort((a, b) => a - b)
  const positionInLayer = new Map<string, number>()
  for (const group of layerGroups.values()) {
    for (let i = 0; i < group.length; i++) positionInLayer.set(group[i]!, i)
  }

  for (let sweep = 0; sweep < 8; sweep++) {
    const leftToRight = sweep % 2 === 0
    const order = leftToRight ? sortedLayerKeys : [...sortedLayerKeys].reverse()

    for (const layerKey of order) {
      const group = layerGroups.get(layerKey)!
      const barycenters = new Map<string, number>()

      for (const nodeId of group) {
        const neighbors = allNeighbors.get(nodeId)
        if (!neighbors) continue
        const adjacentPositions: number[] = []
        for (const nId of neighbors) {
          const nLayer = layers.get(nId)
          if (nLayer !== undefined && (nLayer === layerKey - 1 || nLayer === layerKey + 1)) {
            const pos = positionInLayer.get(nId)
            if (pos !== undefined) adjacentPositions.push(pos)
          }
        }
        if (adjacentPositions.length === 0) continue
        barycenters.set(nodeId, adjacentPositions.reduce((s, p) => s + p, 0) / adjacentPositions.length)
      }

      group.sort((a, b) => {
        const bcA = barycenters.get(a)
        const bcB = barycenters.get(b)
        if (bcA !== undefined && bcB !== undefined) return bcA - bcB
        if (bcA !== undefined) return -1
        if (bcB !== undefined) return 1
        return (sortOrderMap.get(a) ?? 0) - (sortOrderMap.get(b) ?? 0)
      })

      for (let i = 0; i < group.length; i++) positionInLayer.set(group[i]!, i)
    }
  }

  // ── Phase 4: Adjacent swap post-processing ──

  for (let pass = 0; pass < 3; pass++) {
    let improved = false
    for (const layerKey of sortedLayerKeys) {
      const group = layerGroups.get(layerKey)!
      if (group.length < 2) continue

      for (let i = 0; i < group.length - 1; i++) {
        let currentCrossings = 0
        let swappedCrossings = 0

        for (const adjKey of sortedLayerKeys) {
          if (adjKey !== layerKey - 1 && adjKey !== layerKey + 1) continue
          const adjGroup = layerGroups.get(adjKey)!
          const adjPos = new Map<string, number>()
          for (let j = 0; j < adjGroup.length; j++) adjPos.set(adjGroup[j]!, j)

          const countCrossings = (order: string[]) => {
            let crossings = 0
            for (let a = 0; a < order.length; a++) {
              for (let b = a + 1; b < order.length; b++) {
                const nA = allNeighbors.get(order[a]!)
                const nB = allNeighbors.get(order[b]!)
                if (!nA || !nB) continue
                for (const na of nA) {
                  const posNA = adjPos.get(na)
                  if (posNA === undefined) continue
                  for (const nb of nB) {
                    const posNB = adjPos.get(nb)
                    if (posNB === undefined) continue
                    if (posNA > posNB) crossings++
                  }
                }
              }
            }
            return crossings
          }

          currentCrossings += countCrossings(group)

          const swapped = [...group]
          ;[swapped[i], swapped[i + 1]] = [swapped[i + 1]!, swapped[i]!]
          swappedCrossings += countCrossings(swapped)
        }

        if (swappedCrossings < currentCrossings) {
          ;[group[i], group[i + 1]] = [group[i + 1]!, group[i]!]
          for (let j = 0; j < group.length; j++) positionInLayer.set(group[j]!, j)
          improved = true
        }
      }
    }
    if (!improved) break
  }

  // ── Phase 5: Coordinate assignment (connected items) ──

  let tallestLayer = 0
  for (const group of layerGroups.values()) {
    if (group.length > tallestLayer) tallestLayer = group.length
  }

  const positions: LayoutPosition[] = []

  for (const layerKey of sortedLayerKeys) {
    const group = layerGroups.get(layerKey)!
    const layerHeight = (group.length - 1) * NODE_GAP_Y
    const yOffset = ((tallestLayer - 1) * NODE_GAP_Y - layerHeight) / 2

    for (let i = 0; i < group.length; i++) {
      positions.push({
        itemId: group[i]!,
        x: layerKey * LAYER_GAP_X,
        y: yOffset + i * NODE_GAP_Y,
      })
    }
  }

  // ── Phase 6: Disconnected items in grid below ──

  if (disconnectedItems.length > 0) {
    disconnectedItems.sort((a, b) => a.sort_order - b.sort_order)

    let maxY = 0
    for (const p of positions) { if (p.y > maxY) maxY = p.y }
    const startY = positions.length > 0 ? maxY + ORPHAN_GAP_Y : 0

    for (let i = 0; i < disconnectedItems.length; i++) {
      const col = i % ORPHAN_COLS
      const row = Math.floor(i / ORPHAN_COLS)
      positions.push({
        itemId: disconnectedItems[i]!.id,
        x: col * LAYER_GAP_X,
        y: startY + row * NODE_GAP_Y,
      })
    }
  }

  return positions
}
