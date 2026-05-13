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
      await Promise.all(selectedIds.map(id => deleteSocialPost(id)))
      onDone()
    })
  }

  function handleRetry() {
    startTransition(async () => {
      onDone()
    })
  }

  if (selectedIds.length === 0) return null

  return (
    <div className="sticky bottom-4 z-10 flex items-center gap-3 rounded-lg border border-cms-border bg-cms-surface px-4 py-3 shadow-lg">
      <span className="text-sm text-cms-text-muted">{selectedIds.length} selected</span>
      <div className="flex-1" />
      <button type="button" onClick={handleRetry} disabled={isPending} className="text-sm text-cms-accent hover:underline disabled:opacity-50">
        {t.posts.bulk.retry}
      </button>
      <button type="button" onClick={handleDelete} disabled={isPending} className="text-sm text-red-400 hover:underline disabled:opacity-50">
        {t.posts.bulk.delete}
      </button>
    </div>
  )
}
