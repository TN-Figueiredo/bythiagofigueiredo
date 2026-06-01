import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { CompetitorDashboard } from './_components/competitor-dashboard'

export const dynamic = 'force-dynamic'

export default async function CompetitorsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  const validTabs = ['canais', 'mudancas', 'outliers', 'insights'] as const
  const activeTab = (validTabs.includes(tab as any) ? tab : 'canais') as typeof validTabs[number]
  const { siteId } = await getSiteContext()
  const supabase = getSupabaseServiceClient()

  const { data: channels } = await supabase
    .from('competitor_channels')
    .select('id, channel_id, channel_name, thumbnail_url, subscriber_count, last_synced_at')
    .eq('site_id', siteId)
    .order('added_at', { ascending: false })

  const { data: changes } = await supabase
    .from('competitor_changes')
    .select('id, change_type, old_title, new_title, old_thumbnail_url, new_thumbnail_url, view_count_at_change, detected_at, bookmarked, competitor_videos!inner(title, video_id, competitor_channels!inner(channel_name))')
    .eq('site_id', siteId)
    .order('detected_at', { ascending: false })
    .limit(20)

  // Fetch videos per channel and compute outliers
  const safeChannels = channels ?? []
  const channelIds = safeChannels.map(ch => ch.id)

  const { data: allVideos } = channelIds.length > 0
    ? await supabase
        .from('competitor_videos')
        .select('id, competitor_channel_id, video_id, title, thumbnail_url, view_count, published_at, tags')
        .in('competitor_channel_id', channelIds)
        .order('published_at', { ascending: false })
        .limit(750)
    : { data: [] as Array<{ id: string; competitor_channel_id: string; video_id: string; title: string | null; thumbnail_url: string | null; view_count: number | null; published_at: string | null; tags: string[] | null }> }

  // Group videos by channel
  const videosByChannel = new Map<string, typeof allVideos>()
  for (const v of allVideos ?? []) {
    const list = videosByChannel.get(v.competitor_channel_id) ?? []
    list.push(v)
    videosByChannel.set(v.competitor_channel_id, list)
  }

  // Compute outliers: videos with views > 2x channel average
  const outliers: Array<{
    video: NonNullable<typeof allVideos>[number]
    channelName: string
    channelThumb: string | null
    multiplier: number
  }> = []

  for (const ch of safeChannels) {
    const videos = videosByChannel.get(ch.id) ?? []
    if (videos.length < 3) continue
    const avgViews = videos.reduce((sum, v) => sum + (v.view_count ?? 0), 0) / videos.length
    if (avgViews <= 0) continue
    for (const v of videos) {
      const mult = (v.view_count ?? 0) / avgViews
      if (mult >= 2.0) {
        outliers.push({
          video: v,
          channelName: ch.channel_name,
          channelThumb: ch.thumbnail_url,
          multiplier: mult,
        })
      }
    }
  }
  outliers.sort((a, b) => b.multiplier - a.multiplier)

  // Compute insights
  const flatVideos = allVideos ?? []
  const uploadsByDay = [0, 0, 0, 0, 0, 0, 0]
  for (const v of flatVideos) {
    if (v.published_at) { const day = new Date(v.published_at).getDay(); uploadsByDay[day] = (uploadsByDay[day] ?? 0) + 1 }
  }
  const tagCounts = new Map<string, number>()
  for (const v of flatVideos) {
    for (const tag of (v as Record<string, unknown>).tags as string[] ?? []) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
    }
  }
  const topTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)
  const engagementByChannel = safeChannels
    .filter(ch => (videosByChannel.get(ch.id) ?? []).length > 0)
    .map(ch => {
      const vids = videosByChannel.get(ch.id) ?? []
      return { name: ch.channel_name, avgViews: Math.round(vids.reduce((s, v) => s + (v.view_count ?? 0), 0) / vids.length), videoCount: vids.length }
    })
    .sort((a, b) => b.avgViews - a.avgViews)

  const insights = {
    uploadsByDay,
    dayLabels: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
    topTags,
    engagementByChannel,
  }

  const channelsWithVideos = safeChannels.map(ch => ({
    ...ch,
    videos: (videosByChannel.get(ch.id) ?? []).slice(0, 12),
  }))

  return <CompetitorDashboard activeTab={activeTab} channels={channelsWithVideos} changes={changes ?? []} outliers={outliers} insights={insights} />
}
