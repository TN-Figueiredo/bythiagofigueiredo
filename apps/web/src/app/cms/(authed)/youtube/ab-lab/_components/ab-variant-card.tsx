'use client'

import Image from 'next/image'
import type { VariantStats } from '@/lib/youtube/ab-types'

interface AbVariantCardProps {
  variant: VariantStats
  isWinner: boolean
  isLeading: boolean
  isEstimate: boolean
}

function formatNumber(n: number): string {
  return n.toLocaleString()
}

function formatCtr(ctr: number): string {
  return (ctr * 100).toFixed(2) + '%'
}

function capitalizeLabel(label: string): string {
  if (label === 'original') return 'Original'
  if (label === 'variant_b') return 'Variant B'
  if (label === 'variant_c') return 'Variant C'
  if (label === 'variant_d') return 'Variant D'
  return label.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export function AbVariantCard({ variant, isWinner, isLeading, isEstimate }: AbVariantCardProps) {
  const borderClass = isWinner
    ? 'border-l-4 border-l-green-500'
    : 'border border-cms-border'

  const bgClass = isLeading && !isWinner ? 'bg-green-950/20' : 'bg-cms-surface'
  const dashed = isEstimate ? 'border-dashed' : ''

  return (
    <div
      className={[
        'rounded-[var(--cms-radius)] overflow-hidden',
        borderClass,
        bgClass,
        dashed,
        !isWinner ? 'border border-cms-border' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {isWinner && (
        <div className="px-3 pt-2 pb-1">
          <span className="inline-flex items-center rounded-full bg-green-900/40 px-2 py-0.5 text-[10px] font-semibold text-green-400">
            Winner
          </span>
        </div>
      )}

      <div className="relative w-full" style={{ aspectRatio: '16/9' }}>
        {variant.blob_url ? (
          <Image
            src={variant.blob_url}
            alt={capitalizeLabel(variant.label)}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 25vw"
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-cms-surface-hover text-xs text-cms-text-muted">
            No thumbnail
          </div>
        )}
      </div>

      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-cms-text-muted uppercase font-medium tracking-wide">CTR</span>
          <span className="text-lg font-bold text-cms-text">{formatCtr(variant.avg_ctr)}</span>
        </div>

        <div className="grid grid-cols-3 gap-1 text-center">
          <div>
            <p className="text-[10px] text-cms-text-muted">Impressions</p>
            <p className="text-xs font-medium text-cms-text">{formatNumber(variant.total_impressions)}</p>
          </div>
          <div>
            <p className="text-[10px] text-cms-text-muted">Clicks</p>
            <p className="text-xs font-medium text-cms-text">{formatNumber(variant.total_clicks)}</p>
          </div>
          <div>
            <p className="text-[10px] text-cms-text-muted">Cycles</p>
            <p className="text-xs font-medium text-cms-text">{variant.cycles_completed}</p>
          </div>
        </div>

        <div className="pt-1 border-t border-cms-border">
          <span className="text-xs font-medium text-cms-text-muted uppercase tracking-wide">
            {capitalizeLabel(variant.label)}
          </span>
        </div>
      </div>
    </div>
  )
}
