'use client'

import type { ReactNode } from 'react'

interface MetricCard {
  label: string
  value: string | number
  trend?: ReactNode
  color?: string
}

interface HealthStripProps {
  metrics: MetricCard[]
}

export function HealthStrip({ metrics }: HealthStripProps) {
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:flex lg:overflow-x-auto" role="list" aria-label="Key metrics">
      {metrics.map((m) => (
        <div
          key={m.label}
          role="listitem"
          className="flex min-w-0 flex-col rounded-[10px] border border-gray-800 bg-gray-900 px-4 py-3 lg:min-w-[140px] lg:flex-1"
        >
          <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">{m.label}</span>
          <span className="mt-1 text-base font-extrabold tabular-nums text-gray-100" style={m.color ? { color: m.color } : undefined}>
            {m.value}
          </span>
          {m.trend && <div className="mt-1">{m.trend}</div>}
        </div>
      ))}
    </div>
  )
}
