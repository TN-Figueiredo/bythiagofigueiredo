import { unstable_cache } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type {
  YouTubeVideoRow, YouTubeChannelRow, YouTubeCategoryRow,
  YouTubeCuratedCommentRow, YouTubePageData, YouTubeVideoView,
  YouTubeChannelView, YouTubeCategoryView, YouTubeCuratedCommentView,
} from './types'

export const getYouTubePageData = unstable_cache(
  async (siteId: string): Promise<YouTubePageData> => {
    const supabase = getSupabaseServiceClient()

    const [videosRes, channelsRes, categoriesRes, commentsRes] = await Promise.all([
      supabase
        .from('youtube_videos')
        .select('*, youtube_channels!inner(locale, handle)')
        .eq('site_id', siteId)
        .eq('is_hidden', false)
        .order('published_at', { ascending: false }),
      supabase
        .from('youtube_channels')
        .select('*')
        .eq('site_id', siteId),
      supabase
        .from('youtube_categories')
        .select('*')
        .eq('site_id', siteId)
        .order('sort_order'),
      supabase
        .from('youtube_curated_comments')
        .select('*, youtube_videos!inner(title, youtube_video_id, youtube_channels!inner(locale))')
        .eq('site_id', siteId)
        .order('display_order')
        .order('like_count', { ascending: false }),
    ])

    const channels = (channelsRes.data ?? []) as YouTubeChannelRow[]
    const categories = (categoriesRes.data ?? []) as YouTubeCategoryRow[]
    const channelMap = new Map(channels.map((c) => [c.id, c]))
    const categoryMap = new Map(categories.map((c) => [c.id, c]))

    const videos: YouTubeVideoView[] = (videosRes.data ?? []).map((row: YouTubeVideoRow & { youtube_channels: { locale: string; handle: string } }) => {
      const cat = row.category_id ? categoryMap.get(row.category_id) : null
      const locale = row.youtube_channels.locale as 'pt' | 'en'
      return {
        id: row.id,
        youtubeVideoId: row.youtube_video_id,
        title: row.title,
        titleTranslation: row.title_translation,
        description: row.description,
        descriptionTranslation: row.description_translation,
        duration: row.duration,
        durationSeconds: row.duration_seconds,
        publishedAt: row.published_at,
        thumbnailUrl: row.thumbnail_url,
        thumbnailHqUrl: row.thumbnail_hq_url,
        tags: row.tags,
        viewCount: row.view_count,
        likeCount: row.like_count,
        commentCount: row.comment_count,
        locale,
        channelHandle: row.youtube_channels.handle,
        categorySlug: cat?.slug ?? null,
        categoryName: cat ? (locale === 'pt' ? cat.name_pt : cat.name_en) : null,
        categoryColor: cat?.color ?? null,
        isFeatured: row.is_featured,
        isPinned: !!row.pinned_until && new Date(row.pinned_until) > new Date(),
      }
    })

    const categoryCounts = new Map<string, number>()
    for (const v of videos) {
      if (v.categorySlug) {
        categoryCounts.set(v.categorySlug, (categoryCounts.get(v.categorySlug) ?? 0) + 1)
      }
    }

    const categoryViews: YouTubeCategoryView[] = categories.map((c) => ({
      slug: c.slug,
      namePt: c.name_pt,
      nameEn: c.name_en,
      color: c.color,
      count: categoryCounts.get(c.slug) ?? 0,
    }))

    const channelViews: YouTubeChannelView[] = channels.map((c) => ({
      id: c.id,
      locale: c.locale,
      handle: c.handle,
      name: c.name,
      description: c.description,
      subscriberCount: c.subscriber_count,
      videoCount: c.video_count,
      thumbnailUrl: c.thumbnail_url,
      url: `https://www.youtube.com/${c.handle}`,
    }))

    const comments: YouTubeCuratedCommentView[] = (commentsRes.data ?? []).map((row: YouTubeCuratedCommentRow & { youtube_videos: { title: string; youtube_video_id: string; youtube_channels: { locale: string } } }) => ({
      id: row.id,
      videoId: row.video_id,
      videoTitle: row.youtube_videos.title,
      videoYoutubeId: row.youtube_videos.youtube_video_id,
      authorHandle: row.author_handle,
      authorAvatarUrl: row.author_avatar_url,
      textPt: row.text_pt,
      textEn: row.text_en,
      likeCount: row.like_count,
      channelLocale: row.youtube_videos.youtube_channels.locale as 'pt' | 'en',
      publishedAt: row.published_at,
    }))

    const totalDurationSeconds = videos.reduce((sum, v) => sum + v.durationSeconds, 0)

    return {
      videos,
      channels: channelViews,
      categories: categoryViews,
      comments,
      totalVideoCount: videos.length,
      totalDurationSeconds,
    }
  },
  ['youtube-page-data'],
  { revalidate: 3600, tags: ['youtube'] },
)
