'use client'

import { useEffect, useRef } from 'react'

interface ContextMenuItem {
  label: string
  onClick: () => void
  variant?: 'default' | 'danger'
}

interface ContextMenuProps {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (rect.right > window.innerWidth) el.style.left = `${window.innerWidth - rect.width - 8}px`
    if (rect.bottom > window.innerHeight) el.style.top = `${window.innerHeight - rect.height - 8}px`
  }, [x, y])

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[160px] rounded-xl border border-white/10 bg-[#14141f] p-1 shadow-2xl shadow-black/60"
      style={{ left: x, top: y }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          type="button"
          onClick={() => {
            item.onClick()
            onClose()
          }}
          className={`flex w-full rounded-lg px-3 py-1.5 text-left text-xs transition-colors ${
            item.variant === 'danger'
              ? 'text-red-400 hover:bg-red-500/10'
              : 'text-white/70 hover:bg-white/5'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
