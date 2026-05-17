import type { YtChannelMetrics, YtDailyMetric } from '@/lib/youtube/analytics-types'
import { YtHealthRing } from './yt-health-ring'
import { YtRadarChart } from './yt-radar-chart'
import { YtRetentionCurve } from './yt-retention-curve'

interface Props {
  metrics: YtChannelMetrics
  dailyMetrics: YtDailyMetric[]
}

function computeHealthScore(m: YtChannelMetrics): {
  overall: number
  axes: { label: string; value: number; grade: string }[]
} {
  const ctrScore = Math.min(m.impressionClickThroughRate * 10, 100)
  const retentionScore = Math.min(m.averageViewPercentage * 2, 100)
  const growthScore = Math.min(
    ((m.subscribersGained - m.subscribersLost) / Math.max(m.subscribersGained, 1)) * 100,
    100,
  )
  const engagementScore =
    m.views > 0
      ? Math.min(((m.likes + m.comments + m.shares) / m.views) * 1000, 100)
      : 0
  const frequencyScore = 50 // placeholder until upload frequency is tracked

  const overall = Math.round(
    (ctrScore + retentionScore + growthScore + engagementScore + frequencyScore) / 5,
  )

  function grade(v: number) {
    return v >= 80 ? 'A' : v >= 60 ? 'B' : v >= 40 ? 'C' : 'D'
  }

  return {
    overall,
    axes: [
      { label: 'CTR', value: ctrScore, grade: grade(ctrScore) },
      { label: 'Retention', value: retentionScore, grade: grade(retentionScore) },
      { label: 'Growth', value: growthScore, grade: grade(growthScore) },
      { label: 'Engagement', value: engagementScore, grade: grade(engagementScore) },
      { label: 'Frequency', value: frequencyScore, grade: grade(frequencyScore) },
    ],
  }
}

export function YtOverview({ metrics, dailyMetrics: _dailyMetrics }: Props) {
  const health = computeHealthScore(metrics)

  const kpis = [
    { label: 'Views', value: metrics.views.toLocaleString() },
    {
      label: 'Watch Time',
      value: `${Math.round(metrics.estimatedMinutesWatched / 60)}h`,
    },
    {
      label: 'Subs Net',
      value: `+${metrics.subscribersGained - metrics.subscribersLost}`,
    },
    { label: 'Impressions', value: metrics.impressions.toLocaleString() },
    { label: 'CTR', value: `${metrics.impressionClickThroughRate.toFixed(1)}%` },
    {
      label: 'Avg Duration',
      value: `${Math.floor(metrics.averageViewDuration / 60)}:${String(metrics.averageViewDuration % 60).padStart(2, '0')}`,
    },
    { label: 'Likes', value: metrics.likes.toLocaleString() },
    { label: 'Comments', value: metrics.comments.toLocaleString() },
    { label: 'Shares', value: metrics.shares.toLocaleString() },
  ]

  return (
    <div className="space-y-4">
      {/* Health + Radar row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-cms-border bg-cms-surface p-4">
          <h3 className="mb-3 text-sm font-semibold text-cms-text">Channel Health Score</h3>
          <div className="flex items-center justify-center">
            <YtHealthRing score={health.overall} />
          </div>
        </div>
        <div className="rounded-lg border border-cms-border bg-cms-surface p-4">
          <h3 className="mb-3 text-sm font-semibold text-cms-text">Performance Radar</h3>
          <YtRadarChart axes={health.axes} />
        </div>
      </div>

      {/* KPI Grid — first 6 */}
      <div className="grid grid-cols-3 gap-3 lg:grid-cols-6">
        {kpis.slice(0, 6).map((kpi) => (
          <div key={kpi.label} className="rounded-lg border border-cms-border bg-cms-surface p-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-cms-text-muted">
              {kpi.label}
            </p>
            <p className="mt-0.5 text-sm font-bold tabular-nums text-cms-text">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* KPI Grid — last 3 */}
      <div className="grid grid-cols-3 gap-3">
        {kpis.slice(6).map((kpi) => (
          <div key={kpi.label} className="rounded-lg border border-cms-border bg-cms-surface p-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-cms-text-muted">
              {kpi.label}
            </p>
            <p className="mt-0.5 text-sm font-bold tabular-nums text-cms-text">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Retention Curve */}
      <div className="rounded-lg border border-cms-border bg-cms-surface p-4">
        <h3 className="mb-3 text-sm font-semibold text-cms-text">
          Avg Retention Curve (last 10 videos)
        </h3>
        <YtRetentionCurve avgPercentage={metrics.averageViewPercentage} />
      </div>
    </div>
  )
}
