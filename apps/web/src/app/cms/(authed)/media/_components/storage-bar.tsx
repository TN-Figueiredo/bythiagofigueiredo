'use client'

import { useMemo } from 'react'
import { TYPE_COLORS } from '../../_shared/media/types'
import type { MediaAssetType } from '@/lib/media/types'
import type { MediaGalleryStrings } from '../../_shared/media/_i18n/types'

interface FolderStat {
  count: number
  sizeBytes: number
}

interface StorageBarProps {
  folderBreakdown: Record<string, FolderStat>
  totalSizeBytes: number
  orphanCount: number
  t: MediaGalleryStrings
}

const FOLDER_TO_TYPE: Record<string, MediaAssetType> = {
  authors: 'avatar',
  og: 'og',
  blog: 'cover',
  branding: 'cover',
  newsletters: 'inline',
  pipeline: 'inline',
  ads: 'inline',
  links: 'inline',
  general: 'inline',
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function StorageBar({ folderBreakdown, totalSizeBytes, orphanCount, t }: StorageBarProps) {
  const segments = useMemo(() => {
    const byType: Record<MediaAssetType, number> = { cover: 0, inline: 0, avatar: 0, og: 0, orphan: 0 }

    for (const [folder, stat] of Object.entries(folderBreakdown)) {
      const assetType = FOLDER_TO_TYPE[folder] ?? 'inline'
      byType[assetType] += stat.sizeBytes
    }

    const total = totalSizeBytes || 1
    return (Object.entries(byType) as Array<[MediaAssetType, number]>)
      .filter(([, bytes]) => bytes > 0)
      .map(([assetType, bytes]) => ({
        type: assetType,
        pct: (bytes / total) * 100,
        bytes,
      }))
  }, [folderBreakdown, totalSizeBytes])

  const storageLabel = t.storage.label
  const usedLabel = formatBytes(totalSizeBytes)

  return (
    <div className="rounded-lg border border-cms-border bg-cms-surface px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-cms-text-muted">{storageLabel}</span>
        <span className="text-xs font-semibold text-cms-text tabular-nums">{usedLabel}</span>
      </div>

      {/* Bar */}
      <div className="flex h-2 overflow-hidden rounded-full bg-cms-bg">
        {segments.map((seg) => (
          <div
            key={seg.type}
            className={`${TYPE_COLORS[seg.type].bg} transition-all duration-700 ease-out`}
            style={{ width: `${seg.pct}%` }}
            role="meter"
            aria-label={seg.type}
            aria-valuenow={seg.pct}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap gap-3">
        {segments.map((seg) => (
          <div key={seg.type} className="flex items-center gap-1.5">
            <div className={`h-2 w-2 rounded-full ${TYPE_COLORS[seg.type].bg}`} />
            <span className="text-[10px] text-cms-text-muted">
              {t.storage[
                seg.type === 'cover'
                  ? 'covers'
                  : seg.type === 'avatar'
                    ? 'avatars'
                    : (seg.type as keyof typeof t.storage)
              ] as string}
            </span>
            <span className="text-[10px] text-cms-text-dim tabular-nums">{formatBytes(seg.bytes)}</span>
          </div>
        ))}
        {orphanCount > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-red-500" />
            <span className="text-[10px] text-cms-text-muted">{t.storage.unused}</span>
            <span className="text-[10px] text-cms-text-dim">{orphanCount}</span>
          </div>
        )}
      </div>
    </div>
  )
}
