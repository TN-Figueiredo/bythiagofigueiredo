'use client'

import type { DisplayLabel } from '@/lib/youtube/ab-types'
import { formatPercent } from './ab-constants'
import { VChip, Badge } from './ab-primitives'
import { Swords, ArrowRight } from 'lucide-react'

export interface PlayoffBannerProps {
  finalists: Array<{
    label: DisplayLabel
    color: string
    ctr: number
    thumbnailUrl: string | null
  }>
  allVariants: Array<{
    label: DisplayLabel
    isFinalist: boolean
    thumbnailUrl: string | null
  }>
  startsIn: string
  reason: string
}

export function PlayoffBanner({
  finalists,
  allVariants,
  startsIn,
  reason,
}: PlayoffBannerProps) {
  const bracketLabel = `Playoff bracket: ${finalists.map(f => `Variant ${f.label}`).join(' vs ')}. ${reason}`

  return (
    <div
      data-testid="playoff-banner"
      className="rounded-[var(--cms-radius)] border-2 border-purple-500 bg-purple-500/5 p-4 space-y-4"
      role="img"
      aria-label={bracketLabel}
    >
      {/* Header: Swords + title + countdown badge */}
      <div className="flex items-center gap-2 flex-wrap">
        <Swords
          size={20}
          className="text-purple-400 shrink-0"
          data-testid="icon-Swords"
          aria-hidden="true"
        />
        <span className="text-xs font-semibold text-cms-text">
          Playoff created automatically
        </span>
        <Badge tone="accent">{startsIn}</Badge>
      </div>

      {/* 3-column bracket: Round 1 | Arrow | Round 2 */}
      <div className="flex items-center gap-4" data-testid="bracket">
        {/* Round 1: all variants */}
        <div className="flex-1 space-y-1.5" data-testid="round-1">
          <p className="text-2xs text-cms-text-dim uppercase tracking-wider font-medium mb-1">
            Round 1
          </p>
          {allVariants.map((v) => {
            const finalist = finalists.find((f) => f.label === v.label)
            return (
              <div
                key={v.label}
                data-finalist={v.isFinalist || undefined}
                className={`flex items-center gap-2 py-1 ${v.isFinalist ? 'opacity-100' : 'opacity-40'}`}
              >
                <VChip label={v.label} size={18} />
                <span className="text-2xs text-cms-text truncate">
                  {v.isFinalist ? `Variant ${v.label}` : v.label}
                </span>
                {finalist && (
                  <span className="text-2xs font-mono text-cms-text-muted ml-auto">
                    {formatPercent(finalist.ctr)}
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/* Center arrow */}
        <div className="flex items-center justify-center px-2">
          <ArrowRight
            size={20}
            className="text-purple-400"
            aria-hidden="true"
          />
        </div>

        {/* Round 2: finalists */}
        <div className="flex-1 space-y-1.5" data-testid="round-2">
          <p className="text-2xs text-cms-text-dim uppercase tracking-wider font-medium mb-1">
            Round 2
          </p>
          {finalists.map((f) => (
            <div
              key={f.label}
              className="flex items-center gap-2 py-1"
              data-finalist
            >
              <VChip label={f.label} size={18} ring />
              <span className="text-2xs text-cms-text font-medium truncate">
                Variant {f.label}
              </span>
              <span className="text-2xs font-mono text-cms-text-muted ml-auto">
                {formatPercent(f.ctr)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer: reason */}
      <p className="text-2xs text-cms-text-muted" data-testid="playoff-reason">
        {reason}
      </p>
    </div>
  )
}
