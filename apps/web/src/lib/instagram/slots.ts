import type { InstagramPostRow, InstagramFeedSlotRow, ResolvedSlot } from './types'
import { toPostView } from './types'

export function resolveSlots(
  slots: InstagramFeedSlotRow[],
  allPosts: InstagramPostRow[],
  count: number,
): ResolvedSlot[] {
  const postMap = new Map(allPosts.map((p) => [p.id, p]))
  const sortedSlots = [...slots]
    .sort((a, b) => a.position - b.position)
    .slice(0, count)

  const pinnedPostIds = new Set<string>()
  for (const slot of sortedSlots) {
    if (slot.post_id && postMap.has(slot.post_id)) {
      pinnedPostIds.add(slot.post_id)
    }
  }

  const latestPool = allPosts
    .filter((p) => !pinnedPostIds.has(p.id))
    .sort((a, b) => new Date(b.ig_timestamp).getTime() - new Date(a.ig_timestamp).getTime())

  let poolIdx = 0
  const resolved: ResolvedSlot[] = []

  if (sortedSlots.length === 0) {
    for (let i = 0; i < count && poolIdx < latestPool.length; i++) {
      resolved.push({
        position: i + 1,
        post: toPostView(latestPool[poolIdx++]!),
        pinned: false,
      })
    }
    return resolved
  }

  for (const slot of sortedSlots) {
    if (slot.post_id && postMap.has(slot.post_id)) {
      resolved.push({
        position: slot.position,
        post: toPostView(postMap.get(slot.post_id)!),
        pinned: true,
      })
    } else if (poolIdx < latestPool.length) {
      resolved.push({
        position: slot.position,
        post: toPostView(latestPool[poolIdx++]!),
        pinned: false,
      })
    }
  }

  let nextPosition = sortedSlots.length > 0
    ? Math.max(...sortedSlots.map(s => s.position)) + 1
    : resolved.length + 1

  while (resolved.length < count && poolIdx < latestPool.length) {
    resolved.push({
      position: nextPosition++,
      post: toPostView(latestPool[poolIdx++]!),
      pinned: false,
    })
  }

  return resolved
}
