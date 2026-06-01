import { redirect } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { resolveScheduleLabel } from '@/lib/youtube/schedule-label'
import type { SyncScheduleEntry, SyncStatus } from '@/lib/youtube/types'
import { DashboardConnected, type ChannelDashboard, type PinnedVideo, type LastSyncInfo } from './dashboard-connected'

export const dynamic = 'force-dynamic'

const fetchYouTubeDashboardCached = unstable_cache(
  async (siteId: string) => {
    const supabase = getSupabaseServiceClient()

    const [channelsRes, uncategorizedRes, recentSyncRes, pinnedRes, videoStatsRes] = await Promise.all([
      supabase.from('youtube_channels')
        .select('id, locale, handle, name, subscriber_count, video_count, thumbnail_url, last_synced_at, sync_schedules, schedule_label')
        .eq('site_id', siteId)
        .order('locale'),
      supabase.from('youtube_videos')
        .select('id', { count: 'exact', head: true })
        .eq('site_id', siteId)
        .not('auto_suggested_category_id', 'is', null)
        .is('category_id', null),
      supabase.from('youtube_sync_log')
        .select('channel_id, status, videos_found, videos_inserted, videos_updated, error_message, created_at')
        .eq('site_id', siteId)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase.from('youtube_videos')
        .select('id, title, thumbnail_url, view_count, like_count, pinned_until, channel_id')
        .eq('site_id', siteId)
        .not('pinned_until', 'is', null)
        .gt('pinned_until', new Date(Date.now() - 7 * 86_400_000).toISOString()),
      supabase.from('youtube_videos')
        .select('channel_id, view_count, like_count, is_featured, is_hidden, published_at')
        .eq('site_id', siteId),
    ])

    if (channelsRes.error) throw new Error(`Failed to load YouTube channels: ${channelsRes.error.message}`)

    const rawChannels = channelsRes.data ?? []
    const rawPinned = pinnedRes.data ?? []
    const rawSyncs = recentSyncRes.data ?? []
    const rawVideoStats = videoStatsRes.data ?? []

    const pinnedMap = new Map<string, PinnedVideo>()
    for (const p of rawPinned) {
      pinnedMap.set(p.channel_id as string, {
        id: p.id as string,
        title: p.title as string,
        thumbnailUrl: (p.thumbnail_url as string | null) ?? null,
        viewCount: (p.view_count as number) ?? 0,
        likeCount: (p.like_count as number) ?? 0,
        pinnedUntil: p.pinned_until as string,
      })
    }

    const statsMap = new Map<string, { views: number; likes: number; featured: number; hidden: number; latestAt: string | null }>()
    for (const v of rawVideoStats) {
      const chId = v.channel_id as string
      const existing = statsMap.get(chId) ?? { views: 0, likes: 0, featured: 0, hidden: 0, latestAt: null }
      existing.views += (v.view_count as number) ?? 0
      existing.likes += (v.like_count as number) ?? 0
      if (v.is_featured) existing.featured++
      if (v.is_hidden) existing.hidden++
      const pub = v.published_at as string | null
      if (pub && (!existing.latestAt || pub > existing.latestAt)) existing.latestAt = pub
      statsMap.set(chId, existing)
    }

    const channels: ChannelDashboard[] = rawChannels.map(ch => {
      const lastSync = rawSyncs.find(s => s.channel_id === ch.id)
      const stats = statsMap.get(ch.id as string)
      const schedules = (ch.sync_schedules as SyncScheduleEntry[]) ?? []
      const label = resolveScheduleLabel(
        (ch.schedule_label as string | null) ?? null,
        schedules.length > 0 ? schedules : null,
        ch.locale as 'pt' | 'en',
      )
      const syncInfo: LastSyncInfo | null = lastSync ? {
        status: lastSync.status as SyncStatus,
        videosFound: (lastSync.videos_found as number) ?? 0,
        videosInserted: (lastSync.videos_inserted as number) ?? 0,
        videosUpdated: (lastSync.videos_updated as number) ?? 0,
        at: lastSync.created_at as string,
        errorMessage: (lastSync.error_message as string | null) ?? null,
      } : null

      return {
        id: ch.id as string,
        locale: ch.locale as 'pt' | 'en',
        handle: ch.handle as string,
        name: ch.name as string,
        subscriberCount: (ch.subscriber_count as number) ?? 0,
        videoCount: (ch.video_count as number) ?? 0,
        thumbnailUrl: (ch.thumbnail_url as string | null) ?? null,
        lastSyncedAt: (ch.last_synced_at as string | null) ?? null,
        lastSyncStatus: (lastSync?.status as string | null) ?? null,
        pinnedVideo: pinnedMap.get(ch.id as string) ?? null,
        totalViews: stats?.views ?? 0,
        totalLikes: stats?.likes ?? 0,
        featuredCount: stats?.featured ?? 0,
        hiddenCount: stats?.hidden ?? 0,
        latestVideoAt: stats?.latestAt ?? null,
        lastSync: syncInfo,
        scheduleLabel: label,
      }
    })

    return {
      channels,
      uncategorizedCount: uncategorizedRes.count ?? 0,
    }
  },
  ['youtube-dashboard'],
  { tags: ['youtube'], revalidate: 120 },
)

export default async function YouTubeDashboardPage() {
  const { siteId } = await getSiteContext()

  const authRes = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  if (!authRes.ok) redirect('/cms')

  const { channels, uncategorizedCount } = await fetchYouTubeDashboardCached(siteId)

  return (
    <DashboardConnected
      channels={channels}
      uncategorizedCount={uncategorizedCount}
    />
  )
}
