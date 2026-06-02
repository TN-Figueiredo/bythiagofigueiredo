'use client'

import { useState, useMemo } from 'react'
import { brDec, fmtC, fmtRelative } from '@/lib/youtube/format'
import type { CompetitorOutlierView } from '@/lib/youtube/observatory-types'

interface OutliersTabProps {
  outliers: CompetitorOutlierView[]
  onVideoClick: (outlier: CompetitorOutlierView) => void
}

type TierFilter = 'all' | 'mid' | 'high' | 'top'

function handleKeyAction(e: React.KeyboardEvent, fn: () => void) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    fn()
  }
}

const TIER_META: Record<string, { label: string; color: string; range: string }> = {
  mid:  { label: '2-5x',  color: 'var(--tier-mid)', range: '2-5x a mediana' },
  high: { label: '5-10x', color: 'var(--tier-high)', range: '5-10x a mediana' },
  top:  { label: '>10x',  color: 'var(--tier-top)', range: '>10x a mediana' },
}

export function OutliersTab({ outliers, onVideoClick }: OutliersTabProps) {
  const [tierFilter, setTierFilter] = useState<TierFilter>('all')

  const filtered = useMemo(() => {
    if (tierFilter === 'all') return outliers
    return outliers.filter(o => o.tier === tierFilter)
  }, [outliers, tierFilter])

  if (outliers.length === 0) {
    return (
      <div className="fade-in text-center py-12" style={{ color: 'var(--text-dim)' }}>
        <p className="text-sm">Sem outliers nos competidores trackeados.</p>
        <p className="text-xs mt-1">Adicione mais canais e aguarde dados suficientes (mínimo 3 vídeos por canal).</p>
      </div>
    )
  }

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          {(['all', 'mid', 'high', 'top'] as const).map(t => (
            <button
              key={t}
              className={`chip ${tierFilter === t ? 'on' : ''}`}
              onClick={() => setTierFilter(t)}
            >
              {t === 'all' ? 'Todos' : TIER_META[t]?.label}
              {t !== 'all' && TIER_META[t] && (
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: TIER_META[t]?.color }}
                  aria-hidden="true"
                />
              )}
            </button>
          ))}
        </div>

        {/* Legend row */}
        <div className="legend-row flex items-center gap-3 ml-auto text-[10px]" style={{ color: 'var(--text-dim)' }}>
          {Object.entries(TIER_META).map(([key, meta]) => (
            <span key={key} className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: meta.color }} aria-hidden="true" />
              {meta.range}
            </span>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-8" style={{ color: 'var(--text-dim)' }}>
          <p className="text-sm">Nenhum outlier neste tier.</p>
        </div>
      ) : (
        <div className="outlier-grid stagger">
          {filtered.map(o => {
            const meta = TIER_META[o.tier] ?? { label: o.tier, color: 'var(--tier-mid)', range: '' }
            return (
              <div
                key={o.id}
                className="outlier-card clickable rounded-[14px] overflow-hidden cursor-pointer"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                role="button"
                tabIndex={0}
                onClick={() => onVideoClick(o)}
                onKeyDown={e => handleKeyAction(e, () => onVideoClick(o))}
              >
                {/* Thumbnail + mult badge */}
                <div className="relative">
                  {o.thumbnailUrl ? (
                    <img
                      src={o.thumbnailUrl}
                      alt={o.title ?? ''}
                      referrerPolicy="no-referrer"
                      className="w-full aspect-video object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full aspect-video flex items-center justify-center text-xs" style={{ background: 'var(--surface-3)', color: 'var(--text-dim)' }}>
                      Sem thumbnail
                    </div>
                  )}
                  <span
                    className="mult-badge absolute top-2 right-2 rounded-lg px-2 py-1 text-xs font-bold mono"
                    style={{ background: meta.color, color: '#fff' }}
                  >
                    {brDec(o.multiplier, 1)}x
                  </span>
                </div>

                {/* Body */}
                <div className="p-3">
                  <p className="text-xs font-medium line-clamp-2" style={{ color: 'var(--text)' }}>
                    {o.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5 text-[10px]" style={{ color: 'var(--text-dim)' }}>
                    <span>{o.channelName}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[10px] tnum" style={{ color: 'var(--text-dim)' }}>
                    <span>{fmtC(o.viewCount)} views</span>
                    {o.publishedAt && <span>{fmtRelative(o.publishedAt)}</span>}
                  </div>

                  {/* Outlier CTA (revealed on hover) */}
                  <div className="outlier-cta mt-2 text-[11px] font-medium">
                    Analisar vídeo →
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
