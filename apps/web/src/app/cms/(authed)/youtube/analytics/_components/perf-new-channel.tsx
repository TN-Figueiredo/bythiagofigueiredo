/**
 * PerfNewChannel — empty state for new channels.
 * Shows early-band, kpi-strip with "--" values, skeleton chart.
 */

const PLACEHOLDER_KPIS = [
  { label: 'Visualizacoes', icon: 'eye' },
  { label: 'Tempo assistido', icon: 'clock' },
  { label: 'Inscritos', icon: 'user-plus' },
  { label: 'Impressoes', icon: 'bar-chart-2' },
  { label: 'CTR', icon: 'mouse-pointer-click' },
  { label: 'Duracao media', icon: 'timer' },
] as const

export function PerfNewChannel() {
  return (
    <div className="fade-in flex flex-col gap-4">
      {/* Early band */}
      <div className="early-band flex items-center gap-3 rounded-lg border border-cms-border bg-cms-surface p-4">
        <div
          className="early-pulse flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{ background: 'var(--accent-soft)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-cms-text">Ainda coletando historico</p>
          <p className="mt-0.5 text-xs text-cms-text-muted">
            O score de saude se forma com ~7 dias de dados. Enquanto isso, as metricas brutas aparecerao conforme a API do YouTube liberar.
          </p>
          <div className="early-bar mt-2 h-1.5 w-full max-w-xs rounded-full" style={{ background: 'var(--accent-soft)' }} />
        </div>
      </div>

      {/* KPI strip with placeholder values */}
      <div className="kpi-strip stagger">
        {PLACEHOLDER_KPIS.map((kpi) => (
          <div
            key={kpi.label}
            className="kpi-card rounded-lg border border-cms-border bg-cms-surface p-3"
          >
            <p className="eyebrow">{kpi.label}</p>
            <p
              className="tnum mt-1 text-lg font-bold"
              style={{ color: 'var(--text-faint, #5C5345)' }}
            >
              --
            </p>
            <p className="mt-0.5 text-[10px] text-cms-text-muted">aguardando coleta</p>
          </div>
        ))}
      </div>

      {/* Skeleton chart */}
      <div className="rounded-lg border border-cms-border bg-cms-surface p-4">
        <h3 className="mb-3 text-sm font-semibold text-cms-text">Saude do Canal</h3>
        <div className="flex flex-col items-center gap-3 py-8">
          <div className="empty-chart-skel flex items-end gap-3" style={{ height: 80 }}>
            <span style={{ width: 24, height: '60%' }} />
            <span style={{ width: 24, height: '80%' }} />
            <span style={{ width: 24, height: '45%' }} />
            <span style={{ width: 24, height: '70%' }} />
          </div>
          <p className="text-xs text-cms-text-muted">
            Score se forma com ~7 dias de dados
          </p>
        </div>
      </div>
    </div>
  )
}
