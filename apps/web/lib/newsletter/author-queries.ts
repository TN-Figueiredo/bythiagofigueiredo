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

export interface AuthorWithLocale extends AuthorRecord {
  localeBio: string | null
  localeSubtitle: string | null
}

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

export async function getAuthorWithLocale(
  authorId: string,
  locale: 'en' | 'pt-BR',
): Promise<AuthorWithLocale | null> {
  const fn = unstable_cache(
    async (id: string, loc: string): Promise<AuthorWithLocale | null> => {
      const supabase = getSupabaseServiceClient()

      const [authorResult, translationResult] = await Promise.all([
        supabase
          .from('authors')
          .select('id, name, display_name, slug, bio, bio_md, avatar_url, social_links, is_default')
          .eq('id', id)
          .single(),
        supabase
          .from('author_about_translations')
          .select('bio, subtitle')
          .eq('author_id', id)
          .eq('locale', loc)
          .maybeSingle(),
      ])

      if (authorResult.error || !authorResult.data) return null

      const author = authorResult.data as AuthorRecord
      const translation = translationResult.data

      return {
        ...author,
        localeBio: (translation?.bio as string | null) ?? null,
        localeSubtitle: (translation?.subtitle as string | null) ?? null,
      }
    },
    ['author-locale', authorId, locale],
    {
      tags: [`author:${authorId}`],
      revalidate: 3600,
    },
  )
  return fn(authorId, locale)
}
