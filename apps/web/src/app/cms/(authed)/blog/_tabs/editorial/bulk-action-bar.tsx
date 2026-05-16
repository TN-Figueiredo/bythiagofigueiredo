'use client'

import { memo } from 'react'
import { X } from 'lucide-react'
import type { BlogHubStrings } from '../../_i18n/types'

interface BulkActionBarProps {
  count: number
  cardType: 'pipeline' | 'post'
  strings?: BlogHubStrings
  onMoveToStage?: (stage: string) => void
  onPromoteAll?: () => void
  onPublishAll?: () => void
  onArchiveAll?: () => void
  onDeleteAll?: () => void
  onClear: () => void
  allInReady?: boolean
}

export const BulkActionBar = memo(function BulkActionBar({
  count,
  cardType,
  strings,
  onMoveToStage,
  onPromoteAll,
  onPublishAll,
  onArchiveAll,
  onDeleteAll,
  onClear,
  allInReady,
}: BulkActionBarProps) {
  const s = strings?.bulk

  if (count === 0) {
    return (
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {''}
      </span>
    )
  }

  return (
    <>
    <span className="sr-only" aria-live="polite" aria-atomic="true">
      {`${count} ${s?.selected ?? 'selected'}`}
    </span>
    <div
      role="group"
      aria-label={`${count} ${s?.selected ?? 'selected'}`}
      className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 flex items-center gap-2 rounded-xl border border-gray-700 bg-gray-900 px-4 py-2.5 shadow-2xl"
    >
      <span className="text-[12px] font-semibold text-gray-300">
        {count} {s?.selected ?? 'selected'}
      </span>

      <div className="mx-2 h-4 w-px bg-gray-700" aria-hidden="true" />

      {cardType === 'pipeline' && (
        <>
          <button
            onClick={() => onMoveToStage?.('idea')}
            disabled={onMoveToStage === undefined}
            className="rounded-lg px-2.5 py-1 text-[11px] text-gray-300 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {strings?.editorial?.idea ?? 'Idea'}
          </button>
          <button
            onClick={() => onMoveToStage?.('draft')}
            disabled={onMoveToStage === undefined}
            className="rounded-lg px-2.5 py-1 text-[11px] text-gray-300 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {strings?.editorial?.draft ?? 'Draft'}
          </button>
          <button
            onClick={() => onMoveToStage?.('ready')}
            disabled={onMoveToStage === undefined}
            className="rounded-lg px-2.5 py-1 text-[11px] text-gray-300 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {strings?.editorial?.ready ?? 'Ready'}
          </button>
          {allInReady && (
            <button
              onClick={onPromoteAll}
              disabled={onPromoteAll === undefined}
              className="rounded-lg bg-indigo-500/20 px-2.5 py-1 text-[11px] font-medium text-indigo-400 hover:bg-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {s?.promoteAll ?? 'Promote all'}
            </button>
          )}
          <button
            onClick={onArchiveAll}
            disabled={onArchiveAll === undefined}
            className="rounded-lg px-2.5 py-1 text-[11px] text-gray-400 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {s?.archiveAll ?? 'Archive'}
          </button>
        </>
      )}

      {cardType === 'post' && (
        <>
          <button
            onClick={onPublishAll}
            disabled={onPublishAll === undefined}
            className="rounded-lg bg-emerald-500/20 px-2.5 py-1 text-[11px] font-medium text-emerald-400 hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {s?.publishAll ?? 'Publish'}
          </button>
          <button
            onClick={onArchiveAll}
            disabled={onArchiveAll === undefined}
            className="rounded-lg px-2.5 py-1 text-[11px] text-gray-400 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {s?.archiveAll ?? 'Archive'}
          </button>
          <button
            onClick={onDeleteAll}
            disabled={onDeleteAll === undefined}
            className="rounded-lg px-2.5 py-1 text-[11px] text-red-400 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {s?.deleteAll ?? 'Delete'}
          </button>
        </>
      )}

      <div className="mx-1 h-4 w-px bg-gray-700" aria-hidden="true" />

      <button
        onClick={onClear}
        className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-gray-500 hover:text-gray-300"
        aria-label={s?.clearSelection ?? 'Clear selection'}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
    </>
  )
})
