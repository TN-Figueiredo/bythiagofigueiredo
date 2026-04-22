import { notFound } from 'next/navigation'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { parseUserAgent } from '@/lib/newsletter/stats'
import { EditionAnalytics } from '@tn-figueiredo/newsletter-admin/client'
import type { AnalyticsData } from '@tn-figueiredo/newsletter-admin'

export const dynamic = 'force-dynamic'

export default async function EditionAnalyticsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const ctx = await getSiteContext()
  const supabase = getSupabaseServiceClient()

  const { data: edition } = await supabase
    .from('newsletter_editions')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!edition || edition.site_id !== ctx.siteId) return notFound()
  if (edition.status !== 'sent') return notFound()

  if (edition.stats_stale) {
    await supabase.rpc('refresh_newsletter_stats', { p_edition_id: id })
    const { data: refreshed } = await supabase
      .from('newsletter_editions')
      .select('stats_delivered, stats_opens, stats_clicks, stats_bounces, stats_complaints')
      .eq('id', id)
      .single()
    if (refreshed) Object.assign(edition, refreshed)
  }

  // Two-step: get send IDs for this edition, then fetch clicks
  const { data: sendIds } = await supabase
    .from('newsletter_sends')
    .select('id')
    .eq('edition_id', id)

  const { data: clicks } = sendIds?.length
    ? await supabase
        .from('newsletter_click_events')
        .select('url')
        .in('send_id', sendIds.map((s) => s.id))
    : { data: [] as { url: string }[] }

  const clickMap = new Map<string, number>()
  for (const c of clicks ?? []) {
    clickMap.set(c.url, (clickMap.get(c.url) ?? 0) + 1)
  }
  const topLinks = [...clickMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([url, count]) => ({ url, count }))

  const { data: opens } = await supabase
    .from('newsletter_sends')
    .select('open_user_agent')
    .eq('edition_id', id)
    .not('open_user_agent', 'is', null)
    .limit(1000)

  const clientCounts = new Map<string, number>()
  const deviceCounts = new Map<string, number>()
  for (const o of opens ?? []) {
    if (!o.open_user_agent) continue
    const parsed = parseUserAgent(o.open_user_agent)
    clientCounts.set(parsed.client, (clientCounts.get(parsed.client) ?? 0) + 1)
    deviceCounts.set(parsed.device, (deviceCounts.get(parsed.device) ?? 0) + 1)
  }

  const analyticsData: AnalyticsData = {
    subject: edition.subject as string,
    sent_at: edition.sent_at as string,
    send_count: edition.send_count as number,
    stats_delivered: (edition.stats_delivered as number) ?? 0,
    stats_opens: (edition.stats_opens as number) ?? 0,
    stats_clicks: (edition.stats_clicks as number) ?? 0,
    stats_bounces: (edition.stats_bounces as number) ?? 0,
    stats_complaints: (edition.stats_complaints as number) ?? 0,
    topLinks,
    emailClients: [...clientCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count })),
    devices: [...deviceCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count })),
  }

  return <EditionAnalytics data={analyticsData} />
}
