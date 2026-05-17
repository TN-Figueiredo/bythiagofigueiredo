'use client'

import { useMemo } from 'react'

const PERIODS = [
  { value: '7d', label: '7d', ariaLabel: '7 days' },
  { value: '30d', label: '30d', ariaLabel: '30 days' },
  { value: '90d', label: '90d', ariaLabel: '90 days' },
] as const

interface Props {
  activePeriod: string
  compareEnabled: boolean
  onPeriodChange: (period: string) => void
  onCompareToggle: (enabled: boolean) => void
}

export function PeriodSelector({ activePeriod, compareEnabled, onPeriodChange, onCompareToggle }: Props) {
  const dateRange = useMemo(() => {
    const end = new Date()
    const days = activePeriod === '7d' ? 7 : activePeriod === '90d' ? 90 : 30
    const start = new Date()
    start.setDate(start.getDate() - days)
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return `${fmt(start)} – ${fmt(end)}, ${end.getFullYear()}`
  }, [activePeriod])

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-cms-border bg-cms-surface p-3">
      <div className="flex gap-0.5 rounded-md bg-cms-bg p-0.5" role="group" aria-label="Time period">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            type="button"
            aria-label={p.ariaLabel}
            aria-pressed={activePeriod === p.value}
            onClick={() => onPeriodChange(p.value)}
            className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
              activePeriod === p.value
                ? 'bg-[var(--acc)] text-[#1a0a00] font-semibold'
                : 'text-cms-text-muted hover:text-cms-text'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <span className="text-xs text-cms-text-muted">{dateRange}</span>
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          role="switch"
          aria-checked={compareEnabled}
          aria-label="Compare to previous period"
          onClick={() => onCompareToggle(!compareEnabled)}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault()
              onCompareToggle(!compareEnabled)
            }
          }}
          className={`relative h-5 w-9 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--acc)] ${
            compareEnabled ? 'bg-[var(--acc)]' : 'bg-cms-border'
          }`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
              compareEnabled ? 'translate-x-4' : 'translate-x-0.5'
            }`}
          />
        </button>
        <span className="text-xs text-cms-text-muted">vs prev period</span>
      </div>
    </div>
  )
}
