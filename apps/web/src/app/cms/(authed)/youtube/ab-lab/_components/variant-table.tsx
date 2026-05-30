'use client'

import React, { useState, useCallback } from 'react'
import type { FullChartVariant, VariantThumb } from '@/lib/youtube/ab-types'
import { formatPercent, formatNumber, formatCompact } from './ab-constants'
import { VChip } from './ab-primitives'
import { ChevronDown, ChevronRight } from 'lucide-react'

export interface VariantTableProps {
  variants: FullChartVariant[]
  metric: 'pBest' | 'pTop2'
  winnerId?: string
  thumbs: VariantThumb[]
}

export function VariantTable({ variants, metric, winnerId, thumbs }: VariantTableProps) {
  const [expandedLabel, setExpandedLabel] = useState<string | null>(null)

  const sorted = [...variants].sort((a, b) => b[metric] - a[metric])

  const toggleExpand = useCallback((label: string) => {
    setExpandedLabel(prev => (prev === label ? null : label))
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, label: string) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        toggleExpand(label)
      }
    },
    [toggleExpand],
  )

  const thumbMap = new Map(thumbs.map(t => [t.label, t]))

  return (
    <div role="table" aria-label="Variant comparison" className="rounded-lg border border-cms-border bg-cms-bg overflow-hidden">
      {/* Header */}
      <div role="row" className="grid grid-cols-[40px_1fr_60px_60px_100px_28px] gap-2 px-3 py-2 bg-cms-surface text-2xs font-medium text-cms-text-dim">
        <span role="columnheader" />
        <span role="columnheader">Variante</span>
        <span role="columnheader">CTR</span>
        <span role="columnheader">vs A</span>
        <span role="columnheader">{metric === 'pBest' ? 'Chance de vencer' : 'Top 2'}</span>
        <span role="columnheader" />
      </div>

      {/* Body */}
      {sorted.map((variant, idx) => {
        const thumb = thumbMap.get(variant.label)
        const isLeader = idx === 0
        const isWinner = winnerId != null && thumb?.label === sorted[0]?.label && winnerId === variant.label
        const isExpanded = expandedLabel === variant.label
        const chance = variant[metric]

        // Calculate lift vs A
        const variantA = variants.find(v => v.label === 'A')
        const liftVsA = variantA && variantA.ctr > 0
          ? ((variant.ctr - variantA.ctr) / variantA.ctr) * 100
          : 0

        return (
          <React.Fragment key={variant.label}>
            <div
              role="row"
              data-leader={isLeader || undefined}
              className={`grid grid-cols-[40px_1fr_60px_60px_100px_28px] gap-2 px-3 py-2 items-center text-xs cursor-pointer hover:bg-cms-surface/50 transition-colors ${isLeader ? 'border-l-2 border-l-cms-accent bg-cms-accent/5' : ''}`}
              onClick={() => toggleExpand(variant.label)}
              onKeyDown={(e) => handleKeyDown(e, variant.label)}
              tabIndex={0}
              aria-expanded={isExpanded}
            >
              {/* Thumbnail */}
              <div className="w-10 h-[30px] rounded overflow-hidden bg-cms-surface-hover" data-testid="variant-thumb">
                {thumb?.thumbUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumb.thumbUrl}
                    alt={`Variant ${variant.label}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-cms-text-dim text-2xs">
                    {variant.label}
                  </div>
                )}
              </div>

              {/* Label */}
              <div className="flex items-center gap-1.5">
                <VChip label={variant.label} size={18} />
                <span className="text-cms-text font-medium">
                  {thumb?.isOriginal ? 'Original' : `Variante ${variant.label}`}
                </span>
              </div>

              {/* CTR */}
              <span className="font-mono text-cms-text">{formatPercent(variant.ctr)}</span>

              {/* Lift vs A */}
              <span className={`font-mono ${liftVsA > 0 ? 'text-cms-green' : liftVsA < 0 ? 'text-cms-red' : 'text-cms-text-muted'}`}>
                {variant.label === 'A' ? '—' : `${liftVsA > 0 ? '+' : ''}${formatPercent(liftVsA)}`}
              </span>

              {/* Chance bar */}
              <div className="flex items-center gap-1.5">
                <div className="flex-1 h-1.5 rounded-full bg-cms-surface overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, chance * 100)}%`,
                      backgroundColor: variant.color,
                    }}
                  />
                </div>
                <span className="text-2xs font-mono text-cms-text-muted w-8 text-right">
                  {formatPercent(chance * 100, 0)}
                </span>
              </div>

              {/* Expand chevron */}
              <div className="flex justify-center">
                {isExpanded ? (
                  <ChevronDown size={14} className="text-cms-text-muted" aria-hidden="true" />
                ) : (
                  <ChevronRight size={14} className="text-cms-text-muted" aria-hidden="true" />
                )}
              </div>
            </div>

            {/* Expanded detail */}
            {isExpanded && (
              <div role="row" className="px-3 py-3 bg-cms-surface/30 border-t border-cms-border" data-testid="expanded-row">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-2xs">
                  <div>
                    <p className="text-cms-text-dim">Impressions</p>
                    <p className="font-mono text-cms-text font-medium">{formatCompact(variant.impressions)}</p>
                  </div>
                  <div>
                    <p className="text-cms-text-dim">Clicks</p>
                    <p className="font-mono text-cms-text font-medium">{formatCompact(variant.clicks)}</p>
                  </div>
                  <div>
                    <p className="text-cms-text-dim">Link CTR</p>
                    <p className="font-mono text-cms-text font-medium">{variant.linkCtr != null ? formatPercent(variant.linkCtr) : '—'}</p>
                  </div>
                  <div>
                    <p className="text-cms-text-dim">Retention</p>
                    <p className="font-mono text-cms-text font-medium">{variant.retention != null ? formatPercent(variant.retention) : '—'}</p>
                  </div>
                </div>
              </div>
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}
