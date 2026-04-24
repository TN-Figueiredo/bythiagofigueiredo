import { getSupabaseServiceClient } from '@/lib/supabase/service'

export type AdjacentPost = {
  slug: string
  title: string
}

export async function getAdjacentPosts(
  siteId: string,
  locale: string,
  publishedAt: string,
): Promise<{ prev: AdjacentPost | null; next: AdjacentPost | null }> {
  const supabase = getSupabaseServiceClient()
  const now = new Date().toISOString()

  const [prevResult, nextResult] = await Promise.all([
    supabase
      .from('blog_translations')
      .select('slug, title, blog_posts!inner(published_at, status, site_id)')
      .eq('locale', locale)
      .eq('blog_posts.site_id', siteId)
      .eq('blog_posts.status', 'published')
      .lt('blog_posts.published_at', publishedAt)
      .lte('blog_posts.published_at', now)
      .order('published_at', { referencedTable: 'blog_posts', ascending: false })
      .limit(1),
    supabase
      .from('blog_translations')
      .select('slug, title, blog_posts!inner(published_at, status, site_id)')
      .eq('locale', locale)
      .eq('blog_posts.site_id', siteId)
      .eq('blog_posts.status', 'published')
      .gt('blog_posts.published_at', publishedAt)
      .lte('blog_posts.published_at', now)
      .order('published_at', { referencedTable: 'blog_posts', ascending: true })
      .limit(1),
  ])

  return {
    prev: prevResult.data?.[0] ? { slug: prevResult.data[0].slug as string, title: prevResult.data[0].title as string } : null,
    next: nextResult.data?.[0] ? { slug: nextResult.data[0].slug as string, title: nextResult.data[0].title as string } : null,
  }
}
