'use client'

import type { AbTestCardView } from '@/lib/youtube/ab-types'
import { formatPercent } from './ab-constants'
import { VChip, Badge, TypeBadge } from './ab-primitives'
import { Gauge } from './gauge'
import { Dots } from './dots'

export interface ActiveTestCardProps {
  test: AbTestCardView
  onOpen: (id: string) => void
}

export function ActiveTestCard({ test, onOpen }: ActiveTestCardProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onOpen(test.id)
    }
  }

  return (
    <article
      aria-label={test.name}
      tabIndex={0}
      onClick={() => onOpen(test.id)}
      onKeyDown={handleKeyDown}
      className="rounded-lg border border-cms-border bg-cms-bg p-4 cursor-pointer hover:border-cms-accent/40 transition-colors animate-ab-fade-up focus-visible:ring-2 focus-visible:ring-cms-accent focus-visible:outline-none"
    >
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <TypeBadge type={test.type} />
        <Badge tone="live" dot>{`Dia ${test.dayOf}`}</Badge>
        {test.hasPlayoff && <Badge tone="accent">Round {test.roundNumber}</Badge>}
      </div>

      {/* Mini thumbnail row */}
      <div className="flex items-center gap-1.5 mb-3">
        {test.variants.map(v => (
          <div
            key={v.label}
            data-variant-thumb
            className="w-10 h-[30px] rounded overflow-hidden bg-cms-surface-hover"
            style={
              v.label === test.leader
                ? { boxShadow: `0 0 0 2px ${test.leaderColor}` }
                : undefined
            }
          >
            {v.thumbUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={v.thumbUrl}
                alt={`Variant ${v.label}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-cms-text-dim text-2xs">
                {v.label}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Title */}
      <h3 className="text-sm font-medium text-cms-text line-clamp-2 mb-3">{test.name}</h3>

      {/* Footer */}
      <div
        className="rounded bg-[var(--cms-bg-side,var(--cms-surface))] p-2 grid grid-cols-3 gap-2 items-center"
      >
        {/* Mini gauge */}
        <div className="flex justify-center" style={{ width: 32, height: 32 }}>
          <Gauge value={test.confidence} ariaLabel="Test confidence" />
        </div>

        {/* Leader + lift */}
        <div className="flex items-center gap-1.5">
          <VChip label={test.leader} size={18} />
          <span className="text-2xs text-cms-green font-medium">
            {test.lift > 0 ? '+' : ''}{formatPercent(test.lift)}
          </span>
        </div>

        {/* Rotation dots */}
        <Dots total={test.dayOf + 4} done={test.dayOf} color={test.leaderColor} />
      </div>
    </article>
  )
}
