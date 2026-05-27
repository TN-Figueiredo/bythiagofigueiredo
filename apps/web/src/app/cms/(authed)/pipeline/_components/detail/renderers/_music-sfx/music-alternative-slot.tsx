'use client'

import { useState } from 'react'
import type { MusicRecommendation, ArtlistSearchTier } from './types'
import { RESOLVE_COLORS } from './types'
import { CoworkReasoning } from './cowork-reasoning'
import { ScoreBreakdown } from './score-breakdown'
import { computeScorePercent, getScoreColorFromPercent, getDeltaParts, formatDeltaTotal, SCORE_LOW } from './score-utils'
import { DownloadCTA } from './music-hero-card'

interface MusicAlternativeSlotProps {
  recommendation: MusicRecommendation
  slotIndex: 1 | 2 | 3
  searchTier: ArtlistSearchTier
  searchUrl?: string
  searchTerms?: string
}

const TIER_LABELS: Record<ArtlistSearchTier, string> = {
  narrow: 'mesmos filtros',
  medium: 'sem BPM',
  broad: 'filtros amplos',
}

const DOWNLOAD_STEPS = '①Baixar ②Importar ③Re-resolver'

const TIER_COLORS: Record<ArtlistSearchTier, { text: string; bg: string; border: string }> = {
  narrow: { text: '#3b82f6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.25)' },
  medium: { text: '#3b82f6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)' },
  broad: { text: '#c084fc', bg: 'rgba(192,132,252,0.08)', border: 'rgba(192,132,252,0.15)' },
}

export function MusicAlternativeSlot({ recommendation: rec, slotIndex, searchTier, searchUrl, searchTerms }: MusicAlternativeSlotProps) {
  const [expanded, setExpanded] = useState(false)

  if (rec.is_empty_slot) {
    const tierColor = TIER_COLORS[searchTier]
    return (
      <div
        className="rounded-md mb-1.5"
        style={{ border: `1px dashed ${tierColor.border}`, background: tierColor.bg.replace('0.08', '0.02'), padding: '8px 10px' }}
        aria-label={`Slot ${slotIndex} vazio, buscar no Artlist`}
      >
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-[10px] font-mono min-w-4" style={{ color: '#4b5563' }}>{slotIndex}.</span>
          <span className="text-xs font-medium" style={{ color: '#6b7280' }}>
            {searchTier === 'broad' ? 'Explorar alternativa' : 'Buscar alternativa'}
          </span>
          <span className="text-[8px] px-1.5 py-px rounded" style={{ background: tierColor.bg, color: tierColor.text }}>
            {TIER_LABELS[searchTier]}
          </span>
        </div>
        <div style={{ paddingLeft: 22 }}>
          {searchTerms && (
            <div className="text-[10px] italic mb-1.5" style={{ color: '#4b5563' }}>"{searchTerms}"</div>
          )}
          <div className="flex items-center gap-1.5 flex-wrap">
            {searchUrl && (
              <a
                href={searchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-semibold rounded px-2.5 py-0.5"
                style={{ color: tierColor.text, background: tierColor.bg, border: `1px solid ${tierColor.border}`, textDecoration: 'none' }}
              >
                🔍 Buscar no Artlist ↗
              </a>
            )}
            <span className="text-[8px]" style={{ color: '#3d4f65' }}>
              <span style={{ background: tierColor.bg, padding: '0 3px', borderRadius: 2 }}>①</span> Baixar{' '}
              <span style={{ background: tierColor.bg, padding: '0 3px', borderRadius: 2 }}>②</span> Importar{' '}
              <span style={{ background: tierColor.bg, padding: '0 3px', borderRadius: 2 }}>③</span> Re-resolver
            </span>
          </div>
        </div>
      </div>
    )
  }

  const status = RESOLVE_COLORS[rec.resolve_status]
  const pct = computeScorePercent(rec.score, rec.score_max)
  const scoreColor = getScoreColorFromPercent(pct)
  const deltas = rec.delta_vs_favorite ? getDeltaParts(rec.delta_vs_favorite) : []
  const deltaTotal = rec.delta_vs_favorite ? formatDeltaTotal(rec.delta_vs_favorite) : 0
  const isLocal = rec.resolve_status === 'LOCAL'

  return (
    <div
      className="rounded-md overflow-hidden mb-1.5"
      style={{
        border: `1px solid ${isLocal ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)'}`,
        background: isLocal ? 'rgba(16,185,129,0.03)' : 'rgba(255,255,255,0.02)',
      }}
      aria-label={`${rec.track}, ${pct}%, ${status.label}`}
    >
      <button
        onClick={() => setExpanded(v => !v)}
        aria-expanded={expanded}
        className="w-full flex items-center gap-1.5 px-2.5 py-2 text-left"
        style={{ background: 'transparent' }}
      >
        <span className="text-[10px] font-mono min-w-4" style={{ color: '#4b5563' }}>{slotIndex}.</span>
        <span className="text-xs font-medium truncate" style={{ color: '#94a3b8' }}>{rec.track}</span>
        <span className="text-[10px] truncate" style={{ color: '#5a6b7f' }}>— {rec.artist}</span>
        <span
          className="text-[10px] px-1.5 py-px rounded font-semibold flex-shrink-0"
          style={{ background: status.bg, color: status.color }}
        >
          {status.label}
        </span>
        <span className="ml-auto flex-shrink-0" style={{ fontSize: 16, fontWeight: 700, color: scoreColor, fontVariantNumeric: 'tabular-nums', textShadow: pct >= SCORE_LOW ? `0 0 8px ${scoreColor}35` : undefined }}>
          {pct}<span style={{ fontSize: 10, fontWeight: 600 }}>%</span>
        </span>
      </button>

      {!expanded && (
        <div className="flex items-center gap-1.5 px-2.5 pb-2 flex-wrap" style={{ paddingLeft: 34 }}>
          {rec.category && (
            <span className="text-[10px] px-1 py-px rounded" style={{ background: 'rgba(99,102,241,0.08)', color: '#6b7280' }}>{rec.category}</span>
          )}
          {rec.bpm && <span className="text-[10px]" style={{ color: '#6b7280' }}>{rec.bpm} BPM</span>}
          {deltas.length > 0 && (
            <span className="text-[10px]" style={{ color: '#5a6b7f' }}>
              <span style={{ color: '#ef4444' }}>−</span>{Math.abs(deltaTotal)} pts vs #1
            </span>
          )}
        </div>
      )}

      {rec.resolve_status === 'PENDING_MATCH' && rec.artlist_url && !expanded && (
        <div className="px-2.5 pb-2 flex items-center gap-1.5" style={{ paddingLeft: 34 }}>
          <DownloadCTA url={rec.artlist_url} size="sm" />
          <span className="text-[8px]" style={{ color: '#3d4f65' }}>{DOWNLOAD_STEPS}</span>
        </div>
      )}

      {expanded && (
        <div className="px-2.5 pb-2.5 space-y-1.5" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          {rec.reasoning && <CoworkReasoning text={rec.reasoning} />}
          {rec.resolve_status === 'PENDING_MATCH' && rec.artlist_url && (
            <DownloadCTA url={rec.artlist_url} size="sm" />
          )}
          {deltas.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              {deltas.map(({ label, value }) => (
                <span key={label} className="text-[7px] font-mono px-1 rounded-sm" style={{ background: 'rgba(239,68,68,0.06)', color: '#6b7280' }}>
                  {value > 0 ? '+' : '−'}{Math.abs(value)} {label}
                </span>
              ))}
              <span className="text-[7px]" style={{ color: '#4b5563' }}>= {deltaTotal > 0 ? '+' : ''}{deltaTotal} vs #1</span>
            </div>
          )}
          {rec.score_breakdown && <ScoreBreakdown breakdown={rec.score_breakdown} />}
        </div>
      )}
    </div>
  )
}
