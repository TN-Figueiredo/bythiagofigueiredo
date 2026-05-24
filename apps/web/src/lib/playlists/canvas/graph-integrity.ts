import type { PlaylistItemRow, PlaylistEdgeRow, IntegrityReport } from '@/lib/playlists/types'

export function checkGraphIntegrity(
  items: Pick<PlaylistItemRow, 'id' | 'position_x' | 'position_y'>[],
  edges: PlaylistEdgeRow[],
): IntegrityReport {
  const itemIds = new Set(items.map(i => i.id))

  const orphanedEdges = edges.filter(
    e => !itemIds.has(e.source_item_id) || !itemIds.has(e.target_item_id),
  )

  const invalidPositions = items.filter(
    i => !Number.isFinite(i.position_x) || !Number.isFinite(i.position_y),
  ) as PlaylistItemRow[]

  const seen = new Set<string>()
  const duplicateEdges: PlaylistEdgeRow[] = []
  for (const edge of edges) {
    const key = `${edge.source_item_id}→${edge.target_item_id}:${edge.edge_type}`
    if (seen.has(key)) {
      duplicateEdges.push(edge)
    } else {
      seen.add(key)
    }
  }

  return {
    valid: orphanedEdges.length === 0 && invalidPositions.length === 0 && duplicateEdges.length === 0,
    orphanedEdges,
    invalidPositions,
    duplicateEdges,
  }
}
