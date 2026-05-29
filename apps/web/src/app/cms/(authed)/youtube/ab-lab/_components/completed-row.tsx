'use client'

import Link from 'next/link'
import type { AbTestCardView } from '@/lib/youtube/ab-types'
import { formatPercent } from './ab-constants'
import { VChip, TypeBadge, Badge } from './ab-primitives'

export interface CompletedRowProps {
  test: AbTestCardView
  onOpen: (id: string) => void
}

export function CompletedRow({ test, onOpen }: CompletedRowProps) {
  const isInconclusive = Math.abs(test.lift) < 0.1 && test.confidence < 90

  return (
    <Link
      href={`/cms/youtube/ab-lab/${test.id}`}
      onClick={(e) => {
        e.preventDefault()
        onOpen(test.id)
      }}
      className="flex items-center gap-3 px-4 py-3 border-b border-cms-border last:border-0 hover:bg-cms-surface-hover transition-colors group focus-visible:ring-2 focus-visible:ring-cms-accent focus-visible:outline-none"
    >
      {/* Left: thumbnail */}
      <div className="w-[78px] h-[44px] rounded overflow-hidden bg-cms-surface-hover shrink-0">
        {test.leaderThumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={test.leaderThumbUrl}
            alt={test.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-cms-text-dim text-2xs">
            No image
          </div>
        )}
      </div>

      {/* Right: info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-cms-text truncate group-hover:text-cms-text">
          {test.name}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <TypeBadge type={test.type} />
          {isInconclusive ? (
            <Badge tone="amber">Inconclusive</Badge>
          ) : (
            <>
              <VChip label={test.leader} size={18} />
              <span className="text-2xs text-cms-green font-medium">
                +{formatPercent(test.lift)}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Chevron */}
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-cms-text-dim group-hover:text-cms-text-muted transition-colors shrink-0"
        aria-hidden="true"
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </Link>
  )
}
