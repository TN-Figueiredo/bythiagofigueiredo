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

  const userIds = (authors ?? []).map((a: any) => a.user_id).filter(Boolean)
  const { data: memberships } = userIds.length > 0
    ? await supabase.from('site_memberships').select('user_id, role').eq('site_id', siteId).in('user_id', userIds)
    : { data: [] }
  const roleMap: Record<string, string> = {}
  for (const m of memberships ?? []) roleMap[(m as any).user_id] = (m as any).role

  const [postCountsRes, pubCountsRes, campCountsRes] = await Promise.all([
    supabase.from('blog_posts').select('owner_user_id').eq('site_id', siteId).in('owner_user_id', userIds),
    supabase.from('blog_posts').select('owner_user_id').eq('site_id', siteId).eq('status', 'published').in('owner_user_id', userIds),
    supabase.from('campaigns').select('owner_user_id').eq('site_id', siteId).in('owner_user_id', userIds),
  ])

  function countBy(data: any[] | null, field: string): Record<string, number> {
    return (data ?? []).reduce((acc: Record<string, number>, row: any) => {
      acc[row[field]] = (acc[row[field]] ?? 0) + 1
      return acc
    }, {})
  }
  const postCounts = countBy(postCountsRes.data, 'owner_user_id')
  const pubCounts = countBy(pubCountsRes.data, 'owner_user_id')
  const campCounts = countBy(campCountsRes.data, 'owner_user_id')

  const authorRows = (authors ?? []).map((a: any) => ({
    id: a.id,
    displayName: a.display_name,
    slug: a.slug ?? a.id.slice(0, 8),
    role: roleMap[a.user_id] ?? 'editor',
    bio: a.bio,
    avatarUrl: a.avatar_url,
    initials: a.display_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase(),
    postsCount: postCounts[a.user_id] ?? 0,
    publishedCount: pubCounts[a.user_id] ?? 0,
    campaignsCount: campCounts[a.user_id] ?? 0,
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
