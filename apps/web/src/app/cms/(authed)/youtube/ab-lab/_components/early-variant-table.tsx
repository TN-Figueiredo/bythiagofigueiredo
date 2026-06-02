'use client'

import type { DisplayLabel } from '@/lib/youtube/ab-types'
import { VChip } from './ab-primitives'
import { ChevronDown } from 'lucide-react'

export interface EarlyVariantTableProps {
  variants: Array<{
    label: DisplayLabel
    color: string
    thumbUrl: string | null
    titleText: string | null
    isOriginal: boolean
  }>
  videoTitle?: string
}

const GRID = 'grid grid-cols-[60px_minmax(0,1fr)_70px_138px_22px] gap-[14px] items-center'

const THUMB_BG: Record<string, string> = {
  A: 'linear-gradient(135deg, rgb(58,47,40), rgb(31,26,22))',
  B: 'linear-gradient(135deg, rgb(90,47,23), rgb(36,16,8))',
  C: 'linear-gradient(135deg, rgb(30,60,55), rgb(18,35,30))',
  D: 'linear-gradient(135deg, rgb(58,36,86), rgb(22,12,36))',
}

export function EarlyVariantTable({ variants, videoTitle }: EarlyVariantTableProps) {
  if (variants.length === 0) {
    return (
      <div role="table" aria-label="Variant comparison" className="rounded-lg border border-cms-border bg-cms-surface overflow-hidden">
        <div className="flex items-center justify-center py-8 text-xs text-cms-text-muted">
          Nenhuma variante cadastrada.
        </div>
      </div>
    )
  }

  return (
    <div role="table" aria-label="Variant comparison — early state" className="rounded-lg border border-cms-border bg-cms-surface overflow-hidden">
      {/* Header */}
      <div role="row" className={`${GRID} py-[10px] px-[16px] border-b border-cms-border bg-cms-bg-side`}>
        <span role="columnheader" className="text-[9px] font-semibold text-cms-text-dim uppercase tracking-[0.08em]">thumb</span>
        <span role="columnheader" className="text-[9px] font-semibold text-cms-text-dim uppercase tracking-[0.08em]">variante</span>
        <span role="columnheader" className="text-[9px] font-semibold text-cms-text-dim uppercase tracking-[0.08em] text-right">CTR</span>
        <span role="columnheader" className="text-[9px] font-semibold text-cms-text-dim uppercase tracking-[0.08em]">status</span>
        <span role="columnheader" />
      </div>

      {/* Rows */}
      {variants.map((variant) => (
        <div key={variant.label} className="border-t border-cms-border">
          <div
            role="row"
            className={`${GRID} py-[11px] px-[16px]`}
          >
            {/* Thumbnail */}
            <div
              className="rounded-[6px] overflow-hidden"
              style={{ outline: '1px solid var(--cms-border)' }}
            >
              {variant.thumbUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={variant.thumbUrl}
                  alt={`Thumbnail variante ${variant.label}`}
                  referrerPolicy="no-referrer"
                  className="w-full aspect-video rounded-[6px] object-cover"
                />
              ) : (
                <div
                  className="w-full aspect-video rounded-[6px] overflow-hidden"
                  style={{
                    background: THUMB_BG[variant.label] ?? THUMB_BG.A,
                    boxShadow: 'rgba(0,0,0,0.4) 0px 0px 60px inset',
                  }}
                />
              )}
            </div>

            {/* Variant info */}
            <div className="min-w-0 flex items-center gap-[9px]">
              <VChip label={variant.label} size={22} />
              <div className="min-w-0">
                <div className="flex items-center gap-[6px]">
                  <span className="text-[12.5px] font-semibold text-cms-text">
                    {variant.isOriginal ? 'Original' : `Variante ${variant.label}`}
                  </span>
                </div>
                {videoTitle && (
                  <div className="text-[11.5px] text-cms-text-dim whitespace-nowrap overflow-hidden text-ellipsis">
                    {videoTitle}
                  </div>
                )}
              </div>
            </div>

            {/* CTR placeholder */}
            <span className="font-mono text-[19px] font-bold text-right text-cms-text-dim">
              --
            </span>

            {/* Status pill */}
            <div className="flex items-center">
              <span
                className="inline-flex items-center gap-[5px] rounded-full px-[9px] py-[3px] text-[10.5px] font-semibold tracking-[0.06em] font-mono"
                style={{
                  background: 'var(--cms-accent-subtle, rgba(255,130,64,0.08))',
                  color: 'var(--cms-accent)',
                }}
              >
                <span className="size-1.5 rounded-full bg-current early-pulse" />
                coletando
              </span>
            </div>

            {/* Chevron (disabled in early state) */}
            <ChevronDown
              size={15}
              className="text-cms-text-muted opacity-30"
              aria-hidden="true"
            />
          </div>
        </div>
      ))}

      {/* Footer hint */}
      <div className="py-[9px] px-[16px] border-t border-cms-border text-[10.5px] text-cms-text-muted">
        Dados de CTR e chance de vencer aparecem apos o primeiro ciclo ABBA.
      </div>
    </div>
  )
}
