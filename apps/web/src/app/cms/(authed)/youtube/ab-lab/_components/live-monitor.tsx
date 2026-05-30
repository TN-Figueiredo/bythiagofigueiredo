'use client'

import type { LiveMonitor } from '@/lib/youtube/ab-types'
import { Badge } from './ab-primitives'
import { TrendingUp, Check, Clock } from 'lucide-react'

export interface LiveMonitorProps {
  monitor: LiveMonitor
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const w = 130
  const h = 56

  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - 6 - ((v - min) / range) * (h - 12)
    return { x, y }
  })

  const d = pts.map((p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`
    const prev = pts[i - 1]!
    const cpx = (prev.x + p.x) / 2
    return `C ${cpx} ${prev.y}, ${cpx} ${p.y}, ${p.x} ${p.y}`
  }).join(' ')

  const lastPt = pts[pts.length - 1]!

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: w, height: h }} aria-hidden="true">
      <path d={d} fill="none" stroke="var(--cms-green)" strokeWidth={2.4} strokeLinecap="round" />
      <circle cx={lastPt.x} cy={lastPt.y} r={3.4} fill="var(--cms-green)" />
    </svg>
  )
}

export function LiveMonitorCard({ monitor }: LiveMonitorProps) {
  return (
    <div
      data-testid="live-monitor"
      className="rounded-lg border border-[rgba(70,177,126,0.3)] bg-cms-surface p-[20px]"
    >
      {/* Header */}
      <div className="flex items-end justify-between gap-[14px] mb-[16px]">
        <div>
          <div className="flex items-center gap-[9px]">
            <TrendingUp size={17} className="text-cms-accent" aria-hidden="true" />
            <h3 className="text-[19px] font-semibold text-cms-text m-0">Como está agora</h3>
          </div>
          <p className="text-[12.5px] text-cms-text-dim mt-[5px] max-w-[540px]">
            O vencedor já está no ar. Os crons puxam a YouTube Analytics 3× por dia — então dá pra ver se o ganho está segurando.
          </p>
        </div>
        <Badge tone="green" dot>
          ao vivo · últ. checagem há 2h
        </Badge>
      </div>

      {/* Content: CTR + sparkline | Checkpoints */}
      <div className="grid grid-cols-[auto_1fr] gap-[28px] items-center">
        {/* Left: CTR + sparkline */}
        <div className="flex gap-[26px] items-center">
          <div>
            <div className="text-[10px] font-semibold text-cms-text-dim uppercase tracking-[0.08em] mb-[6px]">CTR ao vivo</div>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[34px] font-bold text-cms-green leading-none">
                {monitor.liveCtr.toFixed(1)}%
              </span>
              <span className="font-mono text-[13px] font-semibold text-cms-green">
                +{monitor.liftVsOriginal}%
              </span>
            </div>
            <div className="text-[11.5px] text-cms-text-muted mt-[6px]">
              vs 5.2% da original · segurando há 12 dias
            </div>
          </div>
          <Sparkline data={monitor.sparkline} />
        </div>

        {/* Right: Monitoring checkpoints */}
        <div className="border-l border-cms-border pl-[24px]">
          <div className="text-[10px] font-semibold text-cms-text-dim uppercase tracking-[0.08em] mb-[12px]">
            Monitoramento pós-aplicação
          </div>
          <div className="flex gap-[10px]">
            {monitor.checkpoints.map((cp) => {
              const reached = cp.reached
              return (
                <div
                  key={cp.label}
                  className={`flex-1 py-[11px] px-[13px] rounded-[10px] border ${
                    reached
                      ? 'bg-cms-green-subtle border-[rgba(70,177,126,0.3)]'
                      : 'bg-cms-surface-hover border-cms-border'
                  }`}
                >
                  <div className="flex items-center gap-[6px] mb-[6px]">
                    {reached ? (
                      <span className="size-4 rounded-full flex items-center justify-center bg-cms-green text-[#1A120C]">
                        <Check size={10} strokeWidth={1.7} />
                      </span>
                    ) : (
                      <span className="size-4 rounded-full flex items-center justify-center bg-cms-surface-3 text-cms-text-muted">
                        <Clock size={10} strokeWidth={1.7} />
                      </span>
                    )}
                    <span className="text-[11.5px] font-semibold">{cp.label}</span>
                  </div>
                  <span className={`font-mono text-[14px] font-bold ${reached ? 'text-cms-green' : 'text-cms-text-muted'}`}>
                    {cp.date ?? '—'}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="text-[11.5px] text-cms-text-dim mt-[11px] leading-[1.45]">
            Se o CTR cair abaixo do esperado, o Intelligence Engine reabre o vídeo pra um novo teste automaticamente.
          </div>
        </div>
      </div>
    </div>
  )
}
