'use client'

import { useState } from 'react'
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
  const [isDownloading, setIsDownloading] = useState(false)

  async function handleDownload() {
    if (!variant.blob_url || isDownloading) return
    setIsDownloading(true)
    try {
      const res = await fetch(variant.blob_url)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${variant.label}.jpg`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } finally {
      setIsDownloading(false)
    }
  }

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

      <div className="group relative w-full" style={{ aspectRatio: '16/9' }}>
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
        {variant.blob_url && (
          <button
            type="button"
            onClick={handleDownload}
            disabled={isDownloading}
            className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80 disabled:opacity-50"
            title="Download thumbnail"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
        )}
      </div>

      {variant.title_text && (
        <div className="px-3 pt-2">
          <span className="text-[10px] text-cms-text-muted">Título</span>
          <p className="text-sm font-medium text-cms-text">{variant.title_text}</p>
        </div>
      )}
      {variant.description_text && (
        <div className="px-3 pt-2">
          <span className="text-[10px] text-cms-text-muted">Descrição</span>
          <p className="text-xs line-clamp-3 font-mono text-cms-text opacity-80">{variant.description_text}</p>
        </div>
      )}

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
