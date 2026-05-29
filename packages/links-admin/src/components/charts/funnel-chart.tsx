interface FunnelStep {
  label: string
  value: number
  pct: number
}

interface FunnelChartProps {
  steps: FunnelStep[]
  overallRate?: number
}

const COLORS = ['var(--accent, #F2683C)', '#E0A23C', '#46B17E']

export function FunnelChart({ steps, overallRate }: FunnelChartProps) {
  return (
    <div role="img" aria-label={`Funnel chart: ${steps.map(s => `${s.label} ${s.value}`).join(', ')}`} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {overallRate != null && (
        <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--ink-faint, #6E685D)' }}>
          Taxa geral: <span style={{ fontWeight: 700, color: 'var(--accent, #F2683C)' }}>{overallRate}%</span>
        </div>
      )}
      {steps.map((s, i) => (
        <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 110, fontSize: 12, color: 'var(--ink, #ECE6DA)' }}>{s.label}</span>
          <div style={{ flex: 1, height: 24, borderRadius: 6, background: 'var(--surface-2, #1E1B16)', overflow: 'hidden', position: 'relative' }}>
            <div
              data-funnel-bar
              style={{
                width: `${s.pct}%`, height: '100%', borderRadius: 6,
                background: COLORS[i] ?? COLORS[0],
                transition: 'width .5s',
                display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 8,
              }}
            >
              {s.pct > 15 && (
                <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', fontFamily: 'var(--font-mono, monospace)' }}>
                  {s.pct}%
                </span>
              )}
            </div>
          </div>
          <span style={{ width: 50, textAlign: 'right', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono, monospace)', color: 'var(--ink, #ECE6DA)' }}>
            {s.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  )
}
