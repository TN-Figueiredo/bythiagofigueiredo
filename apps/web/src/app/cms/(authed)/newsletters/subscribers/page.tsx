import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { SubscriberList } from '@tn-figueiredo/newsletter-admin/client'
import type { SubscriberRow } from '@tn-figueiredo/newsletter-admin'

export const dynamic = 'force-dynamic'

export default async function SubscribersPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string; page?: string }>
}) {
  const ctx = await getSiteContext()
  const params = await searchParams
  const page = parseInt(params.page ?? '1', 10)
  const perPage = 50
  const offset = (page - 1) * perPage
  const supabase = getSupabaseServiceClient()

  let query = supabase
    .from('newsletter_subscriptions')
    .select('id, email, status, newsletter_id, subscribed_at, confirmed_at, tracking_consent', { count: 'exact' })
    .eq('site_id', ctx.siteId)
    .order('subscribed_at', { ascending: false })
    .range(offset, offset + perPage - 1)

  if (params.type) query = query.eq('newsletter_id', params.type)
  if (params.status) query = query.eq('status', params.status)

  const { data: subs, count } = await query

  const subscribers: SubscriberRow[] = (subs ?? []).map((s) => ({
    id: s.id,
    email: s.email,
    status: s.status,
    newsletter_id: s.newsletter_id,
    subscribed_at: s.subscribed_at,
    confirmed_at: s.confirmed_at,
    tracking_consent: s.tracking_consent,
  }))

  return (
    <SubscriberList
      subscribers={subscribers}
      totalCount={count ?? 0}
      page={page}
      perPage={perPage}
      filters={{ status: params.status }}
    />
  )
}
