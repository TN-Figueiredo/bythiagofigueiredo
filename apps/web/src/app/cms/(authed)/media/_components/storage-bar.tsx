'use client'

import { useMemo } from 'react'
import { TYPE_COLORS, formatBytes } from '../../_shared/media/types'
import type { MediaGalleryStrings } from '../../_shared/media/_i18n/types'
import { FOLDER_TO_TYPE } from '@/lib/media/resolve-type'
import type { MediaAssetType } from '@/lib/media/types'

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

      <div role="img" aria-label={segments.map(s => `${t.typeLabels[s.type]}: ${formatBytes(s.bytes)}`).join(', ')} className="flex h-2 overflow-hidden rounded-full bg-cms-bg">
        {segments.map((seg) => (
          <div
            key={seg.type}
            className={`${TYPE_COLORS[seg.type].bg} transition-all duration-700 ease-out`}
            style={{ width: `${seg.pct}%` }}
          />
        ))}
      </div>

      <div className="mt-2 flex flex-wrap gap-3">
        {segments.map((seg) => (
          <div key={seg.type} className="flex items-center gap-1.5">
            <div className={`h-2 w-2 rounded-full ${TYPE_COLORS[seg.type].bg}`} />
            <span className="text-[10px] text-cms-text-muted">
              {t.typeLabels[seg.type]}
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
