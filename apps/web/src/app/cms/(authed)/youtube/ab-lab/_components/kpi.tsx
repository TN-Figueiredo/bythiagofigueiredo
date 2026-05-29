'use client'

import { TrendingUp, TrendingDown } from 'lucide-react'

export interface KPIProps {
  label: string
  value: number
  prefix?: string
  suffix?: string
  delta?: number
  spark?: number[]
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length === 0) return null
  const W = 120
  const H = 28
  const pad = 2
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const points = data
    .map((v, i) => {
      const x = pad + (i / Math.max(data.length - 1, 1)) * (W - pad * 2)
      const y = H - pad - ((v - min) / range) * (H - pad * 2)
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      aria-hidden="true"
      className="sparkline"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={0.5}
      />
    </svg>
  )
}

export function KPI({ label, value, prefix, suffix, delta, spark }: KPIProps) {
  return (
    <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-bg p-3 flex flex-col gap-1">
      <span className="text-2xs text-cms-text-dim uppercase tracking-wider">{label}</span>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-bold font-mono" style={{ fontWeight: 700 }}>
          {prefix}{value}
        </span>
        {suffix && <span className="text-sm text-cms-text-muted">{suffix}</span>}
        {delta != null && delta !== 0 && (
          <span
            data-delta
            className={`inline-flex items-center gap-0.5 text-2xs font-medium ${delta > 0 ? 'text-cms-green' : 'text-red-400'}`}
          >
            {delta > 0 ? (
              <TrendingUp size={12} aria-hidden="true" />
            ) : (
              <TrendingDown size={12} aria-hidden="true" />
            )}
            {delta > 0 ? '+' : ''}
            {delta}
          </span>
        )}
      </div>
      {spark && spark.length > 0 && <Sparkline data={spark} />}
    </div>
  )
}
