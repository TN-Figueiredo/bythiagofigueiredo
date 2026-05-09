'use client'
import { useState, useCallback, useRef, useEffect } from 'react'
import { GripVertical, Lock, Type, Image, QrCode, ChevronUp, ChevronDown, ChevronsUp, ChevronsDown, Pencil } from 'lucide-react'
import type { CardElement } from '@tn-figueiredo/links/qr'

interface LayersPanelProps {
  elements: CardElement[]
  selectedIds: Set<string>
  onSelect: (id: string) => void
  onReorder: (fromIndex: number, toIndex: number) => void
  onUpdateElement: (id: string, patch: Partial<CardElement>) => void
}

function elementIcon(type: string) {
  switch (type) {
    case 'qr': return <QrCode size={14} />
    case 'text': return <Type size={14} />
    case 'image': return <Image size={14} />
    default: return null
  }
}

function elementLabel(el: CardElement): string {
  if (el.name) return el.name
  switch (el.type) {
    case 'qr': return 'QR Code'
    case 'text': return el.content.slice(0, 20) || 'Text'
    case 'image': return 'Image'
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
      className="flex-1 bg-neutral-700 border border-blue-500 rounded px-1 py-0 text-[11px] text-neutral-100 outline-none min-w-0"
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
    <div className="space-y-0.5">
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Layers</span>
        <span className="text-[10px] text-neutral-500">{elements.length}</span>
      </div>
      {reversed.length === 0 && (
        <p className="px-2 py-3 text-[11px] text-neutral-500 text-center">No elements yet</p>
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
            className={`flex items-center gap-1 px-1.5 py-1.5 rounded text-[11px] cursor-pointer transition-colors ${
              isDragging ? 'opacity-40' : ''
            } ${isOver ? 'ring-1 ring-blue-500' : ''} ${
              isSelected ? 'bg-blue-600/20 text-blue-300' : 'text-neutral-300 hover:bg-neutral-800'
            }`}
          >
            <GripVertical size={12} className="text-neutral-600 shrink-0 cursor-grab" />
            {elementIcon(el.type)}
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
                    className="p-0.5 text-neutral-600 hover:text-neutral-300"
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
                className="p-0.5 text-neutral-600 hover:text-neutral-300 disabled:opacity-20"
                disabled={isTop}
                aria-label="Send to front"
                title="Send to front"
              >
                <ChevronsUp size={11} />
              </button>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); if (!isTop) onReorder(realIdx, realIdx + 1) }}
                className="p-0.5 text-neutral-600 hover:text-neutral-300 disabled:opacity-20"
                disabled={isTop}
                aria-label="Move up"
                title="Bring forward"
              >
                <ChevronUp size={11} />
              </button>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); if (!isBottom) onReorder(realIdx, realIdx - 1) }}
                className="p-0.5 text-neutral-600 hover:text-neutral-300 disabled:opacity-20"
                disabled={isBottom}
                aria-label="Move down"
                title="Send backward"
              >
                <ChevronDown size={11} />
              </button>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); if (!isBottom) onReorder(realIdx, 0) }}
                className="p-0.5 text-neutral-600 hover:text-neutral-300 disabled:opacity-20"
                disabled={isBottom}
                aria-label="Send to back"
                title="Send to back"
              >
                <ChevronsDown size={11} />
              </button>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onUpdateElement(el.id, { locked: !el.locked }) }}
                className="p-0.5 ml-0.5 hover:text-white"
                aria-label={el.locked ? 'Unlock' : 'Lock'}
              >
                <Lock size={11} className={el.locked ? 'text-yellow-500' : 'text-neutral-600'} />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
