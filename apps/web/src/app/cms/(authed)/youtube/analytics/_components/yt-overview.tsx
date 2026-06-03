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
    <div className="fade-in flex flex-col" style={{ gap: 16 }}>
      {/* perf-top: HealthCard + HealthRadar */}
      <div className="perf-top">
        {/* HealthCard */}
        <div className="card health-card">
          <div className="card-head">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            <span className="card-title">Saude do canal</span>
            <span className="dim" style={{ fontSize: 11.5, marginLeft: 'auto' }}>ultimos 28 dias</span>
          </div>
          <div className="health-body">
            <div className="health-gauge-wrap">
              <YtHealthRing score={health.overall} size={150} />
              {health.overall >= 60 && (
                <span className="mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: 'rgba(34,197,94,0.12)', color: 'var(--green)' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                  Saudavel
                </span>
              )}
              <span className="dim" style={{ fontSize: 11, marginTop: 6 }}>
                meta 80 &middot; faltam {Math.max(0, 80 - health.overall)} pts
              </span>
            </div>
            <div className="health-breakdown">
              {health.axes.map((axis) => {
                const barColor = axis.value >= 75 ? 'var(--green)' : axis.value >= 60 ? 'var(--accent)' : 'var(--amber)'
                return (
                  <div key={axis.label} className="hb-row">
                    <span className="hb-label">{axis.label}</span>
                    <div className="bar">
                      <span style={{ width: `${Math.max(axis.value, 2)}%`, background: barColor }} />
                    </div>
                    <span className="mono hb-score">{Math.round(axis.value)}</span>
                    <span className="hb-note dim">{axis.grade}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* HealthRadar */}
        <div className="card">
          <div className="card-head">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
            <span className="card-title">Radar &middot; canal vs meta</span>
            <span className="dim" style={{ fontSize: 11.5, marginLeft: 'auto' }}>6 eixos</span>
          </div>
          <div className="card-pad">
            <YtRadarChart axes={health.axes} />
            <div className="flex items-center justify-center gap-4" style={{ marginTop: 6 }}>
              <span className="flex items-center gap-1.5" style={{ fontSize: 12 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--accent)' }} />
                Canal
              </span>
              <span className="flex items-center gap-1.5" style={{ fontSize: 12 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--green)', opacity: 0.5 }} />
                Meta
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="kpi-strip stagger">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="card kpi-card">
            <div className="metric-label flex items-center gap-1.5">
              <KpiIcon name={kpi.icon} />
              {kpi.label}
            </div>
            <p className="kpi-val mono">
              {kpi.value}
            </p>
            <div className="flex items-center justify-between" style={{ marginTop: 8 }}>
              <span className={`kpi-delta ${kpi.delta >= 0 ? 'up' : 'down'}`}>
                {kpi.delta >= 0 ? '+' : ''}
                {brDec(kpi.delta, 1)}%
              </span>
              {kpi.sparkline.length >= 2 && (
                <PSparkline
                  data={kpi.sparkline}
                  width={72}
                  height={26}
                  color={kpi.delta >= 0 ? 'var(--green)' : 'var(--red)'}
                />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Retention Curve */}
      <div className="card">
        <div className="card-head">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          <span className="card-title">Curva de retencao</span>
          <span className="dim" style={{ fontSize: 11.5, marginLeft: 'auto' }}>% da audiencia ao longo do video</span>
        </div>
        <div className="card-pad">
          <YtRetentionCurve avgViewPercentage={metrics.averageViewPercentage} />
        </div>
      </div>
    </div>
  )
}
