'use client'
import { useState, useRef, useEffect } from 'react'
import { Pencil, Check, X } from 'lucide-react'
import type { CardComposition, CardElement } from '@tn-figueiredo/links/qr'
import { QrInspector } from './qr-inspector'
import { TextInspector } from './text-inspector'
import { ShapeInspector, isShapeElement } from './shape-inspector'
import { ImageInspector } from './image-inspector'
import { GifInspector } from './gif-inspector'
import { StampInspector, isStampElement } from './stamp-inspector'
import { ButtonInspector, isButtonElement } from './button-inspector'
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
    case 'text': return el.content.startsWith('__shape:') ? 'Forma' : (el.content.slice(0, 20) || 'Texto')
    case 'image': return 'Imagem'
    default: return 'Elemento'
  }
}

const asideStyle: React.CSSProperties = {
  width: 244,
  flexShrink: 0,
  padding: 12,
  overflowY: 'auto',
  background: 'var(--bg-side)',
  borderLeft: '1px solid var(--line)',
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 12 }}>
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
          style={{
            flex: 1, borderRadius: 4, padding: '4px 8px', fontSize: 14, outline: 'none',
            background: 'var(--surface-2)', border: '1px solid var(--accent)', color: 'var(--ink)',
          }}
          maxLength={40}
        />
        <button
          type="button"
          onClick={() => {
            const v = inputRef.current?.value.trim()
            if (v) onUpdate({ name: v })
            setEditing(false)
          }}
          style={{ padding: 4, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--green)' }}
        >
          <Check size={14} />
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          style={{ padding: 4, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--ink-dim)' }}
        >
          <X size={14} />
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }} className="group">
      <h3 style={{
        fontSize: 14, fontWeight: 500, flex: 1,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        color: 'var(--ink)', margin: 0,
      }}>
        {displayName}
      </h3>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ padding: 4, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--ink-faint)' }}
        title="Renomear"
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
      <aside style={asideStyle}>
        <p style={{ fontSize: 11, textAlign: 'center', marginTop: 32, color: 'var(--ink-dim)' }}>
          Selecione um elemento para editar
        </p>
      </aside>
    )
  }

  if (selectedElements.length > 1) {
    return (
      <aside style={asideStyle}>
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
    <aside style={asideStyle}>
      <ElementNameHeader element={element} onUpdate={patch => onUpdateElement(element.id, patch)} />
      {element.type === 'qr' && (
        <QrInspector
          element={element}
          shortUrl={shortUrl}
          linkCode={linkCode}
          onUpdate={patch => onUpdateElement(element.id, patch)}
          onDuplicate={() => {/* handled by parent */}}
          onDelete={() => onRemoveElement(element.id)}
        />
      )}
      {element.type === 'text' && isShapeElement(element) && (
        <ShapeInspector
          element={element}
          onUpdate={patch => onUpdateElement(element.id, patch)}
          onDuplicate={() => {/* handled by parent */}}
          onDelete={() => onRemoveElement(element.id)}
        />
      )}
      {element.type === 'text' && isButtonElement(element) && (
        <ButtonInspector
          element={element}
          onUpdate={patch => onUpdateElement(element.id, patch)}
          onDuplicate={() => {/* handled by parent */}}
          onDelete={() => onRemoveElement(element.id)}
        />
      )}
      {element.type === 'text' && !isShapeElement(element) && !isButtonElement(element) && (
        <TextInspector
          element={element}
          onUpdate={patch => onUpdateElement(element.id, patch)}
        />
      )}
      {element.type === 'image' && isStampElement(element) && (
        <StampInspector
          element={element}
          onUpdate={patch => onUpdateElement(element.id, patch)}
          onDuplicate={() => {/* handled by parent */}}
          onDelete={() => onRemoveElement(element.id)}
        />
      )}
      {element.type === 'image' && !isStampElement(element) && (
        (element.name?.includes('GIF') || element.src?.endsWith('.gif'))
          ? (
            <GifInspector
              element={element}
              onUpdate={patch => onUpdateElement(element.id, patch)}
              onReplaceImage={() => onReplaceImage(element.id)}
              onDuplicate={() => {/* handled by parent */}}
              onDelete={() => onRemoveElement(element.id)}
            />
          )
          : (
            <ImageInspector
              element={element}
              onUpdate={patch => onUpdateElement(element.id, patch)}
              onReplaceImage={() => onReplaceImage(element.id)}
            />
          )
      )}
    </aside>
  )
}
