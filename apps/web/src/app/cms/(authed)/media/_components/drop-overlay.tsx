'use client'

import { memo } from 'react'
import type { MediaGalleryStrings } from '../../_shared/media/_i18n/types'

interface DropOverlayProps {
  active: boolean
  t: MediaGalleryStrings
}

export const DropOverlay = memo(function DropOverlay({ active, t }: DropOverlayProps) {
  if (!active) return null

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-cms-accent/10 backdrop-blur-sm pointer-events-none">
      <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-cms-accent bg-cms-surface/90 px-12 py-10">
        <svg aria-hidden="true" width="48" height="48" viewBox="0 0 48 48" fill="none" className="text-cms-accent">
          <path d="M24 8v24m0 0l-8-8m8 8l8-8M8 36h32" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="text-lg font-medium text-cms-text">{t.upload.dropHere}</p>
      </div>
    </div>
  )
})
