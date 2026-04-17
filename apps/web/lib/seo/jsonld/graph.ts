import type { JsonLdGraph, JsonLdNode } from './types'

export function composeGraph(nodes: JsonLdNode[]): JsonLdGraph {
  const deduped = dedupeBy_id(nodes)
  return { '@context': 'https://schema.org', '@graph': deduped }
}

function dedupeBy_id(nodes: JsonLdNode[]): JsonLdNode[] {
  const byId = new Map<string, JsonLdNode>()
  const noId: JsonLdNode[] = []
  for (const n of nodes) {
    if (typeof n['@id'] === 'string') {
      const existing = byId.get(n['@id'])
      if (!existing || countKeys(n) > countKeys(existing)) {
        byId.set(n['@id'], n)
      }
    } else {
      noId.push(n)
    }
  }
  return [...byId.values(), ...noId]
}

function countKeys(n: JsonLdNode): number {
  return Object.keys(n).length
}
