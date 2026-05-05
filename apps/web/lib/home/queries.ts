import type { HomeChannel, HomeNewsletter, HomePost, HomeTag, HomeVideo } from './types'
import { getSupabaseServiceClient } from '../supabase/service'
import { getSiteContext } from '../cms/site-context'
import { COLD_START_THRESHOLD } from '../tracking/config'
import { unstable_cache } from 'next/cache'

function mapRowToHomePost(row: Record<string, unknown>): HomePost {
  const post = row['blog_posts'] as Record<string, unknown>
  const tag = post['blog_tags'] as Record<string, unknown> | null
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
    tagName: (tag?.['name'] as string) ?? null,
    tagColor: (tag?.['color'] as string) ?? null,
    tagColorDark: (tag?.['color_dark'] as string | null) ?? null,
  }
}

export async function getFeaturedPost(locale: string): Promise<HomePost | null> {
  const db = getSupabaseServiceClient()
  const now = new Date().toISOString()

  const selectCols = `
    slug, locale, title, excerpt, reading_time_min, cover_image_url,
    blog_posts!inner(id, published_at, category, is_featured, status,
      blog_tags(name, color, color_dark)
    )
  `

  const { data: featured } = await db
    .from('blog_translations')
    .select(selectCols)
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
      .select(selectCols)
      .eq('locale', locale)
      .eq('blog_posts.status', 'published')
      .lte('blog_posts.published_at', now)
      .order('published_at', { referencedTable: 'blog_posts', ascending: false })
      .limit(1)
    return data?.[0] ?? null
  })()

  if (!row) return null
  return mapRowToHomePost(row)
}

export async function getLatestPosts(locale: string, limit = 8): Promise<HomePost[]> {
  const db = getSupabaseServiceClient()
  const now = new Date().toISOString()

  const { data, error } = await db
    .from('blog_translations')
    .select(`
      slug, locale, title, excerpt, reading_time_min, cover_image_url,
      blog_posts!inner(id, published_at, category, is_featured, status,
        blog_tags(name, color, color_dark)
      )
    `)
    .eq('locale', locale)
    .eq('blog_posts.status', 'published')
    .lte('blog_posts.published_at', now)
    .order('published_at', { referencedTable: 'blog_posts', ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []).map(mapRowToHomePost)
}

export async function getNewslettersForLocale(locale: string): Promise<HomeNewsletter[]> {
  const db = getSupabaseServiceClient()
  const { data, error } = await db
    .from('newsletter_types')
    .select('id, slug, locale, name, tagline, cadence, color')
    .eq('locale', locale)
    .eq('active', true)
    .order('sort_order')

  if (error) return []
  return (data ?? []) as HomeNewsletter[]
}

export async function getTopTags(locale: string, limit = 4): Promise<HomeTag[]> {
  const db = getSupabaseServiceClient()
  const { siteId } = await getSiteContext()

  const { data, error } = await db
    .from('blog_tags')
    .select('id, name, slug, color, color_dark, sort_order')
    .eq('site_id', siteId)
    .order('sort_order')
    .limit(limit)

  if (error || !data) return []

  const tagIds = data.map(t => t.id)
  const now = new Date().toISOString()

  const { data: counts } = await db
    .from('blog_posts')
    .select('tag_id')
    .in('tag_id', tagIds)
    .eq('status', 'published')
    .lte('published_at', now)

  const countMap = new Map<string, number>()
  for (const row of counts ?? []) {
    const tid = (row as Record<string, unknown>)['tag_id'] as string
    countMap.set(tid, (countMap.get(tid) ?? 0) + 1)
  }

  return data
    .map(t => ({
      id: t.id as string,
      name: t.name as string,
      slug: t.slug as string,
      color: t.color as string,
      colorDark: t.color_dark as string | null,
      postCount: countMap.get(t.id as string) ?? 0,
    }))
    .filter(t => t.postCount > 0)
}

export async function getPostsByTag(locale: string, tagId: string, limit = 2): Promise<HomePost[]> {
  const db = getSupabaseServiceClient()
  const now = new Date().toISOString()

  const { data, error } = await db
    .from('blog_translations')
    .select(`
      slug, locale, title, excerpt, reading_time_min, cover_image_url,
      blog_posts!inner(id, published_at, category, is_featured, status, tag_id,
        blog_tags(name, color, color_dark)
      )
    `)
    .eq('locale', locale)
    .eq('blog_posts.status', 'published')
    .eq('blog_posts.tag_id', tagId)
    .lte('blog_posts.published_at', now)
    .order('published_at', { referencedTable: 'blog_posts', ascending: false })
    .limit(limit)

  if (error) return []
  return (data ?? []).map(mapRowToHomePost)
}

export async function getMostReadPosts(locale: string, limit = 5): Promise<HomePost[]> {
  const db = getSupabaseServiceClient()
  const now = new Date().toISOString()

  // Check if we have enough real data (cold start check)
  const { data: maxRow } = await db
    .from('blog_posts')
    .select('view_count')
    .eq('status', 'published')
    .lte('published_at', now)
    .order('view_count', { ascending: false })
    .limit(1)
    .single()

  const maxViews = (maxRow?.view_count as number) ?? 0

  // Cold start fallback: pseudo-random if not enough views
  if (maxViews < COLD_START_THRESHOLD) {
    const posts = await getLatestPosts(locale, 20)
    if (posts.length === 0) return []
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
    )
    const seeded = posts.map((p, i) => ({
      post: p,
      score: ((i + 1) * 37 + dayOfYear * 13) % 97,
    }))
    seeded.sort((a, b) => b.score - a.score)
    return seeded.slice(0, limit).map(s => s.post)
  }

  // Real ranking by view_count
  const { data, error } = await db
    .from('blog_translations')
    .select(`
      slug, locale, title, excerpt, reading_time_min, cover_image_url,
      blog_posts!inner(id, published_at, category, is_featured, status, view_count,
        blog_tags(name, color, color_dark)
      )
    `)
    .eq('locale', locale)
    .eq('blog_posts.status', 'published')
    .lte('blog_posts.published_at', now)
    .order('view_count', { referencedTable: 'blog_posts', ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []).map(mapRowToHomePost)
}

export async function getPostCount(locale: string): Promise<number> {
  const db = getSupabaseServiceClient()
  const now = new Date().toISOString()

  const { count, error } = await db
    .from('blog_translations')
    .select('slug, blog_posts!inner(id)', { count: 'exact', head: true })
    .eq('locale', locale)
    .eq('blog_posts.status', 'published')
    .lte('blog_posts.published_at', now)

  if (error) return 0
  return count ?? 0
}

export async function getSubscriberCount(): Promise<number> {
  const db = getSupabaseServiceClient()
  const { siteId } = await getSiteContext()

  const { count, error } = await db
    .from('newsletter_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('site_id', siteId)
    .eq('status', 'confirmed')

  if (error) return 0
  return count ?? 0
}

// ── YouTube home queries ──

const DB_LOCALE_MAP: Record<string, 'pt' | 'en'> = { 'pt-BR': 'pt', en: 'en' }
const HOME_LOCALE_MAP: Record<string, 'en' | 'pt-BR'> = { pt: 'pt-BR', en: 'en' }
const LOCALE_FLAG: Record<string, string> = { pt: '🇧🇷', en: '🌎' }

export const getHomeChannels = unstable_cache(
  async (siteId: string): Promise<HomeChannel[]> => {
    const db = getSupabaseServiceClient()
    const { data, error } = await db
      .from('youtube_channels')
      .select('id, locale, handle, name, subscriber_count, thumbnail_url')
      .eq('site_id', siteId)
      .order('locale')

    if (error || !data) return []
    return data.map((c) => {
      const homeLocale = HOME_LOCALE_MAP[c.locale as string] ?? 'en'
      return {
        id: c.id as string,
        locale: homeLocale,
        handle: c.handle as string,
        url: `https://www.youtube.com/${c.handle as string}`,
        flag: LOCALE_FLAG[c.locale as string] ?? '🌎',
        name: c.name as string,
        subscriberCount: (c.subscriber_count as number) ?? 0,
        thumbnailUrl: (c.thumbnail_url as string) ?? null,
      }
    })
  },
  ['home-channels'],
  { revalidate: 3600, tags: ['youtube'] },
)

export const getHomeVideos = unstable_cache(
  async (siteId: string, locale: string, limit = 3): Promise<HomeVideo[]> => {
    const dbLocale = DB_LOCALE_MAP[locale] ?? locale
    const db = getSupabaseServiceClient()
    const { data, error } = await db
      .from('youtube_videos')
      .select(`
        id, youtube_video_id, title, description, thumbnail_url, duration,
        view_count, published_at, is_hidden, pinned_until,
        youtube_channels!inner(locale, handle),
        youtube_categories(slug, name_pt, name_en, color)
      `)
      .eq('site_id', siteId)
      .eq('youtube_channels.locale', dbLocale)
      .eq('is_hidden', false)
      .order('published_at', { ascending: false })
      .limit(limit)

    if (error || !data) return []
    return (data as Record<string, unknown>[]).map((row) => {
      const ch = row['youtube_channels'] as { locale: string; handle: string }
      const cat = row['youtube_categories'] as { slug: string; name_pt: string; name_en: string; color: string } | null
      const homeLocale = HOME_LOCALE_MAP[ch.locale] ?? 'en'
      const catName = cat ? (ch.locale === 'pt' ? cat.name_pt : cat.name_en) : null
      return {
        id: row['id'] as string,
        locale: homeLocale,
        title: row['title'] as string,
        description: (row['description'] as string) ?? '',
        thumbnailUrl: (row['thumbnail_url'] as string) ?? null,
        duration: row['duration'] as string,
        viewCount: row['view_count'] as number,
        publishedAt: row['published_at'] as string,
        categoryName: catName,
        categoryColor: cat?.color ?? null,
        youtubeUrl: `https://www.youtube.com/watch?v=${row['youtube_video_id'] as string}`,
        channelHandle: ch.handle,
        youtubeVideoId: row['youtube_video_id'] as string,
        isPinned: !!row['pinned_until'] && new Date(row['pinned_until'] as string) > new Date(),
      }
    })
  },
  ['home-videos'],
  { revalidate: 3600, tags: ['youtube'] },
)

export const getWeeklyPick = unstable_cache(
  async (siteId: string, locale: string): Promise<HomeVideo | null> => {
    const dbLocale = DB_LOCALE_MAP[locale] ?? locale
    const db = getSupabaseServiceClient()

    const selectCols = `
      id, youtube_video_id, title, description, thumbnail_url, duration,
      view_count, published_at, pinned_until,
      youtube_channels!inner(locale, handle),
      youtube_categories(slug, name_pt, name_en, color)
    `

    const { data: pinned } = await db
      .from('youtube_videos')
      .select(selectCols)
      .eq('site_id', siteId)
      .eq('youtube_channels.locale', dbLocale)
      .eq('is_hidden', false)
      .gt('pinned_until', new Date().toISOString())
      .order('pinned_until', { ascending: false })
      .limit(1)

    const row = (pinned as Record<string, unknown>[] | null)?.[0]

    const source = row ?? await (async () => {
      const { data } = await db
        .from('youtube_videos')
        .select(selectCols)
        .eq('site_id', siteId)
        .eq('youtube_channels.locale', dbLocale)
        .eq('is_hidden', false)
        .order('published_at', { ascending: false })
        .limit(1)
      return (data as Record<string, unknown>[] | null)?.[0] ?? null
    })()

    if (!source) return null

    const ch = source['youtube_channels'] as { locale: string; handle: string }
    const cat = source['youtube_categories'] as { slug: string; name_pt: string; name_en: string; color: string } | null
    const homeLocale = HOME_LOCALE_MAP[ch.locale] ?? 'en'
    const catName = cat ? (ch.locale === 'pt' ? cat.name_pt : cat.name_en) : null
    const pinnedUntil = source['pinned_until'] as string | null
    const isPinned = !!pinnedUntil && new Date(pinnedUntil) > new Date()

    return {
      id: source['id'] as string,
      locale: homeLocale,
      title: source['title'] as string,
      description: (source['description'] as string) ?? '',
      thumbnailUrl: (source['thumbnail_url'] as string) ?? null,
      duration: source['duration'] as string,
      viewCount: source['view_count'] as number,
      publishedAt: source['published_at'] as string,
      categoryName: catName,
      categoryColor: cat?.color ?? null,
      youtubeUrl: `https://www.youtube.com/watch?v=${source['youtube_video_id'] as string}`,
      channelHandle: ch.handle,
      youtubeVideoId: source['youtube_video_id'] as string,
      isPinned,
    }
  },
  ['weekly-pick'],
  { revalidate: 3600, tags: ['youtube'] },
)

export const getVideoCount = unstable_cache(
  async (siteId: string, locale: string): Promise<number> => {
    const dbLocale = DB_LOCALE_MAP[locale] ?? locale
    const db = getSupabaseServiceClient()
    const { count, error } = await db
      .from('youtube_videos')
      .select('id, youtube_channels!inner(locale)', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .eq('youtube_channels.locale', dbLocale)
      .eq('is_hidden', false)

    if (error) return 0
    return count ?? 0
  },
  ['video-count'],
  { revalidate: 3600, tags: ['youtube'] },
)
