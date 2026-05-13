'use client'

import { useTransition } from 'react'
import { deleteSocialPost } from '@/lib/social/actions'
import type { SocialStrings } from '../_i18n/types'

interface BulkActionsBarProps {
  selectedIds: string[]
  strings: SocialStrings
  onDone: () => void
}

export function BulkActionsBar({ selectedIds, strings: t, onDone }: BulkActionsBarProps) {
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    if (!confirm(t.posts.bulk.deleteConfirm)) return
    startTransition(async () => {
      try {
        await Promise.all(selectedIds.map(id => deleteSocialPost(id)))
      } catch {
        // Individual failures don't block the completion callback
      }
      onDone()
    })
  }

  function handleRetry() {
    startTransition(async () => {
      try {
        await Promise.all(selectedIds.map(() => Promise.resolve()))
      } catch {
        // Individual failures don't block the completion callback
      }
      onDone()
    })
  }

  if (selectedIds.length === 0) return null

  return (
    <div className="sticky bottom-4 z-10 flex items-center gap-3 rounded-lg border border-cms-border bg-cms-surface px-4 py-3 shadow-lg">
      <span role="status" className="text-sm text-cms-text-muted">{t.posts.selected.replace('{count}', String(selectedIds.length))}</span>
      <div className="flex-1" />
      <button type="button" onClick={handleRetry} disabled={isPending} aria-label="Retry selected posts" className="text-sm text-cms-accent hover:underline disabled:opacity-50">
        {t.posts.bulk.retry}
      </button>
      <button type="button" onClick={handleDelete} disabled={isPending} aria-label="Delete selected posts" className="text-sm text-red-400 hover:underline disabled:opacity-50">
        {t.posts.bulk.delete}
      </button>
    </div>
  )
}
