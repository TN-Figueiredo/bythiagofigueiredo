import type { PlaylistItemEnriched, FilterState } from '../types'

export function matchesFilter(item: PlaylistItemEnriched, filter: FilterState): boolean {
  if (item.is_ghost) return false

  if (filter.types.size > 0 && (item.content_type === null || !filter.types.has(item.content_type))) {
    return false
  }

  if (filter.languages.size > 0 && (item.language === null || !filter.languages.has(item.language))) {
    return false
  }

  if (filter.search.length > 0 && !item.title.toLowerCase().includes(filter.search.toLowerCase())) {
    return false
  }

  return true
}

export function computeViewNumbers(
  items: PlaylistItemEnriched[],
  filter: FilterState,
): Map<string, number | null> {
  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order)
  const result = new Map<string, number | null>()
  let counter = 1

  for (const item of sorted) {
    if (matchesFilter(item, filter)) {
      result.set(item.id, counter++)
    } else {
      result.set(item.id, null)
    }
  }

  return result
}
