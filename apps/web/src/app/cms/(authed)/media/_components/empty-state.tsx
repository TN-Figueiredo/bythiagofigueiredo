'use client'

import type { MediaAssetType } from '@/lib/media/types'
import type { MediaGalleryStrings } from '../../_shared/media/_i18n/types'

interface EmptyStateProps {
  filter: 'all' | MediaAssetType
  searchQuery: string
  t: MediaGalleryStrings
}

const FILTER_EMPTY_KEY: Record<string, keyof MediaGalleryStrings['empty']> = {
  all: 'noAssets',
  cover: 'noCovers',
  inline: 'noInline',
  avatar: 'noAvatars',
  og: 'noOg',
  orphan: 'noUnused',
}

export function EmptyState({ filter, searchQuery, t }: EmptyStateProps) {
  const message = searchQuery
    ? t.empty.noSearchResults.replace('{query}', searchQuery)
    : t.empty[FILTER_EMPTY_KEY[filter] ?? 'noAssets']

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="text-cms-text-dim">
        <rect x="6" y="10" width="36" height="28" rx="4" stroke="currentColor" strokeWidth="2" />
        <circle cx="18" cy="22" r="4" stroke="currentColor" strokeWidth="2" />
        <path d="M6 32l10-8 6 4 10-10 10 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <p className="text-sm text-cms-text-muted">{message}</p>
    </div>
  )
}
