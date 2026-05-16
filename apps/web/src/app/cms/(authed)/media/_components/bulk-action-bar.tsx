'use client'

import type { MediaGalleryStrings } from '../../_shared/media/_i18n/types'

interface BulkActionBarProps {
  count: number
  onDeselect: () => void
  onDownload: () => void
  onDelete: () => void
  t: MediaGalleryStrings
}

export function BulkActionBar({ count, onDeselect, onDownload, onDelete, t }: BulkActionBarProps) {
  if (count === 0) return null

  return (
    <div role="status" aria-live="polite" className="fixed bottom-6 left-1/2 z-30 -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-xl border border-cms-border bg-cms-surface px-4 py-2.5 shadow-2xl">
        <span className="text-sm font-medium text-cms-text tabular-nums">
          {t.bulk.selected.replace('{count}', String(count))}
        </span>
        <button
          type="button"
          onClick={onDeselect}
          className="text-xs text-cms-accent hover:underline"
        >
          {t.bulk.deselect}
        </button>

        <div className="h-4 w-px bg-cms-border" />

        <button
          type="button"
          onClick={onDownload}
          className="rounded-md bg-cms-bg px-3 py-1.5 text-xs font-medium text-cms-text hover:bg-cms-surface-hover"
        >
          {t.bulk.download}
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-md bg-red-500/15 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/25"
        >
          {t.bulk.deleteSelected}
        </button>
      </div>
    </div>
  )
}
