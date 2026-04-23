import { getSupabaseServiceClient } from '@/lib/supabase/service'

interface KpiCardProps {
  label: string
  value: string | number
  sub?: string
  accent?: 'default' | 'amber' | 'red' | 'green'
}

const ACCENT_COLORS: Record<string, string> = {
  amber: 'var(--cms-amber, #f59e0b)',
  red: 'var(--cms-red, #ef4444)',
  green: 'var(--cms-green, #22c55e)',
  default: 'var(--cms-text)',
}

function KpiCard({ label, value, sub, accent = 'default' }: KpiCardProps) {
  return (
    <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface p-4 flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-cms-text-dim" style={{ letterSpacing: '0.08em' }}>
        {label}
      </span>
      <span className="text-2xl font-bold leading-tight" style={{ color: ACCENT_COLORS[accent] }}>
        {value}
      </span>
      {sub && (
        <span className="text-xs text-cms-text-dim">
          {sub}
        </span>
      )}
    </div>
  )
}

interface SubscriberKpisProps {
  siteId: string
}

export async function SubscriberKpis({ siteId }: SubscriberKpisProps) {
  const supabase = getSupabaseServiceClient()

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { count: totalActive } = await supabase
    .from('newsletter_subscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('site_id', siteId)
    .eq('status', 'confirmed')

  const { count: newLast30d } = await supabase
    .from('newsletter_subscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('site_id', siteId)
    .eq('status', 'confirmed')
    .gte('confirmed_at', thirtyDaysAgo)

  const { count: unsubLast30d } = await supabase
    .from('newsletter_subscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('site_id', siteId)
    .eq('status', 'unsubscribed')
    .gte('unsubscribed_at', thirtyDaysAgo)

  const churnDenom = (totalActive ?? 0) + (unsubLast30d ?? 0)
  const churnRate = churnDenom > 0 ? ((unsubLast30d ?? 0) / churnDenom) * 100 : 0
  const churnPct = churnRate.toFixed(1) + '%'
  const churnAccent: KpiCardProps['accent'] =
    churnRate >= 5 ? 'red' : churnRate >= 2 ? 'amber' : 'default'

  const { data: editionStats } = await supabase
    .from('newsletter_editions')
    .select('stats_opens, stats_delivered')
    .eq('site_id', siteId)
    .eq('status', 'sent')
    .gte('sent_at', thirtyDaysAgo)

  const editions = editionStats ?? []
  let avgOpenRate = 0
  if (editions.length > 0) {
    const totalDelivered = editions.reduce((s, e) => s + (e.stats_delivered ?? 0), 0)
    const totalOpens = editions.reduce((s, e) => s + (e.stats_opens ?? 0), 0)
    avgOpenRate = totalDelivered > 0 ? (totalOpens / totalDelivered) * 100 : 0
  }
  const openRatePct = avgOpenRate.toFixed(1) + '%'
  const openAccent: KpiCardProps['accent'] =
    avgOpenRate >= 30 ? 'green' : avgOpenRate >= 15 ? 'default' : 'amber'

  return (
    <div
      className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
      data-testid="subscriber-kpis"
    >
      <KpiCard
        label="Total ativos"
        value={(totalActive ?? 0).toLocaleString('pt-BR')}
        sub="confirmados"
        accent="default"
      />
      <KpiCard
        label="Novos (30d)"
        value={(newLast30d ?? 0).toLocaleString('pt-BR')}
        sub="últimos 30 dias"
        accent="green"
      />
      <KpiCard
        label="Taxa de churn"
        value={churnPct}
        sub={churnRate >= 5 ? 'crítico' : churnRate >= 2 ? 'atenção' : 'saudável'}
        accent={churnAccent}
      />
      <KpiCard
        label="Média de abertura"
        value={openRatePct}
        sub={`${editions.length} edições (30d)`}
        accent={openAccent}
      />
    </div>
  )
}
