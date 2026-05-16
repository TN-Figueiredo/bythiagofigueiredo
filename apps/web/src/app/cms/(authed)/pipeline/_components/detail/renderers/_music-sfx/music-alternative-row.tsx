'use client'

import { useState } from 'react'
import type { MusicRecommendation } from './types'
import { RESOLVE_COLORS } from './types'
import { ScoreGauge } from './score-gauge'
import { EnergyIndicator } from './energy-indicator'
import { CoworkReasoning } from './cowork-reasoning'
import { formatDeltaNotes, getBreakdownColor } from './score-utils'

interface MusicAlternativeRowProps {
  recommendation: MusicRecommendation
  index: number
}

export function MusicAlternativeRow({ recommendation: rec, index }: MusicAlternativeRowProps) {
  const [expanded, setExpanded] = useState(false)
  const status = RESOLVE_COLORS[rec.resolve_status]
  const deltaText = formatDeltaNotes(rec.delta_vs_favorite)

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
          <ScoreGauge score={rec.score} max={rec.score_max} size={28} />
        </div>
      </button>

      {!expanded && deltaText && (
        <div className="px-2.5 pb-1.5 -mt-0.5">
          <span className="text-[9px] font-mono" style={{ color: '#f97316' }}>
            Δ {deltaText}
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
          {deltaText && (
            <span className="text-[9px] font-mono" style={{ color: '#f97316' }}>Δ {deltaText}</span>
          )}
          {rec.score_breakdown && (
            <div className="flex flex-wrap gap-x-2 gap-y-0.5">
              {Object.entries(rec.score_breakdown).map(([key, { score, max }]) => (
                <span key={key} className="text-[9px] font-mono" style={{ color: getBreakdownColor(score, max) }}>
                  {key} {score}/{max}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
