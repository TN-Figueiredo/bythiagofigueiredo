function cyrb53(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507)
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507)
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}

interface HashableItem {
  id: string
  position_x: number
  position_y: number
  sort_order: number
}

interface HashableEdge {
  source_item_id: string
  target_item_id: string
  edge_type: string
}

export function computeGraphHash(items: HashableItem[], edges: HashableEdge[]): string {
  const itemSig = items
    .map(i => `${i.id}|${i.position_x.toFixed(1)}|${i.position_y.toFixed(1)}|${i.sort_order}`)
    .sort()
    .join('\n')

  const edgeSig = edges
    .map(e => `${e.source_item_id}→${e.target_item_id}:${e.edge_type}`)
    .sort()
    .join('\n')

  return cyrb53(`${itemSig}\x00${edgeSig}`).toString(36)
}
