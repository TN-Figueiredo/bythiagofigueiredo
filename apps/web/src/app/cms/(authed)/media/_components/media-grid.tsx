'use client'

import { memo } from 'react'
import { MediaCard, type QuickAction } from './media-card'
import type { EnrichedMediaAsset, MediaColumnCount } from '../../_shared/media/types'
import type { MediaGalleryStrings } from '../../_shared/media/_i18n/types'
import { COL_CLASSES } from '../../_shared/media/constants'

interface MediaGridProps {
  items: EnrichedMediaAsset[]
  checked: Set<string>
  selectedId: string | null
  cols: MediaColumnCount
  searchQuery: string
  focusedIndex?: number
  onSelect: (id: string) => void
  onCheck: (id: string, shiftKey: boolean) => void
  onQuickAction: (id: string, action: QuickAction) => void
  onContextMenu?: (id: string, x: number, y: number) => void
  compact?: boolean
  t?: MediaGalleryStrings
}

export const MediaGrid = memo(function MediaGrid({
  items,
  checked,
  selectedId,
  cols,
  searchQuery,
  focusedIndex,
  onSelect,
  onCheck,
  onQuickAction,
  onContextMenu,
  compact,
  t,
}: MediaGridProps) {
  return (
    <div
      role="list"
      aria-label={t?.aria.mediaAssets ?? 'Media assets'}
      className={`grid gap-3 ${COL_CLASSES[cols]}`}
    >
      {items.map((enriched, index) => (
        <div
          key={enriched.asset.id}
          role="listitem"
          tabIndex={0}
          data-focus-index={index}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(enriched.asset.id) }
          }}
          onContextMenu={(e) => {
            if (onContextMenu) {
              e.preventDefault()
              onContextMenu(enriched.asset.id, e.clientX, e.clientY)
            }
          }}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cms-accent focus-visible:rounded-lg"
        >
          <MediaCard
            item={enriched.asset}
            type={enriched.type}
            checked={checked.has(enriched.asset.id)}
            selected={selectedId === enriched.asset.id}
            focused={focusedIndex === index}
            onSelect={onSelect}
            onCheck={onCheck}
            onQuickAction={onQuickAction}
            searchQuery={searchQuery}
            compact={compact}
            typeLabel={t?.typeLabels[enriched.type]}
            newBadgeLabel={t?.detail.newBadge}
            svgLabel={t?.detail.svgLabel}
            actionLabels={t ? { preview: t.context.preview, download: t.context.download, 'copy-url': t.context.copyUrl, delete: t.context.deleteAsset } : undefined}
          />
        </div>
      ))}
    </div>
  )
})
