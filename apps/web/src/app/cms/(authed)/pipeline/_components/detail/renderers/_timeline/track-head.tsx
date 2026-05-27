'use client'

import { memo } from 'react'
import type { TrackDef } from './types'
import { TH, MONO_SM_CLS } from './constants'
import { badgeTextColor } from './utils'

interface TrackHeadProps {
  track: TrackDef
  height: number
  clipCount: number
  isAudio?: boolean
}

function TrackHeadRaw({ track, height, clipCount, isAudio = false }: TrackHeadProps) {
  const hasClips = clipCount > 0
  return (
    <div
      className="flex items-center gap-2"
      style={{
        height,
        padding: '0 8px 0 10px',
        borderBottom: `1px solid ${TH.border}`,
        background: isAudio ? `${TH.surface}e8` : TH.surface,
        opacity: hasClips ? 1 : 0.45,
        transition: 'opacity 0.15s',
      }}
    >
      {/* Track badge */}
      <div
        className="font-mono text-[10px] font-semibold tracking-tight rounded-[3px] text-center shrink-0"
        style={{
          color: badgeTextColor(track.color),
          background: track.color,
          padding: '2px 5px',
          minWidth: 24,
        }}
      >
        {track.id}
      </div>
      {/* Name */}
      <div
        className="text-xs whitespace-nowrap overflow-hidden text-ellipsis flex-1"
        style={{ color: TH.text, fontWeight: hasClips ? 500 : 400 }}
      >
        {track.name}
      </div>
      {/* Audio indicator */}
      {isAudio && (
        <span style={{ color: TH.dim, fontSize: 9, flexShrink: 0, opacity: 0.6 }} aria-label="audio track">
          ♫
        </span>
      )}
      {/* Clip count */}
      {hasClips && (
        <span className={MONO_SM_CLS} style={{ color: TH.dim, fontSize: 9, flexShrink: 0 }}>
          {clipCount}
        </span>
      )}
    </div>
  )
}

export const TrackHead = memo(TrackHeadRaw)
TrackHead.displayName = 'TrackHead'
