import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { LibraryDashboard } from './_components/library-dashboard'
import { getAbSiteSettings, getEligibleVideosForPicker } from '../queries'

export const metadata = { title: 'Library: A/B Lab' }
export const dynamic = 'force-dynamic'

export default async function LibraryPage() {
  const { siteId } = await getSiteContext()
  const supabase = getSupabaseServiceClient()

  // Fetch library entries + wizard prerequisites in parallel
  const [libraryResult, settings, eligibleVideos] = await Promise.all([
    supabase
      .from('thumbnail_library')
      .select('id, source_type, blob_url, title, tags, video_title, ctr_at_win, lift_at_win, created_at, thumbnail_longevity(checkpoint_days, status, change_percent, checked_at)')
      .eq('site_id', siteId)
      .order('created_at', { ascending: false }),
    getAbSiteSettings().catch(() => undefined),
    getEligibleVideosForPicker().catch(() => []),
  ])

  return (
    <LibraryDashboard
      entries={libraryResult.data ?? []}
      wizardSettings={settings}
      wizardEligibleVideos={eligibleVideos}
      siteId={siteId}
    />
  )
}
