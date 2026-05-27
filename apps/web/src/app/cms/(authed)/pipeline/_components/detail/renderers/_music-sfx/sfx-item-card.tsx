'use client'

import { useState } from 'react'
import type { SceneSFX } from './types'
import { RESOLVE_COLORS, SFX_CATEGORY_COLORS } from './types'
import { ScoreBar } from './score-bar'
import { ScoreBreakdown } from './score-breakdown'
import { CoworkReasoning } from './cowork-reasoning'
import { SfxRecommendationsList } from './sfx-recommendations-list'
import { computeScorePercent, SCORE_MID } from './score-utils'
import { buildArtlistSfxUrl } from '@/lib/pipeline/artlist-search'

interface SFXItemCardProps {
  sfx: SceneSFX
}

export function SFXItemCard({ sfx }: SFXItemCardProps) {
  const [expanded, setExpanded] = useState(false)
  const resolveStatus = sfx.resolve_status ? RESOLVE_COLORS[sfx.resolve_status] : null
  const categoryColor = sfx.sfx_category ? SFX_CATEGORY_COLORS[sfx.sfx_category] : null
  const hasFile = sfx.original_filename && sfx.resolve_status !== 'NO_MATCH'
  const pct = sfx.score != null && sfx.score_max != null && sfx.score_max > 0 ? computeScorePercent(sfx.score, sfx.score_max) : null
  const lowScore = pct != null && pct < SCORE_MID
  const isLocal = sfx.resolve_status === 'LOCAL'
  const isStrongLocal = isLocal && (!lowScore)
  const borderColor = isStrongLocal
    ? `${RESOLVE_COLORS.LOCAL.color}40`
    : isLocal && lowScore ? `${RESOLVE_COLORS.PENDING_MATCH.color}33`
    : sfx.resolve_status === 'NO_MATCH' ? `${RESOLVE_COLORS.NO_MATCH.color}1F` : 'rgba(255,255,255,0.05)'
  const bgColor = isStrongLocal
    ? `${RESOLVE_COLORS.LOCAL.color}0A`
    : isLocal && lowScore ? `${RESOLVE_COLORS.PENDING_MATCH.color}08`
    : sfx.resolve_status === 'NO_MATCH' ? `${RESOLVE_COLORS.NO_MATCH.color}05` : 'rgba(255,255,255,0.015)'

  const hasRecommendations = sfx.recommendations && sfx.recommendations.length > 0
  const hasBreakdown = !!sfx.score_breakdown
  const hasExpandableContent = hasRecommendations || hasBreakdown || !!sfx.reasoning
  const altCount = sfx.recommendations?.length ?? 0

  return (
    <div
      className="rounded-[5px] px-2.5 py-[7px]"
      style={{
        border: `1px solid ${borderColor}`,
        borderLeft: isStrongLocal ? `3px solid ${RESOLVE_COLORS.LOCAL.color}80` : isLocal && lowScore ? `3px solid ${RESOLVE_COLORS.PENDING_MATCH.color}66` : undefined,
        background: bgColor,
      }}
    >
      <div className="flex gap-2 items-start">
        <span className="font-mono text-[10px] flex-shrink-0 w-8" style={{ color: '#818cf8' }}>
          {sfx.timestamp}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-[3px]">
            {categoryColor && sfx.sfx_category && (
              <span
                className="text-[8px] font-bold uppercase px-[5px] py-px rounded tracking-wide"
                style={{ background: categoryColor.bg, color: categoryColor.color }}
              >
                {sfx.sfx_category}
              </span>
            )}
            <span className="text-[10px]" style={{ color: '#8b949e' }}>
              {sfx.description}
            </span>
          </div>

          {sfx.cue_text && (
            <div className="text-[10px] italic mb-[3px]" style={{ color: '#6b7280' }}>
              <span style={{ color: '#818cf8', fontStyle: 'normal' }}>▸</span>{' '}
              &ldquo;…{sfx.cue_text}&rdquo; → <span className="font-semibold" style={{ color: categoryColor?.color ?? '#8b949e', fontStyle: 'normal' }}>{sfx.sfx_category ?? 'SFX'}</span>
            </div>
          )}

          <div className="flex items-center gap-1.5 flex-wrap">
            {hasFile && (
              <span className="text-[10px] font-semibold" style={{ color: isStrongLocal ? RESOLVE_COLORS.LOCAL.color : isLocal && lowScore ? RESOLVE_COLORS.PENDING_MATCH.color : '#c9d1d9' }}>
                {sfx.original_filename}
              </span>
            )}
            {resolveStatus && (
              <span
                className="text-[10px] px-[6px] py-px rounded font-semibold"
                style={{ background: resolveStatus.bg, color: resolveStatus.color }}
              >
                {resolveStatus.label}
              </span>
            )}
            {sfx.score != null && sfx.score_max != null && (
              <ScoreBar score={sfx.score} max={sfx.score_max} />
            )}
            {hasExpandableContent && (
              <button
                onClick={() => setExpanded(v => !v)}
                aria-expanded={expanded}
                aria-label={expanded ? 'Recolher detalhes' : `Expandir detalhes${altCount > 0 ? ` (${altCount} alternativa${altCount > 1 ? 's' : ''})` : ''}`}
                className="text-[8px] font-medium px-1.5 py-px rounded ml-auto flex-shrink-0"
                style={{ background: 'rgba(167,139,250,0.08)', color: '#a78bfa', border: 'none', cursor: 'pointer' }}
              >
                {expanded ? '▾' : altCount > 0 ? `+${altCount} alt ▸` : '▸'}
              </button>
            )}
          </div>

          {sfx.search_terms && (
            <div className="flex items-center gap-[5px] flex-wrap mt-1.5" role="group" aria-label="Termos de busca no Artlist">
              <span
                className="text-[10px] px-[6px] py-px rounded font-semibold"
                style={{ background: 'rgba(59,130,246,0.12)', color: RESOLVE_COLORS.NO_MATCH.color }}
                aria-hidden="true"
              >
                🔍
              </span>
              {sfx.search_terms.split(',').map(t => t.trim()).filter(Boolean).map((term, i) => (
                <a
                  key={`${term}-${i}`}
                  href={buildArtlistSfxUrl(term) ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-medium rounded-full px-[6px] py-px transition-colors"
                  style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24' }}
                >
                  {term} ↗
                </a>
              ))}
            </div>
          )}

          {expanded && (
            <div className="mt-2 space-y-1.5" style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: 8 }}>
              {sfx.reasoning && <CoworkReasoning text={sfx.reasoning} />}
              {sfx.score_breakdown && <ScoreBreakdown breakdown={sfx.score_breakdown} />}
              {hasRecommendations && <SfxRecommendationsList recommendations={sfx.recommendations!} />}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
