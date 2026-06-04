'use client'

import React, { useState, useCallback } from 'react'
import type { FullChartVariant, VariantThumb, DisplayLabel } from '@/lib/youtube/ab-types'
import { brDec } from '@/lib/youtube/format'
import { formatPercent, formatCompact } from './ab-constants'
import { VChip } from './ab-primitives'
import { ChevronDown, ChevronRight, BarChart3 } from 'lucide-react'

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

export function VariantTable({ variants, metric, winnerId, leaderId, activeNow, finalists, thumbs, videoTitle }: VariantTableProps) {
  const [expandedLabel, setExpandedLabel] = useState<string | null>(null)
  const sorted = [...variants].sort((a, b) => b[metric] - a[metric])
  const thumbMap = new Map(thumbs.map(t => [t.label, t]))

  const toggle = useCallback((label: string) => {
    setExpandedLabel(prev => (prev === label ? null : label))
  }, [])

  if (sorted.length === 0) {
    return (
      <div className="rounded-[12px] border border-cms-border bg-cms-surface overflow-hidden">
        <div className="flex items-center justify-center py-8 text-xs text-cms-text-muted">
          Nenhuma variante cadastrada.
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-[12px] border border-cms-border bg-cms-surface overflow-hidden" style={{ boxShadow: 'var(--shadow)' }}>
      {/* card-head */}
      <div className="flex items-center gap-[8px] px-[16px] py-[12px] border-b border-cms-border">
        <BarChart3 size={15} className="text-cms-text-dim" aria-hidden="true" />
        <span className="text-[13px] font-semibold text-cms-text">Placar das variantes</span>
        <span className="text-[11.5px] text-cms-text-dim ml-auto">ordenado por chance de vencer</span>
      </div>

      {/* vtable */}
      <div role="table" aria-label="Variant comparison">
        {/* Header row */}
        <div
          role="row"
          className="flex items-center gap-[8px] py-[9px] px-[16px] border-b border-cms-border"
        >
          <span role="columnheader" style={{ width: 22, flexShrink: 0 }} />
          <span role="columnheader" className="flex-1 min-w-0 text-[10px] font-semibold text-cms-text-dim uppercase tracking-[0.08em]">
            Thumb + título
          </span>
          <span role="columnheader" className="text-[10px] font-semibold text-cms-text-dim uppercase tracking-[0.08em] text-right" style={{ width: 56, flexShrink: 0 }}>CTR</span>
          <span role="columnheader" className="text-[10px] font-semibold text-cms-text-dim uppercase tracking-[0.08em] text-right" style={{ width: 44, flexShrink: 0 }}>vs A</span>
          <span role="columnheader" className="text-[10px] font-semibold text-cms-text-dim uppercase tracking-[0.08em] text-right" style={{ width: 90, flexShrink: 0 }}>Chance de vencer</span>
          <span role="columnheader" style={{ width: 20, flexShrink: 0 }} />
        </div>

        {/* Rows */}
        {sorted.map((variant) => {
          const thumb = thumbMap.get(variant.label)
          const isLeader = leaderId != null && leaderId === variant.label
          const isWinner = winnerId != null && winnerId === variant.label
          const isHighlighted = isWinner || isLeader
          const isOriginal = thumb?.isOriginal ?? variant.label === 'A'
          const isExpanded = expandedLabel === variant.label
          const chance = variant[metric]

          const variantA = variants.find(v => v.label === 'A')
          const canLift = variantA != null && variantA.ctr > 0 && variant.label !== 'A'
          const liftVsA = canLift ? ((variant.ctr - variantA.ctr) / variantA.ctr) * 100 : null

          return (
            <React.Fragment key={variant.label}>
              <div
                className="border-t border-cms-border"
                style={isHighlighted ? { '--vc': variant.color } as React.CSSProperties : undefined}
              >
                {/* Main row */}
                <div
                  role="row"
                  className={`flex items-center gap-[8px] py-[12px] px-[16px] cursor-pointer transition-[background] duration-150 ${
                    isHighlighted ? '' : 'hover:bg-cms-surface-hover'
                  }`}
                  style={isHighlighted ? {
                    background: `${variant.color}10`,
                    boxShadow: `inset 4px 0 0 ${variant.color}`,
                  } : undefined}
                  onClick={() => toggle(variant.label)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(variant.label) } }}
                  tabIndex={0}
                  aria-expanded={isExpanded}
                  aria-label={`Variante ${variant.label}, detalhes`}
                >
                  {/* VChip */}
                  <span style={{ width: 22, flexShrink: 0 }}>
                    <VChip label={variant.label} size={22} ring={isHighlighted} />
                  </span>

                  {/* Title cell: thumb + title */}
                  <span className="flex-1 min-w-0 flex items-center gap-[8px]">
                    {/* Thumbnail */}
                    <span
                      className="shrink-0 rounded-[5px] overflow-hidden"
                      style={{ width: 48, outline: isHighlighted ? `1.5px solid ${variant.color}` : '1px solid var(--cms-border)' }}
                    >
                      {thumb?.thumbUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumb.thumbUrl}
                          alt={`Thumbnail ${variant.label}`}
                          referrerPolicy="no-referrer"
                          className="w-full aspect-video rounded-[5px] object-cover block"
                        />
                      ) : (
                        <span
                          className="w-full aspect-video rounded-[5px] flex items-center justify-center text-[10px] font-mono font-bold text-cms-text-dim block"
                          style={{
                            background: isHighlighted
                              ? 'linear-gradient(135deg, rgb(90,47,23), rgb(36,16,8))'
                              : 'linear-gradient(135deg, rgb(58,47,40), rgb(31,26,22))',
                          }}
                        >
                          {variant.label}
                        </span>
                      )}
                    </span>

                    {/* Title */}
                    <span className="truncate text-[12.5px] text-cms-text">
                      {videoTitle ?? `Variante ${variant.label}`}
                      {isOriginal && <span className="text-[11px] text-cms-text-dim"> · original</span>}
                    </span>
                  </span>

                  {/* CTR */}
                  <span className="font-mono text-[14px] font-bold text-right tabular-nums" style={{ width: 56, flexShrink: 0, color: variant.color }}>
                    {brDec(variant.ctr * 100, 1)}%
                  </span>

                  {/* vs A */}
                  <span
                    className="font-mono text-[12.5px] font-bold text-right tabular-nums"
                    style={{
                      width: 44, flexShrink: 0,
                      color: variant.label === 'A' || liftVsA == null
                        ? 'var(--cms-text-muted)'
                        : liftVsA > 0 ? 'var(--cms-green)' : 'var(--cms-text-muted)',
                    }}
                  >
                    {variant.label === 'A' || liftVsA == null ? '—' : `${liftVsA > 0 ? '+' : ''}${brDec(liftVsA, 1)}`}
                  </span>

                  {/* Chance */}
                  <span className="font-mono text-[14px] font-bold text-right tabular-nums text-cms-text" style={{ width: 90, flexShrink: 0 }}>
                    {brDec(chance * 100, 0)}%
                  </span>

                  {/* Chevron */}
                  <span style={{ width: 20, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                    {isExpanded
                      ? <ChevronDown size={15} className="text-cms-text-dim" aria-hidden="true" />
                      : <ChevronRight size={15} className="text-cms-text-dim" aria-hidden="true" />
                    }
                  </span>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="fade-in px-[16px] py-[12px] bg-cms-surface-hover/50 border-t border-cms-border">
                    <div className="flex gap-[24px]">
                      <div>
                        <span className="eyebrow">Impressões</span>
                        <span className="block font-mono text-[13px] text-cms-text mt-[2px]">{formatCompact(variant.impressions)}</span>
                      </div>
                      <div>
                        <span className="eyebrow">Cliques</span>
                        <span className="block font-mono text-[13px] text-cms-text mt-[2px]">{formatCompact(variant.clicks)}</span>
                      </div>
                      <div>
                        <span className="eyebrow">Cliques no link</span>
                        <span className="block font-mono text-[13px] text-cms-text mt-[2px]">{variant.linkClicks != null ? formatCompact(variant.linkClicks) : '—'}</span>
                      </div>
                      <div>
                        <span className="eyebrow">CTR no link</span>
                        <span className="block font-mono text-[13px] text-cms-text mt-[2px]">{variant.linkCtr != null ? formatPercent(variant.linkCtr) : '—'}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}
