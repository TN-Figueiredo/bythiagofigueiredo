'use client'

import { useState, useRef, useCallback, memo } from 'react'
import type { BeatData, BeatAssets, TrackHeightMap } from './types'
import {
  TL_TRACKS, ALL_TRACKS, TH,
  PANEL_W, RULER_H, HANDLE_H, EMPTY_H, MIN_H, MAX_H,
  MONO_SM_CLS, MONO_XS_CLS,
} from './constants'
import { fmtTime, fmtDur, effectiveTrackH, calcPxPerSec, difficultyColor } from './utils'
import { Ruler } from './ruler'
import { TrackHead } from './track-head'
import { TrackLane } from './track-lane'
import { TrackDivider } from './track-divider'
import { ResizeHandle } from './resize-handle'
import { AssetResolver } from './asset-resolver'
import { ScriptPanel } from './script-panel'

interface BeatAccordionProps {
  beat: BeatData
  assets: BeatAssets | undefined
  trackHeights: TrackHeightMap
  onResize: (trackId: string, newH: number) => void
  zoom: number
  containerW: number
  defaultOpen: boolean
}

function BeatAccordionRaw({ beat, assets, trackHeights, onResize, zoom, containerW, defaultOpen }: BeatAccordionProps) {
  const [open, setOpen] = useState(defaultOpen)
  const scrollRef = useRef<HTMLDivElement>(null)

  const effH = useCallback(
    (tid: string) => effectiveTrackH(tid, beat.clips, trackHeights, EMPTY_H),
    [beat.clips, trackHeights],
  )

  const availW = Math.max(containerW - PANEL_W - 2, 300)
  const pps = calcPxPerSec(availW, beat.duration, zoom)
  const totalW = beat.duration * pps

  const startResize = useCallback((trackId: string) => (e: React.MouseEvent) => {
    e.preventDefault()
    const startY = e.clientY
    const startH = trackHeights[trackId] ?? EMPTY_H
    let raf: number | null = null

    const move = (me: MouseEvent) => {
      if (raf) cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const delta = me.clientY - startY
        onResize(trackId, Math.max(MIN_H, Math.min(MAX_H, startH + delta)))
      })
    }

    const up = () => {
      if (raf) cancelAnimationFrame(raf)
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', up)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
  }, [trackHeights, onResize])

  const totalClips = ALL_TRACKS.reduce((n, t) => n + (beat.clips[t.id]?.length ?? 0), 0)
  const usedTracks = ALL_TRACKS.filter(t => (beat.clips[t.id]?.length ?? 0) > 0).length
  const diffColor = difficultyColor(beat.difficulty)

  return (
    <div
      className="rounded-md overflow-hidden mb-3.5"
      style={{ background: TH.surface, border: `1px solid ${TH.border}`, borderLeft: `3px solid ${TH.accent}` }}
    >
      {/* Beat header */}
      <button
        className="w-full flex items-center gap-2 px-3.5 py-2.5 cursor-pointer select-none text-left"
        style={{ background: TH.header, borderBottom: open ? `1px solid ${TH.border}` : 'none' }}
        onClick={() => setOpen(v => !v)}
      >
        <span
          className="text-[11px] shrink-0 w-3.5 text-center transition-transform duration-200"
          style={{ color: TH.dim, transform: open ? 'rotate(90deg)' : 'rotate(0)' }}
        >
          ▶
        </span>
        <span className="font-mono text-[13px] font-bold shrink-0" style={{ color: TH.accent }}>
          {beat.idx + 1}
        </span>
        <span className="text-[13px] flex-1 min-w-0 whitespace-nowrap overflow-hidden text-ellipsis" style={{ color: TH.text }}>
          <span className={MONO_SM_CLS} style={{ color: TH.muted }}>{beat.label}</span>
          <span style={{ color: TH.dim, margin: '0 5px' }}>—</span>
          <span className="font-semibold">{beat.name}</span>
        </span>
        <span className={`${MONO_SM_CLS} shrink-0`} style={{ color: TH.muted }}>
          {fmtTime(beat.absStart)}–{fmtTime(beat.absStart + beat.duration)}
        </span>
        <span className="font-mono text-[12px] font-bold shrink-0" style={{ color: TH.text }}>
          {fmtDur(beat.duration)}
        </span>
        <span className={`${MONO_XS_CLS} rounded-[3px]`} style={{ fontSize: 9, padding: '2px 7px', color: TH.muted, background: 'rgba(255,255,255,0.06)' }}>
          {beat.status}
        </span>
        <span className={`${MONO_XS_CLS} rounded-[3px]`} style={{ fontSize: 9, padding: '2px 7px', color: diffColor, background: `${diffColor}18` }}>
          {beat.difficulty}
        </span>
        <span className={`${MONO_SM_CLS} shrink-0 whitespace-nowrap`} style={{ color: TH.dim, fontSize: 8 }}>
          {totalClips}c · {usedTracks}/13
        </span>
      </button>

      {/* Beat body — lazy render when collapsed */}
      {open && (
        <>
          <div className="flex">
            {/* Track panel (left) */}
            <div className="shrink-0" style={{ width: PANEL_W, borderRight: `1px solid ${TH.border}` }}>
              <div style={{ height: RULER_H, background: TH.surface, borderBottom: `1px solid ${TH.border}` }} />
              {TL_TRACKS.video.map(t => (
                <div key={t.id}>
                  <TrackHead track={t} height={effH(t.id)} clipCount={beat.clips[t.id]?.length ?? 0} />
                  <ResizeHandle onStart={startResize(t.id)} />
                </div>
              ))}
              <TrackDivider inPanel />
              {TL_TRACKS.audio.map(t => (
                <div key={t.id}>
                  <TrackHead track={t} height={effH(t.id)} clipCount={beat.clips[t.id]?.length ?? 0} isAudio />
                  <ResizeHandle onStart={startResize(t.id)} />
                </div>
              ))}
            </div>
            {/* Timeline area (right, scrollable) */}
            <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-hidden">
              <div style={{ width: Math.max(totalW, availW) + 36, minWidth: availW }}>
                <Ruler duration={beat.duration} pxPerSec={pps} totalW={Math.max(totalW, availW) + 36} />
                {TL_TRACKS.video.map((t, vi) => (
                  <div key={t.id}>
                    <TrackLane
                      track={t}
                      clips={beat.clips[t.id]}
                      height={effH(t.id)}
                      pxPerSec={pps}
                      duration={beat.duration}
                      zIdx={vi}
                    />
                    <div style={{ height: HANDLE_H }} />
                  </div>
                ))}
                <TrackDivider width={Math.max(totalW, availW) + 36} />
                {TL_TRACKS.audio.map((t, ai) => (
                  <div key={t.id}>
                    <TrackLane
                      track={t}
                      clips={beat.clips[t.id]}
                      height={effH(t.id)}
                      pxPerSec={pps}
                      duration={beat.duration}
                      isAudio
                      zIdx={ai}
                    />
                    <div style={{ height: HANDLE_H }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <AssetResolver assets={assets} />
          <ScriptPanel script={beat.script} />
        </>
      )}
    </div>
  )
}

export const BeatAccordion = memo(BeatAccordionRaw)
BeatAccordion.displayName = 'BeatAccordion'
