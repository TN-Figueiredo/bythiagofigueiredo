import { unstable_cache } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

async function fetchLayoutCountsInner(siteId: string) {
  const svc = getSupabaseServiceClient()
  const [pendingContactsRes, ytPendingRes, researchUnreadRes] = await Promise.all([
    svc.from('contact_submissions').select('id', { count: 'exact', head: true })
      .eq('site_id', siteId).is('replied_at', null).is('anonymized_at', null),
    svc.from('youtube_videos').select('id', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .not('auto_suggested_category_id', 'is', null)
      .is('category_id', null),
    svc.from('research_items').select('id', { count: 'exact', head: true })
      .eq('site_id', siteId).eq('status', 'new'),
  ])
  return {
    pendingContacts: pendingContactsRes.count ?? 0,
    ytPending: ytPendingRes.count ?? 0,
    researchUnread: researchUnreadRes.count ?? 0,
  }
}

export const fetchLayoutCounts = unstable_cache(
  fetchLayoutCountsInner,
  ['layout-counts'],
  { tags: ['layout-counts'], revalidate: 60 },
)
