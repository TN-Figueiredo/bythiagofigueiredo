'use client'

import { useState } from 'react'
import type { MusicRecommendation } from './types'
import { RESOLVE_COLORS } from './types'
import { ScoreGauge } from './score-gauge'
import { EnergyIndicator } from './energy-indicator'
import { CoworkReasoning } from './cowork-reasoning'
import { getBreakdownColor } from './score-utils'

interface MusicRecommendationCardProps {
  recommendation: MusicRecommendation
  isFavorite: boolean
  isNoMatch?: boolean
}

export function MusicRecommendationCard({ recommendation: rec, isFavorite, isNoMatch }: MusicRecommendationCardProps) {
  const [expanded, setExpanded] = useState(false)
  const status = RESOLVE_COLORS[rec.resolve_status]
  const isNoMatchCard = isNoMatch || rec.resolve_status === 'NO_MATCH'

  const borderColor = isFavorite ? status.border : 'rgba(255,255,255,0.06)'
  const bgColor = isFavorite
    ? status.bg.replace(/[\d.]+\)$/, '0.04)')
    : 'rgba(255,255,255,0.02)'

  return (
    <div
      className="rounded-md overflow-hidden"
      style={{
        border: `1px solid ${borderColor}`,
        borderLeft: isFavorite ? `3px solid ${isNoMatchCard ? '#c084fc' : status.color}` : undefined,
        background: isFavorite
          ? `linear-gradient(135deg, ${status.bg.replace(/[\d.]+\)$/, '0.04)')}, ${status.bg.replace(/[\d.]+\)$/, '0.01)')})`
          : bgColor,
      }}
    >
      <button
        onClick={() => setExpanded(v => !v)}
        aria-expanded={expanded}
        className="w-full flex items-center gap-2 px-2.5 py-2 text-left"
        style={{ background: 'transparent' }}
      >
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {isFavorite && (
            <span
              className="text-[9px] px-1 rounded font-bold flex-shrink-0"
              style={{ background: 'rgba(16,185,129,0.2)', color: '#10b981' }}
            >
              ★
            </span>
          )}
          <span className="text-[11px] font-semibold truncate" style={{ color: 'var(--gem-text)' }}>
            {rec.track}
          </span>
          <span className="text-[10px] truncate flex-shrink" style={{ color: 'var(--gem-dim)' }}>
            — {rec.artist}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span
            className="text-[9px] px-1.5 py-px rounded font-semibold"
            style={{ background: status.bg, color: status.color }}
          >
            {status.label}
          </span>
          <ScoreGauge score={rec.score} max={rec.score_max} />
        </div>
      </button>

      {rec.reasoning && !expanded && (
        <div className="px-2.5 pb-2 -mt-0.5">
          <CoworkReasoning text={rec.reasoning} variant={isNoMatchCard ? 'no-match' : 'default'} />
        </div>
      )}

      {expanded && (
        <div className="px-2.5 pb-2.5 space-y-2" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          {rec.reasoning && (
            <CoworkReasoning text={rec.reasoning} variant={isNoMatchCard ? 'no-match' : 'default'} />
          )}

          {rec.original_filename && (
            <div className="text-[10px] font-mono" style={{ color: 'var(--gem-dim)' }}>
              📁 {rec.original_filename}
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap text-[9px]" style={{ color: 'var(--gem-dim)' }}>
            {rec.key && <span style={{ color: '#818cf8' }}>{rec.key}</span>}
            {rec.bpm && <span style={{ color: '#818cf8' }}>{rec.bpm} BPM</span>}
            {rec.duration && <span style={{ color: '#818cf8' }}>{rec.duration}</span>}
            {rec.energy != null && <EnergyIndicator level={rec.energy} />}
            {rec.category && (
              <span className="px-1.5 py-px rounded-full" style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8' }}>
                {rec.category}
              </span>
            )}
          </div>

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
