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

  return (
    <div
      ref={ref}
      className="fixed z-[100] bg-neutral-900 border border-neutral-700 rounded-lg py-1 shadow-xl min-w-[180px]"
      style={{ left: x, top: y }}
      role="menu"
    >
      {items.map((item, i) => {
        if (item.separator) {
          return <div key={`sep-${i}`} className="border-t border-neutral-700 my-1" />
        }
        return (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => { item.onClick(); onClose() }}
            className="w-full flex items-center justify-between px-3 py-1.5 text-[12px] text-neutral-200 hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-default"
          >
            <span>{item.label}</span>
            {item.shortcut && (
              <span className="text-[10px] text-neutral-500 ml-4">{item.shortcut}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
