import { getSupabaseServiceClient } from '@/lib/supabase/service'

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

export async function resolveOrCreateTopics(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  siteId: string,
  topicSlug: string,
  cache?: Map<string, string>,
): Promise<{ topicId: string } | { error: string }> {
  const parts = parseTopicSlug(topicSlug)
  const resolvedIds: string[] = []
  let currentPath = ''

  for (let i = 0; i < parts.length; i++) {
    const slug = parts[i]!
    currentPath = currentPath ? `${currentPath}/${slug}` : slug

    const cached = cache?.get(currentPath)
    if (cached) {
      resolvedIds.push(cached)
      continue
    }

    const parentForInsert = resolvedIds.length > 0 ? resolvedIds[resolvedIds.length - 1]! : null

    const { data: existing } = await supabase
      .from('research_topics')
      .select('id')
      .eq('site_id', siteId)
      .eq('path', currentPath)
      .single()

    if (existing) {
      const id = existing.id as string
      resolvedIds.push(id)
      cache?.set(currentPath, id)
      continue
    }

    const { data: created, error } = await supabase
      .from('research_topics')
      .insert({ site_id: siteId, name: slugToName(slug), slug, path: currentPath, depth: i, parent_id: parentForInsert })
      .select('id')
      .single()

    if (error) return { error: `Failed to create topic "${currentPath}": ${error.message}` }
    const id = (created as { id: string }).id
    resolvedIds.push(id)
    cache?.set(currentPath, id)
  }

  const lastId = resolvedIds[resolvedIds.length - 1]
  if (!lastId) return { error: 'Empty topic slug' }
  return { topicId: lastId }
}
