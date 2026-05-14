import { createClient } from '@supabase/supabase-js'
import { resolve } from 'path'
import { config } from 'dotenv'

config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, serviceKey)

const LAYER_GAP_X = 300
const NODE_GAP_Y = 110
const ORPHAN_COLS = 4
const ORPHAN_GAP_Y = 160

interface Item {
  id: string
  playlist_id: string
  sort_order: number
  position_x: number
  position_y: number
}

interface Edge {
  id: string
  playlist_id: string
  source_item_id: string
  target_item_id: string
  edge_type: string
}

interface LayoutPosition {
  itemId: string
  x: number
  y: number
}

function computeAutoLayout(items: Item[], edges: Edge[]): LayoutPosition[] {
  if (items.length === 0) return []

  const sequenceEdges = edges.filter(e => e.edge_type === 'sequence')
  const validEdges = edges.filter(
    e => items.some(i => i.id === e.source_item_id) && items.some(i => i.id === e.target_item_id),
  )

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

  // Phase 1: Kahn's topological sort
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
      const newDeg = (inDegree.get(next) ?? 1) - 1
      inDegree.set(next, newDeg)
      if (newDeg === 0) queue.push(next)
    }
  }

  // Phase 2: Group by layer
  const layerGroups = new Map<number, string[]>()
  for (const [id, layer] of layers) {
    if (!layerGroups.has(layer)) layerGroups.set(layer, [])
    layerGroups.get(layer)!.push(id)
  }

  const sortOrderMap = new Map(items.map(i => [i.id, i.sort_order]))
  for (const group of layerGroups.values()) {
    group.sort((a, b) => (sortOrderMap.get(a) ?? 0) - (sortOrderMap.get(b) ?? 0))
  }

  // Phase 3: Barycenter cross-minimization
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

  // Phase 4: Adjacent swap post-processing
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

          for (let a = 0; a < group.length; a++) {
            for (let b = a + 1; b < group.length; b++) {
              const nA = allNeighbors.get(group[a]!)
              const nB = allNeighbors.get(group[b]!)
              if (!nA || !nB) continue
              for (const na of nA) {
                const posNA = adjGroup.indexOf(na)
                if (posNA === -1) continue
                for (const nb of nB) {
                  const posNB = adjGroup.indexOf(nb)
                  if (posNB === -1) continue
                  if (posNA > posNB) currentCrossings++
                }
              }
            }
          }

          const swapped = [...group]
          ;[swapped[i], swapped[i + 1]] = [swapped[i + 1]!, swapped[i]!]
          for (let a = 0; a < swapped.length; a++) {
            for (let b = a + 1; b < swapped.length; b++) {
              const nA = allNeighbors.get(swapped[a]!)
              const nB = allNeighbors.get(swapped[b]!)
              if (!nA || !nB) continue
              for (const na of nA) {
                const posNA = adjGroup.indexOf(na)
                if (posNA === -1) continue
                for (const nb of nB) {
                  const posNB = adjGroup.indexOf(nb)
                  if (posNB === -1) continue
                  if (posNA > posNB) swappedCrossings++
                }
              }
            }
          }
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

  // Phase 5: Coordinate assignment
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

  // Phase 6: Disconnected items in grid below
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

async function main() {
  const { data: playlists, error: plErr } = await supabase
    .from('playlists')
    .select('id')

  if (plErr) { console.error('Failed to fetch playlists:', plErr); process.exit(1) }
  console.log(`Found ${playlists.length} playlists`)

  for (const pl of playlists) {
    const { data: items, error: iErr } = await supabase
      .from('playlist_items')
      .select('id, playlist_id, sort_order, position_x, position_y')
      .eq('playlist_id', pl.id)
      .order('sort_order')

    if (iErr) { console.error(`  [${pl.id}] items error:`, iErr); continue }
    if (!items || items.length === 0) { console.log(`  [${pl.id}] no items, skip`); continue }

    const { data: edges, error: eErr } = await supabase
      .from('playlist_edges')
      .select('id, playlist_id, source_item_id, target_item_id, edge_type')
      .eq('playlist_id', pl.id)

    if (eErr) { console.error(`  [${pl.id}] edges error:`, eErr); continue }

    const positions = computeAutoLayout(items, edges ?? [])
    console.log(`  [${pl.id}] ${items.length} items, ${(edges ?? []).length} edges → ${positions.length} positions`)

    for (const pos of positions) {
      const { error: uErr } = await supabase
        .from('playlist_items')
        .update({ position_x: Math.round(pos.x), position_y: Math.round(pos.y) })
        .eq('id', pos.itemId)

      if (uErr) console.error(`    update ${pos.itemId} failed:`, uErr)
    }

    console.log(`  [${pl.id}] ✓ positions saved`)
  }

  console.log('Done.')
}

main()
