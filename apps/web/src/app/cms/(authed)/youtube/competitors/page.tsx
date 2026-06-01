import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { CompetitorDashboard } from './_components/competitor-dashboard'

export const dynamic = 'force-dynamic'

export default async function CompetitorsPage() {
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

  return <CompetitorDashboard channels={channels ?? []} changes={changes ?? []} />
}
