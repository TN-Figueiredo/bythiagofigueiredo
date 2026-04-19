import type { HomeNewsletter, HomePost } from './types'
import { getSupabaseServiceClient } from '../supabase/service'

export async function getFeaturedPost(locale: string): Promise<HomePost | null> {
  const db = getSupabaseServiceClient()
  const now = new Date().toISOString()

  // Try featured first
  const { data: featured } = await db
    .from('blog_translations')
    .select(`
      slug, locale, title, excerpt, reading_time_min, cover_image_url,
      blog_posts!inner(id, published_at, category, is_featured, status)
    `)
    .eq('locale', locale)
    .eq('blog_posts.status', 'published')
    .eq('blog_posts.is_featured', true)
    .lte('blog_posts.published_at', now)
    .order('published_at', { referencedTable: 'blog_posts', ascending: false })
    .limit(1)
    .single()

  const row = featured ?? await (async () => {
    const { data } = await db
      .from('blog_translations')
      .select(`
        slug, locale, title, excerpt, reading_time_min, cover_image_url,
        blog_posts!inner(id, published_at, category, is_featured, status)
      `)
      .eq('locale', locale)
      .eq('blog_posts.status', 'published')
      .lte('blog_posts.published_at', now)
      .order('published_at', { referencedTable: 'blog_posts', ascending: false })
      .limit(1)
    return data?.[0] ?? null
  })()

  if (!row) return null

  const post = (row as Record<string, unknown>)['blog_posts'] as Record<string, unknown>
  return {
    id: post['id'] as string,
    slug: (row as Record<string, unknown>)['slug'] as string,
    locale: (row as Record<string, unknown>)['locale'] as string,
    title: (row as Record<string, unknown>)['title'] as string,
    excerpt: (row as Record<string, unknown>)['excerpt'] as string | null,
    publishedAt: post['published_at'] as string,
    category: post['category'] as string | null,
    readingTimeMin: (row as Record<string, unknown>)['reading_time_min'] as number,
    coverImageUrl: (row as Record<string, unknown>)['cover_image_url'] as string | null,
    isFeatured: post['is_featured'] as boolean,
  }
}

export async function getLatestPosts(locale: string, limit = 8): Promise<HomePost[]> {
  const db = getSupabaseServiceClient()
  const now = new Date().toISOString()

  const { data, error } = await db
    .from('blog_translations')
    .select(`
      slug, locale, title, excerpt, reading_time_min, cover_image_url,
      blog_posts!inner(id, published_at, category, is_featured, status)
    `)
    .eq('locale', locale)
    .eq('blog_posts.status', 'published')
    .lte('blog_posts.published_at', now)
    .order('published_at', { referencedTable: 'blog_posts', ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []).map((row: Record<string, unknown>) => {
    const post = row['blog_posts'] as Record<string, unknown>
    return {
      id: post['id'] as string,
      slug: row['slug'] as string,
      locale: row['locale'] as string,
      title: row['title'] as string,
      excerpt: row['excerpt'] as string | null,
      publishedAt: post['published_at'] as string,
      category: post['category'] as string | null,
      readingTimeMin: row['reading_time_min'] as number,
      coverImageUrl: row['cover_image_url'] as string | null,
      isFeatured: post['is_featured'] as boolean,
    }
  })
}

export async function getNewslettersForLocale(locale: string): Promise<HomeNewsletter[]> {
  const db = getSupabaseServiceClient()
  const { data, error } = await db
    .from('newsletter_types')
    .select('id, locale, name, tagline, cadence, color')
    .eq('locale', locale)
    .eq('active', true)
    .order('sort_order')

  if (error) return []
  return (data ?? []) as HomeNewsletter[]
}
