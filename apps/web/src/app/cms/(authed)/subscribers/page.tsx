import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { getSiteContext } from '../../../../../lib/cms/site-context'
import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'
import { SubscriberKpis } from './_components/subscriber-kpis'
import { GrowthChart, type GrowthDataPoint } from './_components/growth-chart'
import { SubscriberTableShell } from './_components/subscriber-table-shell'

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
  const ctx = await getSiteContext()
  const cookieStore = await cookies()

  // RBAC gate: only org_admin / super_admin may view subscriber PII
  const userClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(
          list: Array<{ name: string; value: string; options?: CookieOptions }>,
        ) {
          for (const { name, value, options } of list)
            cookieStore.set(name, value, options)
        },
      },
    },
  )

  // Check org-level role — only org_admin / owner / super_admin may view subscriber PII
  const { data: role } = await userClient.rpc('org_role', { p_org_id: ctx.orgId })
  const isAdmin =
    role === 'org_admin' || role === 'owner' || role === 'admin' || role === 'super_admin'

  if (!isAdmin) {
    redirect('/cms?error=insufficient_access')
  }

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
    .eq('active', true)
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
      'id, email, status, newsletter_id, subscribed_at, confirmed_at, unsubscribed_at, tracking_consent',
      { count: 'exact' },
    )
    .eq('site_id', ctx.siteId)
    .order('subscribed_at', { ascending: false })
    .range(offset, offset + perPage - 1)

  if (search) query = query.ilike('email', `%${search}%`)
  if (statusFilter) query = query.eq('status', statusFilter)
  if (typeFilter) query = query.eq('newsletter_id', typeFilter)

  const { data: subsRaw, count: totalCount } = await query

  // Fetch last 5 engagement dots per subscriber
  const subEmails = (subsRaw ?? []).map((s) => s.email as string).filter(Boolean)
  const sendsByEmail: Map<
    string,
    Array<{ status: string; opened_at: string | null; bounced_at: string | null; bounce_type: string | null }>
  > = new Map()

  if (subEmails.length > 0) {
    const { data: sendsRaw } = await supabase
      .from('newsletter_sends')
      .select('subscriber_email, status, opened_at, bounced_at, bounce_type, sent_at')
      .in('subscriber_email', subEmails)
      .order('sent_at', { ascending: false })
      .limit(subEmails.length * 5)

    type SendRow = {
      subscriber_email: string | null
      status: string | null
      opened_at: string | null
      bounced_at: string | null
      bounce_type: string | null
    }

    for (const send of (sendsRaw ?? []) as SendRow[]) {
      const email = send.subscriber_email
      if (!email) continue
      const arr = sendsByEmail.get(email) ?? []
      if (arr.length < 5) {
        arr.push({
          status: send.status ?? 'none',
          opened_at: send.opened_at,
          bounced_at: send.bounced_at,
          bounce_type: send.bounce_type,
        })
        sendsByEmail.set(email, arr)
      }
    }
  }

  // Build subscriber rows
  type DotStatus = 'opened' | 'clicked' | 'none' | 'bounced' | 'complained'

  function toDotStatus(send: {
    status: string
    opened_at: string | null
    bounced_at: string | null
    bounce_type: string | null
  }): DotStatus {
    if (send.status === 'complained') return 'complained'
    if (send.bounced_at) return 'bounced'
    if (send.status === 'clicked') return 'clicked'
    if (send.opened_at) return 'opened'
    return 'none'
  }

  function isAnonymized(email: string): boolean {
    return /^[a-f0-9]{8,}\.\.\.@anon$/.test(email)
  }

  type SubscriberStatus = 'confirmed' | 'pending' | 'bounced' | 'unsubscribed' | 'complained'

  const rows = (subsRaw ?? []).map((s) => {
    const sends = sendsByEmail.get(s.email as string) ?? []
    const dots: DotStatus[] = sends.map(toDotStatus)
    while (dots.length < 5) dots.push('none')
    const typeInfo = typeMap.get(s.newsletter_id as string)
    const anonymized = isAnonymized(s.email as string)
    return {
      id: s.id as string,
      email: s.email as string,
      status: s.status as SubscriberStatus,
      newsletter_type_name: typeInfo?.name ?? 'Desconhecido',
      newsletter_type_color: typeInfo?.color ?? null,
      engagement_dots: dots,
      tracking_consent: (s.tracking_consent as boolean) ?? false,
      subscribed_at: s.subscribed_at as string,
      confirmed_at: s.confirmed_at as string | null,
      is_anonymized: anonymized,
    }
  })

  // Growth chart data (last 365 days)
  const oneYearAgo = new Date(
    Date.now() - 365 * 24 * 60 * 60 * 1000,
  ).toISOString()

  const { data: newSubs } = await supabase
    .from('newsletter_subscriptions')
    .select('confirmed_at')
    .eq('site_id', ctx.siteId)
    .eq('status', 'confirmed')
    .gte('confirmed_at', oneYearAgo)
    .not('confirmed_at', 'is', null)

  const { data: churnedSubs } = await supabase
    .from('newsletter_subscriptions')
    .select('unsubscribed_at')
    .eq('site_id', ctx.siteId)
    .eq('status', 'unsubscribed')
    .gte('unsubscribed_at', oneYearAgo)
    .not('unsubscribed_at', 'is', null)

  const growthMap = new Map<string, { gain: number; loss: number }>()

  for (const s of newSubs ?? []) {
    const d = String(s.confirmed_at).slice(0, 10)
    const entry = growthMap.get(d) ?? { gain: 0, loss: 0 }
    entry.gain++
    growthMap.set(d, entry)
  }
  for (const s of churnedSubs ?? []) {
    const d = String(s.unsubscribed_at).slice(0, 10)
    const entry = growthMap.get(d) ?? { gain: 0, loss: 0 }
    entry.loss++
    growthMap.set(d, entry)
  }

  const growthData: GrowthDataPoint[] = []
  for (let i = 364; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    const dateStr = d.toISOString().slice(0, 10)
    const entry = growthMap.get(dateStr) ?? { gain: 0, loss: 0 }
    growthData.push({ date: dateStr, ...entry })
  }

  const isEmpty = (totalCount ?? 0) === 0 && !search && !statusFilter && !typeFilter

  return (
    <main className="p-4 md:p-8 max-w-7xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-xl font-bold"
            style={{ color: 'var(--cms-text)' }}
          >
            Assinantes
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--cms-text-dim)' }}>
            Visibilidade completa e gerenciamento de ciclo de vida
          </p>
        </div>
        <a
          href="/cms/newsletters"
          className="text-sm px-3 py-1.5 rounded-lg border transition-colors"
          style={{ borderColor: 'var(--cms-border)', color: 'var(--cms-text-dim)' }}
        >
          ← Newsletters
        </a>
      </header>

      <SubscriberKpis siteId={ctx.siteId} />

      <div className="hidden lg:block">
        <GrowthChart data={growthData} />
      </div>

      {isEmpty ? (
        <div
          className="rounded-lg border p-12 text-center"
          style={{ borderColor: 'var(--cms-border)', background: 'var(--cms-surface)' }}
          data-testid="subscribers-empty"
        >
          <div className="text-4xl mb-3">📭</div>
          <h2
            className="text-base font-semibold mb-1"
            style={{ color: 'var(--cms-text)' }}
          >
            Nenhum assinante ainda
          </h2>
          <p className="text-sm mb-4" style={{ color: 'var(--cms-text-dim)' }}>
            Adicione um formulário de newsletter ao seu site para começar a
            capturar assinantes.
          </p>
          <a
            href="/cms/newsletters"
            className="inline-block text-sm px-4 py-2 rounded-lg font-medium"
            style={{ background: 'var(--cms-text)', color: 'var(--cms-surface)' }}
          >
            Configurar newsletter
          </a>
        </div>
      ) : (
        <SubscriberTableShell
          initialRows={rows}
          totalCount={totalCount ?? 0}
          page={page}
          perPage={perPage}
          newsletterTypes={newsletterTypes}
          currentSearch={search}
          currentStatus={statusFilter}
          currentType={typeFilter}
        />
      )}
    </main>
  )
}
