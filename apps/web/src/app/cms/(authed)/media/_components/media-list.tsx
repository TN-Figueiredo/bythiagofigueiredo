'use client'

import { memo } from 'react'
import Image from 'next/image'
import type { EnrichedMediaAsset } from '../../_shared/media/types'
import { TYPE_COLORS, formatBytes } from '../../_shared/media/types'
import type { MediaGalleryStrings } from '../../_shared/media/_i18n/types'

interface MediaListProps {
  items: EnrichedMediaAsset[]
  checked: Set<string>
  selectedId: string | null
  focusedIndex?: number
  onSelect: (id: string) => void
  onCheck: (id: string, shiftKey: boolean) => void
  t?: MediaGalleryStrings
}

export const MediaList = memo(function MediaList({ items, checked, selectedId, focusedIndex, onSelect, onCheck, t }: MediaListProps) {
  return (
    <div role="list" className="flex flex-col gap-1">
      {items.map((enriched, index) => {
        const { asset, type } = enriched
        const colors = TYPE_COLORS[type]
        const isChecked = checked.has(asset.id)
        const isSelected = selectedId === asset.id
        const isFocused = focusedIndex === index
        const isSvg = asset.mimeType === 'image/svg+xml'

        return (
          <div
            key={asset.id}
            role="listitem"
            data-focus-index={index}
            tabIndex={0}
            onClick={() => onSelect(asset.id)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(asset.id) } }}
            className={`
              flex items-center gap-3 rounded-lg border-l-4 px-3 py-2 cursor-pointer transition-colors
              ${colors.border}
              ${isSelected ? 'bg-cms-accent/10 ring-1 ring-cms-accent' : 'bg-cms-surface hover:bg-cms-surface-hover'}
              ${isFocused ? 'ring-2 ring-offset-1 ring-cms-accent/50' : ''}
              ${isChecked ? 'bg-cms-accent/5' : ''}
            `}
          >
            <button
              type="button"
              role="checkbox"
              aria-checked={isChecked}
              aria-label={`Select ${asset.filename}`}
              onClick={(e) => { e.stopPropagation(); onCheck(asset.id, e.shiftKey) }}
              className={`
                flex min-h-6 min-w-6 shrink-0 items-center justify-center rounded border transition-colors
                ${isChecked ? 'border-cms-accent bg-cms-accent text-white' : 'border-cms-border hover:border-cms-accent'}
              `}
            >
              {isChecked && (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              )}
            </button>

            <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-cms-bg">
              {isSvg ? (
                <img src={asset.blobUrl} alt="" className="h-full w-full object-contain p-0.5" />
              ) : (
                <Image src={asset.blobUrl} alt="" width={40} height={40} className="h-full w-full object-cover" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-cms-text" title={asset.filename}>{asset.filename}</p>
            </div>

            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${colors.badge}`}>
              {t?.typeLabels[type] ?? colors.label}
            </span>

            <span className="shrink-0 text-xs text-cms-text-muted tabular-nums w-24 text-right">
              {asset.width && asset.height ? `${asset.width}×${asset.height}` : (t?.detail.svgLabel ?? 'SVG')}
            </span>

            <span className="shrink-0 text-xs text-cms-text-dim tabular-nums w-16 text-right">
              {formatBytes(asset.fileSize)}
            </span>
          </div>
        )
      })}
    </div>
  )
})
