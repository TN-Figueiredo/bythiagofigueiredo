import Link from 'next/link'
import { cms } from '@/lib/cms/admin'
import { CmsTopbar, CmsButton } from '@tn-figueiredo/cms-ui/client'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { NewslettersConnected } from './newsletters-connected'
import { NewsletterToastProvider } from './_components/toast-provider'

export const dynamic = 'force-dynamic'

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

async function fetchKpiData(siteId: string) {
  const supabase = getSupabaseServiceClient()
  const thirtyDaysAgo = new Date(Date.now() - THIRTY_DAYS_MS).toISOString()
  const sixtyDaysAgo = new Date(Date.now() - 2 * THIRTY_DAYS_MS).toISOString()

  // Unique active subscribers across all types
  const { count: uniqueSubscribers } = await supabase
    .from('newsletter_subscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('site_id', siteId)
    .eq('status', 'confirmed')

  // Editions sent in last 30d
  const { data: recentEditions } = await supabase
    .from('newsletter_editions')
    .select('id, stats_delivered, stats_opens, stats_bounces')
    .eq('site_id', siteId)
    .eq('status', 'sent')
    .gte('sent_at', thirtyDaysAgo)

  const editions30d = recentEditions ?? []
  const editionsSent30d = editions30d.length

  // Calculate avg open rate for last 30d
  const totalDelivered30d = editions30d.reduce((s, e) => s + (e.stats_delivered ?? 0), 0)
  const totalOpens30d = editions30d.reduce((s, e) => s + (e.stats_opens ?? 0), 0)
  const avgOpenRate30d = totalDelivered30d > 0 ? (totalOpens30d / totalDelivered30d) * 100 : 0

  // Prior 30d for delta calculation
  const { data: priorEditions } = await supabase
    .from('newsletter_editions')
    .select('stats_delivered, stats_opens')
    .eq('site_id', siteId)
    .eq('status', 'sent')
    .gte('sent_at', sixtyDaysAgo)
    .lt('sent_at', thirtyDaysAgo)

  const priorEditions30d = priorEditions ?? []
  let avgOpenRateDelta: number | null = null
  if (priorEditions30d.length > 0) {
    const priorDelivered = priorEditions30d.reduce((s, e) => s + (e.stats_delivered ?? 0), 0)
    const priorOpens = priorEditions30d.reduce((s, e) => s + (e.stats_opens ?? 0), 0)
    const priorRate = priorDelivered > 0 ? (priorOpens / priorDelivered) * 100 : 0
    avgOpenRateDelta = avgOpenRate30d - priorRate
  }

  // Bounce rate
  const totalBounces30d = editions30d.reduce((s, e) => s + (e.stats_bounces ?? 0), 0)
  const bounceRate = totalDelivered30d > 0 ? (totalBounces30d / totalDelivered30d) * 100 : 0

  return {
    uniqueSubscribers: uniqueSubscribers ?? 0,
    editionsSent30d,
    avgOpenRate30d,
    avgOpenRateDelta,
    bounceRate,
  }
}

async function fetchLastEdition(siteId: string) {
  const supabase = getSupabaseServiceClient()

  const { data } = await supabase
    .from('newsletter_editions')
    .select('id, subject, sent_at, stats_delivered, stats_opens, stats_clicks')
    .eq('site_id', siteId)
    .eq('status', 'sent')
    .order('sent_at', { ascending: false })
    .limit(1)

  const edition = data?.[0]
  if (!edition) return null

  const delivered = edition.stats_delivered ?? 0
  const opens = edition.stats_opens ?? 0
  const openRate = delivered > 0 ? (opens / delivered) * 100 : 0

  return {
    id: edition.id as string,
    subject: edition.subject as string,
    sentAt: edition.sent_at as string,
    delivered,
    opens,
    clicks: edition.stats_clicks ?? 0,
    openRate,
  }
}

async function fetchEditionsWithMeta(siteId: string, typeId?: string, status?: string) {
  const supabase = getSupabaseServiceClient()

  let query = supabase
    .from('newsletter_editions')
    .select(`
      id, subject, status, newsletter_type_id,
      stats_delivered, stats_opens, stats_clicks, stats_bounces,
      total_subscribers, sent_at, scheduled_at, created_at, updated_at,
      error_message, retry_count, max_retries, source_post_id
    `)
    .eq('site_id', siteId)
    .order('created_at', { ascending: false })

  if (typeId) {
    query = query.eq('newsletter_type_id', typeId)
  }
  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  const { data: editions, count } = await query

  // Fetch newsletter types for name/color mapping
  const { data: typeRows } = await supabase
    .from('newsletter_types')
    .select('id, name, color')
    .eq('site_id', siteId)

  const typeMap = new Map<string, { name: string; color: string }>()
  for (const t of typeRows ?? []) {
    typeMap.set(t.id as string, { name: t.name as string, color: (t.color ?? '#6366f1') as string })
  }

  // Find best performer (highest open rate among sent editions)
  const sentEditions = (editions ?? []).filter((e) => e.status === 'sent')
  let bestId: string | null = null
  let bestOpenRate = 0
  for (const e of sentEditions) {
    const delivered = (e.stats_delivered ?? 0) as number
    const opens = (e.stats_opens ?? 0) as number
    if (delivered > 0) {
      const rate = opens / delivered
      if (rate > bestOpenRate) {
        bestOpenRate = rate
        bestId = e.id as string
      }
    }
  }

  const enriched = (editions ?? []).map((e) => {
    const typeInfo = typeMap.get(e.newsletter_type_id as string)
    return {
      id: e.id as string,
      subject: e.subject as string,
      status: e.status as 'idea' | 'draft' | 'ready' | 'queued' | 'scheduled' | 'sending' | 'sent' | 'failed' | 'cancelled',
      newsletter_type_id: e.newsletter_type_id as string,
      newsletter_type_name: typeInfo?.name,
      newsletter_type_color: typeInfo?.color,
      stats_delivered: e.stats_delivered as number | null,
      stats_opens: e.stats_opens as number | null,
      stats_clicks: e.stats_clicks as number | null,
      stats_bounces: e.stats_bounces as number | null,
      total_subscribers: e.total_subscribers as number | null,
      sent_at: e.sent_at as string | null,
      scheduled_at: e.scheduled_at as string | null,
      created_at: e.created_at as string | null,
      updated_at: e.updated_at as string | null,
      error_message: e.error_message as string | null,
      retry_count: e.retry_count as number | null,
      max_retries: e.max_retries as number | null,
      source_post_id: e.source_post_id as string | null,
      is_best_performer: bestId === e.id,
    }
  })

  return { editions: enriched, total: count ?? enriched.length }
}

export default async function NewsletterDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string; q?: string; page?: string; sort?: string; dir?: string }>
}) {
  const params = await searchParams
  const ctx = await getSiteContext()

  const [types, kpis, lastEdition, { editions, total }] = await Promise.all([
    cms.newsletters.listTypes(),
    fetchKpiData(ctx.siteId),
    fetchLastEdition(ctx.siteId),
    fetchEditionsWithMeta(ctx.siteId, params.type, params.status),
  ])

  return (
    <div>
      <NewsletterToastProvider />
      <CmsTopbar
        title="Newsletters"
        actions={
          <Link href="/cms/newsletters/new">
            <CmsButton variant="primary" size="sm">
              + New Edition
            </CmsButton>
          </Link>
        }
      />
      <div className="p-6 lg:p-8">
        <NewslettersConnected
          types={types}
          editions={editions}
          kpis={kpis}
          lastEdition={lastEdition}
          totalEditions={total}
        />
      </div>
    </div>
  )
}
