import { redirect } from 'next/navigation'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { VideosConnected, type VideoRow, type ChannelOption, type CategoryOption } from './videos-connected'

export const dynamic = 'force-dynamic'

export default async function YouTubeVideosPage() {
  const { siteId } = await getSiteContext()

  const authRes = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  if (!authRes.ok) redirect('/cms')

  const supabase = getSupabaseServiceClient()

  const [videosRes, channelsRes, categoriesRes] = await Promise.all([
    supabase
      .from('youtube_videos')
      .select(
        'id, youtube_video_id, title, title_translation, published_at, thumbnail_url, view_count, like_count, duration, is_featured, is_hidden, category_id, auto_suggested_category_id, channel_id, pinned_until, youtube_channels!inner(locale, handle, name)',
      )
      .eq('site_id', siteId)
      .order('published_at', { ascending: false }),
    supabase.from('youtube_channels').select('id, locale, handle, name').eq('site_id', siteId),
    supabase
      .from('youtube_categories')
      .select('id, name_pt, name_en, color')
      .eq('site_id', siteId)
      .order('sort_order'),
  ])

  const rawVideos = videosRes.data ?? []
  const rawChannels = channelsRes.data ?? []
  const rawCategories = categoriesRes.data ?? []

  // Build a lookup map: categoryId → { name, color }
  type CatInfo = { namePt: string; nameEn: string; color: string }
  const categoryMap = new Map<string, CatInfo>(
    rawCategories.map((c) => [
      c.id as string,
      {
        namePt: c.name_pt as string,
        nameEn: c.name_en as string,
        color: c.color as string,
      },
    ]),
  )

  const videos: VideoRow[] = rawVideos.map((v) => {
    const channel = (
      v.youtube_channels as unknown as { locale: string; handle: string; name: string }
    )
    const catInfo = v.category_id ? categoryMap.get(v.category_id as string) : undefined
    const suggestedInfo = v.auto_suggested_category_id
      ? categoryMap.get(v.auto_suggested_category_id as string)
      : undefined

    return {
      id: v.id as string,
      youtubeVideoId: v.youtube_video_id as string,
      title: v.title as string,
      titleTranslation: (v.title_translation as string | null) ?? null,
      publishedAt: v.published_at as string,
      thumbnailUrl: (v.thumbnail_url as string | null) ?? null,
      viewCount: (v.view_count as number) ?? 0,
      likeCount: (v.like_count as number) ?? 0,
      duration: (v.duration as string) ?? '0:00',
      isFeatured: (v.is_featured as boolean) ?? false,
      isHidden: (v.is_hidden as boolean) ?? false,
      categoryId: (v.category_id as string | null) ?? null,
      categoryName: catInfo ? catInfo.namePt : null,
      categoryColor: catInfo ? catInfo.color : null,
      suggestedCategoryId: (v.auto_suggested_category_id as string | null) ?? null,
      suggestedCategoryName: suggestedInfo ? suggestedInfo.namePt : null,
      channelId: (v.channel_id as string) ?? '',
      channelLocale: (channel?.locale as 'pt' | 'en') ?? 'pt',
      channelHandle: (channel?.handle as string) ?? '',
      channelName: (channel?.name as string) ?? '',
      pinnedUntil: (v.pinned_until as string | null) ?? null,
    }
  })

  const channels: ChannelOption[] = rawChannels.map((ch) => ({
    id: ch.id as string,
    locale: ch.locale as 'pt' | 'en',
    handle: ch.handle as string,
    name: ch.name as string,
  }))

  const categories: CategoryOption[] = rawCategories.map((cat) => ({
    id: cat.id as string,
    namePt: cat.name_pt as string,
    nameEn: cat.name_en as string,
    color: cat.color as string,
  }))

  return (
    <div className="flex flex-col gap-6">
      <VideosConnected videos={videos} channels={channels} categories={categories} />
    </div>
  )
}
