'use client'
import { useEffect, useRef } from 'react'

export interface ContextMenuItem {
  label: string
  shortcut?: string
  onClick: () => void
  disabled?: boolean
  separator?: false
}

export interface ContextMenuSeparator {
  separator: true
}

export type ContextMenuEntry = ContextMenuItem | ContextMenuSeparator

interface ContextMenuProps {
  x: number
  y: number
  items: ContextMenuEntry[]
  onClose: () => void
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const maxX = window.innerWidth - rect.width - 4
    const maxY = window.innerHeight - rect.height - 4
    if (x > maxX || y > maxY) {
      el.style.left = `${Math.max(4, Math.min(x, maxX))}px`
      el.style.top = `${Math.max(4, Math.min(y, maxY))}px`
    }
  }, [x, y])

  return (
    <div
      ref={ref}
      className="fixed z-[100] rounded-lg py-1 shadow-xl min-w-[180px]"
      style={{ left: x, top: y, background: 'var(--bg-side)', border: '1px solid var(--line)' }}
      role="menu"
    >
      {items.map((item, i) => {
        if (item.separator) {
          return <div key={`sep-${i}`} className="my-1" style={{ borderTop: '1px solid var(--line)' }} />
        }
        return (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => { item.onClick(); onClose() }}
            className="w-full flex items-center justify-between px-3 py-1.5 text-[12px] disabled:opacity-40 disabled:cursor-default"
            style={{ color: 'var(--ink)' }}
            onMouseEnter={e => { if (!item.disabled) (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >
            <span>{item.label}</span>
            {item.shortcut && (
              <span className="text-[10px] ml-4" style={{ color: 'var(--ink-dim)' }}>{item.shortcut}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
