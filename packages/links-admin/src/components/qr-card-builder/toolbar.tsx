'use client'
import { useState, useEffect, useRef } from 'react'
import { Undo2, Redo2, ZoomIn, ZoomOut, Maximize, Grid3X3, Magnet, Save, Download, Move, Scissors, ChevronLeft, ChevronRight, Check } from 'lucide-react'

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
  tl: 'Topo Esquerda', tc: 'Topo Centro', tr: 'Topo Direita',
  cl: 'Centro Esquerda', cc: 'Centro', cr: 'Centro Direita',
  bl: 'Base Esquerda', bc: 'Base Centro', br: 'Base Direita',
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
    <div ref={ref} style={{
      position: 'absolute', top: '100%', marginTop: 4, left: 0, zIndex: 50,
      background: 'var(--surface)', border: '1px solid var(--line-strong)',
      borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.3)', padding: 8,
    }}>
      <p style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-faint)', margin: '0 0 6px 2px' }}>Posição no canvas</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 3, width: 84 }}>
        {anchors.map(a => (
          <button
            key={a}
            type="button"
            onClick={() => { onPosition(a); onClose() }}
            title={POSITION_LABELS[a]}
            style={{
              width: 24, height: 24, borderRadius: 4,
              border: 'none', background: 'var(--surface-2)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <span style={{ width: 4, height: 4, borderRadius: 2, background: 'var(--ink-dim)' }} />
          </button>
        ))}
      </div>
    </div>
  )
}

const iconBtn: React.CSSProperties = {
  background: 'transparent', border: 'none',
  color: 'var(--ink-dim)', width: 30, height: 30,
  borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', padding: 0, flexShrink: 0,
}

const ghostBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 7, justifyContent: 'center',
  padding: '6px 11px', fontSize: '12.5px', fontWeight: 600,
  borderRadius: 9, border: '1px solid var(--line-strong)',
  whiteSpace: 'nowrap', letterSpacing: '-0.01em',
  background: 'transparent', color: 'var(--ink-dim)', cursor: 'pointer',
}

const accentBtn: React.CSSProperties = {
  ...ghostBtn,
  border: '1px solid var(--accent)',
  background: 'var(--accent)', color: 'var(--pb-ink-on-accent, #1A140C)',
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

  const activeStyle = (active: boolean): React.CSSProperties => ({
    ...iconBtn,
    color: active ? 'var(--accent)' : 'var(--ink-faint)',
    background: active ? 'var(--accent-soft, rgba(255,130,64,0.1))' : 'transparent',
  })

  return (
    <div style={{
      height: 52, flexShrink: 0,
      borderBottom: '1px solid var(--line)',
      background: 'var(--bg-side)',
      display: 'flex', alignItems: 'center',
      padding: '0 16px', gap: 14,
    }}>
      {/* Back button */}
      <button
        type="button"
        onClick={() => window.history.back()}
        style={{
          background: 'transparent', border: 'none',
          color: 'var(--ink-dim)', display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 13, cursor: 'pointer', padding: 0,
        }}
      >
        <ChevronLeft size={18} strokeWidth={1.7} />
        Voltar
      </button>

      {/* Separator */}
      <div style={{ width: 1, height: 22, background: 'var(--line)' }} />

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'nowrap', minWidth: 0 }}>
        <span style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--ink-dim)', whiteSpace: 'nowrap', flexShrink: 0 }}>
          Links
        </span>
        <ChevronRight size={13} strokeWidth={1.7} style={{ color: 'var(--ink-faint)', opacity: 0.7, flexShrink: 0 }} />
        <span style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--ink-dim)', whiteSpace: 'nowrap', flexShrink: 0 }}>
          /{linkCode}
        </span>
        <ChevronRight size={13} strokeWidth={1.7} style={{ color: 'var(--ink-faint)', opacity: 0.7, flexShrink: 0 }} />
        <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 1 }}>
          QR Card
        </span>
      </div>

      {/* Zoom controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 18 }}>
        <button type="button" onClick={onZoomOut} style={iconBtn} title="Zoom -" aria-label="Zoom -">
          <ZoomOut size={16} strokeWidth={1.7} />
        </button>
        <span className="mono" style={{ fontSize: 12, width: 42, textAlign: 'center', color: 'var(--ink-dim)' }}>
          {Math.round(zoom * 100)}%
        </span>
        <button type="button" onClick={onZoomIn} style={iconBtn} title="Zoom +" aria-label="Zoom +">
          <ZoomIn size={16} strokeWidth={1.7} />
        </button>
        <button type="button" onClick={onFitToView} style={iconBtn} title="Ajustar à tela (⌘0)" aria-label="Ajustar à tela">
          <Maximize size={14} strokeWidth={1.7} />
        </button>
      </div>

      {/* Tool toggles */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <button type="button" onClick={onUndo} disabled={!canUndo} style={{ ...iconBtn, opacity: canUndo ? 1 : 0.3 }} title="Desfazer (⌘Z)" aria-label="Desfazer">
          <Undo2 size={15} strokeWidth={1.7} />
        </button>
        <button type="button" onClick={onRedo} disabled={!canRedo} style={{ ...iconBtn, opacity: canRedo ? 1 : 0.3 }} title="Refazer (⌘⇧Z)" aria-label="Refazer">
          <Redo2 size={15} strokeWidth={1.7} />
        </button>

        <div style={{ width: 1, height: 22, background: 'var(--line)', margin: '0 4px' }} />

        <button type="button" onClick={onToggleGuides} style={activeStyle(guidesVisible)} title="Guias de alinhamento (⌘G)" aria-label="Guias de alinhamento">
          <Magnet size={14} strokeWidth={1.7} />
        </button>
        <button type="button" onClick={onToggleGrid} style={activeStyle(gridVisible)} title="Grade" aria-label="Grade">
          <Grid3X3 size={14} strokeWidth={1.7} />
        </button>
        <button type="button" onClick={onToggleClipOverflow} style={activeStyle(clipOverflow)} title="Cortar excesso (⌘⇧K)" aria-label="Cortar excesso">
          <Scissors size={14} strokeWidth={1.7} />
        </button>

        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setShowPosition(!showPosition)}
            disabled={!hasSelection}
            style={{ ...activeStyle(showPosition), opacity: hasSelection ? 1 : 0.3 }}
            title="Posicionar elemento"
            aria-label="Posicionar elemento no canvas"
          >
            <Move size={14} strokeWidth={1.7} />
          </button>
          {showPosition && hasSelection && (
            <PositionPopover onPosition={onPositionElement} onClose={() => setShowPosition(false)} />
          )}
        </div>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Status + Actions */}
      {isSaving && <span style={{ fontSize: '10.5px', color: 'var(--ink-faint)', marginRight: 4 }}>Salvando...</span>}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button type="button" onClick={onOpenTemplates} style={ghostBtn} aria-label="Templates">
          <Save size={14} strokeWidth={1.7} />
          Templates
        </button>
        <button type="button" onClick={onOpenExport} style={{ ...ghostBtn, background: 'var(--surface-2)', color: 'var(--ink)', borderColor: 'var(--line)' }} aria-label="Exportar">
          <Download size={14} strokeWidth={1.7} />
          Exportar
        </button>
      </div>
    </div>
  )
}
