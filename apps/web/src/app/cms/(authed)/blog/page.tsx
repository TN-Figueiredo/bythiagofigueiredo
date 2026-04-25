import Link from 'next/link'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { CmsTopbar, CmsButton } from '@tn-figueiredo/cms-ui/client'
import { PostsListConnected, type PostRow } from './_components/posts-list-connected'
import { bulkPublish, bulkArchive, bulkDelete, bulkChangeAuthor } from './actions'

interface Props { searchParams: Promise<Record<string, string | undefined>> }

interface BlogPostRow {
  id: string
  slug: string | null
  status: string | null
  updated_at: string
  published_at: string | null
  cover_image_url: string | null
  view_count: number | null
  author_id: string | null
  blog_translations: Array<{ title: string; locale: string; reading_time_min: number | null }>
  authors: Array<{ id: string; display_name: string }>
}

export default async function BlogListPage({ searchParams }: Props) {
  const params = await searchParams
  const supabase = getSupabaseServiceClient()
  const { siteId } = await getSiteContext()
  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const pageSize = 50

  // Parallel: status counts + posts + authors
  const [statusResult, postsResult, authorsResult] = await Promise.all([
    supabase
      .from('blog_posts')
      .select('status')
      .eq('site_id', siteId),

    (() => {
      const sortMap: Record<string, { column: string; ascending: boolean }> = {
        newest: { column: 'updated_at', ascending: false },
        oldest: { column: 'updated_at', ascending: true },
        recently_published: { column: 'published_at', ascending: false },
        most_viewed: { column: 'view_count', ascending: false },
      }
      const sort = sortMap[params.sort ?? ''] ?? sortMap.newest!

      let q = supabase
        .from('blog_posts')
        .select(
          'id, slug, status, updated_at, published_at, cover_image_url, view_count, author_id, blog_translations(title, locale, reading_time_min), authors!blog_posts_author_id_fkey(id, display_name)',
          { count: 'exact' },
        )
        .eq('site_id', siteId)
        .order(sort.column, { ascending: sort.ascending })
        .range((page - 1) * pageSize, page * pageSize - 1)

      if (params.status) q = q.eq('status', params.status)
      if (params.locale) q = q.eq('blog_translations.locale', params.locale)
      if (params.q) q = q.ilike('blog_translations.title', `%${params.q}%`)

      return q
    })(),

    supabase
      .from('authors')
      .select('id, display_name')
      .eq('site_id', siteId)
      .order('display_name'),
  ])

  // Status counts
  const counts: Record<string, number> = {}
  for (const row of statusResult.data ?? []) {
    const status = String(row.status ?? 'draft')
    counts[status] = (counts[status] ?? 0) + 1
  }

  // Authors list
  const authors = (authorsResult.data ?? []).map((a) => ({
    id: a.id as string,
    display_name: a.display_name as string,
  }))

  // Map posts to PostRow[]
  const rows: PostRow[] = (postsResult.data ?? []).map((p) => {
    const post = p as unknown as BlogPostRow
    const authorDisplay = post.authors?.[0]?.display_name ?? 'Unknown'
    return {
      id: post.id,
      title: post.blog_translations?.[0]?.title ?? '',
      slug: post.slug ?? '',
      status: post.status ?? 'draft',
      locales: (post.blog_translations ?? []).map((t) => t.locale),
      authorName: authorDisplay,
      authorId: post.author_id ?? post.authors?.[0]?.id ?? '',
      authorInitials: authorDisplay
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase(),
      updatedAt: new Date(post.updated_at).toLocaleDateString('en', {
        month: 'short',
        day: 'numeric',
      }),
      readingTime: post.blog_translations?.[0]?.reading_time_min ?? 0,
      coverImageUrl: post.cover_image_url ?? null,
      viewCount: post.view_count ?? 0,
    }
  })

  return (
    <div>
      <CmsTopbar
        title="Posts"
        actions={
          <Link href="/cms/blog/new">
            <CmsButton variant="primary" size="sm">
              + New Post
            </CmsButton>
          </Link>
        }
      />
      <div className="p-6 lg:p-8">
        <PostsListConnected
          posts={rows}
          total={postsResult.count ?? rows.length}
          page={page}
          pageSize={pageSize}
          counts={counts}
          authors={authors}
          onBulkPublish={bulkPublish}
          onBulkArchive={bulkArchive}
          onBulkDelete={bulkDelete}
          onBulkChangeAuthor={bulkChangeAuthor}
        />
      </div>
    </div>
  )
}

export const dynamic = 'force-dynamic'
