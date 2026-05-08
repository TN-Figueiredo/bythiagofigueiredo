'use client'
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
