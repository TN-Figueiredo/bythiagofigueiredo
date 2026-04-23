import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'

interface KpiTileProps {
  label: string
  value: string | number
  sub?: string
  color?: 'amber' | 'green' | 'indigo' | 'default'
}

function KpiTile({ label, value, sub, color = 'default' }: KpiTileProps) {
  const accentMap = {
    amber: 'border-t-[var(--cms-amber)]',
    green: 'border-t-[var(--cms-green)]',
    indigo: 'border-t-cms-accent',
    default: 'border-t-cms-border',
  }
  return (
    <div
      className={`rounded-[var(--cms-radius)] border border-cms-border border-t-2 bg-cms-surface px-4 py-4 ${accentMap[color]}`}
    >
      <p className="text-[11px] font-medium uppercase tracking-[1.5px] text-cms-text-muted">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold leading-none text-cms-text">
        {value}
      </p>
      {sub && (
        <p className="mt-1 text-[11px] text-cms-text-dim">{sub}</p>
      )}
    </div>
  )
}

export async function CampaignKpis() {
  const ctx = await getSiteContext()
  const supabase = getSupabaseServiceClient()

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { count: activeCount } = await supabase
    .from('campaigns')
    .select('id', { count: 'exact', head: true })
    .eq('site_id', ctx.siteId)
    .in('status', ['published', 'scheduled'])

  const { count: totalSubmissions } = await supabase
    .from('campaign_submissions')
    .select('id', { count: 'exact', head: true })
    .in(
      'campaign_id',
      await supabase
        .from('campaigns')
        .select('id')
        .eq('site_id', ctx.siteId)
        .then((r) => (r.data ?? []).map((c) => c.id)),
    )

  const { count: pdfDownloads30d } = await supabase
    .from('campaign_submissions')
    .select('id', { count: 'exact', head: true })
    .gte('downloaded_at', thirtyDaysAgo)
    .in(
      'campaign_id',
      await supabase
        .from('campaigns')
        .select('id')
        .eq('site_id', ctx.siteId)
        .then((r) => (r.data ?? []).map((c) => c.id)),
    )

  const conversionRate =
    (activeCount ?? 0) > 0
      ? (((totalSubmissions ?? 0) / (activeCount ?? 1)) * 10).toFixed(1)
      : '—'

  return (
    <div
      className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      data-testid="campaign-kpis"
    >
      <KpiTile
        label="Active campaigns"
        value={activeCount ?? 0}
        color="amber"
      />
      <KpiTile
        label="Total submissions"
        value={totalSubmissions ?? 0}
        color="green"
      />
      <KpiTile
        label="PDF downloads / 30d"
        value={pdfDownloads30d ?? 0}
        color="indigo"
      />
      <KpiTile
        label="Conv. rate"
        value={conversionRate === '—' ? '—' : `${conversionRate}%`}
        sub="subs per active campaign × 10"
      />
    </div>
  )
}
