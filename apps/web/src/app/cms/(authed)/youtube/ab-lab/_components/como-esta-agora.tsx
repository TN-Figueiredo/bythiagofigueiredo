'use client'

import type { LiveMonitor } from '@/lib/youtube/ab-types'
import { formatPercent } from './ab-constants'
import { Activity, Check, Clock } from 'lucide-react'

export interface ComoEstaAgoraProps {
  monitor: LiveMonitor
}

function MiniSparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const w = 72
  const h = 26
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / range) * (h - 4) - 2
    return `${x},${y}`
  })
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0" aria-hidden="true">
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke="var(--cms-accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ComoEstaAgora({ monitor }: ComoEstaAgoraProps) {
  return (
    <div
      data-testid="como-esta-agora"
      className="rounded-[14px] border border-cms-border bg-cms-surface p-[20px]"
    >
      {/* Header */}
      <div className="flex items-center gap-[9px] mb-[16px]">
        <Activity size={17} className="text-cms-accent" aria-hidden="true" />
        <h3 className="text-[19px] font-semibold text-cms-text m-0">Como esta agora</h3>
      </div>

      {/* Live CTR + sparkline */}
      <div className="flex items-center gap-[16px] mb-[18px]">
        <div>
          <div className="eyebrow mb-[4px]">CTR ao vivo</div>
          <div className="font-mono text-[28px] font-bold text-cms-text leading-none tnum">
            {formatPercent(monitor.liveCtr, 1)}
          </div>
          {monitor.liftVsOriginal != null && (
            <div className="text-[11.5px] mt-[4px]" style={{
              color: monitor.liftVsOriginal > 0 ? 'var(--cms-green)' : 'var(--cms-text-muted)',
            }}>
              {monitor.liftVsOriginal > 0 ? '+' : ''}{monitor.liftVsOriginal}% vs original
            </div>
          )}
        </div>
        {monitor.sparkline && monitor.sparkline.length >= 2 && (
          <MiniSparkline data={monitor.sparkline} />
        )}
      </div>

      {/* Checkpoints */}
      {monitor.checkpoints && monitor.checkpoints.length > 0 && (
        <div className="flex flex-col gap-[10px]">
          <div className="eyebrow">Checkpoints de longevidade</div>
          {monitor.checkpoints.map((cp, i) => (
            <div key={i} className="flex items-center gap-[9px]">
              <span
                className="size-[18px] rounded-full shrink-0 flex items-center justify-center"
                style={{
                  background: cp.reached ? 'var(--cms-green-subtle)' : 'var(--cms-surface-3, var(--cms-surface-hover))',
                  color: cp.reached ? 'var(--cms-green)' : 'var(--cms-text-dim)',
                }}
              >
                {cp.reached ? <Check size={10} /> : <Clock size={10} />}
              </span>
              <span className={`text-[12.5px] font-medium ${cp.reached ? 'text-cms-text' : 'text-cms-text-dim'}`}>
                {cp.label}
              </span>
              {cp.date && (
                <span className="mono text-[11.5px] text-cms-text-dim ml-auto">
                  {cp.date}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
