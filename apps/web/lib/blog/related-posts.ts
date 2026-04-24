import { getSupabaseServiceClient } from '@/lib/supabase/service'

export type RelatedPost = {
  id: string
  slug: string
  title: string
  excerpt: string | null
  category: string | null
  coverImageUrl: string | null
  readingTimeMin: number
  publishedAt: string
}

export async function getRelatedPosts(
  siteId: string,
  locale: string,
  postId: string,
  category: string | null,
  limit = 3,
): Promise<RelatedPost[]> {
  const supabase = getSupabaseServiceClient()
  const now = new Date().toISOString()

  if (category) {
    const { data } = await supabase
      .from('blog_translations')
      .select('slug, title, excerpt, reading_time_min, cover_image_url, blog_posts!inner(id, published_at, category, status, site_id)')
      .eq('locale', locale)
      .eq('blog_posts.site_id', siteId)
      .eq('blog_posts.status', 'published')
      .eq('blog_posts.category', category)
      .neq('blog_posts.id', postId)
      .lte('blog_posts.published_at', now)
      .order('published_at', { referencedTable: 'blog_posts', ascending: false })
      .limit(limit)

    if (data && data.length > 0) return data.map(mapRow)
  }

  const { data: fallback } = await supabase
    .from('blog_translations')
    .select('slug, title, excerpt, reading_time_min, cover_image_url, blog_posts!inner(id, published_at, category, status, site_id)')
    .eq('locale', locale)
    .eq('blog_posts.site_id', siteId)
    .eq('blog_posts.status', 'published')
    .neq('blog_posts.id', postId)
    .lte('blog_posts.published_at', now)
    .order('published_at', { referencedTable: 'blog_posts', ascending: false })
    .limit(limit)

  return (fallback ?? []).map(mapRow)
}

function mapRow(row: Record<string, unknown>): RelatedPost {
  const post = row['blog_posts'] as Record<string, unknown>
  return {
    id: post['id'] as string,
    slug: row['slug'] as string,
    title: row['title'] as string,
    excerpt: row['excerpt'] as string | null,
    category: post['category'] as string | null,
    coverImageUrl: row['cover_image_url'] as string | null,
    readingTimeMin: row['reading_time_min'] as number,
    publishedAt: post['published_at'] as string,
  }
}
