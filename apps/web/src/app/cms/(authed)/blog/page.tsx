import { Suspense } from 'react'
import Link from 'next/link'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { CmsTopbar, CmsButton, SkeletonBlock } from '@tn-figueiredo/cms-ui/client'
import { PostsFilters } from './_components/posts-filters'
import { PostsTable } from './_components/posts-table'

interface Props { searchParams: Promise<Record<string, string | undefined>> }

interface BlogPostRow {
  id: string
  slug: string | null
  status: string | null
  updated_at: string
  blog_translations: Array<{ title: string; locale: string; reading_time_min: number | null }>
  authors: Array<{ display_name: string }>
}

export default async function BlogListPage({ searchParams }: Props) {
  const params = await searchParams
  const supabase = getSupabaseServiceClient()
  const { siteId } = await getSiteContext()
  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const pageSize = 20

  const { data: statusData } = await supabase
    .from('blog_posts')
    .select('status')
    .eq('site_id', siteId)

  const counts: Record<string, number> = {}
  for (const row of statusData ?? []) {
    const status = String(row.status ?? 'draft')
    counts[status] = (counts[status] ?? 0) + 1
  }

  let query = supabase
    .from('blog_posts')
    .select('id, slug, status, slot_date, updated_at, owner_user_id, blog_translations(title, locale, reading_time_min), authors!blog_posts_owner_user_id_fkey(display_name)', { count: 'exact' })
    .eq('site_id', siteId)
    .order('updated_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (params.status) query = query.eq('status', params.status)
  if (params.locale) query = query.eq('blog_translations.locale', params.locale)
  if (params.q) query = query.ilike('blog_translations.title', `%${params.q}%`)

  const { data: posts, count: total } = await query

  const rows = (posts ?? []).map((p) => {
    const post = p as BlogPostRow
    return {
      id: post.id,
      title: post.blog_translations?.[0]?.title ?? 'Untitled',
      slug: post.slug ?? '',
      status: post.status ?? 'draft',
      locales: (post.blog_translations ?? []).map((t) => t.locale),
      authorName: post.authors?.[0]?.display_name ?? 'Unknown',
      authorInitials: (post.authors?.[0]?.display_name ?? 'U').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase(),
      updatedAt: new Date(post.updated_at).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
      readingTime: post.blog_translations?.[0]?.reading_time_min ?? 0,
    }
  })

  return (
    <div>
      <CmsTopbar title="Posts" actions={
        <Link href="/cms/blog/new"><CmsButton variant="primary" size="sm">+ New Post</CmsButton></Link>
      } />
      <div className="p-6 lg:p-8 space-y-4">
        <Suspense fallback={<SkeletonBlock className="h-20" />}>
          <PostsFilters counts={counts} />
        </Suspense>
        <div className="bg-cms-surface border border-cms-border rounded-[var(--cms-radius)] overflow-hidden">
          <PostsTable posts={rows} total={total ?? rows.length} page={page} pageSize={pageSize} currentParams={new URLSearchParams(params as Record<string, string>).toString()} />
        </div>
      </div>
    </div>
  )
}

export const dynamic = 'force-dynamic'
