import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { CmsTopbar } from '@/components/cms/cms-topbar'
import { EmptyState, CmsButton } from '@/components/cms/ui'
import { AuthorCard } from './_components/author-card'

export default async function AuthorsPage() {
  const supabase = getSupabaseServiceClient()
  const { siteId } = await getSiteContext()

  const { data: authors } = await supabase
    .from('authors')
    .select('id, display_name, slug, bio, avatar_url, user_id')
    .eq('site_id', siteId)
    .order('display_name')

  interface AuthorRow { id: string; display_name: string; slug: string | null; bio: string | null; avatar_url: string | null; user_id: string | null }
  interface MembershipRow { user_id: string; role: string }
  interface OwnerRow extends Record<string, unknown> { owner_user_id: string | null }

  const userIds = (authors as AuthorRow[] ?? []).map((a) => a.user_id).filter((id): id is string => id !== null)
  const { data: memberships } = userIds.length > 0
    ? await supabase.from('site_memberships').select('user_id, role').eq('site_id', siteId).in('user_id', userIds)
    : { data: [] as MembershipRow[] }
  const roleMap: Record<string, string> = {}
  for (const m of (memberships ?? []) as MembershipRow[]) roleMap[m.user_id] = m.role

  const [postCountsRes, pubCountsRes, campCountsRes] = await Promise.all([
    supabase.from('blog_posts').select('owner_user_id').eq('site_id', siteId).in('owner_user_id', userIds),
    supabase.from('blog_posts').select('owner_user_id').eq('site_id', siteId).eq('status', 'published').in('owner_user_id', userIds),
    supabase.from('campaigns').select('owner_user_id').eq('site_id', siteId).in('owner_user_id', userIds),
  ])

  function countBy<T extends Record<string, unknown>>(data: T[] | null, field: keyof T): Record<string, number> {
    return (data ?? []).reduce((acc: Record<string, number>, row) => {
      const key = String(row[field])
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    }, {})
  }
  const postCounts = countBy((postCountsRes.data ?? []) as OwnerRow[], 'owner_user_id')
  const pubCounts = countBy((pubCountsRes.data ?? []) as OwnerRow[], 'owner_user_id')
  const campCounts = countBy((campCountsRes.data ?? []) as OwnerRow[], 'owner_user_id')

  const authorRows = (authors as AuthorRow[] ?? []).map((a) => ({
    id: a.id,
    displayName: a.display_name,
    slug: a.slug ?? a.id.slice(0, 8),
    role: (a.user_id != null ? roleMap[a.user_id] : undefined) ?? 'editor',
    bio: a.bio,
    avatarUrl: a.avatar_url,
    initials: a.display_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase(),
    postsCount: a.user_id != null ? (postCounts[a.user_id] ?? 0) : 0,
    publishedCount: a.user_id != null ? (pubCounts[a.user_id] ?? 0) : 0,
    campaignsCount: a.user_id != null ? (campCounts[a.user_id] ?? 0) : 0,
    lastActiveAt: null,
  }))

  if (authorRows.length === 0) {
    return (
      <div>
        <CmsTopbar title="Authors" />
        <div className="p-8">
          <EmptyState icon="👤" title="You're the only author" description="Invite team members from Admin to add more authors." actions={<CmsButton variant="primary" size="sm">Go to Admin → Users</CmsButton>} />
        </div>
      </div>
    )
  }

  return (
    <div>
      <CmsTopbar title="Authors" />
      <div className="p-6 lg:p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {authorRows.map((author) => (
            <AuthorCard key={author.id} {...author} />
          ))}
        </div>
      </div>
    </div>
  )
}
