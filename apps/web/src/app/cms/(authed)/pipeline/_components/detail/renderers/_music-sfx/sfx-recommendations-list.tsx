'use client'

import { useState } from 'react'
import type { SfxRecommendation } from './types'
import { RESOLVE_COLORS } from './types'
import { ScoreBar } from './score-bar'
import { ScoreBreakdown } from './score-breakdown'
import { CoworkReasoning } from './cowork-reasoning'
import { computeScorePercent, getScoreColorFromPercent } from './score-utils'

interface SfxRecommendationsListProps {
  recommendations: SfxRecommendation[]
}

function SfxRecCard({ rec, index }: { rec: SfxRecommendation; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const rank = rec.rank ?? index + 1
  const status = RESOLVE_COLORS[rec.resolve_status]
  const pct = computeScorePercent(rec.score, rec.score_max)
  const scoreColor = getScoreColorFromPercent(pct)

  return (
    <div
      className="rounded-md overflow-hidden"
      style={{
        border: `1px solid ${rec.resolve_status === 'LOCAL' ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.05)'}`,
        background: rec.resolve_status === 'LOCAL' ? 'rgba(16,185,129,0.02)' : 'rgba(255,255,255,0.015)',
      }}
      aria-label={`Alternativa ${rank}: ${rec.title}, ${pct}%, ${status.label}`}
    >
      <button
        onClick={() => setExpanded(v => !v)}
        aria-expanded={expanded}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 text-left"
        style={{ background: 'transparent' }}
      >
        <span className="text-[9px] font-mono min-w-3 font-bold" style={{ color: '#4b5563' }}>#{rank}</span>
        {rec.preferred && (
          <span className="text-[7px] font-bold uppercase px-1 py-px rounded" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>★</span>
        )}
        <span className="text-[10px] font-medium truncate" style={{ color: '#94a3b8' }}>{rec.title}</span>
        <span className="text-[9px] truncate" style={{ color: '#5a6b7f' }}>— {rec.artist}</span>
        <span className="text-[8px] px-1 py-px rounded font-semibold flex-shrink-0" style={{ background: status.bg, color: status.color }}>
          {status.label}
        </span>
        <span className="ml-auto flex-shrink-0 flex items-center gap-1">
          <ScoreBar score={rec.score} max={rec.score_max} />
        </span>
        <span className="text-[8px] flex-shrink-0" style={{ color: '#4b5563' }}>{expanded ? '▾' : '▸'}</span>
      </button>

      {expanded && (
        <div className="px-2 pb-2 space-y-1.5" style={{ borderTop: '1px solid rgba(255,255,255,0.03)', paddingLeft: 24 }}>
          {rec.original_filename && (
            <div className="text-[9px] font-mono" style={{ color: '#6b7280' }}>{rec.original_filename}</div>
          )}
          {rec.reasoning && <CoworkReasoning text={rec.reasoning} />}
          {rec.category && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[8px] px-1 py-px rounded" style={{ background: 'rgba(99,102,241,0.08)', color: '#6b7280' }}>{rec.category}</span>
              {rec.subcategory && (
                <span className="text-[8px] px-1 py-px rounded" style={{ background: 'rgba(99,102,241,0.06)', color: '#5a6b7f' }}>{rec.subcategory}</span>
              )}
              {rec.duration && (
                <span className="text-[8px]" style={{ color: '#5a6b7f' }}>{rec.duration}</span>
              )}
            </div>
          )}
          {rec.score_breakdown && <ScoreBreakdown breakdown={rec.score_breakdown} />}
        </div>
      )}
    </div>
  )
}

export function SfxRecommendationsList({ recommendations }: SfxRecommendationsListProps) {
  return (
    <div className="space-y-1 mt-1.5" role="list" aria-label="Alternativas de SFX">
      {recommendations.map((rec, i) => (
        <SfxRecCard key={rec.audio_asset_id ?? `${rec.title}-${i}`} rec={rec} index={i} />
      ))}
    </div>
  )
}
