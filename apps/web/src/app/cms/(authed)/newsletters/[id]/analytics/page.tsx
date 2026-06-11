import { notFound } from 'next/navigation'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { parseUserAgent } from '@/lib/newsletter/stats'
import {
  getEditionDeliverySummary,
  getEditionSendRows,
} from '@/lib/newsletter/delivery'
import { EditionAnalytics } from '@tn-figueiredo/newsletter-admin/client'
import type { AnalyticsData } from '@tn-figueiredo/newsletter-admin'
import { getNewsletterClickRows } from '@/lib/links/newsletter-compat'
import { DeliverySummaryPanel } from './delivery-summary'
import { DeliverySendsTable } from './delivery-sends-table'

export const dynamic = 'force-dynamic'

/** Edition statuses that can have `newsletter_sends` rows. */
const DISPATCHED_STATUSES = new Set(['sending', 'sent', 'failed'])

const STATUS_NOTES: Record<string, string> = {
  sending: 'Envio em andamento — os números abaixo atualizam conforme os eventos chegam.',
  failed: 'O envio falhou — os números abaixo refletem o que foi disparado antes da falha.',
}

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

  const status = edition.status as string

  // Edge state: edition not dispatched yet — no sends to report on.
  if (!DISPATCHED_STATUSES.has(status)) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">{edition.subject as string}</h1>
        <div className="rounded-[10px] border border-gray-800 bg-gray-900 px-4 py-6 text-center">
          <p className="text-sm text-gray-300">Edição ainda não enviada.</p>
          <p className="mt-1 text-[11px] text-gray-500">
            Os dados de entrega aparecem aqui depois do disparo.
          </p>
        </div>
      </div>
    )
  }

  if (status === 'sent' && edition.stats_stale) {
    await supabase.rpc('refresh_newsletter_stats', { p_edition_id: id })
    const { data: refreshed } = await supabase
      .from('newsletter_editions')
      .select('stats_delivered, stats_opens, stats_clicks, stats_bounces, stats_complaints')
      .eq('id', id)
      .single()
    if (refreshed) Object.assign(edition, refreshed)
  }

  // Per-edition delivery picture, straight from newsletter_sends.
  const [deliverySummary, deliveryRows] = await Promise.all([
    getEditionDeliverySummary(supabase, id),
    getEditionSendRows(supabase, id),
  ])

  const statusNote = STATUS_NOTES[status]

  const deliverySection = (
    <div className="space-y-4">
      {statusNote && (
        <p className="rounded-[10px] border border-amber-500 bg-[rgba(245,158,11,0.08)] px-4 py-2 text-[11px] text-amber-400">
          {statusNote}
        </p>
      )}
      <DeliverySummaryPanel summary={deliverySummary} />
      <DeliverySendsTable
        rows={deliveryRows}
        total={deliverySummary.total}
        timezone={ctx.timezone}
      />
    </div>
  )

  // Mid-send / failed editions: delivery picture only (engagement analytics
  // requires a completed send).
  if (status !== 'sent') {
    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-bold">{edition.subject as string}</h1>
        {deliverySection}
      </div>
    )
  }

  // Fetch send IDs for this edition.
  const { data: sendRows } = await supabase
    .from('newsletter_sends')
    .select('id')
    .eq('edition_id', id)

  const sendIds = (sendRows ?? []).map((s) => s.id as string)

  const clickRows = await getNewsletterClickRows({ supabase, sendIds })
  const topLinks = clickRows
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

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

  return (
    <div className="space-y-8">
      {deliverySection}
      <EditionAnalytics data={analyticsData} />
    </div>
  )
}
