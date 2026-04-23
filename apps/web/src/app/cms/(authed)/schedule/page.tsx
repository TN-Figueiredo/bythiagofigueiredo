import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { CmsTopbar } from '@/components/cms/cms-topbar'
import { ScheduleClient } from './_components/schedule-client'

export default async function SchedulePage() {
  const supabase = getSupabaseServiceClient()
  const { siteId } = await getSiteContext()

  const [postsRes, editionsRes, cadenceRes, backlogRes] = await Promise.all([
    supabase.from('blog_posts').select('id, slot_date, status, blog_translations(title, locale)')
      .eq('site_id', siteId).in('status', ['queued', 'scheduled']).not('slot_date', 'is', null),
    supabase.from('newsletter_editions').select('id, subject, status, scheduled_at, newsletter_types(name)')
      .eq('site_id', siteId).in('status', ['scheduled', 'queued']),
    supabase.from('blog_cadence').select('*').eq('site_id', siteId),
    supabase.from('blog_posts').select('id, blog_translations(title, locale, reading_time_min)')
      .eq('site_id', siteId).eq('status', 'ready').is('slot_date', null).order('created_at').limit(10),
  ])

  return (
    <div>
      <CmsTopbar title="Schedule" />
      <ScheduleClient
        posts={(postsRes.data ?? []) as any}
        editions={(editionsRes.data ?? []) as any}
        cadence={(cadenceRes.data ?? []) as any}
        backlog={(backlogRes.data ?? []) as any}
      />
    </div>
  )
}
