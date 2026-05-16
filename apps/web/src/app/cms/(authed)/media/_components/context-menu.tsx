'use client'

import { useEffect, useRef } from 'react'
import type { MediaGalleryStrings } from '../../_shared/media/_i18n/types'

interface ContextMenuProps {
  x: number
  y: number
  assetId: string
  onAction: (action: string) => void
  onClose: () => void
  t: MediaGalleryStrings
}

export function ContextMenu({ x, y, assetId, onAction, onClose, t }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const items = [
    { action: 'preview', label: t.context.preview },
    { action: 'download', label: t.context.download },
    { action: 'copy-url', label: t.context.copyUrl },
    { action: 'edit-alt', label: t.context.editAlt },
    { action: 'divider', label: '' },
    { action: 'delete', label: t.context.deleteAsset },
  ]

  return (
    <div
      ref={ref}
      role="menu"
      className="fixed z-50 min-w-[160px] rounded-lg border border-cms-border bg-cms-surface py-1 shadow-xl"
      style={{ left: x, top: y }}
      data-asset-id={assetId}
    >
      {items.map((item) =>
        item.action === 'divider' ? (
          <div key="divider" role="separator" className="my-1 h-px bg-cms-border" />
        ) : (
          <button
            key={item.action}
            type="button"
            role="menuitem"
            onClick={() => { onAction(item.action); onClose() }}
            className={`
              w-full px-3 py-1.5 text-left text-xs transition-colors focus:outline-none focus:bg-cms-surface-hover
              ${item.action === 'delete' ? 'text-red-400 hover:bg-red-500/10' : 'text-cms-text hover:bg-cms-surface-hover'}
            `}
          >
            {item.label}
          </button>
        ),
      )}
    </div>
  )
}
