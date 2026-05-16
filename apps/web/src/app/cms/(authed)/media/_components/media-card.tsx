'use client'

import { memo, useCallback } from 'react'
import Image from 'next/image'
import type { MediaAsset, MediaAssetType } from '@/lib/media/types'
import { TYPE_COLORS, formatBytes } from '../../_shared/media/types'

export type QuickAction = 'preview' | 'download' | 'copy-url' | 'delete'

const DEFAULT_ACTION_LABELS: Record<QuickAction, string> = {
  preview: 'Preview', download: 'Download', 'copy-url': 'Copy URL', delete: 'Delete',
}

interface MediaCardProps {
  item: MediaAsset
  type: MediaAssetType
  checked: boolean
  selected: boolean
  focused?: boolean
  onSelect: (id: string) => void
  onCheck: (id: string, shiftKey: boolean) => void
  onQuickAction: (id: string, action: QuickAction) => void
  searchQuery?: string
  compact?: boolean
  typeLabel?: string
  newBadgeLabel?: string
  svgLabel?: string
  actionLabels?: Record<QuickAction, string>
  'data-testid'?: string
}

function highlightMatch(text: string, query: string | undefined): React.ReactNode {
  if (!query) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark data-testid="search-highlight" className="bg-cms-accent/30 text-cms-text rounded-sm px-0.5">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  )
}

function isNewAsset(createdAt: string): boolean {
  const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000
  return new Date(createdAt).getTime() > threeDaysAgo
}

export const MediaCard = memo(function MediaCard({
  item,
  type,
  checked,
  selected,
  onSelect,
  onCheck,
  onQuickAction,
  searchQuery,
  compact,
  focused,
  typeLabel,
  newBadgeLabel,
  svgLabel,
  actionLabels,
  'data-testid': dataTestId,
}: MediaCardProps) {
  const labels = actionLabels ?? DEFAULT_ACTION_LABELS
  const colors = TYPE_COLORS[type]
  const isSvg = item.mimeType === 'image/svg+xml'

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.shiftKey) {
        onCheck(item.id, true)
      } else {
        onSelect(item.id)
      }
    },
    [item.id, onSelect, onCheck],
  )

  const handleCheckbox = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onCheck(item.id, e.shiftKey)
    },
    [item.id, onCheck],
  )

  return (
    <div
      data-testid={dataTestId ?? `media-card-${item.id}`}
      data-checked={checked}
      onClick={handleClick}
      className={`
        group relative flex flex-col overflow-hidden rounded-lg border-l-4
        bg-cms-surface transition-all duration-150 cursor-pointer
        hover:bg-cms-surface-hover
        ${colors.border}
        ${selected ? 'ring-2 ring-cms-accent shadow-lg shadow-cms-accent/20' : 'border border-cms-border hover:border-cms-border-subtle'}
        ${focused ? 'ring-2 ring-offset-1 ring-cms-accent/50' : ''}
        ${checked ? 'bg-cms-accent/5' : ''}
      `}
    >
      {/* Thumbnail */}
      <div className="relative aspect-[4/3] overflow-hidden bg-cms-bg">
        {isSvg ? (
          <img
            src={item.blobUrl}
            alt={item.altText ?? ''}
            className="h-full w-full object-contain p-2"
            loading="lazy"
          />
        ) : (
          <Image
            src={item.blobUrl}
            alt={item.altText ?? ''}
            fill
            sizes={compact ? '150px' : '(min-width: 1200px) 300px, (min-width: 900px) 250px, 50vw'}
            className="object-cover"
          />
        )}

        {/* Checkbox — hidden in compact mode */}
        {!compact && (
          <button
            type="button"
            role="checkbox"
            aria-checked={checked}
            aria-label={`Select ${item.filename}`}
            onClick={handleCheckbox}
            className={`
              absolute left-2 top-2 z-10 flex min-h-6 min-w-6 items-center justify-center rounded border transition-all
              ${checked
                ? 'border-cms-accent bg-cms-accent text-white'
                : 'border-white/40 bg-black/30 opacity-0 group-hover:opacity-100'}
            `}
          >
            {checked && (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        )}

        {/* Hover overlay with quick actions */}
        {!compact && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
            {(['preview', 'download', 'copy-url', 'delete'] as const).map((action) => (
              <button
                key={action}
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onQuickAction(item.id, action)
                }}
                className="rounded-full bg-white/10 p-2 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
                aria-label={labels[action]}
              >
                <QuickActionIcon action={action} />
              </button>
            ))}
          </div>
        )}

        {/* Checked overlay */}
        {checked && (
          <div className="absolute inset-0 bg-cms-accent/15 pointer-events-none" />
        )}
      </div>

      {/* Info section — hidden in compact mode (gallery modal has its own details bar) */}
      {!compact && (
        <div className="flex flex-col gap-1 px-3 py-2">
          <div className="flex items-center gap-1.5">
            <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${colors.badge}`}>
              {typeLabel ?? colors.label}
            </span>
            {isNewAsset(item.createdAt) && (
              <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                {newBadgeLabel ?? 'NEW'}
              </span>
            )}
          </div>
          <p className="truncate text-sm font-medium text-cms-text" title={item.filename}>
            {highlightMatch(item.filename, searchQuery)}
          </p>
          <div className="flex items-center gap-2 text-xs text-cms-text-muted">
            {item.width && item.height ? (
              <span>{item.width} × {item.height}</span>
            ) : (
              <span>{svgLabel ?? 'SVG'}</span>
            )}
            <span>·</span>
            <span>{formatBytes(item.fileSize)}</span>
          </div>
        </div>
      )}

      {/* Orphan pulse effect */}
      {type === 'orphan' && (
        <div className="absolute inset-0 rounded-lg shadow-[inset_0_0_0_1px_rgba(239,68,68,0.3)] motion-safe:animate-pulse pointer-events-none" />
      )}
    </div>
  )
})

function QuickActionIcon({ action }: { action: QuickAction }) {
  switch (action) {
    case 'preview':
      return <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.2" /><circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2" /></svg>
    case 'download':
      return <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2v8m0 0l-3-3m3 3l3-3M3 13h10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
    case 'copy-url':
      return <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="5" y="5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" /><path d="M3 11V3.5A1.5 1.5 0 014.5 2H11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
    case 'delete':
      return <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1m2 0v8a2 2 0 01-2 2H6a2 2 0 01-2-2V4h8z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
  }
}
