'use client'

import { useState, useTransition } from 'react'
import type { SocialStrings } from '../_i18n/types'

interface BulkActionsBarProps {
  selectedIds: string[]
  strings: SocialStrings
  onDone: () => void
  onDeletePost?: (id: string) => Promise<{ ok: boolean }>
  onRetryPostDeliveries?: (id: string) => Promise<{ ok: boolean }>
}

export function BulkActionsBar({
  selectedIds,
  strings: t,
  onDone,
  onDeletePost,
  onRetryPostDeliveries,
}: BulkActionsBarProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleDelete() {
    if (!onDeletePost || !confirm(t.posts.bulk.deleteConfirm)) return
    setError(null)
    startTransition(async () => {
      try {
        await Promise.all(selectedIds.map(id => onDeletePost(id)))
        onDone()
      } catch {
        setError(t.common.error)
      }
    })
  }

  function handleRetry() {
    if (!onRetryPostDeliveries) return
    setError(null)
    startTransition(async () => {
      try {
        const results = await Promise.all(selectedIds.map(id => onRetryPostDeliveries!(id)))
        const failed = results.filter(r => !r.ok)
        if (failed.length > 0) setError(`${failed.length} falha(s) ao retentar`)
        onDone()
      } catch {
        setError(t.common.error)
      }
    })
  }

  if (selectedIds.length === 0) return null

  return (
    <div className="sticky bottom-4 z-10 space-y-2">
      {error && (
        <p role="alert" className="text-center text-sm text-red-400">{error}</p>
      )}
      <div className="flex items-center gap-3 rounded-lg border border-cms-border bg-cms-surface px-4 py-3 shadow-lg">
        <span role="status" className="text-sm text-cms-text-muted">{t.posts.selected.replace('{count}', String(selectedIds.length))}</span>
        <div className="flex-1" />
        <button type="button" onClick={handleRetry} disabled={isPending} aria-label="Retry selected posts" className="text-sm text-cms-accent hover:underline disabled:opacity-50">
          {t.posts.bulk.retry}
        </button>
        <button type="button" onClick={handleDelete} disabled={isPending} aria-label="Delete selected posts" className="text-sm text-red-400 hover:underline disabled:opacity-50">
          {t.posts.bulk.delete}
        </button>
      </div>
    </div>
  )
}
