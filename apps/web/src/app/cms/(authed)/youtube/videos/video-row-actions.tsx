'use client'

import { useTransition } from 'react'
import { updateVideo, approveCategory, rejectCategory } from './actions'

interface CategoryBadgeProps {
  videoId: string
  categoryId: string | null
  suggestedCategoryId: string | null
  suggestedCategoryName: string | null
  categoryName: string | null
  categoryColor: string | null
}

export function CategoryBadge({
  videoId,
  categoryId,
  suggestedCategoryId,
  suggestedCategoryName,
  categoryName,
  categoryColor,
}: CategoryBadgeProps) {
  const [isPending, startTransition] = useTransition()

  if (suggestedCategoryId && !categoryId) {
    return (
      <div className="flex flex-col gap-1">
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-amber-900/30 text-amber-400">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2a10 10 0 100 20A10 10 0 0012 2zm0 15a1 1 0 110-2 1 1 0 010 2zm1-4H11V7h2v6z" />
          </svg>
          {suggestedCategoryName ?? 'Suggested'}
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            disabled={isPending}
            onClick={() => startTransition(async () => { await approveCategory(videoId) })}
            className="rounded px-1.5 py-0.5 text-xs font-medium bg-emerald-900/40 text-emerald-400 hover:bg-emerald-900/70 disabled:opacity-50"
          >
            Approve
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => startTransition(async () => { await rejectCategory(videoId) })}
            className="rounded px-1.5 py-0.5 text-xs font-medium bg-red-900/40 text-red-400 hover:bg-red-900/70 disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      </div>
    )
  }

  if (!categoryId) {
    return (
      <span className="text-xs text-cms-text-dim">—</span>
    )
  }

  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white"
      style={{ backgroundColor: categoryColor ?? '#6366f1' }}
    >
      {categoryName ?? categoryId.slice(0, 8)}
    </span>
  )
}

interface FeaturedToggleProps {
  videoId: string
  isFeatured: boolean
}

export function FeaturedToggle({ videoId, isFeatured }: FeaturedToggleProps) {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => { await updateVideo({ id: videoId, is_featured: !isFeatured }) })
      }
      title={isFeatured ? 'Remove from featured' : 'Mark as featured'}
      className={`flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${
        isFeatured ? 'bg-cms-accent' : 'bg-cms-surface-hover'
      }`}
      aria-label={isFeatured ? 'Featured (click to remove)' : 'Not featured (click to feature)'}
    >
      <span
        className={`h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
          isFeatured ? 'translate-x-4' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

interface HiddenToggleProps {
  videoId: string
  isHidden: boolean
}

export function HiddenToggle({ videoId, isHidden }: HiddenToggleProps) {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => { await updateVideo({ id: videoId, is_hidden: !isHidden }) })
      }
      title={isHidden ? 'Unhide video' : 'Hide video from public page'}
      className={`flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${
        isHidden ? 'bg-amber-600' : 'bg-cms-surface-hover'
      }`}
      aria-label={isHidden ? 'Hidden (click to show)' : 'Visible (click to hide)'}
    >
      <span
        className={`h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
          isHidden ? 'translate-x-4' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

interface SyncButtonProps {
  onSync: () => Promise<void>
}

export function SyncButton({ onSync }: SyncButtonProps) {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(onSync)}
      className="inline-flex items-center gap-2 rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface px-4 py-2 text-sm font-medium text-cms-text hover:bg-cms-surface-hover disabled:opacity-60"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
        className={isPending ? 'animate-spin' : ''}
      >
        <path d="M21 2v6h-6" />
        <path d="M3 12a9 9 0 0115-6.7L21 8M3 22v-6h6" />
        <path d="M21 12a9 9 0 01-15 6.7L3 16" />
      </svg>
      {isPending ? 'Syncing…' : 'Sync Now'}
    </button>
  )
}
