'use client'

import { useEffect, useRef, useState } from 'react'
import type { MediaGalleryStrings } from '../../_shared/media/_i18n/types'

interface ContextMenuProps {
  x: number
  y: number
  assetId: string
  onAction: (action: 'preview' | 'download' | 'copy-url' | 'edit-alt' | 'delete') => void
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
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'Tab') { e.preventDefault(); onClose(); return }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Home' || e.key === 'End') {
        e.preventDefault()
        const buttons = ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]')
        if (!buttons?.length) return
        const active = document.activeElement as HTMLElement
        const idx = Array.from(buttons).indexOf(active)
        let next: number
        if (e.key === 'ArrowDown') next = idx < buttons.length - 1 ? idx + 1 : 0
        else if (e.key === 'ArrowUp') next = idx > 0 ? idx - 1 : buttons.length - 1
        else if (e.key === 'Home') next = 0
        else next = buttons.length - 1
        buttons[next]?.focus()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    const firstItem = ref.current?.querySelector<HTMLElement>('[role="menuitem"]')
    firstItem?.focus()
  }, [])

  const [pos, setPos] = useState({ left: x, top: y })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const newPos = { left: x, top: y }
    if (rect.right > window.innerWidth) newPos.left = window.innerWidth - rect.width - 8
    if (rect.bottom > window.innerHeight) newPos.top = window.innerHeight - rect.height - 8
    if (newPos.left !== x || newPos.top !== y) setPos(newPos)
  }, [x, y])

  type ContextAction = 'preview' | 'download' | 'copy-url' | 'edit-alt' | 'delete'
  const items: Array<{ action: ContextAction | 'divider'; label: string }> = [
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
      style={{ left: pos.left, top: pos.top }}
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
            onClick={() => { onAction(item.action as ContextAction); onClose() }}
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
