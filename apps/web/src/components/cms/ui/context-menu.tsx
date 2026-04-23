'use client'

import { useEffect, useRef, type ReactNode } from 'react'

interface ContextMenuProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  className?: string
}

export function ContextMenu({ open, onClose, children, className = '' }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
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
  }, [open, onClose])

  if (!open) return null
  return (
    <div ref={ref} role="menu" className={`bg-cms-surface border border-cms-border rounded-[10px] p-1 min-w-[200px] shadow-[0_8px_24px_rgba(0,0,0,.4)] z-50 ${className}`}>
      {children}
    </div>
  )
}

interface ContextMenuItemProps {
  icon?: string
  label: string
  danger?: boolean
  disabled?: boolean
  onClick?: () => void
}

export function ContextMenuItem({ icon, label, danger, disabled, onClick }: ContextMenuItemProps) {
  return (
    <button
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={`flex items-center gap-2 w-full px-3 py-2 text-[13px] rounded-md transition-colors duration-100
        ${danger ? 'text-cms-red hover:bg-cms-red-subtle' : 'text-cms-text-muted hover:bg-cms-surface-hover hover:text-cms-text'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      {icon && <span className="w-4 text-center text-sm">{icon}</span>}
      <span>{label}</span>
    </button>
  )
}

export function ContextMenuDivider() {
  return <div className="h-px bg-cms-border my-1" />
}
