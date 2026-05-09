'use client'
import { useState, useRef, useEffect } from 'react'
import { Pencil, Check, X } from 'lucide-react'
import type { CardComposition, CardElement } from '@tn-figueiredo/links/qr'
import { QrInspector } from './qr-inspector'
import { TextInspector } from './text-inspector'
import { ImageInspector } from './image-inspector'
import { MultiInspector } from './multi-inspector'

interface RightPanelProps {
  composition: CardComposition
  selectedIds: Set<string>
  shortUrl: string
  linkCode: string
  onUpdateElement: (id: string, patch: Partial<CardElement>) => void
  onRemoveElement: (id: string) => void
  onReplaceImage: (elementId: string) => void
}

function defaultLabel(el: CardElement): string {
  switch (el.type) {
    case 'qr': return 'QR Code'
    case 'text': return el.content.slice(0, 20) || 'Text'
    case 'image': return 'Image'
  }
}

function ElementNameHeader({ element, onUpdate }: { element: CardElement; onUpdate: (patch: Partial<CardElement>) => void }) {
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const displayName = element.name || defaultLabel(element)

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  if (editing) {
    return (
      <div className="flex items-center gap-1 mb-3">
        <input
          ref={inputRef}
          autoFocus
          defaultValue={displayName}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              const v = (e.target as HTMLInputElement).value.trim()
              if (v) onUpdate({ name: v })
              setEditing(false)
            }
            if (e.key === 'Escape') setEditing(false)
          }}
          className="flex-1 bg-neutral-800 border border-blue-500 rounded px-2 py-1 text-sm text-neutral-100 outline-none"
          maxLength={40}
        />
        <button
          type="button"
          onClick={() => {
            const v = inputRef.current?.value.trim()
            if (v) onUpdate({ name: v })
            setEditing(false)
          }}
          className="p-1 text-green-400 hover:text-green-300"
        >
          <Check size={14} />
        </button>
        <button type="button" onClick={() => setEditing(false)} className="p-1 text-neutral-500 hover:text-neutral-300">
          <X size={14} />
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5 mb-3 group">
      <h3 className="text-sm font-medium text-neutral-200 truncate flex-1">{displayName}</h3>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="p-1 text-neutral-600 hover:text-neutral-300 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Rename"
      >
        <Pencil size={12} />
      </button>
    </div>
  )
}

export function RightPanel({
  composition, selectedIds, shortUrl, linkCode,
  onUpdateElement, onRemoveElement, onReplaceImage,
}: RightPanelProps) {
  const selectedElements = composition.elements.filter(el => selectedIds.has(el.id))

  if (selectedElements.length === 0) {
    return (
      <aside className="w-[244px] shrink-0 bg-neutral-900 border-l border-neutral-800 p-3 overflow-y-auto">
        <p className="text-[11px] text-neutral-500 text-center mt-8">Select an element to edit its properties</p>
      </aside>
    )
  }

  if (selectedElements.length > 1) {
    return (
      <aside className="w-[244px] shrink-0 bg-neutral-900 border-l border-neutral-800 p-3 overflow-y-auto">
        <MultiInspector
          elements={selectedElements}
          onUpdateAll={patch => selectedElements.forEach(el => onUpdateElement(el.id, patch))}
          onDeleteAll={() => selectedElements.forEach(el => onRemoveElement(el.id))}
          onLockAll={() => selectedElements.forEach(el => onUpdateElement(el.id, { locked: true }))}
          onAlign={() => {}}
        />
      </aside>
    )
  }

  const element = selectedElements[0]!

  return (
    <aside className="w-[244px] shrink-0 bg-neutral-900 border-l border-neutral-800 p-3 overflow-y-auto">
      <ElementNameHeader element={element} onUpdate={patch => onUpdateElement(element.id, patch)} />
      {element.type === 'qr' && (
        <QrInspector
          element={element}
          shortUrl={shortUrl}
          linkCode={linkCode}
          onUpdate={patch => onUpdateElement(element.id, patch)}
        />
      )}
      {element.type === 'text' && (
        <TextInspector
          element={element}
          onUpdate={patch => onUpdateElement(element.id, patch)}
        />
      )}
      {element.type === 'image' && (
        <ImageInspector
          element={element}
          onUpdate={patch => onUpdateElement(element.id, patch)}
          onReplaceImage={() => onReplaceImage(element.id)}
        />
      )}
    </aside>
  )
}
