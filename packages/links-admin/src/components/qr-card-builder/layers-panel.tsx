'use client'
import { useState, useCallback, useRef, useEffect } from 'react'
import { GripVertical, Lock, Type, Image, QrCode, LayoutTemplate, ChevronUp, ChevronDown, ChevronsUp, ChevronsDown, Pencil, FileText, Stamp } from 'lucide-react'
import type { CardElement } from '@tn-figueiredo/links/qr'
import { isShapeElement } from './shape-inspector'

interface LayersPanelProps {
  elements: CardElement[]
  selectedIds: Set<string>
  onSelect: (id: string) => void
  onReorder: (fromIndex: number, toIndex: number) => void
  onUpdateElement: (id: string, patch: Partial<CardElement>) => void
}

function elementIcon(el: CardElement) {
  switch (el.type) {
    case 'qr': return <QrCode size={14} />
    case 'text': {
      if (isShapeElement(el)) return <LayoutTemplate size={14} />
      if (el.name?.startsWith('__button:')) return <FileText size={14} />
      return <Type size={14} />
    }
    case 'image': {
      if (el.name?.startsWith('__stamp:')) return <Stamp size={14} />
      return <Image size={14} />
    }
    default: return null
  }
}

function elementLabel(el: CardElement): string {
  if (el.name && !el.name.startsWith('__')) return el.name
  switch (el.type) {
    case 'qr': return 'QR Code'
    case 'text': {
      if (el.content.startsWith('__shape:')) return 'Forma'
      if (el.name?.startsWith('__button:')) return 'Botão'
      return el.content.slice(0, 20) || 'Texto'
    }
    case 'image': {
      if (el.name?.startsWith('__stamp:')) return 'Carimbo'
      return 'Imagem'
    }
    default: return 'Elemento'
  }
}

function InlineRename({ value, onCommit, onCancel }: { value: string; onCommit: (v: string) => void; onCancel: () => void }) {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    ref.current?.select()
  }, [])

  return (
    <input
      ref={ref}
      autoFocus
      defaultValue={value}
      onBlur={e => {
        const v = e.target.value.trim()
        if (v && v !== value) onCommit(v)
        else onCancel()
      }}
      onKeyDown={e => {
        if (e.key === 'Enter') {
          const v = (e.target as HTMLInputElement).value.trim()
          if (v) onCommit(v)
          else onCancel()
        }
        if (e.key === 'Escape') onCancel()
      }}
      onClick={e => e.stopPropagation()}
      style={{
        flex: 1,
        padding: '0 4px',
        fontSize: 11,
        outline: 'none',
        minWidth: 0,
        background: 'var(--surface)',
        border: '1px solid var(--accent)',
        borderRadius: 'var(--r)',
        color: 'var(--ink)',
      }}
      maxLength={40}
    />
  )
}

export function LayersPanel({ elements, selectedIds, onSelect, onReorder, onUpdateElement }: LayersPanelProps) {
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const dragRef = useRef<number | null>(null)

  const reversed = [...elements].reverse()

  const toReal = (displayIdx: number) => elements.length - 1 - displayIdx

  const handleDragStart = useCallback((displayIdx: number) => {
    const real = toReal(displayIdx)
    setDragIdx(displayIdx)
    dragRef.current = real
  }, [elements.length])

  const handleDragOver = useCallback((e: React.DragEvent, displayIdx: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setOverIdx(displayIdx)
  }, [])

  const handleDrop = useCallback((displayIdx: number) => {
    const fromReal = dragRef.current
    const toReal_ = toReal(displayIdx)
    if (fromReal !== null && fromReal !== toReal_) {
      onReorder(fromReal, toReal_)
    }
    setDragIdx(null)
    setOverIdx(null)
    dragRef.current = null
  }, [elements.length, onReorder])

  const handleDragEnd = useCallback(() => {
    setDragIdx(null)
    setOverIdx(null)
    dragRef.current = null
  }, [])

  const handleRename = useCallback((id: string, newName: string) => {
    onUpdateElement(id, { name: newName } as Partial<CardElement>)
    setEditingId(null)
  }, [onUpdateElement])

  return (
    <>
      <style>{`
        .qr-layer-row:hover {
          background: var(--surface-2) !important;
        }
        .qr-layer-action:hover {
          color: var(--ink) !important;
        }
        .qr-layer-lock:hover {
          color: var(--ink) !important;
        }
      `}</style>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px' }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--ink-dim)',
            }}
          >
            Camadas
          </span>
          <span style={{ fontSize: 10, color: 'var(--ink-faint)' }}>
            {elements.length}
          </span>
        </div>
        {reversed.length === 0 && (
          <p
            style={{ padding: '12px 8px', fontSize: 11, textAlign: 'center', color: 'var(--ink-faint)' }}
          >
            Nenhum elemento
          </p>
        )}
        {reversed.map((el, displayIdx) => {
          const realIdx = toReal(displayIdx)
          const isSelected = selectedIds.has(el.id)
          const isDragging = dragIdx === displayIdx
          const isOver = overIdx === displayIdx && dragIdx !== null && dragIdx !== displayIdx
          const isTop = realIdx === elements.length - 1
          const isBottom = realIdx === 0
          const isEditing = editingId === el.id

          return (
            <div
              key={el.id}
              draggable={!isEditing}
              onDragStart={() => handleDragStart(displayIdx)}
              onDragOver={e => handleDragOver(e, displayIdx)}
              onDrop={() => handleDrop(displayIdx)}
              onDragEnd={handleDragEnd}
              onClick={() => onSelect(el.id)}
              onDoubleClick={() => setEditingId(el.id)}
              className={!isSelected && !isEditing ? 'qr-layer-row' : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '6px 6px',
                fontSize: 11,
                cursor: 'pointer',
                transition: 'color 0.15s',
                opacity: isDragging ? 0.4 : undefined,
                borderRadius: 'var(--r)',
                outline: isOver ? '1px solid var(--accent)' : undefined,
                background: isSelected ? 'var(--accent-soft)' : 'transparent',
                color: isSelected ? 'var(--accent)' : 'var(--ink)',
              }}
            >
              <GripVertical
                size={12}
                style={{ flexShrink: 0, cursor: 'grab', color: 'var(--ink-faint)' }}
              />
              {elementIcon(el)}
              {isEditing ? (
                <InlineRename
                  value={elementLabel(el)}
                  onCommit={v => handleRename(el.id, v)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{elementLabel(el)}</span>
                  {isSelected && (
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setEditingId(el.id) }}
                      className="qr-layer-action"
                      style={{ padding: 2, color: 'var(--ink-faint)' }}
                      title="Renomear"
                    >
                      <Pencil size={10} />
                    </button>
                  )}
                </>
              )}
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); if (!isTop) onReorder(realIdx, elements.length - 1) }}
                  className="qr-layer-action"
                  style={{ padding: 2, color: 'var(--ink-faint)', opacity: isTop ? 0.2 : undefined }}
                  disabled={isTop}
                  aria-label="Send to front"
                  title="Send to front"
                >
                  <ChevronsUp size={11} />
                </button>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); if (!isTop) onReorder(realIdx, realIdx + 1) }}
                  className="qr-layer-action"
                  style={{ padding: 2, color: 'var(--ink-faint)', opacity: isTop ? 0.2 : undefined }}
                  disabled={isTop}
                  aria-label="Move up"
                  title="Bring forward"
                >
                  <ChevronUp size={11} />
                </button>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); if (!isBottom) onReorder(realIdx, realIdx - 1) }}
                  className="qr-layer-action"
                  style={{ padding: 2, color: 'var(--ink-faint)', opacity: isBottom ? 0.2 : undefined }}
                  disabled={isBottom}
                  aria-label="Move down"
                  title="Send backward"
                >
                  <ChevronDown size={11} />
                </button>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); if (!isBottom) onReorder(realIdx, 0) }}
                  className="qr-layer-action"
                  style={{ padding: 2, color: 'var(--ink-faint)', opacity: isBottom ? 0.2 : undefined }}
                  disabled={isBottom}
                  aria-label="Send to back"
                  title="Send to back"
                >
                  <ChevronsDown size={11} />
                </button>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); onUpdateElement(el.id, { locked: !el.locked }) }}
                  className="qr-layer-lock"
                  style={{ padding: 2, marginLeft: 2, color: el.locked ? 'var(--amber)' : 'var(--ink-faint)' }}
                  aria-label={el.locked ? 'Unlock' : 'Lock'}
                >
                  <Lock size={11} />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
