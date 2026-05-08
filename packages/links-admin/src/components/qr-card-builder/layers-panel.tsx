'use client'
import { useCallback } from 'react'
import { GripVertical, Lock, Type, Image, QrCode } from 'lucide-react'
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
  switch (el.type) {
    case 'qr': return 'QR Code'
    case 'text': return el.content.slice(0, 20) || 'Text'
    case 'image': return 'Image'
  }
}

export function LayersPanel({ elements, selectedIds, onSelect, onReorder, onUpdateElement }: LayersPanelProps) {
  const handleMoveUp = useCallback((idx: number) => {
    if (idx < elements.length - 1) onReorder(idx, idx + 1)
  }, [elements.length, onReorder])

  const handleMoveDown = useCallback((idx: number) => {
    if (idx > 0) onReorder(idx, idx - 1)
  }, [onReorder])

  const handleKeyDown = useCallback((e: React.KeyboardEvent, idx: number) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); handleMoveUp(idx) }
    if (e.key === 'ArrowDown') { e.preventDefault(); handleMoveDown(idx) }
  }, [handleMoveUp, handleMoveDown])

  const reversed = [...elements].reverse()

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Layers</span>
        <span className="text-[10px] text-neutral-500">{elements.length}</span>
      </div>
      {reversed.length === 0 && (
        <p className="px-2 py-3 text-[11px] text-neutral-500 text-center">No elements yet</p>
      )}
      {reversed.map((el) => {
        const realIdx = elements.indexOf(el)
        const isSelected = selectedIds.has(el.id)
        return (
          <div
            key={el.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(el.id)}
            onKeyDown={e => handleKeyDown(e, realIdx)}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-[11px] cursor-pointer ${
              isSelected ? 'bg-blue-600/20 text-blue-300' : 'text-neutral-300 hover:bg-neutral-800'
            }`}
          >
            <GripVertical size={12} className="text-neutral-600 shrink-0 cursor-grab" />
            {elementIcon(el.type)}
            <span className="flex-1 truncate">{elementLabel(el)}</span>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onUpdateElement(el.id, { locked: !el.locked }) }}
              className="p-0.5 hover:text-white"
              aria-label={el.locked ? 'Unlock' : 'Lock'}
            >
              <Lock size={11} className={el.locked ? 'text-yellow-500' : 'text-neutral-600'} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
