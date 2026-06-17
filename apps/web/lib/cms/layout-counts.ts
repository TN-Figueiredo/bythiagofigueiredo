import { unstable_cache } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

// Exported so DB-gated tests can assert the raw counts directly (the unstable_cache
// wrapper below makes per-test assertions flaky).
export async function fetchLayoutCountsInner(siteId: string) {
  const svc = getSupabaseServiceClient()
  // A launching waitlist is "stuck" (actionable) only once it has sat past the 6h watchdog
  // window; a fresh one is in-flight and excluded. Absolute-instant threshold avoids
  // off-by-one/timezone drift.
  const stuckThreshold = new Date(Date.now() - 6 * 3600 * 1000).toISOString()
  const [pendingContactsRes, ytPendingRes, researchUnreadRes, failedWlRes, stuckLaunchingWlRes] = await Promise.all([
    svc.from('contact_submissions').select('id', { count: 'exact', head: true })
      .eq('site_id', siteId).is('replied_at', null).is('anonymized_at', null),
    svc.from('youtube_videos').select('id', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .not('auto_suggested_category_id', 'is', null)
      .is('category_id', null),
    svc.from('research_items').select('id', { count: 'exact', head: true })
      .eq('site_id', siteId).eq('status', 'new'),
    svc.from('waitlists').select('id', { count: 'exact', head: true })
      .eq('site_id', siteId).eq('status', 'failed'),
    svc.from('waitlists').select('id', { count: 'exact', head: true })
      .eq('site_id', siteId).eq('status', 'launching').lt('updated_at', stuckThreshold),
  ])
  return {
    pendingContacts: pendingContactsRes.count ?? 0,
    ytPending: ytPendingRes.count ?? 0,
    researchUnread: researchUnreadRes.count ?? 0,
    waitlistsNeedAttention: (failedWlRes.count ?? 0) + (stuckLaunchingWlRes.count ?? 0),
  }
}

export const fetchLayoutCounts = unstable_cache(
  fetchLayoutCountsInner,
  ['layout-counts'],
  { tags: ['layout-counts'], revalidate: 60 },
)
