import { notFound } from 'next/navigation'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'

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
    await supabase.rpc('refresh_newsletter_stats')
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

  function parseUA(ua: string): { client: string; device: string } {
    const lc = ua.toLowerCase()
    const client =
      lc.includes('gmail') ? 'Gmail' :
      lc.includes('apple') || lc.includes('webkit') ? 'Apple Mail' :
      lc.includes('outlook') || lc.includes('microsoft') ? 'Outlook' :
      lc.includes('thunderbird') ? 'Thunderbird' :
      'Other'
    const device =
      lc.includes('mobile') || lc.includes('android') || lc.includes('iphone') ? 'Mobile' :
      lc.includes('tablet') || lc.includes('ipad') ? 'Tablet' :
      'Desktop'
    return { client, device }
  }

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
    const parsed = parseUA(o.open_user_agent)
    clientCounts.set(parsed.client, (clientCounts.get(parsed.client) ?? 0) + 1)
    deviceCounts.set(parsed.device, (deviceCounts.get(parsed.device) ?? 0) + 1)
  }

  const d = (edition.stats_delivered as number) || 1
  const openRate = Math.round(((edition.stats_opens as number) / d) * 100)
  const clickRate = Math.round(((edition.stats_clicks as number) / d) * 100)

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">{edition.subject as string}</h1>
      <p className="text-sm text-gray-500">
        Sent {new Date(edition.sent_at as string).toLocaleString()} · {edition.send_count as number} recipients
      </p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Delivered" value={edition.stats_delivered as number} />
        <KpiCard label="Opened" value={edition.stats_opens as number} pct={openRate} />
        <KpiCard label="Clicked" value={edition.stats_clicks as number} pct={clickRate} />
        <KpiCard label="Bounced" value={edition.stats_bounces as number} />
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-2">Top Links</h2>
        {topLinks.length === 0 ? (
          <p className="text-gray-400 text-sm">No clicks yet.</p>
        ) : (
          <ul className="space-y-1">
            {topLinks.map(([url, count]) => (
              <li key={url} className="flex items-center gap-3 text-sm">
                <span className="font-mono text-gray-400 w-8 text-right">{count}</span>
                <span className="truncate text-gray-700">{url}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Email Clients</h2>
        <div className="flex gap-4">
          {[...clientCounts.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => (
            <span key={name} className="text-sm">
              {name}: <strong>{count}</strong>
            </span>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Devices</h2>
        <div className="flex gap-4">
          {[...deviceCounts.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => (
            <span key={name} className="text-sm">
              {name}: <strong>{count}</strong>
            </span>
          ))}
        </div>
      </section>
    </div>
  )
}

function KpiCard({ label, value, pct }: { label: string; value: number; pct?: number }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-2xl font-bold">{(value ?? 0).toLocaleString()}</div>
      <div className="text-sm text-gray-500">
        {label}
        {pct !== undefined && <span className="ml-1 text-gray-400">({pct}%)</span>}
      </div>
    </div>
  )
}
