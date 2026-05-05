import { redirect } from 'next/navigation'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { DashboardConnected, type ChannelDashboard, type PinnedVideo } from './dashboard-connected'

export const dynamic = 'force-dynamic'

export default async function YouTubeDashboardPage() {
  const { siteId } = await getSiteContext()

  const authRes = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  if (!authRes.ok) redirect('/cms')

  const supabase = getSupabaseServiceClient()

  const [channelsRes, uncategorizedRes, recentSyncRes, pinnedRes] = await Promise.all([
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
      .select('channel_id, status, videos_found, videos_inserted, created_at')
      .eq('site_id', siteId)
      .order('created_at', { ascending: false })
      .limit(6),
    supabase.from('youtube_videos')
      .select('id, title, thumbnail_url, view_count, like_count, pinned_until, channel_id')
      .eq('site_id', siteId)
      .gt('pinned_until', new Date().toISOString()),
  ])

  const rawChannels = channelsRes.data ?? []
  const rawPinned = pinnedRes.data ?? []
  const rawSyncs = recentSyncRes.data ?? []

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

  const channels: ChannelDashboard[] = rawChannels.map(ch => {
    const lastSync = rawSyncs.find(s => s.channel_id === ch.id)
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
    }
  })

  return (
    <DashboardConnected
      channels={channels}
      uncategorizedCount={uncategorizedRes.count ?? 0}
    />
  )
}
