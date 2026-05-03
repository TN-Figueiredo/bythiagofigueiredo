import { unstable_cache } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

export interface AuthorRecord {
  id: string
  name: string
  display_name: string | null
  slug: string
  bio: string | null
  bio_md: string | null
  avatar_url: string | null
  social_links: Record<string, string> | null
  is_default: boolean
}

/**
 * Fetches author by ID and tags the cache entry with the specific author ID
 * so CMS edits can surgically invalidate it via `revalidateTag('author:${id}')`.
 *
 * This is the only query function needed — the per-author tag enables surgical
 * cache invalidation without a generic catch-all.
 */
export async function getAuthorByIdTagged(authorId: string): Promise<AuthorRecord | null> {
  const fn = unstable_cache(
    async (id: string): Promise<AuthorRecord | null> => {
      const supabase = getSupabaseServiceClient()
      const { data, error } = await supabase
        .from('authors')
        .select('id, name, display_name, slug, bio, bio_md, avatar_url, social_links, is_default')
        .eq('id', id)
        .single()

      if (error || !data) return null
      return data as AuthorRecord
    },
    ['author', authorId],
    {
      tags: [`author:${authorId}`],
      revalidate: 3600,
    },
  )
  return fn(authorId)
}
