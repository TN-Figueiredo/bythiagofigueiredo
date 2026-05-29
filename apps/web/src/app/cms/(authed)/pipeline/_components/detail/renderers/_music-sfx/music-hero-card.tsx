'use client'

import { useState } from 'react'
import type { MusicRecommendation, SceneMusic } from './types'
import { RESOLVE_COLORS } from './types'
import { EnergyIndicator } from './energy-indicator'
import { CoworkReasoning } from './cowork-reasoning'
import { ScoreBreakdown } from './score-breakdown'
import { computeScorePercent, getScoreColorFromPercent, SCORE_HIGH } from './score-utils'
import { CoworkDeepLink } from '@/components/cms/cowork-deep-link'
import { buildCoworkInstruction } from '@/lib/pipeline/cowork-instructions'

interface MusicHeroCardProps {
  recommendation: MusicRecommendation
  music: SceneMusic
  itemCode?: string
}

const DOWNLOAD_CTA_STYLE = {
  color: RESOLVE_COLORS.PENDING_MATCH.color,
  background: 'rgba(245,158,11,0.1)',
  border: '1px solid rgba(245,158,11,0.2)',
  textDecoration: 'none',
} as const

export function DownloadCTA({ url, size = 'md' }: { url: string; size?: 'sm' | 'md' }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Baixar no Artlist (abre em nova aba)"
      className={
        size === 'md'
          ? 'text-[10px] font-semibold inline-flex items-center gap-1 rounded-[5px] px-3 py-1'
          : 'text-[10px] font-semibold rounded px-2 py-0.5'
      }
      style={DOWNLOAD_CTA_STYLE}
    >
      ⬇ Baixar no Artlist ↗
    </a>
  )
}

export function MusicHeroCard({ recommendation: rec, music, itemCode }: MusicHeroCardProps) {
  const [expanded, setExpanded] = useState(false)
  const status = RESOLVE_COLORS[rec.resolve_status]
  const pct = computeScorePercent(rec.score, rec.score_max)
  const scoreColor = getScoreColorFromPercent(pct)
  const isHighScore = pct >= SCORE_HIGH

  return (
    <div
      className="rounded-md overflow-hidden mb-2"
      style={{
        border: `1px solid ${isHighScore ? `${scoreColor}30` : status.border}`,
        borderLeft: `3px solid ${isHighScore ? scoreColor : status.color}`,
        background: isHighScore
          ? `linear-gradient(135deg, ${scoreColor}0A, ${scoreColor}03)`
          : `linear-gradient(135deg, ${status.color}0F, ${status.color}03)`,
      }}
      aria-label={`${rec.track}, ${pct}%, ${status.label}`}
    >
      <button
        onClick={() => setExpanded(v => !v)}
        aria-expanded={expanded}
        className="w-full flex items-center gap-1.5 px-3 py-2.5 text-left"
        style={{ background: 'transparent' }}
      >
        <span
          className="text-[10px] w-[18px] h-[18px] inline-flex items-center justify-center rounded flex-shrink-0"
          style={{ background: `${status.color}33`, color: status.color, fontWeight: 700 }}
          aria-hidden="true"
        >
          ★
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold truncate" style={{ color: 'var(--gem-text)' }}>{rec.track}</div>
          <div className="text-[10px] truncate" style={{ color: 'var(--gem-dim)' }}>{rec.artist}</div>
        </div>
        <span
          className="text-[10px] px-2 py-0.5 rounded font-semibold flex-shrink-0"
          style={{ background: status.bg, color: status.color }}
        >
          {status.label}
        </span>
        <div className="text-right flex-shrink-0 min-w-[52px]">
          <div style={{ fontSize: 28, fontWeight: 800, color: scoreColor, lineHeight: 1, fontVariantNumeric: 'tabular-nums', textShadow: pct >= SCORE_HIGH ? `0 0 12px ${scoreColor}40` : undefined }}>
            {pct}<span style={{ fontSize: 16, fontWeight: 600 }}>%</span>
          </div>
          <div className="text-[8px]" style={{ color: '#5a6b7f' }}>{rec.score}/{rec.score_max} pts</div>
        </div>
      </button>

      <div className="flex items-center gap-3 px-3 pb-2">
        <div className="flex items-center gap-1.5 flex-wrap flex-1">
          {rec.category && (
            <span className="text-[10px] px-1.5 py-px rounded" style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8' }}>
              {rec.category}
            </span>
          )}
          {rec.energy != null && <EnergyIndicator level={rec.energy} />}
          {rec.bpm && <span className="text-[10px] font-semibold" style={{ color: '#818cf8' }}>{rec.bpm} BPM</span>}
          {rec.key && <span className="text-[10px] font-semibold" style={{ color: '#818cf8' }}>{rec.key}</span>}
          {rec.duration && <span className="text-[10px]" style={{ color: '#6b7280' }}>{rec.duration}</span>}
          {music.flow_to && (
            <span className="text-[8px] px-1.5 py-px rounded ml-auto" style={{ background: 'rgba(129,140,248,0.08)', color: '#818cf8' }}>
              → continua na {music.flow_to}
            </span>
          )}
        </div>
      </div>

      {rec.reasoning && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="mx-3 mb-2 text-[10px] rounded px-2 py-1 flex items-baseline gap-1 w-[calc(100%-1.5rem)] text-left"
          style={{ background: `${status.color}08`, borderLeft: `2px solid ${status.color}25`, color: '#a3b1bf' }}
        >
          <span className="italic truncate flex-1">{rec.reasoning}</span>
          <span className="text-[8px] flex-shrink-0" style={{ color: '#818cf8' }}>mais</span>
        </button>
      )}

      {rec.resolve_status === 'PENDING_MATCH' && rec.artlist_url && !expanded && (
        <div className="px-3 pb-2 flex items-center gap-2">
          <DownloadCTA url={rec.artlist_url} />
          <span className="text-[10px]" style={{ color: '#5a6b7f' }}>Após download, rodar import</span>
        </div>
      )}

      {expanded && (
        <div className="px-3 pb-3 space-y-2" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          {rec.reasoning && <CoworkReasoning text={rec.reasoning} />}
          {rec.resolve_status === 'PENDING_MATCH' && rec.artlist_url && (
            <DownloadCTA url={rec.artlist_url} />
          )}
          {rec.original_filename && (
            <div className="text-[10px] font-mono" style={{ color: '#5a6b7f' }}>{rec.original_filename}</div>
          )}
          {rec.score_breakdown && <ScoreBreakdown breakdown={rec.score_breakdown} />}
          {itemCode && (
            <CoworkDeepLink
              instruction={buildCoworkInstruction('audio-resolve', { code: itemCode })}
              variant="inline"
              label="Resolver no Cowork"
            />
          )}
        </div>
      )}
    </div>
  )
}
