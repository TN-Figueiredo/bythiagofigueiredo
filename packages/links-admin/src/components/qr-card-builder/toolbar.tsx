'use client'
import { useState, useEffect, useRef } from 'react'
import { Undo2, Redo2, ZoomIn, ZoomOut, Maximize, Grid3X3, Magnet, Save, Download, Move, Scissors } from 'lucide-react'

interface ToolbarProps {
  linkCode: string
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onFitToView: () => void
  guidesVisible: boolean
  onToggleGuides: () => void
  gridVisible: boolean
  onToggleGrid: () => void
  clipOverflow: boolean
  onToggleClipOverflow: () => void
  isSaving: boolean
  onOpenTemplates: () => void
  onOpenExport: () => void
  onPositionElement: (position: PositionAnchor) => void
  hasSelection: boolean
}

export type PositionAnchor = 'tl' | 'tc' | 'tr' | 'cl' | 'cc' | 'cr' | 'bl' | 'bc' | 'br'

const POSITION_LABELS: Record<PositionAnchor, string> = {
  tl: 'Top Left', tc: 'Top Center', tr: 'Top Right',
  cl: 'Center Left', cc: 'Center', cr: 'Center Right',
  bl: 'Bottom Left', bc: 'Bottom Center', br: 'Bottom Right',
}

function PositionPopover({ onPosition, onClose }: { onPosition: (p: PositionAnchor) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handle)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handle)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  const anchors: PositionAnchor[] = ['tl', 'tc', 'tr', 'cl', 'cc', 'cr', 'bl', 'bc', 'br']

  return (
    <div ref={ref} className="absolute top-full mt-1 left-0 bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl p-2 z-50">
      <p className="text-[9px] text-neutral-500 uppercase tracking-wider mb-1.5 px-0.5">Position on Canvas</p>
      <div className="grid grid-cols-3 gap-1 w-[84px]">
        {anchors.map(a => (
          <button
            key={a}
            type="button"
            onClick={() => { onPosition(a); onClose() }}
            className="w-6 h-6 rounded border border-neutral-600 hover:border-blue-500 hover:bg-blue-600/20 flex items-center justify-center transition-colors"
            title={POSITION_LABELS[a]}
          >
            <div className={`w-1.5 h-1.5 rounded-full bg-neutral-400 ${a === 'cc' ? 'bg-blue-400' : ''}`} />
          </button>
        ))}
      </div>
    </div>
  )
}

export function Toolbar({
  linkCode, canUndo, canRedo, onUndo, onRedo,
  zoom, onZoomIn, onZoomOut, onFitToView,
  guidesVisible, onToggleGuides, gridVisible, onToggleGrid,
  clipOverflow, onToggleClipOverflow,
  isSaving, onOpenTemplates, onOpenExport,
  onPositionElement, hasSelection,
}: ToolbarProps) {
  const [showPosition, setShowPosition] = useState(false)

  return (
    <div className="h-10 bg-neutral-900 border-b border-neutral-800 flex items-center px-3 gap-1">
      <div className="flex items-center gap-1 text-[11px] text-neutral-400 mr-4">
        <span className="hover:text-neutral-200 cursor-pointer">Links</span>
        <span>/</span>
        <span className="text-neutral-200 font-medium">{linkCode}</span>
        <span>/</span>
        <span className="text-blue-400">QR Card</span>
      </div>

      <div className="w-px h-5 bg-neutral-700 mx-1" />

      <button type="button" onClick={onUndo} disabled={!canUndo} className="p-1.5 rounded text-neutral-400 hover:text-white disabled:opacity-30" title="Undo (⌘Z)" aria-label="Undo">
        <Undo2 size={15} />
      </button>
      <button type="button" onClick={onRedo} disabled={!canRedo} className="p-1.5 rounded text-neutral-400 hover:text-white disabled:opacity-30" title="Redo (⌘⇧Z)" aria-label="Redo">
        <Redo2 size={15} />
      </button>

      <div className="w-px h-5 bg-neutral-700 mx-1" />

      <button type="button" onClick={onZoomOut} className="p-1.5 rounded text-neutral-400 hover:text-white" title="Zoom out" aria-label="Zoom out">
        <ZoomOut size={15} />
      </button>
      <span className="text-[11px] text-neutral-300 w-10 text-center">{Math.round(zoom * 100)}%</span>
      <button type="button" onClick={onZoomIn} className="p-1.5 rounded text-neutral-400 hover:text-white" title="Zoom in" aria-label="Zoom in">
        <ZoomIn size={15} />
      </button>
      <button type="button" onClick={onFitToView} className="p-1.5 rounded text-neutral-400 hover:text-white" title="Fit to view (⌘0)" aria-label="Fit to view">
        <Maximize size={14} />
      </button>

      <div className="w-px h-5 bg-neutral-700 mx-1" />

      <button type="button" onClick={onToggleGuides} className={`p-1.5 rounded ${guidesVisible ? 'text-blue-400 bg-blue-600/10' : 'text-neutral-500'} hover:text-white`} title="Snap guides (⌘G)" aria-label="Toggle snap guides">
        <Magnet size={14} />
      </button>
      <button type="button" onClick={onToggleGrid} className={`p-1.5 rounded ${gridVisible ? 'text-blue-400 bg-blue-600/10' : 'text-neutral-500'} hover:text-white`} title="Snap to grid" aria-label="Toggle grid">
        <Grid3X3 size={14} />
      </button>
      <button type="button" onClick={onToggleClipOverflow} className={`p-1.5 rounded ${clipOverflow ? 'text-blue-400 bg-blue-600/10' : 'text-neutral-500'} hover:text-white`} title="Clip overflow (⌘⇧K)" aria-label="Toggle clip overflow">
        <Scissors size={14} />
      </button>

      <div className="relative">
        <button
          type="button"
          onClick={() => setShowPosition(!showPosition)}
          disabled={!hasSelection}
          className={`p-1.5 rounded ${showPosition ? 'text-blue-400 bg-blue-600/10' : 'text-neutral-500'} hover:text-white disabled:opacity-30`}
          title="Position element"
          aria-label="Position element on canvas"
        >
          <Move size={14} />
        </button>
        {showPosition && hasSelection && (
          <PositionPopover onPosition={onPositionElement} onClose={() => setShowPosition(false)} />
        )}
      </div>

      <div className="flex-1" />

      {isSaving && <span className="text-[10px] text-neutral-500 mr-2">Saving...</span>}

      <button type="button" onClick={onOpenTemplates} className="px-2.5 py-1 rounded border border-neutral-700 text-[11px] text-neutral-300 hover:border-neutral-500 mr-1" aria-label="Templates">
        <Save size={13} className="inline mr-1" />Templates
      </button>
      <button type="button" onClick={onOpenExport} className="px-2.5 py-1 rounded bg-blue-600 text-[11px] text-white hover:bg-blue-500" aria-label="Export">
        <Download size={13} className="inline mr-1" />Export
      </button>
    </div>
  )
}
