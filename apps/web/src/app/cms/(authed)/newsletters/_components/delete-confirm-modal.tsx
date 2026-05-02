'use client'

import { useState, useRef, useEffect } from 'react'

interface DeleteConfirmModalProps {
  open: boolean
  title: string
  description: string
  impactLevel: 'low' | 'medium' | 'high'
  onConfirm: (confirmText?: string) => void
  onCancel: () => void
}

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

export function DeleteConfirmModal({ open, title, description, impactLevel, onConfirm, onCancel }: DeleteConfirmModalProps) {
  const [confirmText, setConfirmText] = useState('')
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const dialog = dialogRef.current
    if (!dialog) return

    const focusable = dialog.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
    focusable?.focus()

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCancel()
        return
      }
      if (e.key !== 'Tab') return
      const focusableEls = dialog!.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      const first = focusableEls[0]
      const last = focusableEls[focusableEls.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last?.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first?.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-confirm-title"
        className="w-full max-w-md rounded-xl bg-[#111827] border border-[#374151] p-6 shadow-2xl"
      >
        <h3 id="delete-confirm-title" className="text-lg font-semibold text-[#f3f4f6]">{title}</h3>
        <p className="mt-2 text-sm text-[#9ca3af]">{description}</p>

        {impactLevel === 'high' && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-[#f87171] mb-1">
              Type DELETE to confirm
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full rounded border border-[#7f1d1d] bg-[#0a0f1a] text-[#d1d5db] px-3 py-2 text-sm focus:border-red-500 focus:ring-red-500"
              placeholder="DELETE"
            />
          </div>
        )}

        {impactLevel === 'medium' && (
          <div className="mt-3 rounded bg-amber-500/10 border border-amber-500/20 px-3 py-2">
            <p className="text-xs text-[#f59e0b]">This edition has content or is scheduled. This action cannot be undone.</p>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-4 py-2 text-sm font-medium text-[#9ca3af] hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(impactLevel === 'high' ? confirmText : undefined)}
            disabled={impactLevel === 'high' && confirmText !== 'DELETE'}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
