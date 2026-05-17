import { getSiteContext } from '@/lib/cms/site-context'
import { fetchContentTabData } from '@/lib/analytics/content-queries'
import { ContentTopPosts } from './content-top-posts'
import { ContentDailyChart } from './content-daily-chart'
import { SparklineSvg } from './sparkline-svg'
import type { PeriodInput } from '../types'

interface Props {
  periodInput: PeriodInput
  compareEnabled?: boolean
}

export async function ContentTab({ periodInput, compareEnabled = false }: Props) {
  const { siteId, timezone } = await getSiteContext()
  const data = await fetchContentTabData(siteId, periodInput, timezone)

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {data.kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-lg border border-cms-border bg-cms-surface p-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-cms-text-muted">{kpi.label}</p>
            <div className="mt-1 flex items-end justify-between gap-2">
              <p className="text-lg font-bold tabular-nums text-cms-text">
                {typeof kpi.value === 'number' ? kpi.value.toLocaleString() : kpi.value}
              </p>
              {kpi.sparkline.length > 1 && <SparklineSvg data={kpi.sparkline} color="var(--acc)" />}
            </div>
            {kpi.delta && (
              <p className={`mt-0.5 text-[10px] font-medium ${kpi.delta.direction === 'up' ? 'text-green-400' : kpi.delta.direction === 'down' ? 'text-red-400' : 'text-cms-text-muted'}`}>
                {kpi.delta.value}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Daily Chart */}
      <ContentDailyChart data={data.dailyChart} compareEnabled={compareEnabled} />

      {/* Top Posts Table */}
      <ContentTopPosts posts={data.topPosts} />
    </div>
  )
}
