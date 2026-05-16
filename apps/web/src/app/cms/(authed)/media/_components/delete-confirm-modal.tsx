'use client'

import { useEffect, useRef } from 'react'
import type { MediaGalleryStrings } from '../../_shared/media/_i18n/types'

interface DeleteConfirmModalProps {
  open: boolean
  count: number
  usageCount: number
  onConfirm: () => void
  onCancel: () => void
  isLoading?: boolean
  error?: string | null
  t: MediaGalleryStrings
}

export function DeleteConfirmModal({ open, count, usageCount, onConfirm, onCancel, isLoading, error, t }: DeleteConfirmModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onCancel])

  useEffect(() => {
    if (!open) return
    cancelRef.current?.focus()
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onCancel}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-confirm-title"
        aria-describedby="delete-confirm-desc"
        className="mx-4 w-full max-w-sm rounded-xl border border-cms-border bg-cms-surface p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="delete-confirm-title" className="text-base font-semibold text-cms-text">{t.delete.confirmTitle}</h3>
        <p id="delete-confirm-desc" className="mt-2 text-sm text-cms-text-muted">{t.delete.confirmMessage}</p>
        {usageCount > 0 && (
          <div className="mt-3 rounded-md border border-orange-500/30 bg-orange-500/10 px-3 py-2">
            <p className="text-xs text-orange-400">
              {t.delete.usageWarning.replace('{count}', String(usageCount))}
            </p>
          </div>
        )}
        {error && (
          <p className="mt-3 text-sm text-red-400" role="alert">{error}</p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-md border border-cms-border px-3 py-1.5 text-sm text-cms-text hover:bg-cms-surface-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t.delete.cancel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? t.delete.deleting : t.detail.deleteAsset}
          </button>
        </div>
      </div>
    </div>
  )
}
