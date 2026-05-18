'use client'
import type { CardComposition, CardElement } from '@tn-figueiredo/links/qr'
import { TextInspector } from '@tn-figueiredo/links-admin/qr-card-builder/text-inspector'
import { ImageInspector } from '@tn-figueiredo/links-admin/qr-card-builder/image-inspector'
import { MultiInspector } from '@tn-figueiredo/links-admin/qr-card-builder/multi-inspector'

interface SocialRightPanelProps {
  composition: CardComposition
  selectedIds: Set<string>
  onUpdateElement: (id: string, patch: Partial<CardElement>) => void
  onRemoveElement: (id: string) => void
  onReplaceImage: (elementId: string) => void
}

export function SocialRightPanel({
  composition, selectedIds,
  onUpdateElement, onRemoveElement, onReplaceImage,
}: SocialRightPanelProps) {
  const selectedElements = composition.elements.filter(el => selectedIds.has(el.id))

  if (selectedElements.length === 0) {
    return (
      <aside className="w-[280px] shrink-0 bg-neutral-900 border-l border-neutral-800 p-3 overflow-y-auto">
        <div className="mt-8 text-center">
          <p className="text-[11px] text-neutral-500">Select an element to edit its properties</p>
          <p className="text-[10px] text-neutral-600 mt-2">Tip: Use the left panel to add text, images, or load a template</p>
        </div>
      </aside>
    )
  }

  if (selectedElements.length > 1) {
    return (
      <aside className="w-[280px] shrink-0 bg-neutral-900 border-l border-neutral-800 p-3 overflow-y-auto">
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
    <aside className="w-[280px] shrink-0 bg-neutral-900 border-l border-neutral-800 p-3 overflow-y-auto">
      <h3 className="text-sm font-medium text-neutral-200 truncate mb-3">
        {element.name || (element.type === 'text' ? 'Text' : 'Image')}
      </h3>
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
