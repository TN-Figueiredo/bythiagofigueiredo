'use client'

import { useState } from 'react'
import type { Axis } from '@/lib/youtube/scoring-types'
import { AXIS_LABELS } from '@/lib/youtube/scoring-types'

interface OutlierVideo {
  videoId: string
  title: string
  score: number
  modifiedZ: number
  direction: 'positive' | 'negative'
  axis: Axis
  patterns?: string[]
}

interface Props {
  outliers: OutlierVideo[]
}

export function YtOutliersV2({ outliers }: Props) {
  const [selectedAxis, setSelectedAxis] = useState<Axis | 'all'>('all')
  const axes: Axis[] = ['ctr', 'retention', 'reach', 'engagement', 'growth', 'sub_impact']

  const filtered = selectedAxis === 'all' ? outliers : outliers.filter(o => o.axis === selectedAxis)
  const positive = filtered.filter(o => o.direction === 'positive').sort((a, b) => b.modifiedZ - a.modifiedZ)
  const negative = filtered.filter(o => o.direction === 'negative').sort((a, b) => a.modifiedZ - b.modifiedZ)

  if (outliers.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded border border-dashed border-cms-border">
        <p className="text-xs text-cms-text-muted">Nenhum outlier significativo detectado.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Axis Selector */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setSelectedAxis('all')}
          className={`rounded px-2 py-0.5 text-[10px] ${selectedAxis === 'all' ? 'bg-cms-accent text-white' : 'border border-cms-border text-cms-text-muted'}`}
        >
          Todos
        </button>
        {axes.map(a => (
          <button
            key={a}
            onClick={() => setSelectedAxis(a)}
            className={`rounded px-2 py-0.5 text-[10px] ${selectedAxis === a ? 'bg-cms-accent text-white' : 'border border-cms-border text-cms-text-muted'}`}
          >
            {AXIS_LABELS[a]}
          </button>
        ))}
      </div>

      {/* Positive Outliers */}
      {positive.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-[#34d399]">Destaques Positivos</h4>
          {positive.map(o => (
            <div key={`${o.videoId}-${o.axis}`} className="rounded border border-cms-border border-l-2 border-l-[#34d399] bg-cms-surface p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-cms-text">{o.title}</span>
                <span className="text-[10px] font-mono text-[#34d399]">z={o.modifiedZ.toFixed(1)}</span>
              </div>
              <div className="mt-1 flex gap-1.5">
                <span className="rounded bg-[#34d399]/10 px-1.5 py-0.5 text-[9px] text-[#34d399]">
                  {AXIS_LABELS[o.axis]}
                </span>
                {o.patterns?.map(p => (
                  <span key={p} className="rounded bg-cms-border px-1.5 py-0.5 text-[9px] text-cms-text-muted">{p}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Negative Outliers */}
      {negative.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-[#f87171]">Underperformers</h4>
          {negative.map(o => (
            <div key={`${o.videoId}-${o.axis}`} className="rounded border border-cms-border border-l-2 border-l-[#f87171] bg-cms-surface p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-cms-text">{o.title}</span>
                <span className="text-[10px] font-mono text-[#f87171]">z={o.modifiedZ.toFixed(1)}</span>
              </div>
              <span className="mt-1 inline-block rounded bg-[#f87171]/10 px-1.5 py-0.5 text-[9px] text-[#f87171]">
                {AXIS_LABELS[o.axis]}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
