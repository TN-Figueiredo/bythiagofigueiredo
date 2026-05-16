'use client'

import type { MediaColumnCount } from '../../_shared/media/types'
import type { MediaGalleryStrings } from '../../_shared/media/_i18n/types'
import { COL_CLASSES } from '../../_shared/media/constants'

interface SkeletonGridProps {
  cols: MediaColumnCount
  count?: number
  t?: MediaGalleryStrings
}

export function SkeletonGrid({ cols, count = 12, t }: SkeletonGridProps) {
  return (
    <div className={`grid gap-3 ${COL_CLASSES[cols]}`} aria-busy="true" aria-label={t?.aria.loading ?? 'Loading'}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="animate-pulse rounded-lg border border-cms-border bg-cms-surface">
          <div className="aspect-[4/3] bg-cms-bg" />
          <div className="flex flex-col gap-2 px-3 py-2">
            <div className="h-3 w-12 rounded bg-cms-bg" />
            <div className="h-3.5 w-3/4 rounded bg-cms-bg" />
            <div className="h-3 w-1/2 rounded bg-cms-bg" />
          </div>
        </div>
      ))}
    </div>
  )
}
