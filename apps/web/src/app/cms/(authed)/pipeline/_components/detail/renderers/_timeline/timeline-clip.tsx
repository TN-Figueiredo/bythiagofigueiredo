'use client'

import { memo, useState } from 'react'
import type { TimelineClipData, TrackDef } from './types'
import { WaveDecor } from './wave-decor'
import { ClipTooltip } from './clip-tooltip'

interface TimelineClipProps {
  clip: TimelineClipData
  track: TrackDef
  pxPerSec: number
  laneH: number
  isAudio: boolean
  idx: number
}

function TimelineClipRaw({ clip, track, pxPerSec, laneH, isAudio, idx }: TimelineClipProps) {
  const [hovered, setHovered] = useState(false)
  const left = clip.s * pxPerSec + 1
  const w = Math.max((clip.e - clip.s) * pxPerSec - 2, 3)
  const c = track.color
  const innerH = laneH - 4

  return (
    <div
      className="absolute cursor-pointer overflow-hidden rounded-[3px]"
      style={{
        left,
        width: w,
        top: 2,
        height: innerH,
        background: isAudio
          ? `linear-gradient(180deg, ${c}dd, ${c}aa)`
          : `linear-gradient(180deg, ${c}cc, ${c}99)`,
        borderTop: `2px solid ${c}`,
        boxShadow: hovered ? `0 0 0 1px ${c}, 0 2px 8px rgba(0,0,0,0.4)` : 'none',
        transition: 'box-shadow 0.12s',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Video frame markers */}
      {!isAudio && w > 40 && (
        <div
          className="absolute inset-0"
          style={{
            opacity: 0.12,
            backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 32px, rgba(0,0,0,0.6) 32px, rgba(0,0,0,0.6) 33px)',
          }}
        />
      )}
      {/* Audio waveform */}
      {isAudio && w > 20 && <WaveDecor width={w} height={innerH} color={c} seed={idx + clip.s} />}
      {/* Label */}
      {w > 20 && (
        <div
          className="relative z-[1] whitespace-nowrap overflow-hidden text-ellipsis"
          style={{
            padding: '2px 5px',
            fontSize: innerH < 24 ? 9 : 10,
            fontWeight: 500,
            color: '#fff',
            textShadow: '0 1px 2px rgba(0,0,0,0.8), 0 0 6px rgba(0,0,0,0.4)',
            lineHeight: `${innerH - 4}px`,
          }}
        >
          {clip.label}
        </div>
      )}
      {/* Tooltip */}
      {hovered && <ClipTooltip clip={clip} trackName={`${track.id} · ${track.name}`} />}
    </div>
  )
}

export const TimelineClip = memo(TimelineClipRaw)
TimelineClip.displayName = 'TimelineClip'
