'use client'
import { useState, useCallback, useRef, useEffect } from 'react'
import { GripVertical, Lock, Type, Image, QrCode, LayoutTemplate, ChevronUp, ChevronDown, ChevronsUp, ChevronsDown, Pencil } from 'lucide-react'
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
    case 'text': return isShapeElement(el) ? <LayoutTemplate size={14} /> : <Type size={14} />
    case 'image': return <Image size={14} />
    default: return null
  }
}

function elementLabel(el: CardElement): string {
  if (el.name) return el.name
  switch (el.type) {
    case 'qr': return 'QR Code'
    case 'text': return el.content.startsWith('__shape:') ? 'Forma' : (el.content.slice(0, 20) || 'Text')
    case 'image': return 'Image'
    default: return 'Element'
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
      className="flex-1 px-1 py-0 text-[11px] outline-none min-w-0"
      style={{
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
      <div className="space-y-0.5">
        <div className="flex items-center justify-between px-2 py-1">
          <span
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--ink-dim)' }}
          >
            Layers
          </span>
          <span className="text-[10px]" style={{ color: 'var(--ink-faint)' }}>
            {elements.length}
          </span>
        </div>
        {reversed.length === 0 && (
          <p
            className="px-2 py-3 text-[11px] text-center"
            style={{ color: 'var(--ink-faint)' }}
          >
            No elements yet
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
              className={`flex items-center gap-1 px-1.5 py-1.5 text-[11px] cursor-pointer transition-colors ${
                isDragging ? 'opacity-40' : ''
              } ${!isSelected && !isEditing ? 'qr-layer-row' : ''}`}
              style={{
                borderRadius: 'var(--r)',
                outline: isOver ? '1px solid var(--accent)' : undefined,
                background: isSelected ? 'var(--accent-soft)' : 'transparent',
                color: isSelected ? 'var(--accent)' : 'var(--ink)',
              }}
            >
              <GripVertical
                size={12}
                className="shrink-0 cursor-grab"
                style={{ color: 'var(--ink-faint)' }}
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
                  <span className="flex-1 truncate">{elementLabel(el)}</span>
                  {isSelected && (
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setEditingId(el.id) }}
                      className="qr-layer-action p-0.5"
                      style={{ color: 'var(--ink-faint)' }}
                      title="Rename"
                    >
                      <Pencil size={10} />
                    </button>
                  )}
                </>
              )}
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); if (!isTop) onReorder(realIdx, elements.length - 1) }}
                  className="qr-layer-action p-0.5 disabled:opacity-20"
                  style={{ color: 'var(--ink-faint)' }}
                  disabled={isTop}
                  aria-label="Send to front"
                  title="Send to front"
                >
                  <ChevronsUp size={11} />
                </button>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); if (!isTop) onReorder(realIdx, realIdx + 1) }}
                  className="qr-layer-action p-0.5 disabled:opacity-20"
                  style={{ color: 'var(--ink-faint)' }}
                  disabled={isTop}
                  aria-label="Move up"
                  title="Bring forward"
                >
                  <ChevronUp size={11} />
                </button>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); if (!isBottom) onReorder(realIdx, realIdx - 1) }}
                  className="qr-layer-action p-0.5 disabled:opacity-20"
                  style={{ color: 'var(--ink-faint)' }}
                  disabled={isBottom}
                  aria-label="Move down"
                  title="Send backward"
                >
                  <ChevronDown size={11} />
                </button>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); if (!isBottom) onReorder(realIdx, 0) }}
                  className="qr-layer-action p-0.5 disabled:opacity-20"
                  style={{ color: 'var(--ink-faint)' }}
                  disabled={isBottom}
                  aria-label="Send to back"
                  title="Send to back"
                >
                  <ChevronsDown size={11} />
                </button>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); onUpdateElement(el.id, { locked: !el.locked }) }}
                  className="qr-layer-lock p-0.5 ml-0.5"
                  style={{ color: el.locked ? 'var(--amber)' : 'var(--ink-faint)' }}
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
