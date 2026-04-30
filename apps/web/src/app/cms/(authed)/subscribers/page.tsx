import { redirect } from 'next/navigation'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { SubscribersConnected, type SubscriberRow } from './subscribers-connected'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{
    page?: string
    search?: string
    status?: string
    type?: string
  }>
}

export default async function SubscribersPage({ searchParams }: Props) {
  const params = await searchParams
  const { siteId } = await getSiteContext()

  // RBAC: require edit access (org_admin / super_admin)
  const authRes = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!authRes.ok) redirect('/cms')

  const supabase = getSupabaseServiceClient()

  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const perPage = 50
  const offset = (page - 1) * perPage
  const search = params.search ?? ''
  const statusFilter = params.status ?? ''
  const typeFilter = params.type ?? ''

  // Fetch newsletter types for filter dropdown
  const { data: typesRaw } = await supabase
    .from('newsletter_types')
    .select('id, name, color')
    .eq('site_id', siteId)
    .order('sort_order')

  const newsletterTypes = (typesRaw ?? []).map((t) => ({
    id: t.id as string,
    name: t.name as string,
    color: t.color as string | null,
  }))

  const typeMap = new Map(newsletterTypes.map((t) => [t.id, t]))

  // Fetch subscribers with pagination
  let query = supabase
    .from('newsletter_subscriptions')
    .select(
      'id, email, status, newsletter_id, tracking_consent, subscribed_at, confirmed_at, unsubscribed_at',
      { count: 'exact' },
    )
    .eq('site_id', siteId)
    .order('subscribed_at', { ascending: false })
    .range(offset, offset + perPage - 1)

  if (search) query = query.ilike('email', `%${search}%`)
  if (statusFilter) query = query.eq('status', statusFilter)
  if (typeFilter) query = query.eq('newsletter_id', typeFilter)

  const { data: subsRaw, count: totalCount } = await query

  // Build subscriber rows
  const rows: SubscriberRow[] = (subsRaw ?? []).map((s) => {
    const typeInfo = typeMap.get(s.newsletter_id as string)
    const email = s.email as string
    const anonymized = /^[a-f0-9]{8,}\.\.\.@anon$/.test(email)
    return {
      id: s.id as string,
      email,
      status: s.status as SubscriberRow['status'],
      newsletter_type_name: typeInfo?.name ?? 'Unknown',
      newsletter_type_color: typeInfo?.color ?? null,
      tracking_consent: (s.tracking_consent as boolean) ?? false,
      subscribed_at: (s.subscribed_at as string) ?? '',
      confirmed_at: s.confirmed_at as string | null,
      is_anonymized: anonymized,
    }
  })

  // Compute stats
  const [confirmedRes, pendingRes, unsubRes, consentRes] = await Promise.all([
    supabase
      .from('newsletter_subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .eq('status', 'confirmed'),
    supabase
      .from('newsletter_subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .eq('status', 'pending_confirmation'),
    supabase
      .from('newsletter_subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .eq('status', 'unsubscribed'),
    supabase
      .from('newsletter_subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .eq('tracking_consent', true),
  ])

  const totalAll =
    (confirmedRes.count ?? 0) +
    (pendingRes.count ?? 0) +
    (unsubRes.count ?? 0)
  const trackingConsentedPct =
    totalAll > 0
      ? Math.round(((consentRes.count ?? 0) / totalAll) * 100)
      : 0

  const stats = {
    totalConfirmed: confirmedRes.count ?? 0,
    totalPending: pendingRes.count ?? 0,
    totalUnsubscribed: unsubRes.count ?? 0,
    trackingConsentedPct,
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#0f172a] p-4 md:p-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-100">
              Subscribers
            </h1>
            <p className="text-sm text-slate-400">
              Manage newsletter subscribers and lifecycle
            </p>
          </div>
        </header>

        <SubscribersConnected
          initialRows={rows}
          totalCount={totalCount ?? 0}
          page={page}
          perPage={perPage}
          newsletterTypes={newsletterTypes}
          stats={stats}
          currentSearch={search}
          currentStatus={statusFilter}
          currentType={typeFilter}
        />
      </div>
    </main>
  )
}
