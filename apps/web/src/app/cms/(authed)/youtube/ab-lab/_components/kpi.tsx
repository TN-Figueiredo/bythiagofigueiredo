'use client'

import type { LucideIcon } from 'lucide-react'
import { TrendingUp } from 'lucide-react'
import { niceLine } from './chart-utils'

export interface KPIProps {
  label: string
  value: string | number
  suffix?: string
  icon?: LucideIcon
  spark?: number[]
  trend?: string
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null
  const W = 120
  const H = 28
  const pad = 2
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const pts = data.map((v, i) => ({
    x: pad + (i / (data.length - 1)) * (W - pad * 2),
    y: H - pad - ((v - min) / range) * (H - pad * 2),
  }))
  const d = niceLine(pts)
  if (!d) return null

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      aria-hidden="true"
      style={{ position: 'absolute', right: 0, bottom: 0, width: 120, height: 28, opacity: 0.5 }}
    >
      <path d={d} fill="none" stroke="var(--cms-accent)" strokeWidth={2} />
    </svg>
  )
}

export function KPI({ label, value, suffix, icon: Icon, spark, trend }: KPIProps) {
  return (
    <div className="rounded-[14px] border border-cms-border bg-cms-surface p-[18px] relative overflow-hidden">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-semibold text-cms-text-dim uppercase tracking-[0.08em]">{label}</span>
        {Icon && <Icon size={15} className="text-cms-text-dim opacity-60" aria-hidden="true" />}
      </div>
      <div className="flex items-baseline gap-[4px] mt-[12px]">
        <span className="font-mono text-[30px] font-bold tracking-[-0.02em] leading-none">{value}</span>
        {suffix && <span className="font-mono text-[15px] font-semibold text-cms-text-dim">{suffix}</span>}
      </div>
      {trend && (
        <div className="flex items-center gap-[4px] mt-[8px] text-[11.5px] text-cms-green">
          <TrendingUp size={12} aria-hidden="true" />
          {trend}
        </div>
      )}
      {spark && <Sparkline data={spark} />}
    </div>
  )
}
