'use client'

import type { LiveMonitor } from '@/lib/youtube/ab-types'
import { formatPercent } from './ab-constants'
import { Badge } from './ab-primitives'
import { CheckCircle, Clock } from 'lucide-react'

export interface LiveMonitorProps {
  monitor: LiveMonitor
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const w = 80
  const h = 24
  const pad = 2

  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2)
    const y = h - pad - ((v - min) / range) * (h - pad * 2)
    return `${x},${y}`
  })

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      aria-hidden="true"
      data-testid="sparkline"
    >
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke="var(--cms-accent, #3b82f6)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function LiveMonitorCard({ monitor }: LiveMonitorProps) {
  const liftPositive = monitor.liftVsOriginal >= 0

  return (
    <div
      data-testid="live-monitor"
      className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-bg p-4"
    >
      <h3 className="text-sm font-semibold text-cms-text mb-3">Como está agora</h3>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Left: Big CTR + sparkline + lift badge */}
        <div className="flex items-center gap-3">
          <span
            className="text-xl font-bold font-mono text-cms-text"
            data-testid="live-ctr"
          >
            {formatPercent(monitor.liveCtr)}
          </span>
          <Sparkline data={monitor.sparkline} />
          <Badge tone={liftPositive ? 'green' : 'amber'}>
            {liftPositive ? '+' : ''}
            {formatPercent(monitor.liftVsOriginal, 1)}
          </Badge>
        </div>

        {/* Right: Checkpoints */}
        <div className="flex gap-4" data-testid="checkpoints">
          {monitor.checkpoints.map((cp) => (
            <div key={cp.label} className="flex items-center gap-1.5">
              {cp.reached ? (
                <CheckCircle
                  size={14}
                  className="text-cms-green shrink-0"
                  aria-hidden="true"
                />
              ) : (
                <Clock
                  size={14}
                  className="text-cms-text-dim shrink-0"
                  aria-hidden="true"
                />
              )}
              <span
                className={`text-2xs font-medium ${cp.reached ? 'text-cms-text' : 'text-cms-text-dim'}`}
              >
                {cp.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
