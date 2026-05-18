'use client'

import { useCallback, memo } from 'react'
import { TL_TRACKS, TH, ZOOM_MIN, ZOOM_MAX, ZOOM_STEP, MONO_SM_CLS, MONO_XS_CLS } from './constants'

interface ToolbarProps {
  zoom: number
  setZoom: (fn: (z: number) => number) => void
  expandAll: () => void
  collapseAll: () => void
}

const btnCls = 'font-mono text-[12px] leading-none rounded cursor-pointer'
const btnStyle = {
  background: 'rgba(255,255,255,0.06)',
  border: `1px solid ${TH.border}`,
  color: TH.text,
  padding: '3px 6px',
}
const btnSmStyle = { ...btnStyle, padding: '3px 8px', fontSize: 10 }

function ToolbarRaw({ zoom, setZoom, expandAll, collapseAll }: ToolbarProps) {
  const zoomIn = useCallback(() => setZoom(z => Math.min(ZOOM_MAX, z + ZOOM_STEP)), [setZoom])
  const zoomOut = useCallback(() => setZoom(z => Math.max(ZOOM_MIN, z - ZOOM_STEP)), [setZoom])
  const zoomFit = useCallback(() => setZoom(() => 1), [setZoom])
  const handleSlider = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value)
    setZoom(() => val)
  }, [setZoom])

  const allTracks = [...TL_TRACKS.video].reverse().concat(TL_TRACKS.audio)

  return (
    <div
      className="flex items-center gap-4 flex-wrap rounded-md mb-3"
      style={{ padding: '10px 16px', background: TH.surface, border: `1px solid ${TH.border}` }}
    >
      <div className={MONO_XS_CLS} style={{ color: TH.accent, fontSize: 10, letterSpacing: '0.14em', whiteSpace: 'nowrap' }}>
        TIMELINE RESOLVER
      </div>
      <div style={{ width: 1, height: 20, background: TH.border }} />
      {/* Zoom controls */}
      <div className="flex items-center gap-2">
        <span className={MONO_SM_CLS} style={{ color: TH.muted, fontSize: 9 }}>ZOOM</span>
        <button onClick={zoomOut} className={btnCls} style={btnStyle} aria-label="Zoom out">−</button>
        <input
          type="range"
          min={ZOOM_MIN}
          max={ZOOM_MAX}
          step={0.05}
          value={zoom}
          onChange={handleSlider}
          className="w-[100px]"
          style={{ accentColor: TH.accent }}
          aria-label="Zoom level"
        />
        <button onClick={zoomIn} className={btnCls} style={btnStyle} aria-label="Zoom in">+</button>
        <span className={`${MONO_SM_CLS} min-w-[36px] text-center`} style={{ color: TH.text }}>
          {Math.round(zoom * 100)}%
        </span>
        <button onClick={zoomFit} className={btnCls} style={btnSmStyle}>Fit</button>
      </div>
      <div className="flex-1" />
      {/* Collapse / Expand */}
      <button onClick={expandAll} className={btnCls} style={btnSmStyle}>Expand All</button>
      <button onClick={collapseAll} className={btnCls} style={btnSmStyle}>Collapse All</button>
      {/* Track color legend */}
      <div className="flex gap-1.5 flex-wrap">
        {allTracks.map(t => (
          <div
            key={t.id}
            title={`${t.id} · ${t.name}: ${t.fn}`}
            className="w-2.5 h-2.5 rounded-sm cursor-help"
            style={{ background: t.color, opacity: 0.8 }}
          />
        ))}
      </div>
    </div>
  )
}

export const Toolbar = memo(ToolbarRaw)
Toolbar.displayName = 'Toolbar'
