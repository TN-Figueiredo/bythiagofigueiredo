'use client'

import { memo, useMemo } from 'react'
import type { TimelineClipData, TrackDef } from './types'
import { TH } from './constants'
import { tickInterval } from './utils'
import { TimelineClip } from './timeline-clip'

interface TrackLaneProps {
  track: TrackDef
  clips?: TimelineClipData[]
  height: number
  pxPerSec: number
  duration: number
  isAudio?: boolean
  zIdx?: number
}

function TrackLaneRaw({ track, clips, height, pxPerSec, duration, isAudio = false, zIdx = 0 }: TrackLaneProps) {
  const totalW = duration * pxPerSec
  const hasClips = clips != null && clips.length > 0
  const intv = tickInterval(duration)

  const gridLines = useMemo(() => {
    const lines: number[] = []
    const count = Math.ceil(duration / intv) - 1
    for (let i = 0; i < count; i++) lines.push((i + 1) * intv)
    return lines
  }, [duration, intv])

  const clipElements = useMemo(
    () =>
      (clips ?? []).map((clip, i) => (
        <TimelineClip key={i} clip={clip} track={track} pxPerSec={pxPerSec} laneH={height} isAudio={isAudio} idx={i} />
      )),
    [clips, track, pxPerSec, height, isAudio],
  )

  return (
    <div
      className="relative"
      style={{
        height,
        width: totalW,
        borderBottom: `1px solid ${TH.border}`,
        background: hasClips
          ? (zIdx % 2 === 1 ? 'rgba(255,255,255,0.018)' : 'transparent')
          : 'rgba(255,255,255,0.006)',
      }}
    >
      {/* Vertical grid lines */}
      {gridLines.map(t => (
        <div
          key={`g${t}`}
          className="absolute top-0 pointer-events-none"
          style={{ left: t * pxPerSec, width: 1, height: '100%', background: 'rgba(255,255,255,0.03)' }}
        />
      ))}
      {/* Playhead line */}
      <div
        className="absolute top-0 z-[1]"
        style={{ left: 0, width: 1, height: '100%', background: `${TH.playhead}18` }}
      />
      {/* Clips */}
      {clipElements}
    </div>
  )
}

export const TrackLane = memo(TrackLaneRaw)
TrackLane.displayName = 'TrackLane'
