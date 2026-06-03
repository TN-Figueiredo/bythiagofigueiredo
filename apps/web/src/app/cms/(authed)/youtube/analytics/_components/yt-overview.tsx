/**
 * YtOverview — Performance "Visao Geral" (Established channel).
 *
 * Layout: .perf-top grid (1.5fr / 1fr).
 *   Left: HealthCard (gauge 150px + 6-axis breakdown with colored bars).
 *   Right: HealthRadar (canal x meta, 6 axes).
 * Below: .kpi-strip.stagger (6 KPIs with PSparkline, delta badges, lucide icons — NO lift on hover).
 * Below: RetentionCurve.
 */

import type { YtChannelMetrics, YtDailyMetric } from '@/lib/youtube/analytics-types'
import { YtHealthRing } from './yt-health-ring'
import { YtRadarChart } from './yt-radar-chart'
import { YtRetentionCurve } from './yt-retention-curve'
import { PSparkline } from '../../_components/p-sparkline'
import { fmtC, brDec } from '@/lib/youtube/format'

interface Props {
  metrics: YtChannelMetrics
  dailyMetrics: YtDailyMetric[]
  intelligenceHealthScore?: number
  intelligenceRadar?: Array<{ label: string; value: number; grade: string }>
}

const GRADE_COLORS: Record<string, string> = {
  A: 'var(--green)',
  B: 'var(--tier-mid)',
  C: 'var(--amber)',
  D: 'var(--red)',
}

function computeFallbackHealth(m: YtChannelMetrics): {
  overall: number
  axes: { label: string; value: number; grade: string }[]
} {
  // impressions/impressionClickThroughRate are unavailable from the Analytics
  // Reporting API (YouTube Studio-only metrics). When zero, use engagement-based
  // proxies so the health score still has 6 meaningful axes.
  const ctrScore = m.impressionClickThroughRate > 0
    ? Math.min(m.impressionClickThroughRate * 10, 100)
    : m.views > 0
      ? Math.min(((m.likes + m.comments) / m.views) * 500, 100) // engagement proxy
      : 0
  const retentionScore = Math.min(m.averageViewPercentage * 2, 100)
  const growthScore = Math.min(
    ((m.subscribersGained - m.subscribersLost) / Math.max(m.subscribersGained, 1)) * 100,
    100,
  )
  const engagementScore =
    m.views > 0
      ? Math.min(((m.likes + m.comments + m.shares) / m.views) * 1000, 100)
      : 0
  const reachScore = m.impressions > 0
    ? Math.min((m.impressions / Math.max(m.views, 1)) * 50, 100)
    : Math.min(m.views > 0 ? (m.estimatedMinutesWatched / m.views) * 10 : 0, 100) // watch-depth proxy
  const subImpactScore = Math.min((m.subscribersGained / Math.max(m.views, 1)) * 500, 100)

  const overall = Math.round(
    (ctrScore + retentionScore + growthScore + engagementScore + reachScore + subImpactScore) / 6,
  )

  function grade(v: number) {
    return v >= 85 ? 'A' : v >= 65 ? 'B' : v >= 40 ? 'C' : 'D'
  }

  return {
    overall,
    axes: [
      { label: 'CTR', value: ctrScore, grade: grade(ctrScore) },
      { label: 'Retencao', value: retentionScore, grade: grade(retentionScore) },
      { label: 'Watch time', value: reachScore, grade: grade(reachScore) },
      { label: 'Frequencia', value: growthScore, grade: grade(growthScore) },
      { label: 'Engajamento', value: engagementScore, grade: grade(engagementScore) },
      { label: 'Crescimento', value: subImpactScore, grade: grade(subImpactScore) },
    ],
  }
}

/** Build sparklines from daily metrics for each KPI */
function buildKpiData(m: YtChannelMetrics, daily: YtDailyMetric[]) {
  const sorted = [...daily].sort((a, b) => a.date.localeCompare(b.date))
  const viewsSpark = sorted.map((d) => d.views)
  const watchSpark = sorted.map((d) => d.estimatedMinutesWatched)
  const subsSpark = sorted.map((d) => d.subscribersGained - d.subscribersLost)
  const impressionsSpark = sorted.map((d) => d.impressions)
  const ctrSpark = sorted.map((d) => d.impressionClickThroughRate)
  const avgDurSpark = sorted.map((d) => d.estimatedMinutesWatched / Math.max(d.views, 1))

  // Calculate deltas (last 7d vs previous 7d)
  function delta7d(arr: number[]): number {
    if (arr.length < 14) return 0
    const recent = arr.slice(-7).reduce((s, v) => s + v, 0)
    const prev = arr.slice(-14, -7).reduce((s, v) => s + v, 0)
    if (prev === 0) return 0
    return ((recent - prev) / prev) * 100
  }

  return [
    {
      label: 'Visualizacoes',
      value: fmtC(m.views),
      delta: delta7d(viewsSpark),
      sparkline: viewsSpark,
      icon: 'eye',
    },
    {
      label: 'Tempo assistido',
      value: `${Math.round(m.estimatedMinutesWatched / 60)}h`,
      delta: delta7d(watchSpark),
      sparkline: watchSpark,
      icon: 'clock',
    },
    {
      label: 'Inscritos',
      value: `+${fmtC(m.subscribersGained - m.subscribersLost)}`,
      delta: delta7d(subsSpark),
      sparkline: subsSpark,
      icon: 'user-plus',
    },
    {
      label: 'Impressoes',
      value: m.impressions > 0 ? fmtC(m.impressions) : '—',
      delta: m.impressions > 0 ? delta7d(impressionsSpark) : 0,
      sparkline: m.impressions > 0 ? impressionsSpark : [],
      icon: 'bar-chart-2',
    },
    {
      label: 'CTR',
      value: m.impressionClickThroughRate > 0 ? `${brDec(m.impressionClickThroughRate, 1)}%` : '—',
      delta: m.impressionClickThroughRate > 0 ? delta7d(ctrSpark) : 0,
      sparkline: m.impressionClickThroughRate > 0 ? ctrSpark : [],
      icon: 'mouse-pointer-click',
    },
    {
      label: 'Duracao media',
      value: `${Math.floor(m.averageViewDuration / 60)}:${String(m.averageViewDuration % 60).padStart(2, '0')}`,
      delta: delta7d(avgDurSpark),
      sparkline: avgDurSpark,
      icon: 'timer',
    },
  ]
}

/** KPI icon by name (inline SVGs to avoid importing 6 separate lucide components) */
function KpiIcon({ name }: { name: string }) {
  const props = { width: 13, height: 13, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true as const }
  switch (name) {
    case 'eye':
      return <svg {...props}><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>
    case 'clock':
      return <svg {...props}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
    case 'user-plus':
      return <svg {...props}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>
    case 'bar-chart-2':
      return <svg {...props}><line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/></svg>
    case 'mouse-pointer-click':
      return <svg {...props}><path d="M14 4.1 12 6"/><path d="m5.1 8-2.9-.8"/><path d="m6 12-1.9 2"/><path d="M7.2 2.2 8 5.1"/><path d="M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z"/></svg>
    case 'timer':
      return <svg {...props}><line x1="10" x2="14" y1="2" y2="2"/><line x1="12" x2="15" y1="14" y2="11"/><circle cx="12" cy="14" r="8"/></svg>
    default:
      return null
  }
}

export function YtOverview({ metrics, dailyMetrics, intelligenceHealthScore, intelligenceRadar }: Props) {
  const useIntelligence = intelligenceRadar && intelligenceRadar.length > 0 && intelligenceHealthScore !== undefined
  const health = useIntelligence
    ? { overall: intelligenceHealthScore!, axes: intelligenceRadar! }
    : computeFallbackHealth(metrics)

  const kpis = buildKpiData(metrics, dailyMetrics)

  return (
    <div className="fade-in flex flex-col gap-4">
      {/* perf-top: HealthCard + HealthRadar */}
      <div className="perf-top">
        {/* HealthCard */}
        <div className="health-card rounded-lg border border-cms-border bg-cms-surface">
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <h3 className="text-sm font-semibold text-cms-text">Saude do Canal</h3>
            <span className={`rounded px-1.5 py-0.5 text-[9px] ${useIntelligence ? 'bg-cms-purple-soft text-cms-purple' : 'bg-cms-border text-cms-text-muted'}`}>
              {useIntelligence ? '6 eixos . AI' : '6 eixos . API'}
            </span>
          </div>

          {/* health-body: gauge | breakdown side-by-side */}
          <div className="health-body">
            {/* Gauge column */}
            <div className="health-gauge-wrap">
              <YtHealthRing score={health.overall} size={150} />
              <span className="mt-2 text-xs text-cms-text-muted">
                meta 80 &middot; faltam {Math.max(0, 80 - health.overall)} pts
              </span>
            </div>

            {/* 6-axis breakdown column */}
            <div className="health-breakdown">
              {health.axes.map((axis) => {
                const color = GRADE_COLORS[axis.grade] ?? '#888'
                return (
                  <div key={axis.label} className="hb-row">
                    <span className="hb-label">{axis.label}</span>
                    <div className="flex-1">
                      <div
                        className="h-2 rounded-full"
                        style={{
                          width: `${Math.max(axis.value, 2)}%`,
                          background: color,
                          opacity: 0.8,
                        }}
                      />
                    </div>
                    <span className="hb-score mono">{Math.round(axis.value)}</span>
                    <span
                      className="hb-note"
                      style={{ color }}
                    >
                      {axis.grade}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* HealthRadar */}
        <div className="card rounded-lg border border-cms-border bg-cms-surface p-4">
          <h3 className="mb-3 text-sm font-semibold text-cms-text">Radar de Performance</h3>
          <YtRadarChart axes={health.axes} />
          <div className="mt-2 flex items-center justify-center gap-4 text-[10px] text-cms-text-muted">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: 'var(--accent)', opacity: 0.4 }} />
              Canal
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full border border-cms-text-muted" />
              Meta
            </span>
          </div>
        </div>
      </div>

      {/* KPI strip — 6 KPIs with sparklines, NO lift on hover */}
      <div className="kpi-strip stagger">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="kpi-card rounded-lg border border-cms-border bg-cms-surface">
            <div className="metric-label flex items-center gap-1.5">
              <KpiIcon name={kpi.icon} />
              {kpi.label}
            </div>
            <p className="kpi-val mono">
              {kpi.value}
            </p>
            <div className="mt-1.5 flex items-center justify-between">
              <span className={`kpi-delta ${kpi.delta >= 0 ? 'up' : 'down'}`}>
                {kpi.delta >= 0 ? '+' : ''}
                {brDec(kpi.delta, 1)}%
              </span>
              {kpi.sparkline.length >= 2 && (
                <PSparkline
                  data={kpi.sparkline}
                  width={72}
                  height={26}
                  color={kpi.delta >= 0 ? '#22c55e' : '#ef4444'}
                />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Retention Curve */}
      <div className="card rounded-lg border border-cms-border bg-cms-surface p-4">
        <h3 className="mb-3 text-sm font-semibold text-cms-text">
          Curva de Retencao Media (ultimos 10 videos)
        </h3>
        <YtRetentionCurve avgViewPercentage={metrics.averageViewPercentage} />
      </div>
    </div>
  )
}
