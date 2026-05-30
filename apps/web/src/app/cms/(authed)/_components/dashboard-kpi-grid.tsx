import type { KpiQueryResult } from './dashboard-queries'
import { formatNumber } from '../_shared/format-number'
import { KpiCard } from '../_shared/kpi-card'
import type { KpiCardProps } from '../_shared/kpi-card'

interface DashboardKpiGridProps {
  data: KpiQueryResult
}

export function DashboardKpiGrid({ data }: DashboardKpiGridProps) {
  const cards: KpiCardProps[] = [
    {
      label: 'Total Views',
      value: formatNumber(data.totalViews),
      sparkline: data.totalViewsSparkline,
      sparklineColor: 'var(--color-blog)',
      testId: 'kpi-total-views',
    },
    {
      label: 'Publicados',
      value: formatNumber(data.publishedCount),
      trend: undefined,
      testId: 'kpi-publicados',
    },
    {
      label: 'Assinantes',
      value: formatNumber(data.subscribers),
      trend:
        data.subscribersNet !== 0
          ? {
              direction: data.subscribersNet > 0 ? 'up' : 'down',
              label: `${data.subscribersNet > 0 ? '+' : ''}${data.subscribersNet}`,
            }
          : undefined,
      sparklineColor: 'var(--color-newsletter)',
      testId: 'kpi-assinantes',
    },
    {
      label: 'Link Clicks',
      value: formatNumber(data.linkClicks),
      sparkline: data.linkClicksSparkline,
      sparklineColor: 'var(--color-link)',
      testId: 'kpi-link-clicks',
    },
    {
      label: 'Receita',
      value: data.revenue !== null ? formatNumber(data.revenue) : '--',
      testId: 'kpi-receita',
    },
  ]

  return (
    <div
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
      data-testid="kpi-grid"
    >
      {cards.map((card) => (
        <KpiCard key={card.testId} {...card} />
      ))}
    </div>
  )
}
