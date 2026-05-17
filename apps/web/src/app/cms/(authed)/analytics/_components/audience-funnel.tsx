import type { FunnelStep } from '@/lib/analytics/audience-queries'

interface Props {
  steps: FunnelStep[]
}

export function AudienceFunnel({ steps }: Props) {
  const maxValue = Math.max(...steps.map(s => s.value), 1)

  return (
    <div className="rounded-lg border border-cms-border bg-cms-surface p-4">
      <h3 className="mb-3 text-sm font-semibold text-cms-text">Cross-System Funnel: YouTube → Blog → Newsletter</h3>
      {steps.every(s => s.value === 0) ? (
        <p className="text-xs text-cms-text-muted">Funnel data will populate once YouTube Analytics is connected.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {steps.map((step, i) => (
            <div key={step.label}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-cms-text-muted">{step.label}</span>
                <span className="flex items-center gap-2">
                  <span className="font-bold tabular-nums text-cms-text">{step.value.toLocaleString()}</span>
                  {step.dropOff && i > 0 && (
                    <span className="text-red-400">↓{step.dropOff}</span>
                  )}
                </span>
              </div>
              <div className="h-[6px] overflow-hidden rounded-full bg-cms-border">
                <div
                  className="h-full rounded-full bg-[var(--acc)] transition-[width] duration-500"
                  style={{ width: `${(step.value / maxValue) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
