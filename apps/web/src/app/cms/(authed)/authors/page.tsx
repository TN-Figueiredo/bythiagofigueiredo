import { redirect } from 'next/navigation'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { AuthorsConnected, type AuthorData } from './authors-connected'

interface AuthorRow {
  id: string
  display_name: string | null
  name: string
  slug: string | null
  bio: string | null
  avatar_url: string | null
  avatar_color: string | null
  user_id: string | null
  social_links: Record<string, string> | null
  sort_order: number | null
  is_default: boolean | null
  about_photo_url: string | null
}

export default async function AuthorsPage() {
  const { siteId } = await getSiteContext()

  // RBAC: require at least view access; redirect otherwise
  const authRes = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  if (!authRes.ok) redirect('/cms')

  // Check edit access for read-only mode
  const editRes = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  const readOnly = !editRes.ok

  const supabase = getSupabaseServiceClient()

  const { data: authors } = await supabase
    .from('authors')
    .select(
      'id, display_name, name, slug, bio, avatar_url, avatar_color, user_id, social_links, sort_order, is_default, about_photo_url',
    )
    .eq('site_id', siteId)
    .order('sort_order')

  // Count posts per author (via author_id FK)
  const authorIds = ((authors as AuthorRow[] | null) ?? []).map((a) => a.id)
  const { data: postCountRows } =
    authorIds.length > 0
      ? await supabase
          .from('blog_posts')
          .select('author_id')
          .eq('site_id', siteId)
          .in('author_id', authorIds)
      : { data: [] as { author_id: string }[] }

  const postCounts: Record<string, number> = {}
  for (const row of (postCountRows ?? []) as { author_id: string }[]) {
    postCounts[row.author_id] = (postCounts[row.author_id] ?? 0) + 1
  }

  const { data: siteRow } = await supabase
    .from('sites')
    .select('supported_locales')
    .eq('id', siteId)
    .single()
  const supportedLocales: string[] = (siteRow as unknown as { supported_locales: string[] } | null)?.supported_locales ?? ['pt-BR']

  const authorData: AuthorData[] = ((authors as AuthorRow[] | null) ?? []).map(
    (a) => {
      const displayName = a.display_name ?? a.name
      return {
        id: a.id,
        displayName,
        slug: a.slug ?? a.id.slice(0, 8),
        bio: a.bio,
        avatarUrl: a.avatar_url,
        avatarColor: a.avatar_color,
        initials: displayName
          .split(' ')
          .map((n: string) => n[0])
          .join('')
          .slice(0, 2)
          .toUpperCase(),
        userId: a.user_id,
        socialLinks: (a.social_links as Record<string, string>) ?? {},
        sortOrder: a.sort_order ?? 0,
        isDefault: a.is_default ?? false,
        postsCount: postCounts[a.id] ?? 0,
        aboutPhotoUrl: a.about_photo_url,
      }
    },
  )

  return (
    <div>
      <CmsTopbar title="Authors" />
      <AuthorsConnected authors={authorData} readOnly={readOnly} supportedLocales={supportedLocales} />
    </div>
  )
}
