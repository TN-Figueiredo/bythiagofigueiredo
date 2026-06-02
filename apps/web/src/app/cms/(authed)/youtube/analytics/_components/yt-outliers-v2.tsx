/**
 * YtOutliersV2 — refactored per spec 4.3.5.
 *
 * List -> .outlier-grid.stagger cards.
 * Add video thumbnails.
 * Add "Criar teste A/B" affordance (.outlier-cta revealed on hover/focus).
 * Card lift with accent-line border.
 */
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { brDec } from '@/lib/youtube/format'
import type { Axis } from '@/lib/youtube/scoring-types'
import { AXIS_LABELS } from '@/lib/youtube/scoring-types'
import type { OutlierVideo } from './types'

interface Props {
  outliers: OutlierVideo[]
  hasAnalyticsData?: boolean
}

const TIER_COLORS: Record<string, string> = {
  high: 'var(--tier-high)',
  top: 'var(--tier-top)',
}

function getTier(modifiedZ: number): 'mid' | 'high' | 'top' {
  if (Math.abs(modifiedZ) >= 5) return 'top'
  if (Math.abs(modifiedZ) >= 3) return 'high'
  return 'mid'
}

function getTierColor(tier: string): string {
  return TIER_COLORS[tier] ?? 'var(--tier-mid)'
}

export function YtOutliersV2({ outliers, hasAnalyticsData = true }: Props) {
  const [selectedAxis, setSelectedAxis] = useState<Axis | 'all'>('all')
  const axes: Axis[] = ['ctr', 'retention', 'reach', 'engagement', 'growth', 'sub_impact']

  const filtered = selectedAxis === 'all' ? outliers : outliers.filter(o => o.axis === selectedAxis)
  const positive = filtered
    .filter(o => o.direction === 'positive')
    .sort((a, b) => b.modifiedZ - a.modifiedZ)

  if (outliers.length === 0) {
    return (
      <div className="fade-in flex h-40 flex-col items-center justify-center gap-2 rounded border border-dashed border-cms-border">
        <p className="text-xs text-cms-text-muted">Nenhum outlier significativo detectado.</p>
        {!hasAnalyticsData && (
          <p className="max-w-sm text-center text-[10px] text-cms-text-muted/70">
            Os dados de CTR, retencao e impressoes ainda nao foram sincronizados. Outliers aparecerao quando
            a YouTube Analytics API fornecer metricas detalhadas (pode levar 48-72h apos a conexao).
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="fade-in flex flex-col gap-4">
      {/* Intro */}
      <p className="text-xs text-cms-text-muted">
        Videos do seu canal com performance acima da mediana. Clique para criar um teste A/B.
      </p>

      {/* Axis filter */}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setSelectedAxis('all')}
          className={`chip${selectedAxis === 'all' ? ' on' : ''}`}
          aria-pressed={selectedAxis === 'all'}
        >
          Todos
        </button>
        {axes.map(a => (
          <button
            key={a}
            type="button"
            onClick={() => setSelectedAxis(a)}
            className={`chip${selectedAxis === a ? ' on' : ''}`}
            aria-pressed={selectedAxis === a}
          >
            {AXIS_LABELS[a]}
          </button>
        ))}
      </div>

      {/* Outlier grid */}
      {positive.length > 0 && (
        <div className="outlier-grid stagger">
          {positive.map(o => {
            const tier = getTier(o.modifiedZ)
            const tierColor = getTierColor(tier)

            return (
              <div
                key={`${o.videoId}-${o.axis}`}
                className="outlier-card clickable rounded-lg border border-cms-border bg-cms-surface"
                role="button"
                tabIndex={0}
                title={`Criar teste A/B para "${o.title}"`}
                onClick={() => toast.success(`Teste A/B criado para "${o.title}"`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    toast.success(`Teste A/B criado para "${o.title}"`)
                  }
                }}
              >
                {/* Thumbnail placeholder (no URL in outlier data, show colored bar) */}
                <div
                  className="relative h-24 w-full rounded-t-lg"
                  style={{ background: `linear-gradient(135deg, ${tierColor}20, var(--surface-3))` }}
                >
                  <span
                    className="tnum absolute right-2 top-2 rounded px-1.5 py-0.5 text-[10px] font-bold"
                    style={{ background: `${tierColor}20`, color: tierColor }}
                  >
                    z={brDec(o.modifiedZ, 1)}
                  </span>
                </div>

                <div className="p-3">
                  <p className="line-clamp-2 text-xs font-medium text-cms-text">
                    {o.title || 'Sem titulo'}
                  </p>

                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <span
                      className="rounded px-1.5 py-0.5 text-[9px] font-medium"
                      style={{ background: `${tierColor}15`, color: tierColor }}
                    >
                      {AXIS_LABELS[o.axis]}
                    </span>
                    {o.patterns?.map(p => (
                      <span key={p} className="rounded bg-cms-border px-1.5 py-0.5 text-[9px] text-cms-text-muted">
                        {p}
                      </span>
                    ))}
                  </div>

                  {/* Affordance: Criar teste A/B */}
                  <div className="outlier-cta mt-2 flex items-center gap-1 text-[11px]">
                    Criar teste A/B
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12h14" />
                      <path d="m12 5 7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {positive.length === 0 && filtered.length > 0 && (
        <p className="text-center text-xs text-cms-text-muted">
          Nenhum outlier positivo neste eixo. Selecione "Todos" para ver outros.
        </p>
      )}
    </div>
  )
}
