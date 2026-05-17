import { ProgressBarList } from './progress-bar-list'
import type { ReferrerItem } from '@/lib/analytics/links-queries'

interface Props {
  referrers: ReferrerItem[]
}

const REFERRER_COLORS = ['#FF8240', '#60a5fa', '#34d399', '#fbbf24', '#a78bfa']

export function LinksReferrers({ referrers }: Props) {
  const items = referrers.map((r, i) => ({
    label: r.domain,
    value: r.clicks,
    color: REFERRER_COLORS[i % REFERRER_COLORS.length]!,
    suffix: 'clicks',
  }))

  return (
    <div className="rounded-lg border border-cms-border bg-cms-surface p-4">
      <h3 className="mb-3 text-sm font-semibold text-cms-text">Top Referrer Domains</h3>
      {items.length === 0 ? (
        <p className="text-xs text-cms-text-muted">No referrer data in this period.</p>
      ) : (
        <ProgressBarList items={items} />
      )}
    </div>
  )
}
