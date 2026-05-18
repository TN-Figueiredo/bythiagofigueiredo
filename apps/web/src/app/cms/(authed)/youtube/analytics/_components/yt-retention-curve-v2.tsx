'use client'

import { useId } from 'react'

interface Props {
  retentionCurve: number[] | null
  avgViewPercentage: number
}

export function YtRetentionCurveV2({ retentionCurve, avgViewPercentage }: Props) {
  const uid = useId()
  if (!retentionCurve || retentionCurve.length < 2) {
    return (
      <div className="flex h-20 items-center justify-center rounded border border-dashed border-cms-border">
        <span className="text-xs text-cms-text-muted">
          Dados de retenção indisponíveis — mínimo 100 views necessários
        </span>
      </div>
    )
  }

  const w = 400
  const h = 80
  const points = retentionCurve.map((val, i) => ({
    x: (i / (retentionCurve.length - 1)) * w,
    y: h - (val / 100) * h,
  }))

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const areaD = `${pathD} L ${w},${h} L 0,${h} Z`

  const cliffs: Array<{ x: number; startPct: number; endPct: number }> = []
  for (let i = 1; i < retentionCurve.length; i++) {
    const drop = retentionCurve[i - 1]! - retentionCurve[i]!
    if (drop > 30) {
      cliffs.push({
        x: (i / retentionCurve.length) * w,
        startPct: retentionCurve[i - 1]!,
        endPct: retentionCurve[i]!,
      })
    }
  }

  const benchY = h - (50 / 100) * h

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: '80px' }} role="img" aria-label="Curva de retenção do vídeo">
        <defs>
          <linearGradient id={`retGradV2-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#60a5fa" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#retGradV2-${uid})`} />
        <line x1="0" y1={benchY} x2={w} y2={benchY} stroke="#958A75" strokeWidth="0.5" strokeDasharray="3" />
        <path d={pathD} fill="none" stroke="#60a5fa" strokeWidth="1.5" />
        {cliffs.map((cliff, i) => (
          <line key={i} x1={cliff.x} y1={0} x2={cliff.x} y2={h} stroke="#f87171" strokeWidth="1" strokeDasharray="2" opacity="0.6" />
        ))}
      </svg>
      <div className="mt-1 flex items-center justify-between text-[9px] text-cms-text-muted">
        <span>0%</span>
        <span>Retenção média: {avgViewPercentage.toFixed(0)}%</span>
        <span>100%</span>
      </div>
    </div>
  )
}
