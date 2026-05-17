'use client'

import type { SceneMusic } from './types'
import { RESOLVE_COLORS } from './types'
import { computeScorePercent } from './score-utils'

interface MusicContinuationCardProps {
  music: SceneMusic
  sourceSceneLabel: string
  sourceSceneIndex: number
}

export function MusicContinuationCard({ music, sourceSceneLabel, sourceSceneIndex }: MusicContinuationCardProps) {
  const status = music.resolve_status ? RESOLVE_COLORS[music.resolve_status] : null
  const pct = music.score != null && music.recommendations[0]
    ? computeScorePercent(music.score, music.recommendations[0].score_max)
    : null

  return (
    <div
      className="rounded-md overflow-hidden mb-1.5"
      style={{ border: '1px solid rgba(255,255,255,0.06)', borderLeft: '3px solid #5a6b7f', background: 'rgba(255,255,255,0.015)', padding: '10px 12px' }}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-[10px]" style={{ color: '#5a6b7f' }}>↩</span>
        <span className="text-[12px] font-semibold" style={{ color: 'var(--gem-text)' }}>{music.track || 'Track anterior'}</span>
        {music.artist && <span className="text-[10px]" style={{ color: '#5a6b7f' }}>— {music.artist}</span>}
        {status && (
          <span className="text-[9px] px-1.5 py-px rounded font-semibold ml-auto" style={{ background: status.bg, color: status.color }}>
            {status.label}
          </span>
        )}
        {pct != null && (
          <span className="text-[14px] font-bold" style={{ color: '#5a6b7f', fontVariantNumeric: 'tabular-nums' }}>
            {pct}<span className="text-[9px]">%</span>
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 mt-1 flex-wrap" style={{ paddingLeft: 18 }}>
        <span className="text-[9px] px-1.5 py-px rounded" style={{ background: 'rgba(255,255,255,0.04)', color: '#5a6b7f' }}>
          score da cena {sourceSceneIndex}
        </span>
      </div>
    </div>
  )
}
