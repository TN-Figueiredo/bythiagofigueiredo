export function slugToName(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function parseTopicSlug(topicSlug: string): string[] {
  return topicSlug.split('/').filter(Boolean)
}

export const MAX_TOPIC_DEPTH = 2

export function validateTopicSlugDepth(topicSlug: string): boolean {
  const parts = parseTopicSlug(topicSlug)
  return parts.length > 0 && parts.length <= MAX_TOPIC_DEPTH + 1
}
