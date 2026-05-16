'use client'

import { MediaCard, type QuickAction } from './media-card'
import type { EnrichedMediaAsset, MediaColumnCount } from '../../_shared/media/types'

interface MediaGridProps {
  items: EnrichedMediaAsset[]
  checked: Set<string>
  selectedId: string | null
  cols: MediaColumnCount
  searchQuery: string
  onSelect: (id: string) => void
  onCheck: (id: string, shiftKey: boolean) => void
  onQuickAction: (id: string, action: QuickAction) => void
  onContextMenu?: (id: string, x: number, y: number) => void
  compact?: boolean
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
  onSelect,
  onCheck,
  onQuickAction,
  onContextMenu,
  compact,
}: MediaGridProps) {
  return (
    <div
      role="grid"
      aria-label="Media assets"
      className={`grid gap-3 ${COL_CLASSES[cols]}`}
    >
      {items.map((enriched) => (
        <div
          key={enriched.asset.id}
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
            onSelect={onSelect}
            onCheck={onCheck}
            onQuickAction={onQuickAction}
            searchQuery={searchQuery}
            compact={compact}
          />
        </div>
      ))}
    </div>
  )
}
