'use client'

import React, { useState, useCallback } from 'react'
import type { FullChartVariant, VariantThumb, DisplayLabel } from '@/lib/youtube/ab-types'
import { formatPercent, formatCompact } from './ab-constants'
import { VChip } from './ab-primitives'
import { ChevronDown, Trophy, TrendingUp, Radio } from 'lucide-react'

export interface VariantTableProps {
  variants: FullChartVariant[]
  metric: 'pBest' | 'pTop2'
  winnerId?: string
  leaderId?: string
  activeNow?: string
  finalists?: DisplayLabel[]
  thumbs: VariantThumb[]
  videoTitle?: string
}

const GRID = 'grid grid-cols-[60px_minmax(0,1fr)_70px_58px_138px_22px] gap-[14px] items-center'

export function VariantTable({ variants, metric, winnerId, leaderId, activeNow, finalists, thumbs, videoTitle }: VariantTableProps) {
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

  if (sorted.length === 0) {
    return (
      <div role="table" aria-label="Variant comparison" className="rounded-lg border border-cms-border bg-cms-surface overflow-hidden">
        <div className="flex items-center justify-center py-8 text-xs text-cms-text-muted">
          Nenhuma variante cadastrada.
        </div>
      </div>
    )
  }

  return (
    <div role="table" aria-label="Variant comparison" className="rounded-lg border border-cms-border bg-cms-surface overflow-hidden">
      {/* Header */}
      <div role="row" className={`${GRID} py-[10px] px-[16px] border-b border-cms-border bg-cms-bg-side`}>
        <span role="columnheader" className="text-[9px] font-semibold text-cms-text-dim uppercase tracking-[0.08em]">thumb</span>
        <span role="columnheader" className="text-[9px] font-semibold text-cms-text-dim uppercase tracking-[0.08em]">variante</span>
        <span role="columnheader" className="text-[9px] font-semibold text-cms-text-dim uppercase tracking-[0.08em] text-right">CTR</span>
        <span role="columnheader" className="text-[9px] font-semibold text-cms-text-dim uppercase tracking-[0.08em] text-right">vs A</span>
        <span role="columnheader" className="text-[9px] font-semibold text-cms-text-dim uppercase tracking-[0.08em]">
          {metric === 'pBest' ? 'chance de vencer' : 'top 2'}
        </span>
        <span role="columnheader" />
      </div>

      {/* Rows */}
      {sorted.map((variant, idx) => {
        const thumb = thumbMap.get(variant.label)
        const isWinner = winnerId != null && winnerId === variant.label
        const isLeader = leaderId != null && leaderId === variant.label
        const isActiveNow = activeNow != null && activeNow === variant.label
        const isHighlighted = isWinner || isLeader
        const isOriginal = thumb?.isOriginal ?? variant.label === 'A'
        const isExpanded = expandedLabel === variant.label
        const chance = variant[metric]

        const variantA = variants.find(v => v.label === 'A')
        const canComputeLift = variantA != null && variantA.ctr > 0 && variant.label !== 'A'
        const liftVsA = canComputeLift
          ? ((variant.ctr - variantA.ctr) / variantA.ctr) * 100
          : null

        return (
          <React.Fragment key={variant.label}>
            <div className="border-t border-cms-border">
              <div
                role="row"
                className={`${GRID} py-[11px] px-[16px] cursor-pointer transition-[background] duration-150 ${
                  isHighlighted ? '' : 'hover:bg-cms-surface-hover'
                }`}
                style={isHighlighted ? { background: `${variant.color}10` } : undefined}
                onClick={() => toggleExpand(variant.label)}
                onKeyDown={(e) => handleKeyDown(e, variant.label)}
                tabIndex={0}
                aria-expanded={isExpanded}
              >
                {/* Thumbnail */}
                <div
                  className="rounded-[6px] overflow-hidden"
                  style={{ outline: isHighlighted ? `1.5px solid ${variant.color}` : '1px solid var(--cms-border)' }}
                >
                  {thumb?.thumbUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumb.thumbUrl}
                      alt={`Thumbnail variante ${variant.label}`}
                      className="w-full aspect-video rounded-[6px] object-cover"
                    />
                  ) : (
                    <div
                      className="w-full aspect-video rounded-[6px] overflow-hidden"
                      style={{
                        background: isHighlighted
                          ? 'linear-gradient(135deg, rgb(90,47,23), rgb(36,16,8))'
                          : 'linear-gradient(135deg, rgb(58,47,40), rgb(31,26,22))',
                        boxShadow: 'rgba(0,0,0,0.4) 0px 0px 60px inset',
                      }}
                    />
                  )}
                </div>

                {/* Variant info */}
                <div className="min-w-0 flex items-center gap-[9px]">
                  <VChip label={variant.label} size={22} ring={isHighlighted} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-[6px]">
                      <span className="text-[12.5px] font-semibold text-cms-text">
                        {isWinner ? 'Winner' : isLeader ? 'Hero' : isOriginal ? 'Original' : finalists?.includes(variant.label) ? 'Finalista' : leaderId != null ? 'Challenger' : 'Variante'}
                      </span>
                      {isWinner && (
                        <span className="inline-flex items-center gap-[5px] px-[6px] py-px rounded-full text-[8.5px] font-semibold tracking-[0.06em] uppercase bg-cms-green-subtle text-cms-green">
                          <Trophy size={11} aria-hidden="true" />
                          venceu
                        </span>
                      )}
                      {isLeader && (
                        <span className="inline-flex items-center gap-[5px] px-[6px] py-px rounded-full text-[8.5px] font-semibold tracking-[0.06em] uppercase bg-cms-green-subtle text-cms-green">
                          <TrendingUp size={11} aria-hidden="true" />
                          líder
                        </span>
                      )}
                      {isActiveNow && (
                        <span className="inline-flex items-center gap-[5px] px-[6px] py-px rounded-full text-[8.5px] font-semibold tracking-[0.06em] uppercase bg-cms-red-subtle text-cms-red">
                          <Radio size={11} aria-hidden="true" />
                          no ar
                        </span>
                      )}
                    </div>
                    {videoTitle && (
                      <div className="text-[11.5px] text-cms-text-dim whitespace-nowrap overflow-hidden text-ellipsis">
                        {videoTitle}
                      </div>
                    )}
                  </div>
                </div>

                {/* CTR */}
                <span className="font-mono text-[19px] font-bold text-right" style={{ color: variant.color }}>
                  {(variant.ctr * 100).toFixed(1)}%
                </span>

                {/* vs A */}
                <span className={`font-mono text-[12.5px] font-bold text-right ${
                  variant.label === 'A' || liftVsA == null ? 'text-cms-text-muted' : liftVsA > 0 ? 'text-cms-green' : 'text-cms-text-muted'
                }`}>
                  {variant.label === 'A' || liftVsA == null ? '—' : `${liftVsA > 0 ? '+' : ''}${liftVsA.toFixed(0)}%`}
                </span>

                {/* Chance bar */}
                <div className="flex items-center gap-[9px]">
                  <div className="flex-1 h-[7px] bg-cms-surface-hover rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(2, Math.min(100, chance * 100))}%`,
                        backgroundColor: variant.color,
                        transition: 'width 0.6s',
                      }}
                    />
                  </div>
                  <span className="font-mono text-[13px] font-bold w-[34px] text-right text-cms-text">
                    {(chance * 100).toFixed(0)}%
                  </span>
                </div>

                {/* Chevron */}
                <ChevronDown
                  size={15}
                  className="text-cms-text-muted"
                  style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                  aria-hidden="true"
                />
              </div>
            </div>

            {/* Expanded detail */}
            {isExpanded && (
              <div role="row" className="px-[16px] py-[11px] bg-cms-surface-hover/50 border-t border-cms-border" data-testid="expanded-row">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-[14px] text-2xs">
                  <div>
                    <p className="text-cms-text-dim">Impressões</p>
                    <p className="font-mono text-cms-text font-medium">{formatCompact(variant.impressions)}</p>
                  </div>
                  <div>
                    <p className="text-cms-text-dim">Cliques</p>
                    <p className="font-mono text-cms-text font-medium">{formatCompact(variant.clicks)}</p>
                  </div>
                  <div>
                    <p className="text-cms-text-dim">Link CTR</p>
                    <p className="font-mono text-cms-text font-medium">{variant.linkCtr != null ? formatPercent(variant.linkCtr) : '—'}</p>
                  </div>
                  <div>
                    <p className="text-cms-text-dim">Retenção</p>
                    <p className="font-mono text-cms-text font-medium">{variant.retention != null ? formatPercent(variant.retention) : '—'}</p>
                  </div>
                </div>
              </div>
            )}
          </React.Fragment>
        )
      })}

      {/* Footer hint */}
      <div className="py-[9px] px-[16px] border-t border-cms-border text-[10.5px] text-cms-text-muted flex items-center gap-[6px]">
        <ChevronDown size={11} aria-hidden="true" />
        Clique numa linha pra ver impressões, cliques e o briefing criativo.
      </div>
    </div>
  )
}
