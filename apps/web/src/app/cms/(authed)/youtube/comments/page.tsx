import { redirect } from 'next/navigation'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { CommentsConnected, type CommentRow, type VideoOption } from './comments-connected'

export const metadata = { title: 'Comentários' }
export const dynamic = 'force-dynamic'

export default async function YouTubeCuratedCommentsPage() {
  const { siteId } = await getSiteContext()

  const authRes = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  if (!authRes.ok) redirect('/cms')

  const supabase = getSupabaseServiceClient()

  const [commentsRes, videosRes] = await Promise.all([
    supabase
      .from('youtube_curated_comments')
      .select(
        'id, video_id, author_handle, author_avatar_url, text_pt, text_en, like_count, target_locale, display_order, published_at, youtube_videos!inner(title, youtube_video_id, youtube_channels!inner(locale, handle))',
      )
      .eq('site_id', siteId)
      .order('display_order', { ascending: true }),
    supabase
      .from('youtube_videos')
      .select('id, youtube_video_id, title, channel_id, youtube_channels!inner(locale, handle)')
      .eq('site_id', siteId)
      .order('published_at', { ascending: false }),
  ])

  const rawComments = commentsRes.data ?? []
  const rawVideos = videosRes.data ?? []

  const comments: CommentRow[] = rawComments.map((c) => {
    const video = c.youtube_videos as unknown as {
      title: string
      youtube_video_id: string
      youtube_channels: { locale: string; handle: string }
    }
    return {
      id: c.id as string,
      videoId: c.video_id as string,
      videoTitle: video?.title ?? '',
      youtubeVideoId: video?.youtube_video_id ?? '',
      channelLocale: (video?.youtube_channels?.locale as 'pt' | 'en') ?? 'pt',
      channelHandle: video?.youtube_channels?.handle ?? '',
      authorHandle: c.author_handle as string,
      authorAvatarUrl: (c.author_avatar_url as string | null) ?? null,
      textPt: c.text_pt as string,
      textEn: c.text_en as string,
      likeCount: (c.like_count as number) ?? 0,
      targetLocale: (c.target_locale as 'pt' | 'en' | null) ?? null,
      displayOrder: (c.display_order as number) ?? 0,
      publishedAt: (c.published_at as string | null) ?? null,
    }
  })

  const videos: VideoOption[] = rawVideos.map((v) => {
    const channel = v.youtube_channels as unknown as { locale: string; handle: string }
    return {
      id: v.id as string,
      youtubeVideoId: v.youtube_video_id as string,
      title: v.title as string,
      channelLocale: (channel?.locale as 'pt' | 'en') ?? 'pt',
      channelHandle: channel?.handle ?? '',
    }
  })

  return (
    <div className="flex flex-col gap-6">
      <CommentsConnected comments={comments} videos={videos} />
    </div>
  )
}
