'use client'

import React, { useEffect, useRef } from 'react'
import type { MediaGalleryStrings } from '../../_shared/media/_i18n/types'

interface KeyboardHelpProps {
  open: boolean
  onClose: () => void
  t: MediaGalleryStrings
}

interface ShortcutEntry {
  key: string
  description: string
}

export const KeyboardHelp = React.memo(function KeyboardHelp({ open, onClose, t }: KeyboardHelpProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<Element | null>(null)

  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement
    }
    return () => {
      if (open) {
        ;(previousFocusRef.current as HTMLElement | null)?.focus()
      }
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const dialog = dialogRef.current
    if (!dialog) return
    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const focusable = dialog.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
      if (!focusable.length) return
      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', trap)
    return () => document.removeEventListener('keydown', trap)
  }, [open])

  if (!open) return null

  const shortcuts: ShortcutEntry[] = [
    { key: '⌘K', description: t.shortcuts.search.replace('⌘K — ', '') },
    { key: '↑↓←→', description: t.shortcuts.navigate.replace('↑↓←→ — ', '') },
    { key: 'Space', description: t.shortcuts.toggleSelect.replace(/^(Space|Espaço) — /, '') },
    { key: 'Enter', description: t.shortcuts.openDetail.replace('Enter — ', '') },
    { key: 'Delete', description: t.shortcuts.deleteKey.replace('Delete — ', '') },
    { key: 'Esc', description: t.shortcuts.escape.replace('Esc — ', '') },
    { key: 'Shift+Click', description: t.shortcuts.rangeSelect.replace(/^Shift\+Cli(ck|que) — /, '') },
    { key: '?', description: t.shortcuts.showShortcuts.replace('? — ', '') },
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="keyboard-help-title"
        className="mx-4 w-full max-w-md rounded-xl border border-cms-border bg-cms-surface p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 id="keyboard-help-title" className="text-base font-semibold text-cms-text">
            {t.shortcuts.title}
          </h3>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded-md border border-cms-border px-2 py-1 text-xs text-cms-text-muted hover:bg-cms-surface-hover"
          >
            {t.modal.close}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
          {shortcuts.map((s) => (
            <React.Fragment key={s.key}>
              <kbd className="inline-flex items-center justify-center rounded-md border border-cms-border bg-cms-surface-hover px-2 py-0.5 font-mono text-xs text-cms-text">
                {s.key}
              </kbd>
              <span className="text-sm text-cms-text-muted">{s.description}</span>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  )
})
