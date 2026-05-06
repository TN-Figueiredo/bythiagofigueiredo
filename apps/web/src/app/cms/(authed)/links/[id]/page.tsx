import { notFound, redirect } from 'next/navigation'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { LinkDetail } from './_detail'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function LinkDetailPage({ params }: Props) {
  const { id } = await params
  const { siteId } = await getSiteContext()

  const authRes = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  if (!authRes.ok) redirect('/cms')

  const supabase = getSupabaseServiceClient()

  const { data: link, error } = await supabase
    .from('tracked_links')
    .select('*')
    .eq('id', id)
    .eq('site_id', siteId)
    .single()

  if (error || !link) notFound()
  if (link.deleted_at) notFound()

  // Fetch recent daily metrics (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)
  const { data: recentMetrics } = await supabase
    .from('link_daily_metrics')
    .select('date, clicks, unique_visitors')
    .eq('link_id', id)
    .gte('date', thirtyDaysAgo)
    .order('date', { ascending: true })

  const dailyClicks = (recentMetrics ?? []).map((m) => ({
    date: m.date as string,
    clicks: (m.clicks as number) ?? 0,
    unique: (m.unique_visitors as number) ?? 0,
  }))

  // Top country from aggregated daily metrics
  const { data: countryRows } = await supabase
    .from('link_daily_metrics')
    .select('countries')
    .eq('link_id', id)
    .gte('date', thirtyDaysAgo)
    .limit(30)

  const countryAgg = new Map<string, number>()
  for (const row of countryRows ?? []) {
    const countries = row.countries as Record<string, number> | null
    if (countries) {
      for (const [c, n] of Object.entries(countries)) {
        countryAgg.set(c, (countryAgg.get(c) ?? 0) + n)
      }
    }
  }
  let topCountry: string | null = null
  let topCount = 0
  for (const [c, n] of countryAgg) {
    if (n > topCount) {
      topCount = n
      topCountry = c
    }
  }

  const pulseEnabled = process.env.LINKS_LIVE_PULSE_ENABLED !== 'false'

  return (
    <div className="flex flex-col gap-6 px-4 py-4 md:px-7">
      <LinkDetail
        link={{
          id: link.id as string,
          code: link.code as string,
          slug: (link.slug as string) ?? null,
          title: (link.title as string) ?? null,
          destination_url: link.destination_url as string,
          source_type: (link.source_type as string) ?? 'manual',
          tags: (link.tags as string[]) ?? [],
          active: link.active as boolean,
          redirect_type: (link.redirect_type as number) ?? 302,
          expires_at: (link.expires_at as string) ?? null,
          total_clicks: (link.total_clicks as number) ?? 0,
          unique_visitors: (link.unique_visitors as number) ?? 0,
          last_clicked_at: (link.last_clicked_at as string) ?? null,
          created_at: link.created_at as string,
        }}
        dailyClicks={dailyClicks}
        topCountry={topCountry}
        pulseEnabled={pulseEnabled}
        linkId={id}
      />
    </div>
  )
}
