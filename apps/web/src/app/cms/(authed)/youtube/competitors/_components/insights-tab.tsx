'use client'

import { Fragment } from 'react'
import { toast } from 'sonner'
import { fmtC, brDec } from '@/lib/youtube/format'
import type { CompetitorInsights } from '@/lib/youtube/observatory-types'

interface InsightsTabProps {
  insights: CompetitorInsights
}

function handleKeyAction(e: React.KeyboardEvent, fn: () => void) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    fn()
  }
}

const DAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

function heatColor(value: number, max: number): string {
  if (max <= 0) return 'var(--surface-3)'
  const ratio = value / max
  if (ratio < 0.2) return 'var(--surface-3)'
  if (ratio < 0.4) return 'rgba(255,130,64,0.15)'
  if (ratio < 0.6) return 'rgba(255,130,64,0.30)'
  if (ratio < 0.8) return 'rgba(255,130,64,0.50)'
  return 'rgba(255,130,64,0.75)'
}

export function InsightsTab({ insights }: InsightsTabProps) {
  const hasData = insights.tags.length > 0 || insights.engagement.length > 0

  if (!hasData && insights.gaps.length === 0) {
    return (
      <div className="fade-in text-center py-12" style={{ color: 'var(--text-dim)' }}>
        <p className="text-sm">Dados insuficientes. Adicione competidores e aguarde sync.</p>
      </div>
    )
  }

  return (
    <div className="fade-in insights-grid stagger">
      {/* Heatmap card */}
      <HeatmapCard heatmap={insights.heatmap} />

      {/* Tags card */}
      <TagsCard tags={insights.tags} />

      {/* Engagement card */}
      <EngagementCard engagement={insights.engagement} />

      {/* Gaps card */}
      <GapsCard gaps={insights.gaps} />
    </div>
  )
}

function HeatmapCard({ heatmap }: { heatmap: number[][] }) {
  const flatMax = Math.max(...heatmap.flat(), 1)

  // Find best hour/day
  let bestDay = 0
  let bestHour = 0
  let bestVal = 0
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      const v = heatmap[d]?.[h] ?? 0
      if (v > bestVal) { bestVal = v; bestDay = d; bestHour = h }
    }
  }

  return (
    <div className="rounded-[14px] p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <h4 className="text-sm font-semibold mb-1" style={{ color: 'var(--text)' }}>Melhor Horário</h4>
      <p className="text-xs mb-3" style={{ color: 'var(--text-dim)' }}>Quando os competidores publicam com mais views</p>

      {/* 7x24 grid */}
      <div className="overflow-x-auto">
        <div style={{ display: 'grid', gridTemplateColumns: 'auto repeat(24, 1fr)', gap: 2, minWidth: 500 }}>
          {/* Hour headers */}
          <div />
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="text-center text-[8px] tnum" style={{ color: 'var(--text-dim)' }}>
              {h}
            </div>
          ))}

          {/* Day rows */}
          {DAY_LABELS.map((day, d) => (
            <Fragment key={d}>
              <div className="text-[9px] font-medium pr-1 flex items-center" style={{ color: 'var(--text-muted)' }}>
                {day}
              </div>
              {Array.from({ length: 24 }, (_, h) => {
                const val = heatmap[d]?.[h] ?? 0
                return (
                  <div
                    key={`${d}-${h}`}
                    className="heat-cell rounded-sm"
                    style={{
                      background: heatColor(val, flatMax),
                      aspectRatio: '1',
                      minHeight: 12,
                    }}
                    title={`${day} ${h}h — ${val}`}
                  />
                )
              })}
            </Fragment>
          ))}
        </div>
      </div>

      {/* Best time note */}
      <div
        className="insight-note flex items-center gap-2 mt-3 rounded-lg px-3 py-2 text-xs"
        style={{ background: 'var(--accent-soft, rgba(255,130,64,0.1))', color: 'var(--accent)' }}
      >
        Melhor janela: <span className="font-semibold">{DAY_LABELS[bestDay]} às {bestHour}h</span>
      </div>
    </div>
  )
}

function TagsCard({ tags }: { tags: CompetitorInsights['tags'] }) {
  if (tags.length === 0) return null
  const maxCount = tags[0]?.count ?? 1

  return (
    <div className="rounded-[14px] p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <h4 className="text-sm font-semibold mb-1" style={{ color: 'var(--text)' }}>Tags Mais Usadas</h4>
      <p className="text-xs mb-3" style={{ color: 'var(--text-dim)' }}>Nos vídeos dos competidores</p>

      <div className="flex flex-col gap-1.5">
        {tags.map(t => {
          const pct = (t.count / maxCount) * 100
          return (
            <div key={t.tag} className="tag-row flex items-center gap-2">
              <span className="text-[11px] w-28 truncate text-right" style={{ color: 'var(--text-muted)' }}>
                {t.tag}
              </span>
              <div className="flex-1 h-4 rounded" style={{ background: 'var(--surface-2)' }}>
                <div
                  className="h-full rounded"
                  style={{ width: `${pct}%`, background: 'var(--accent)', opacity: 0.5 }}
                />
              </div>
              <span className="text-[10px] w-8 tnum" style={{ color: 'var(--text-dim)' }}>
                {t.count}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function EngagementCard({ engagement }: { engagement: CompetitorInsights['engagement'] }) {
  if (engagement.length === 0) return null
  const maxRate = Math.max(...engagement.map(e => e.engagementRate), 0.001)

  return (
    <div className="rounded-[14px] p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <h4 className="text-sm font-semibold mb-1" style={{ color: 'var(--text)' }}>Engajamento Comparativo</h4>
      <p className="text-xs mb-3" style={{ color: 'var(--text-dim)' }}>Taxa de engajamento por canal</p>

      <div className="flex flex-col gap-2">
        {engagement.map(e => {
          const pct = (e.engagementRate / maxRate) * 100
          const isUs = e.isUs
          return (
            <div
              key={e.channelName}
              className="eng-row flex items-center gap-2 rounded-lg px-2 py-1.5"
              style={{
                background: isUs ? 'var(--accent-soft, rgba(255,130,64,0.1))' : 'transparent',
                border: isUs ? '1px solid var(--accent-line, rgba(255,130,64,0.3))' : '1px solid transparent',
              }}
            >
              <span className="text-[11px] w-28 truncate text-right flex items-center gap-1 justify-end" style={{ color: isUs ? 'var(--accent)' : 'var(--text-muted)' }}>
                {isUs && <span className="us-tag rounded px-1 py-0.5 text-[8px] font-bold uppercase" style={{ background: 'var(--accent)', color: 'var(--on-accent, #1A120A)' }}>VOCÊ</span>}
                {e.channelName}
              </span>
              <div className="flex-1 h-4 rounded" style={{ background: 'var(--surface-2)' }}>
                <div
                  className="h-full rounded"
                  style={{
                    width: `${pct}%`,
                    background: isUs ? 'var(--accent)' : 'var(--tier-mid)',
                    opacity: isUs ? 0.8 : 0.4,
                  }}
                />
              </div>
              <span className="text-[10px] w-10 tnum text-right" style={{ color: isUs ? 'var(--accent)' : 'var(--text-dim)' }}>
                {brDec(e.engagementRate * 100, 1)}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function GapsCard({ gaps }: { gaps: CompetitorInsights['gaps'] }) {
  if (gaps.length === 0) return null

  const theirTopics = gaps.filter(g => !g.weCover)
  const ourTopics = gaps.filter(g => g.weCover)

  const handleGapClick = (topic: string) => {
    toast.success(`Ideia "${topic}" adicionada ao pipeline.`, { duration: 2800 })
  }

  return (
    <div className="rounded-[14px] p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <h4 className="text-sm font-semibold mb-1" style={{ color: 'var(--text)' }}>Gaps & Lacunas</h4>
      <p className="text-xs mb-3" style={{ color: 'var(--text-dim)' }}>O que eles cobrem vs o que cobrimos</p>

      <div className="gap-cols grid grid-cols-[1fr_auto_1fr] gap-3">
        {/* Their topics (gaps) */}
        <div>
          <p className="eyebrow mb-2">ELES COBREM</p>
          <div className="flex flex-col gap-1.5">
            {theirTopics.map(g => (
              <div
                key={g.topic}
                className="gap-chip clickable rounded-lg px-2 py-1.5 cursor-pointer"
                style={{ background: 'var(--accent-soft, rgba(255,130,64,0.1))', border: '1px solid var(--accent-line, rgba(255,130,64,0.2))' }}
                role="button"
                tabIndex={0}
                onClick={() => handleGapClick(g.topic)}
                onKeyDown={e => handleKeyAction(e, () => handleGapClick(g.topic))}
              >
                <p className="text-[11px] font-medium" style={{ color: 'var(--accent)' }}>{g.topic}</p>
                <p className="text-[9px] tnum" style={{ color: 'var(--text-dim)' }}>
                  {g.competitorCount} canais · {fmtC(g.avgViews)} views méd.
                </p>
              </div>
            ))}
            {theirTopics.length === 0 && (
              <p className="text-[10px]" style={{ color: 'var(--text-dim)' }}>Nenhuma lacuna identificada</p>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="flex items-stretch justify-center">
          <div style={{ width: 1, background: 'var(--border)' }} />
        </div>

        {/* Our topics */}
        <div>
          <p className="eyebrow mb-2">NÓS COBRIMOS</p>
          <div className="flex flex-col gap-1.5">
            {ourTopics.map(g => (
              <div
                key={g.topic}
                className="rounded-lg px-2 py-1.5"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
              >
                <p className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>{g.topic}</p>
                <p className="text-[9px] tnum" style={{ color: 'var(--text-dim)' }}>
                  {g.competitorCount} canais · {fmtC(g.avgViews)} views méd.
                </p>
              </div>
            ))}
            {ourTopics.length === 0 && (
              <p className="text-[10px]" style={{ color: 'var(--text-dim)' }}>Sem tópicos em comum</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
