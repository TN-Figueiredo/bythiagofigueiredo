import { NewsletterDashboard } from '@tn-figueiredo/newsletter-admin/client'
import Link from 'next/link'
import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'
import { getSiteContext } from '../../../../../lib/cms/site-context'
import type { NewsletterTypeInfo, EditionSummary } from '@tn-figueiredo/newsletter-admin'

export const dynamic = 'force-dynamic'

export default async function NewsletterDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string }>
}) {
  const ctx = await getSiteContext()
  const params = await searchParams
  const supabase = getSupabaseServiceClient()

  const { data: types } = await supabase
    .from('newsletter_types')
    .select('id, name, locale, color, cadence_days, last_sent_at, cadence_paused')
    .eq('active', true)
    .order('sort_order')

  let editionsQuery = supabase
    .from('newsletter_editions')
    .select('id, subject, status, newsletter_type_id, slot_date, scheduled_at, sent_at, send_count, stats_opens, stats_delivered, created_at')
    .eq('site_id', ctx.siteId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (params.type) editionsQuery = editionsQuery.eq('newsletter_type_id', params.type)
  if (params.status) editionsQuery = editionsQuery.eq('status', params.status)

  const { data: editions } = await editionsQuery

  const mappedTypes: NewsletterTypeInfo[] = (types ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    locale: t.locale,
    color: t.color,
    cadence_days: t.cadence_days,
    last_sent_at: t.last_sent_at,
    cadence_paused: t.cadence_paused,
  }))

  const mappedEditions: EditionSummary[] = (editions ?? []).map((e) => ({
    id: e.id,
    subject: e.subject,
    status: e.status,
    newsletter_type_id: e.newsletter_type_id,
    slot_date: e.slot_date,
    scheduled_at: e.scheduled_at,
    sent_at: e.sent_at,
    send_count: e.send_count,
    stats_opens: e.stats_opens,
    stats_delivered: e.stats_delivered,
    created_at: e.created_at,
  }))

  return (
    <NewsletterDashboard
      types={mappedTypes}
      editions={mappedEditions}
      filters={params}
      linkComponent={Link}
    />
  )
}
