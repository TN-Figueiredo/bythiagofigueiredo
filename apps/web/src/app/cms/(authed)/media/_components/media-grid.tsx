'use client'

import { MediaCard, type QuickAction } from './media-card'
import type { EnrichedMediaAsset, MediaColumnCount } from '../../_shared/media/types'
import type { MediaGalleryStrings } from '../../_shared/media/_i18n/types'

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

const COL_CLASSES: Record<MediaColumnCount, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-2 md:grid-cols-3',
  4: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
}

export function MediaGrid({
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
      role="grid"
      aria-label={t?.aria.mediaAssets ?? 'Media assets'}
      className={`grid gap-3 ${COL_CLASSES[cols]}`}
    >
      {items.map((enriched, index) => (
        <div
          key={enriched.asset.id}
          data-focus-index={index}
          onContextMenu={(e) => {
            if (onContextMenu) {
              e.preventDefault()
              onContextMenu(enriched.asset.id, e.clientX, e.clientY)
            }
          }}
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
          />
        </div>
      ))}
    </div>
  )
}
