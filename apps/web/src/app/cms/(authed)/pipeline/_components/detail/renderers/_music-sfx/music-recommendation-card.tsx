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
              className="text-[9px] w-4 h-4 inline-flex items-center justify-center rounded font-bold flex-shrink-0"
              style={{ background: status.bg.replace(/[\d.]+\)$/, '0.2)'), color: status.color }}
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
          <CoworkReasoning text={rec.reasoning} variant={isNoMatchCard ? 'no-match' : rec.resolve_status === 'PENDING_MATCH' ? 'pending' : 'local'} />
        </div>
      )}

      {rec.resolve_status === 'PENDING_MATCH' && rec.artlist_url && !expanded && (
        <div className="px-2.5 pb-2 flex items-center gap-2">
          <a
            href={rec.artlist_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-semibold inline-flex items-center gap-1 rounded-[5px] px-3 py-1 transition-colors"
            style={{ color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}
          >
            ⬇ Baixar no Artlist ↗
          </a>
          <span className="text-[9px]" style={{ color: '#5a6b7f' }}>
            Após download, rodar import na Audio Library
          </span>
        </div>
      )}

      {expanded && (
        <div className="px-2.5 pb-2.5 space-y-2" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          {rec.reasoning && (
            <CoworkReasoning text={rec.reasoning} variant={isNoMatchCard ? 'no-match' : rec.resolve_status === 'PENDING_MATCH' ? 'pending' : 'local'} />
          )}

          {rec.resolve_status === 'PENDING_MATCH' && rec.artlist_url && (
            <div className="flex items-center gap-2">
              <a
                href={rec.artlist_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-semibold inline-flex items-center gap-1 rounded-[5px] px-3 py-1 transition-colors"
                style={{ color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}
              >
                ⬇ Baixar no Artlist ↗
              </a>
              <span className="text-[9px]" style={{ color: '#5a6b7f' }}>
                Após download, rodar import na Audio Library
              </span>
            </div>
          )}

          {(rec.original_filename || rec.duration || rec.artlist_url) && (
            <div className="flex items-center gap-2 flex-wrap text-[9px]">
              {rec.original_filename && (
                <span className="font-mono" style={{ color: '#5a6b7f' }}>{rec.original_filename}</span>
              )}
              {rec.duration && <span style={{ color: '#3d4f65' }}>{rec.duration}</span>}
              {rec.artlist_url && rec.resolve_status !== 'PENDING_MATCH' && (
                <>
                  <span style={{ color: '#3d4f65' }}>·</span>
                  <a
                    href={rec.artlist_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-colors"
                    style={{ color: '#c084fc', textDecoration: 'none' }}
                  >
                    ouvir no Artlist ↗
                  </a>
                </>
              )}
            </div>
          )}

          <div className="flex items-center gap-1.5 flex-wrap">
            {rec.category && (
              <span className="text-[9px] px-[6px] py-px rounded" style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8' }}>
                {rec.category}
              </span>
            )}
            {rec.energy != null && <EnergyIndicator level={rec.energy} />}
            {rec.bpm && <span className="text-[9px] font-semibold" style={{ color: '#818cf8' }}>{rec.bpm} BPM</span>}
            {rec.key && <span className="text-[9px] font-semibold" style={{ color: '#818cf8' }}>{rec.key}</span>}
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
