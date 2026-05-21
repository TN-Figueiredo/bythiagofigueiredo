import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { deriveCadenceLabel } from '@/lib/newsletter/format'
import { LinktreeConfigSchema } from './types'
import type {
  LinktreeConfig,
  SiteInfo,
  AuthorInfo,
  LatestPost,
  LatestVideo,
  SocialProfile,
  NewsletterTypeInfo,
  YouTubeChannelInfo,
} from './types'

export async function getLinktreeConfig(siteId: string): Promise<LinktreeConfig> {
  const db = getSupabaseServiceClient()
  const { data } = await db
    .from('sites')
    .select('linktree_config')
    .eq('id', siteId)
    .single()
  return LinktreeConfigSchema.parse(data?.linktree_config ?? {})
}

export async function getSiteInfo(siteId: string): Promise<SiteInfo> {
  const db = getSupabaseServiceClient()
  const { data, error } = await db
    .from('sites')
    .select('id, name, primary_domain, logo_url, primary_color, supported_locales, default_locale')
    .eq('id', siteId)
    .single()
  if (error || !data) throw new Error(`Site not found: ${siteId}`)
  return {
    id: data.id,
    name: data.name,
    primaryDomain: data.primary_domain,
    logoUrl: data.logo_url,
    primaryColor: data.primary_color ?? '#FF8240',
    supportedLocales: data.supported_locales ?? ['pt-BR'],
    defaultLocale: data.default_locale ?? 'pt-BR',
  }
}

export async function getDefaultAuthor(siteId: string): Promise<AuthorInfo> {
  const db = getSupabaseServiceClient()
  const { data } = await db
    .from('authors')
    .select('display_name, avatar_url, bio')
    .eq('site_id', siteId)
    .eq('is_default', true)
    .single()
  return {
    displayName: data?.display_name ?? 'Thiago Figueiredo',
    avatarUrl: data?.avatar_url ?? null,
    bio: data?.bio ?? null,
  }
}

export async function getLatestPost(siteId: string, locale: string): Promise<LatestPost | null> {
  const db = getSupabaseServiceClient()
  const { data } = await db
    .from('blog_translations')
    .select(`
      title, slug, reading_time_min, locale,
      blog_posts!inner (published_at, status, site_id,
        blog_tags (name, color)
      )
    `)
    .eq('blog_posts.site_id', siteId)
    .eq('blog_posts.status', 'published')
    .eq('locale', locale)
    .order('published_at', { referencedTable: 'blog_posts', ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data) return null
  const post = data.blog_posts as unknown as {
    published_at: string
    blog_tags: { name: string; color: string } | null
  }
  return {
    title: data.title,
    slug: data.slug,
    readingTimeMin: data.reading_time_min ?? 0,
    publishedAt: post.published_at,
    tagName: post.blog_tags?.name ?? null,
    tagColor: post.blog_tags?.color ?? null,
    locale: data.locale,
  }
}

export async function getLatestVideo(siteId: string): Promise<LatestVideo | null> {
  const db = getSupabaseServiceClient()
  const { data } = await db
    .from('youtube_videos')
    .select(`
      title, duration, published_at, view_count, youtube_video_id,
      youtube_channels!inner (handle)
    `)
    .eq('site_id', siteId)
    .eq('is_hidden', false)
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data) return null
  const channel = data.youtube_channels as unknown as { handle: string }
  return {
    title: data.title,
    duration: data.duration ?? '0:00',
    publishedAt: data.published_at,
    viewCount: data.view_count ?? 0,
    channelHandle: channel.handle,
    youtubeVideoId: data.youtube_video_id,
  }
}

export async function getSocialProfiles(siteId: string): Promise<SocialProfile[]> {
  const db = getSupabaseServiceClient()
  const [ytRes, igRes, siteRes, authorRes] = await Promise.all([
    db.from('youtube_channels').select('handle').eq('site_id', siteId),
    db.from('instagram_accounts_public').select('handle').eq('site_id', siteId),
    db.from('sites').select('twitter_handle').eq('id', siteId).single(),
    db.from('authors').select('social_links').eq('site_id', siteId).eq('is_default', true).single(),
  ])

  const profiles: SocialProfile[] = []
  const seenHandles = new Set<string>()

  for (const ch of ytRes.data ?? []) {
    if (ch.handle && !seenHandles.has(ch.handle)) {
      seenHandles.add(ch.handle)
      profiles.push({ platform: 'youtube', url: `https://youtube.com/@${ch.handle}`, handle: ch.handle })
    }
  }
  for (const acc of igRes.data ?? []) {
    if (acc.handle && !seenHandles.has(acc.handle)) {
      seenHandles.add(acc.handle)
      profiles.push({ platform: 'instagram', url: `https://instagram.com/${acc.handle}`, handle: acc.handle })
    }
  }
  if (siteRes.data?.twitter_handle) {
    const h = siteRes.data.twitter_handle
    profiles.push({ platform: 'x', url: `https://x.com/${h}`, handle: h })
  }
  const socialLinks = (authorRes.data?.social_links ?? {}) as Record<string, string>
  if (socialLinks.github) {
    profiles.push({ platform: 'github', url: socialLinks.github, handle: socialLinks.github.split('/').pop() ?? '' })
  }
  if (socialLinks.bluesky) {
    profiles.push({ platform: 'bluesky', url: socialLinks.bluesky, handle: socialLinks.bluesky.split('/').pop() ?? '' })
  }

  return profiles
}

export async function getNewsletterTypes(siteId: string): Promise<NewsletterTypeInfo[]> {
  const db = getSupabaseServiceClient()
  const { data } = await db
    .from('newsletter_types')
    .select('name, slug, locale, cadence_label, cadence_days, cadence_start_date')
    .eq('site_id', siteId)
    .eq('active', true)
    .order('sort_order')
  return (data ?? []).map((d) => ({
    name: d.name,
    slug: d.slug,
    locale: d.locale,
    cadenceLabel: deriveCadenceLabel(
      d.cadence_label,
      d.cadence_days as number,
      (d.locale === 'pt-BR' ? 'pt-BR' : 'en') as 'en' | 'pt-BR',
      d.cadence_start_date as string | null,
    ),
  }))
}

export async function getYouTubeChannels(siteId: string): Promise<YouTubeChannelInfo[]> {
  const db = getSupabaseServiceClient()
  const { data } = await db
    .from('youtube_channels')
    .select('handle, locale, schedule_label, subscriber_count')
    .eq('site_id', siteId)
  return (data ?? []).map((d) => ({
    handle: d.handle,
    locale: d.locale,
    scheduleLabel: d.schedule_label,
    subscriberCount: d.subscriber_count ?? 0,
  }))
}
