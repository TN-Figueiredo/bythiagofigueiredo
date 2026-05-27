'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import type { RendererProps } from '../../section-content'
import type { PostProdContent, TrackHeightMap } from './types'
import { ALL_TRACKS, DEF_H, PRIMARY_H, TH, ZOOM_DEFAULT, ZOOM_MIN, ZOOM_MAX, ZOOM_STEP, MONO_SM_CLS } from './constants'
import { fmtDur, parsePostProdContent } from './utils'
import { ProgressBar } from './progress-bar'
import { CrossRefPanel } from './crossref-panel'
import { SpeedRampsPanel } from './speedramps-panel'
import { Toolbar } from './toolbar'
import { BeatAccordion } from './beat-accordion'

interface PostProductionViewProps extends RendererProps {
  scenesContent?: unknown
  crossRefContent?: unknown
  speedRampsContent?: unknown
}

export function PostProductionView({
  content,
  scenesContent,
  crossRefContent,
  speedRampsContent,
}: PostProductionViewProps) {
  const data: PostProdContent = useMemo(() => {
    if (scenesContent || crossRefContent || speedRampsContent) {
      return parsePostProdContent(scenesContent ?? content, crossRefContent, speedRampsContent)
    }
    if (content && typeof content === 'object' && !Array.isArray(content)) {
      return content as PostProdContent
    }
    return {}
  }, [content, scenesContent, crossRefContent, speedRampsContent])

  const beats = data.beats ?? []

  const [zoom, setZoom] = useState(ZOOM_DEFAULT)
  const [trackHeights, setTrackHeights] = useState<TrackHeightMap>(() => {
    const h: TrackHeightMap = {}
    ALL_TRACKS.forEach(t => { h[t.id] = (t.id === 'V1' || t.id === 'A1') ? PRIMARY_H : DEF_H })
    return h
  })
  const [containerW, setContainerW] = useState(960)
  const containerRef = useRef<HTMLDivElement>(null)

  const [allState, setAllState] = useState<0 | 1 | 2>(0)
  const [resetKey, setResetKey] = useState(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      for (const e of entries) setContainerW(e.contentRect.width)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const handleResize = useCallback((id: string, newH: number) => {
    setTrackHeights(prev => ({ ...prev, [id]: newH }))
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const tag = target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (target.isContentEditable) return

      switch (e.key) {
        case '+':
        case '=':
          e.preventDefault()
          setZoom(z => Math.min(ZOOM_MAX, z + ZOOM_STEP))
          break
        case '-':
          e.preventDefault()
          setZoom(z => Math.max(ZOOM_MIN, z - ZOOM_STEP))
          break
        case '0':
          e.preventDefault()
          setZoom(ZOOM_DEFAULT)
          break
        case 'e':
        case 'E':
          e.preventDefault()
          setAllState(2)
          setResetKey(k => k + 1)
          break
        case 'c':
        case 'C':
          e.preventDefault()
          setAllState(1)
          setResetKey(k => k + 1)
          break
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  if (beats.length === 0) {
    return (
      <div className="p-5 text-xs text-center" style={{ color: TH.dim }}>
        Nenhum beat de pós-produção disponível.
      </div>
    )
  }

  const totalDur = beats.reduce((s, b) => s + b.duration, 0)

  return (
    <div ref={containerRef} className="max-w-[1440px] mx-auto px-5 py-4 pb-10">
      <div className="flex items-baseline gap-3.5 flex-wrap mb-4">
        <h2 className="text-[18px] font-semibold m-0" style={{ color: TH.text }}>
          Pós-Produção
        </h2>
        <span className="text-[13px]" style={{ color: TH.muted }}>Cena × Cena</span>
        <div className="flex-1" />
        <span className={MONO_SM_CLS} style={{ color: TH.muted }}>
          {fmtDur(totalDur)} · {beats.length} beats
        </span>
      </div>

      <ProgressBar beats={beats} />

      {(data.crossRef || data.speedRamps) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <CrossRefPanel data={data.crossRef} />
          <SpeedRampsPanel data={data.speedRamps} />
        </div>
      )}

      <Toolbar
        zoom={zoom}
        setZoom={(fn: (z: number) => number) => { setZoom(fn) }}
        expandAll={() => { setAllState(2); setResetKey(k => k + 1) }}
        collapseAll={() => { setAllState(1); setResetKey(k => k + 1) }}
      />

      {beats.map(beat => (
        <BeatAccordion
          key={`${beat.idx}-${resetKey}`}
          beat={beat}
          assets={data.assets?.[beat.idx]}
          trackHeights={trackHeights}
          onResize={handleResize}
          zoom={zoom}
          containerW={containerW}
          defaultOpen={allState !== 1}
        />
      ))}
    </div>
  )
}
