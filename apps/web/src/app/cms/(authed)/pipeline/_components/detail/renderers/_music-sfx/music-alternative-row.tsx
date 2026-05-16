'use client'

import { useState } from 'react'
import type { MusicRecommendation } from './types'
import { RESOLVE_COLORS } from './types'
import { ScoreBar } from './score-bar'
import { EnergyIndicator } from './energy-indicator'
import { CoworkReasoning } from './cowork-reasoning'
import { getBreakdownColor, getDeltaParts, formatDeltaTotal } from './score-utils'

interface MusicAlternativeRowProps {
  recommendation: MusicRecommendation
  index: number
}

export function MusicAlternativeRow({ recommendation: rec, index }: MusicAlternativeRowProps) {
  const [expanded, setExpanded] = useState(false)
  const status = RESOLVE_COLORS[rec.resolve_status]

  return (
    <div
      className="rounded-md overflow-hidden"
      style={{ border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}
    >
      <button
        onClick={() => setExpanded(v => !v)}
        aria-expanded={expanded}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left"
        style={{ background: 'transparent' }}
      >
        <span className="text-[10px] font-mono flex-shrink-0" style={{ color: '#6b7280' }}>
          {index}.
        </span>
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <span className="text-[11px] truncate" style={{ color: 'var(--gem-muted)' }}>
            {rec.track}
          </span>
          <span className="text-[10px] truncate" style={{ color: 'var(--gem-dim)' }}>
            — {rec.artist}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {rec.energy != null && <EnergyIndicator level={rec.energy} />}
          <span
            className="text-[9px] px-1.5 py-px rounded font-semibold"
            style={{ background: status.bg, color: status.color }}
          >
            {status.label}
          </span>
          <ScoreBar score={rec.score} max={rec.score_max} />
        </div>
      </button>

      {!expanded && rec.delta_vs_favorite && getDeltaParts(rec.delta_vs_favorite).length > 0 && (
        <div className="px-2.5 pb-1.5 -mt-0.5 flex items-center gap-1 flex-wrap" style={{ paddingLeft: 20 }}>
          {getDeltaParts(rec.delta_vs_favorite).map(({ label, value }) => (
            <span
              key={label}
              className="text-[7px] font-mono px-1 rounded-sm"
              style={{ background: 'rgba(239,68,68,0.06)', color: '#6b7280' }}
            >
              {value > 0 ? '+' : '−'}{Math.abs(value)} {label}
            </span>
          ))}
          <span className="text-[7px]" style={{ color: '#4b5563' }}>
            = {formatDeltaTotal(rec.delta_vs_favorite) > 0 ? '+' : ''}{formatDeltaTotal(rec.delta_vs_favorite)} vs favorita
          </span>
        </div>
      )}

      {!expanded && rec.reasoning && (
        <div className="px-2.5 pb-1.5">
          <span className="text-[9px] italic" style={{ color: 'var(--gem-dim)' }}>
            {rec.reasoning}
          </span>
        </div>
      )}

      {expanded && (
        <div className="px-2.5 pb-2.5 space-y-1.5" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          {rec.reasoning && <CoworkReasoning text={rec.reasoning} />}
          {rec.original_filename && (
            <div className="text-[10px] font-mono" style={{ color: 'var(--gem-dim)' }}>📁 {rec.original_filename}</div>
          )}
          <div className="flex items-center gap-2 flex-wrap text-[9px]" style={{ color: 'var(--gem-dim)' }}>
            {rec.key && <span style={{ color: '#818cf8' }}>{rec.key}</span>}
            {rec.bpm && <span style={{ color: '#818cf8' }}>{rec.bpm} BPM</span>}
            {rec.duration && <span style={{ color: '#818cf8' }}>{rec.duration}</span>}
            {rec.category && (
              <span className="px-1.5 py-px rounded-full" style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8' }}>
                {rec.category}
              </span>
            )}
          </div>
          {rec.delta_vs_favorite && getDeltaParts(rec.delta_vs_favorite).length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              {getDeltaParts(rec.delta_vs_favorite).map(({ label, value }) => (
                <span
                  key={label}
                  className="text-[7px] font-mono px-1 rounded-sm"
                  style={{ background: 'rgba(239,68,68,0.06)', color: '#6b7280' }}
                >
                  {value > 0 ? '+' : '−'}{Math.abs(value)} {label}
                </span>
              ))}
              <span className="text-[7px]" style={{ color: '#4b5563' }}>
                = {formatDeltaTotal(rec.delta_vs_favorite) > 0 ? '+' : ''}{formatDeltaTotal(rec.delta_vs_favorite)} vs favorita
              </span>
            </div>
          )}
          {rec.score_breakdown && (
            <div className="flex flex-wrap gap-1">
              {Object.entries(rec.score_breakdown).map(([key, { score, max }]) => {
                const color = getBreakdownColor(score, max)
                return (
                  <span
                    key={key}
                    className="text-[8px] font-mono px-[5px] py-px rounded"
                    style={{ color, background: `${color}15` }}
                  >
                    {key} {score}/{max}
                  </span>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
