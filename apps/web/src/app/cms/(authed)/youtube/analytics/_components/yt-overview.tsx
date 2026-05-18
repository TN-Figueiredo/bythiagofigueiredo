import type { YtChannelMetrics, YtDailyMetric } from '@/lib/youtube/analytics-types'
import { YtHealthRing } from './yt-health-ring'
import { YtRadarChart } from './yt-radar-chart'
import { YtRetentionCurve } from './yt-retention-curve'

interface Props {
  metrics: YtChannelMetrics
  dailyMetrics: YtDailyMetric[]
  intelligenceHealthScore?: number
  intelligenceRadar?: Array<{ label: string; value: number; grade: string }>
}

function computeFallbackHealth(m: YtChannelMetrics): {
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

  const overall = Math.round(
    (ctrScore + retentionScore + growthScore + engagementScore) / 4,
  )

  function grade(v: number) {
    return v >= 85 ? 'A' : v >= 65 ? 'B' : v >= 40 ? 'C' : 'D'
  }

  return {
    overall,
    axes: [
      { label: 'CTR', value: ctrScore, grade: grade(ctrScore) },
      { label: 'Retenção', value: retentionScore, grade: grade(retentionScore) },
      { label: 'Crescimento', value: growthScore, grade: grade(growthScore) },
      { label: 'Engajamento', value: engagementScore, grade: grade(engagementScore) },
    ],
  }
}

export function YtOverview({ metrics, dailyMetrics: _dailyMetrics, intelligenceHealthScore, intelligenceRadar }: Props) {
  const useIntelligence = intelligenceRadar && intelligenceRadar.length > 0 && intelligenceHealthScore !== undefined
  const health = useIntelligence
    ? { overall: intelligenceHealthScore!, axes: intelligenceRadar! }
    : computeFallbackHealth(metrics)

  const kpis = [
    { label: 'Visualizações', value: metrics.views.toLocaleString() },
    {
      label: 'Tempo Assistido',
      value: `${Math.round(metrics.estimatedMinutesWatched / 60)}h`,
    },
    {
      label: 'Subs Líquido',
      value: `+${metrics.subscribersGained - metrics.subscribersLost}`,
    },
    { label: 'Impressões', value: metrics.impressions.toLocaleString() },
    { label: 'CTR', value: `${metrics.impressionClickThroughRate.toFixed(1)}%` },
    {
      label: 'Duração Média',
      value: `${Math.floor(metrics.averageViewDuration / 60)}:${String(metrics.averageViewDuration % 60).padStart(2, '0')}`,
    },
    { label: 'Curtidas', value: metrics.likes.toLocaleString() },
    { label: 'Comentários', value: metrics.comments.toLocaleString() },
    { label: 'Compartilhamentos', value: metrics.shares.toLocaleString() },
  ]

  return (
    <div className="space-y-4">
      {/* Health + Radar row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-cms-border bg-cms-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-cms-text">Saúde do Canal</h3>
            <span className={`rounded px-1.5 py-0.5 text-[9px] ${useIntelligence ? 'bg-[#8b5cf6]/10 text-[#8b5cf6]' : 'bg-cms-border text-cms-text-muted'}`}>
              {useIntelligence ? '6 eixos · AI' : '4 eixos · API'}
            </span>
          </div>
          <div className="flex items-center justify-center">
            <YtHealthRing score={health.overall} />
          </div>
        </div>
        <div className="rounded-lg border border-cms-border bg-cms-surface p-4">
          <h3 className="mb-3 text-sm font-semibold text-cms-text">Radar de Performance</h3>
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
          Curva de Retenção Média (últimos 10 vídeos)
        </h3>
        <YtRetentionCurve avgPercentage={metrics.averageViewPercentage} />
      </div>
    </div>
  )
}
