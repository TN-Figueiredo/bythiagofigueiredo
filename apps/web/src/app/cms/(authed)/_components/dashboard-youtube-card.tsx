import type { YtDashboardSummary } from './dashboard-queries'

interface Props {
  data: YtDashboardSummary
}

export function DashboardYoutubeCard({ data }: Props) {
  const radius = 32
  const circumference = 2 * Math.PI * radius
  const dashLength = (data.healthScore / 100) * circumference
  const color = data.healthScore >= 65 ? '#34d399' : data.healthScore >= 40 ? '#fbbf24' : '#f87171'

  return (
    <div className="rounded-lg border border-cms-border bg-cms-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-cms-text">Resumo YouTube</h3>
        <a href="/cms/youtube/analytics" className="text-xs font-medium text-[var(--acc)] hover:underline">
          Ver Analytics →
        </a>
      </div>
      <div className="flex items-center gap-4">
        <div className="relative h-20 w-20 shrink-0">
          <svg viewBox="0 0 80 80" className="h-full w-full" role="img" aria-label={`Saúde do canal: ${data.healthScore} de 100`}>
            <title>{`Saúde ${data.healthScore}/100`}</title>
            <circle cx="40" cy="40" r={radius} fill="none" stroke="var(--bdr-1)" strokeWidth="7" />
            <circle cx="40" cy="40" r={radius} fill="none" stroke={color} strokeWidth="7"
              strokeDasharray={`${dashLength} ${circumference}`}
              strokeLinecap="round"
              transform="rotate(-90 40 40)" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-bold" style={{ color }}>{data.healthScore}</span>
            <span className="text-[8px] uppercase text-cms-text-muted">Saúde</span>
          </div>
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex gap-4 text-xs">
            <div>
              <span className="text-cms-text-muted">Views (30d)</span>
              <div className="font-medium tabular-nums text-cms-text">{data.views30d.toLocaleString('pt-BR')}</div>
            </div>
            <div>
              <span className="text-cms-text-muted">Subs</span>
              <div className="font-medium tabular-nums text-cms-text">{data.subsNet >= 0 ? '+' : ''}{data.subsNet.toLocaleString()}</div>
            </div>
            <div>
              <span className="text-cms-text-muted">CTR</span>
              <div className="font-medium tabular-nums text-cms-text">{data.ctr.toFixed(1)}%</div>
            </div>
            <div>
              <span className="text-cms-text-muted">Retenção</span>
              <div className="font-medium tabular-nums text-cms-text">{Math.round(data.avgPercentage)}%</div>
            </div>
          </div>
          {data.milestoneTarget !== null && data.milestoneAway !== null && (
            <p className="text-[11px] text-cms-text-muted">
              <span aria-hidden="true">🎯</span> {data.milestoneTarget.toLocaleString('pt-BR')} subs — faltam {data.milestoneAway.toLocaleString('pt-BR')}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
