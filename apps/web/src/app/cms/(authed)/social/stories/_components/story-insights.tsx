'use client'

import { useEffect, useState } from 'react'
import type { StoryInsights } from '@/lib/social/story-types'
import { getStoryInsights } from '@/lib/social/actions/story-metrics'

interface StoryInsightsProps {
  siteId: string
  postId: string
}

export function StoryInsightsPanel({ siteId, postId }: StoryInsightsProps) {
  const [insights, setInsights] = useState<StoryInsights | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getStoryInsights(siteId, postId)
      .then(setInsights)
      .finally(() => setLoading(false))
  }, [siteId, postId])

  if (loading) return <div className="animate-pulse h-48 bg-cms-surface rounded-xl" />
  if (!insights) {
    return (
      <p className="text-cms-text-muted text-sm">
        Métricas disponíveis após primeiro poll.
      </p>
    )
  }

  const maxReach = Math.max(...insights.per_slide.map((s) => s.reach), 1)

  return (
    <div className="space-y-6">
      {/* Aggregate KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Alcance', value: insights.aggregate.reach },
          { label: 'Impressões', value: insights.aggregate.impressions },
          { label: 'Respostas', value: insights.aggregate.replies },
          { label: 'Link Clicks', value: insights.aggregate.link_clicks },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-cms-border bg-cms-surface p-4 text-center"
          >
            <p className="text-2xl font-bold tabular-nums text-cms-text">
              {kpi.value.toLocaleString('pt-BR')}
            </p>
            <p className="text-xs text-cms-text-muted mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Per-slide reach bar chart */}
      {insights.per_slide.length > 1 && (
        <div>
          <h3 className="text-sm font-semibold text-cms-text mb-3">Alcance por Slide</h3>
          <div className="space-y-2">
            {insights.per_slide.map((slide, i) => (
              <div key={slide.slide_index} className="flex items-center gap-3">
                <span className="text-xs text-cms-text-muted w-8 shrink-0">
                  S{slide.slide_index + 1}
                </span>
                <div className="flex-1 h-6 bg-cms-surface border border-cms-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                    style={{ width: `${(slide.reach / maxReach) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-cms-text w-16 text-right tabular-nums shrink-0">
                  {slide.reach.toLocaleString('pt-BR')}
                </span>
                {i > 0 && insights.drop_off[i - 1] && (
                  <span className="text-[10px] text-red-400 w-12 text-right shrink-0">
                    -{insights.drop_off[i - 1].drop_percentage.toFixed(1)}%
                  </span>
                )}
              </div>
            ))}
          </div>
          <p className="text-[10px] text-cms-text-muted mt-3 italic leading-relaxed">
            Nota: a diferença de alcance entre slides não é necessariamente perda — novos viewers
            podem entrar em qualquer slide. Use como referência, não como métrica precisa de abandono.
          </p>
        </div>
      )}
    </div>
  )
}
