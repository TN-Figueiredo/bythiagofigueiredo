'use client'
import { Undo2, Redo2, ZoomIn, ZoomOut, Maximize, Grid3X3, Magnet, Save, Download } from 'lucide-react'

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
  isSaving: boolean
  onOpenTemplates: () => void
  onOpenExport: () => void
}

export function Toolbar({
  linkCode, canUndo, canRedo, onUndo, onRedo,
  zoom, onZoomIn, onZoomOut, onFitToView,
  guidesVisible, onToggleGuides, gridVisible, onToggleGrid,
  isSaving, onOpenTemplates, onOpenExport,
}: ToolbarProps) {
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

      <button type="button" onClick={onUndo} disabled={!canUndo} className="p-1.5 rounded text-neutral-400 hover:text-white disabled:opacity-30" title="Undo" aria-label="Undo">
        <Undo2 size={15} />
      </button>
      <button type="button" onClick={onRedo} disabled={!canRedo} className="p-1.5 rounded text-neutral-400 hover:text-white disabled:opacity-30" title="Redo" aria-label="Redo">
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
      <button type="button" onClick={onFitToView} className="p-1.5 rounded text-neutral-400 hover:text-white" title="Fit to view" aria-label="Fit to view">
        <Maximize size={14} />
      </button>

      <div className="w-px h-5 bg-neutral-700 mx-1" />

      <button type="button" onClick={onToggleGuides} className={`p-1.5 rounded ${guidesVisible ? 'text-blue-400' : 'text-neutral-500'} hover:text-white`} title="Snap guides" aria-label="Toggle snap guides">
        <Magnet size={14} />
      </button>
      <button type="button" onClick={onToggleGrid} className={`p-1.5 rounded ${gridVisible ? 'text-blue-400' : 'text-neutral-500'} hover:text-white`} title="Toggle grid" aria-label="Toggle grid">
        <Grid3X3 size={14} />
      </button>

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
