'use client'

import { useEffect } from 'react'
import type { MediaGalleryStrings } from '../../_shared/media/_i18n/types'

interface DeleteConfirmModalProps {
  open: boolean
  count: number
  usageCount: number
  onConfirm: () => void
  onCancel: () => void
  isLoading?: boolean
  t: MediaGalleryStrings
}

export function DeleteConfirmModal({ open, count, usageCount, onConfirm, onCancel, isLoading, t }: DeleteConfirmModalProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-confirm-title"
        className="mx-4 w-full max-w-sm rounded-xl border border-cms-border bg-cms-surface p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="delete-confirm-title" className="text-base font-semibold text-cms-text">{t.delete.confirmTitle}</h3>
        <p className="mt-2 text-sm text-cms-text-muted">{t.delete.confirmMessage}</p>
        {usageCount > 0 && (
          <div className="mt-3 rounded-md border border-orange-500/30 bg-orange-500/10 px-3 py-2">
            <p className="text-xs text-orange-400">
              {t.delete.usageWarning.replace('{count}', String(usageCount))}
            </p>
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-md border border-cms-border px-3 py-1.5 text-sm text-cms-text hover:bg-cms-surface-hover disabled:opacity-50"
          >
            {t.crop.cropCancel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
          >
            {isLoading ? t.delete.deleting : t.detail.deleteAsset}
          </button>
        </div>
      </div>
    </div>
  )
}
