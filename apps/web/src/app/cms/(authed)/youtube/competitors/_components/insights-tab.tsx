'use client'

import { useState, useTransition, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Zap, Activity, Calendar, BarChart3, Target, Sparkles, ArrowRight, Plus, FlaskConical, Check,
} from 'lucide-react'
import { fmtC, brDec, fmtRelative } from '@/lib/youtube/format'
import { createPipelineItem } from '@/app/cms/(authed)/pipeline/actions'
import type { CompetitorInsights } from '@/lib/youtube/observatory-types'

interface InsightsTabProps {
  insights: CompetitorInsights
}

const DAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

function heatCellColor(value: number, max: number): string {
  if (max <= 0 || value <= 0) return 'var(--surface-3)'
  const r = value / max
  const g = Math.round(255 * (1 - r))
  const rb = Math.round(190 * r + 29 * (1 - r))
  const gb = Math.round(45 * r + 123 * (1 - r))
  const bb = Math.round(45 * r + 52 * (1 - r))
  return `rgb(${rb}, ${gb}, ${bb})`
}

function heatTitle(value: number, max: number): string {
  if (value <= 0) return 'sem uploads'
  const pct = Math.round((value / max) * 100)
  return `${pct}% de atividade`
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
      {/* 1. Jogada da Semana (full width) */}
      {insights.play && <PlayCard play={insights.play} />}

      {/* 2. Cadencia por Canal (full width) */}
      {insights.cadence.length > 0 && <CadenceCard cadence={insights.cadence} />}

      {/* 3. Formulas de Titulo */}
      {insights.formulas.length > 0 && <FormulasCard formulas={insights.formulas} outlierCount={insights.formulas.reduce((s, f) => s + f.count, 0)} />}

      {/* 4. Horarios do Nicho */}
      <HeatmapCard heatmap={insights.heatmap} hitsHeatmap={insights.hitsHeatmap} />

      {/* 5. Tags */}
      <TagsCard tags={insights.tags} />

      {/* 6. Engajamento */}
      <EngagementCard engagement={insights.engagement} />

      {/* 7. Lacunas (full width) */}
      {insights.gaps.length > 0 && <GapsCard gaps={insights.gaps} ownTagsByChannel={insights.ownTagsByChannel} competitorTagsByChannel={insights.competitorTagsByChannel} />}
    </div>
  )
}

/* ── 1. Jogada da Semana ── */

function PlayCard({ play }: { play: NonNullable<CompetitorInsights['play']> }) {
  return (
    <div className="card play-card ins-full">
      <div className="play-main">
        <span className="play-eyebrow">
          <Zap style={{ width: 12, height: 12, stroke: 'var(--accent)' }} aria-hidden="true" />
          Jogada da semana
        </span>
        <p className="play-text">
          Poste sobre <b>{play.topicBold}</b> com a fórmula <b>{play.formulaBold}</b>{' '}
          <span className="dim">({brDec(play.formulaMult, 1)}× nos outliers)</span>{' '}
          e publique na janela vazia de <b>{play.windowBold}</b> — {play.windowReason}
        </p>
      </div>
      <button className="btn cowork play-cta" disabled title="Integração com Cowork em desenvolvimento" style={{ opacity: 0.5, cursor: 'not-allowed' }}>
        <Sparkles style={{ width: 14, height: 14 }} aria-hidden="true" />
        Montar roteiro
      </button>
    </div>
  )
}

/* ── 2. Cadencia por Canal ── */

const CADENCE_DAY_NAMES = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'] as const

function computeCadenceInsight(cadence: CompetitorInsights['cadence']): string | null {
  const allVideos = cadence.flatMap(c => c.videos)
  if (allVideos.length < 10) return null

  // Build 7x24 volume grid and hits grid (top quartile by viewCount)
  const volumeGrid: number[][] = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0))
  const hitsGrid: number[][] = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0))

  const sortedViews = [...allVideos].map(v => v.viewCount).sort((a, b) => a - b)
  const topQuartileThreshold = sortedViews[Math.floor(sortedViews.length * 0.75)] ?? 0

  for (const v of allVideos) {
    const d = new Date(v.publishedAt)
    const dayIdx = (d.getDay() + 6) % 7 // 0=Mon
    const hourIdx = d.getHours()
    const dayRow = volumeGrid[dayIdx]
    if (dayRow) dayRow[hourIdx] = (dayRow[hourIdx] ?? 0) + 1

    if (v.viewCount >= topQuartileThreshold && topQuartileThreshold > 0) {
      const hitsRow = hitsGrid[dayIdx]
      if (hitsRow) hitsRow[hourIdx] = (hitsRow[hourIdx] ?? 0) + 1
    }
  }

  // Find peak volume slot
  let peakVolDay = 0, peakVolHour = 0, peakVolVal = 0
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      const v = volumeGrid[d]?.[h] ?? 0
      if (v > peakVolVal) { peakVolVal = v; peakVolDay = d; peakVolHour = h }
    }
  }

  // Find peak hits slot
  let peakHitsDay = 0, peakHitsHour = 0, peakHitsVal = 0
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      const v = hitsGrid[d]?.[h] ?? 0
      if (v > peakHitsVal) { peakHitsVal = v; peakHitsDay = d; peakHitsHour = h }
    }
  }

  if (peakVolVal === 0 && peakHitsVal === 0) return null

  const volSlot = `${CADENCE_DAY_NAMES[peakVolDay]} ${peakVolHour}h–${peakVolHour + 2}h`
  const hitsSlot = peakHitsVal > 0
    ? `${CADENCE_DAY_NAMES[peakHitsDay]}${peakHitsDay + 1 < 7 ? '–' + CADENCE_DAY_NAMES[peakHitsDay + 1] : ''} ${peakHitsHour}h–${peakHitsHour + 2}h`
    : null

  if (hitsSlot && (peakHitsDay !== peakVolDay || Math.abs(peakHitsHour - peakVolHour) > 2)) {
    return `Pico de volume: ${volSlot} (lotado). Mas os maiores hits recentes saíram em ${hitsSlot} — janela quase vazia. Bolinha maior = mais views.`
  }

  return `Pico de volume: ${volSlot}. Bolinha maior = mais views.`
}

function CadenceCard({ cadence }: { cadence: CompetitorInsights['cadence'] }) {
  const DAYS_RANGE = 21
  const now = Date.now()

  const allViews = cadence.flatMap(c => c.videos.map(v => v.viewCount)).filter(v => v > 0)
  const logMax = allViews.length > 0 ? Math.log10(Math.max(...allViews)) : 1
  const logMin = allViews.length > 0 ? Math.log10(Math.min(...allViews) || 1) : 0

  const cadenceInsight = computeCadenceInsight(cadence)

  return (
    <div className="card cad-card ins-full">
      <div className="card-head">
        <Activity style={{ width: 15, height: 15, stroke: 'var(--text-dim)' }} aria-hidden="true" />
        <span className="card-title">Cadência por canal</span>
        <div className="cad-legend">
          <span className="cad-leg-item"><span className="cad-leg-tick" /><span>publicou</span></span>
          <span className="cad-leg-item"><span className="cad-leg-dot" /><span>vídeo notável </span><span className="dim">(tamanho = views)</span></span>
        </div>
      </div>

      <div className="card-pad">
        <div className="cad-lanes">
          {/* Axis */}
          <div className="cad-axis">
            <span className="section-label" style={{ width: 200, flexShrink: 0 }}>Canal · ritmo · janela</span>
            <div className="cad-axis-ticks">
              <span style={{ left: '0%' }}>há {DAYS_RANGE}d</span>
              <span style={{ left: '33.33%' }}>14d</span>
              <span style={{ left: '66.66%' }}>7d</span>
              <span style={{ left: '100%' }}>hoje</span>
            </div>
            <span className="section-label" style={{ width: 48, textAlign: 'right', flexShrink: 0 }}>último</span>
          </div>

          {/* Rows */}
          {cadence.map(ch => {
            const initials = ch.channelName.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()

            return (
              <div key={ch.channelId} className="cad-row clickable" role="button" tabIndex={0} aria-label={`Abrir canal ${ch.channelName}`}>
                <div className="cad-id">
                  <span className="cad-av" style={{ background: ch.color }}>{initials}</span>
                  <div className="cad-meta">
                    <div className="cad-name truncate">{ch.channelName}</div>
                    <div className="cad-sub">
                      <span className="cad-freq mono">{brDec(ch.freq, 1)}/sem</span>
                      <span>·</span>
                      <span className="cad-win">{ch.window}</span>
                    </div>
                  </div>
                </div>

                <div className="cad-lane">
                  {ch.videos.map((v, i) => {
                    const vDate = new Date(v.publishedAt).getTime()
                    const daysAgo = (now - vDate) / 86_400_000
                    if (daysAgo > DAYS_RANGE) return null
                    const pct = ((DAYS_RANGE - daysAgo) / DAYS_RANGE) * 100
                    const logV = v.viewCount > 0 ? Math.log10(v.viewCount) : logMin
                    const ratio = logMax > logMin ? (logV - logMin) / (logMax - logMin) : 0.5
                    const size = Math.round(7 + ratio * 9)

                    return (
                      <Fragment key={i}>
                        <span className="cad-tick" style={{ left: `${pct}%`, background: ch.color }} />
                        <span
                          className="cad-dot"
                          role="button"
                          tabIndex={0}
                          title={`"${v.title}" · ${fmtC(v.viewCount)} · ${fmtRelative(v.publishedAt)} · abrir`}
                          aria-label={`Abrir vídeo: ${v.title}`}
                          style={{ left: `${pct}%`, width: size, height: size, background: ch.color }}
                        />
                      </Fragment>
                    )
                  })}
                </div>

                <div className={`cad-last mono${ch.lastUploadDays <= 3 ? ' fresh' : ''}`}>
                  há {ch.lastUploadDays}d
                </div>
              </div>
            )
          })}
        </div>

        <div className="insight-note">
          <Zap style={{ width: 13, height: 13, stroke: 'var(--accent)', flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
          <span style={{ flex: 1 }}>
            {cadenceInsight ?? 'Dados insuficientes para calcular janelas de publicação. Adicione mais concorrentes ou aguarde sync.'}
          </span>
        </div>
      </div>
    </div>
  )
}

/* ── 3. Formulas de Titulo ── */

function FormulasCard({ formulas, outlierCount }: { formulas: CompetitorInsights['formulas']; outlierCount: number }) {
  const maxMult = formulas[0]?.multiplier ?? 1

  return (
    <div className="card">
      <div className="card-head">
        <Zap style={{ width: 15, height: 15, stroke: 'var(--text-dim)' }} aria-hidden="true" />
        <span className="card-title">Fórmulas de título que furam</span>
        <span className="dim" style={{ fontSize: 11.5, marginLeft: 'auto' }}>
          padrões nos {outlierCount} outliers · mult. médio
        </span>
      </div>
      <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        {formulas.map((f, i) => {
          const barPct = (f.multiplier / maxMult) * 100
          const isTop = i === 0

          return (
            <div key={f.label} className="formula-row clickable" role="button" tabIndex={0} aria-label={`Gerar título com a fórmula ${f.label}`}>
              <div className="formula-top">
                <span className="formula-label truncate">{f.label}</span>
                <span className="formula-mult mono" style={{ color: isTop ? 'var(--accent)' : 'var(--text)' }}>
                  {brDec(f.multiplier, 1)}×
                </span>
              </div>
              <div className="formula-bar">
                <span style={{
                  width: `${barPct}%`,
                  background: isTop ? 'var(--accent)' : 'var(--surface-3)',
                  boxShadow: isTop ? 'none' : 'inset 0 0 0 1px var(--border-strong, var(--border))',
                }} />
              </div>
              <div className="formula-eg truncate">
                <span className="formula-hint">{f.hint}</span>
                <span> · </span>
                <span className="formula-count mono">{f.count}×</span>
                <span> &quot;{f.exampleTitle}&quot;</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── 4. Heatmap ── */

function HeatmapCard({ heatmap, hitsHeatmap }: { heatmap: number[][]; hitsHeatmap: number[][] }) {
  const [mode, setMode] = useState<'volume' | 'hits'>('volume')
  const data = mode === 'volume' ? heatmap : hitsHeatmap
  const flatMax = Math.max(...data.flat(), 1)

  let peakDay = 0, peakHour = 0, peakVal = 0
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      const v = data[d]?.[h] ?? 0
      if (v > peakVal) { peakVal = v; peakDay = d; peakHour = h }
    }
  }

  const HOUR_LABELS = [0, 3, 6, 9, 12, 15, 18, 21]

  return (
    <div className="card">
      <div className="card-head">
        <Calendar style={{ width: 15, height: 15, stroke: 'var(--text-dim)' }} aria-hidden="true" />
        <span className="card-title">Horários do nicho</span>
        <div className="seg-pills" style={{ marginLeft: 'auto' }}>
          <button className={`seg-pill${mode === 'volume' ? ' on' : ''}`} onClick={() => setMode('volume')} title="Onde todo mundo publica">Volume</button>
          <button className={`seg-pill${mode === 'hits' ? ' on' : ''}`} onClick={() => setMode('hits')} title="Onde nascem os vídeos de alta performance">Hits</button>
        </div>
      </div>

      <div className="card-pad">
        <div className="dim" style={{ fontSize: 11.5, marginBottom: 12 }}>
          {mode === 'volume'
            ? 'quando os concorrentes publicam — todos os uploads (horário de SP)'
            : 'onde nascem os vídeos de alta performance (horário de SP)'}
        </div>

        <div className="heatmap">
          <div className="heat-corner" />
          <div className="heat-hours">
            {HOUR_LABELS.map(h => (
              <span key={h} className="mono heat-hlabel">{h}h</span>
            ))}
          </div>

          {DAY_LABELS.map((day, d) => (
            <Fragment key={d}>
              <span className="mono heat-dlabel">{day}</span>
              <div className="heat-row">
                {Array.from({ length: 24 }, (_, h) => {
                  const val = data[d]?.[h] ?? 0
                  return (
                    <div
                      key={h}
                      className="heat-cell"
                      title={heatTitle(val, flatMax)}
                      style={{ background: heatCellColor(val, flatMax) }}
                    />
                  )
                })}
              </div>
            </Fragment>
          ))}
        </div>

        {/* Scale legend */}
        <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end', alignItems: 'center' }}>
          <span className="dim" style={{ fontSize: 10.5 }}>menos</span>
          <div className="heat-scale">
            {[0, 0.25, 0.5, 0.75, 1].map(r => (
              <div key={r} className="heat-cell" title={`${Math.round(r * 100)}% de atividade`} style={{ background: heatCellColor(r * flatMax, flatMax) }} />
            ))}
          </div>
          <span className="dim" style={{ fontSize: 10.5 }}>mais</span>
        </div>

        {/* Insight note */}
        <div className="insight-note">
          <Zap style={{ width: 13, height: 13, stroke: 'var(--accent)', flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
          <span style={{ flex: 1 }}>
            {mode === 'volume' ? (
              <>Pico de publicação: <b>{DAY_LABELS[peakDay]} {peakHour}h–{peakHour + 2}h</b> (lotado). Veja a aba <b>Hits</b> pra onde a performance realmente aparece.</>
            ) : (
              <>Os <b>hits nascem {DAY_LABELS[peakDay]} {peakHour}h–{peakHour + 2}h</b> — exatamente quando o <b>volume</b> está fraco. Postar fora do pico de sexta é a brecha.</>
            )}
          </span>
        </div>
      </div>
    </div>
  )
}

/* ── 5. Tags ── */

function TagsCard({ tags }: { tags: CompetitorInsights['tags'] }) {
  if (tags.length === 0) return null
  const maxCount = tags[0]?.count ?? 1

  return (
    <div className="card">
      <div className="card-head">
        <BarChart3 style={{ width: 15, height: 15, stroke: 'var(--text-dim)' }} aria-hidden="true" />
        <span className="card-title">Tags mais usadas</span>
        <span className="dim" style={{ fontSize: 11.5, marginLeft: 'auto' }}>
          em {tags.length} canais
        </span>
      </div>
      <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {tags.map((t, i) => {
          const pct = (t.count / maxCount) * 100
          const isTop = i < 3
          return (
            <div key={t.tag} className="tag-row clickable" role="button" tabIndex={0} aria-label={`Roteiro com a tag ${t.tag}`}>
              <span className="tag-name truncate">{t.tag}</span>
              <div className="bar" style={{ flex: 1 }}>
                <span style={{ width: `${pct}%`, background: isTop ? 'var(--accent)' : 'var(--blue)' }} />
              </div>
              <span className="mono dim tag-count">{t.count}</span>
              <ArrowRight style={{ width: 12, height: 12, stroke: 'var(--text-dim)' }} className="tag-go" aria-hidden="true" />
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── 6. Engajamento Comparado ── */

function EngagementCard({ engagement }: { engagement: CompetitorInsights['engagement'] }) {
  if (engagement.length === 0) return null
  const maxRate = Math.max(...engagement.map(e => e.engagementRate), 0.001)

  return (
    <div className="card">
      <div className="card-head">
        <Activity style={{ width: 15, height: 15, stroke: 'var(--text-dim)' }} aria-hidden="true" />
        <span className="card-title">Engajamento comparado</span>
        <span className="dim" style={{ fontSize: 11.5, marginLeft: 'auto' }}>
          curtidas + comentários / views
        </span>
      </div>
      <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        {engagement.map(e => {
          const pct = (e.engagementRate / maxRate) * 100
          const isUs = e.isUs
          return (
            <div
              key={e.channelName}
              className={`eng-row${!isUs ? ' clickable' : ''}`}
              role={isUs ? undefined : 'button'}
              tabIndex={isUs ? undefined : 0}
              aria-label={isUs ? undefined : `Abrir canal ${e.channelName}`}
            >
              <span className={`eng-name truncate${isUs ? ' us' : ''}`}>
                {e.channelName}
                {isUs && <span className="us-tag">você</span>}
              </span>
              <div className="bar" style={{ flex: 1 }}>
                <span style={{
                  width: `${pct}%`,
                  background: isUs ? 'var(--accent)' : 'var(--surface-3)',
                  boxShadow: isUs ? 'none' : 'inset 0 0 0 1px var(--border-strong, var(--border))',
                }} />
              </div>
              <span className="mono eng-val" style={{ color: isUs ? 'var(--accent)' : 'var(--text)' }}>
                {brDec(e.engagementRate * 100, 1)}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── 7. Análise de Lacunas ── */

function GapsCard({ gaps, ownTagsByChannel, competitorTagsByChannel }: {
  gaps: CompetitorInsights['gaps']
  ownTagsByChannel: CompetitorInsights['ownTagsByChannel']
  competitorTagsByChannel: CompetitorInsights['competitorTagsByChannel']
}) {
  const router = useRouter()
  const theirTopics = gaps.filter(g => !g.weCover)
  const gapCount = theirTopics.length
  const [addedTopics, setAddedTopics] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()

  const handleGapClick = (topic: string) => {
    if (addedTopics.has(topic)) return
    startTransition(async () => {
      const result = await createPipelineItem({
        format: 'video',
        title_pt: topic,
        synopsis: 'Lacuna identificada via analise de concorrentes — tema com tracao comprovada e zero cobertura propria.',
        tags: ['search-term'],
      })
      if (result.ok) {
        setAddedTopics(prev => new Set(prev).add(topic))
        toast.success(`Ideia "${topic}" adicionada ao pipeline.`, { duration: 2800 })
      } else {
        toast.error(result.error ?? 'Erro ao adicionar ao pipeline.')
      }
    })
  }

  const handleTestHighestTraction = () => {
    const topGap = theirTopics.sort((a, b) => b.avgViews - a.avgViews)[0]
    if (topGap) {
      toast(`Criando teste A/B para "${topGap.topic}"...`, { duration: 2000 })
    }
    router.push('/cms/youtube/ab-lab/new')
  }

  return (
    <div className="card ins-full">
      <div className="card-head">
        <Target style={{ width: 15, height: 15, stroke: 'var(--text-dim)' }} aria-hidden="true" />
        <span className="card-title">Análise de lacunas</span>
        <span className="dim" style={{ fontSize: 11.5, marginLeft: 'auto' }}>
          temas deles que você ainda não cobre
        </span>
      </div>

      <div className="card-pad gap-cols" style={{ padding: '12px 18px 0' }}>
        {/* Their tags — per competitor channel */}
        <div className="gap-col">
          {competitorTagsByChannel.map(ch => (
            <div key={ch.channelName} style={{ marginBottom: 10 }}>
              <span className="section-label">Tags · {ch.channelName}</span>
              <div className="gap-chips" style={{ marginTop: 6 }}>
                {ch.tags.map(t => {
                  const isGap = theirTopics.some(g => g.topic.toLowerCase() === t.toLowerCase())
                  const isAdded = addedTopics.has(t)
                  return isGap ? (
                    <button
                      key={t}
                      className="gap-chip gap clickable"
                      title={isAdded ? 'Já adicionado ao pipeline' : 'Criar roteiro deste tema'}
                      onClick={() => handleGapClick(t)}
                      disabled={isAdded || isPending}
                      style={isAdded ? { opacity: 0.6, cursor: 'default' } : undefined}
                    >
                      {isAdded
                        ? <Check style={{ width: 11, height: 11 }} aria-hidden="true" />
                        : <Plus style={{ width: 11, height: 11 }} aria-hidden="true" />
                      }
                      {t}
                    </button>
                  ) : (
                    <span key={t} className="gap-chip">{t}</span>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="gap-divider" />

        {/* Our tags — per own channel */}
        <div className="gap-col">
          {ownTagsByChannel.length > 0 ? ownTagsByChannel.map(ch => (
            <div key={ch.channelName} style={{ marginBottom: 10 }}>
              <span className="section-label">Suas tags · {ch.channelName}</span>
              <div className="gap-chips" style={{ marginTop: 6 }}>
                {ch.tags.length > 0 ? ch.tags.map(t => (
                  <span key={t} className="gap-chip ours">{t}</span>
                )) : (
                  <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Nenhuma tag ainda</span>
                )}
              </div>
            </div>
          )) : (
            <>
              <span className="section-label">Suas tags</span>
              <div className="gap-chips">
                <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Sem tags próprias ainda</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Insight note */}
      {gapCount > 0 && (
        <div className="insight-note" style={{ margin: '0 18px 14px' }}>
          <Sparkles style={{ width: 13, height: 13, stroke: 'var(--accent)', flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
          <span>
            <b>{gapCount} lacunas</b> com tração comprovada e zero cobertura sua — candidatas a roteiro.
          </span>
        </div>
      )}

      {/* CTAs */}
      {gapCount > 0 && (
        <div style={{ display: 'flex', gap: 8, margin: '0 18px 16px', flexWrap: 'wrap' }}>
          <button className="btn cowork sm" disabled title="Integração com Cowork em desenvolvimento" style={{ opacity: 0.5, cursor: 'not-allowed' }}>
            <Sparkles style={{ width: 13, height: 13 }} aria-hidden="true" />
            Roteirizar as {gapCount} lacunas no Cowork
          </button>
          <button className="btn sm" onClick={handleTestHighestTraction}>
            <FlaskConical style={{ width: 13, height: 13 }} aria-hidden="true" />
            Testar o tema de maior tração
          </button>
        </div>
      )}
    </div>
  )
}
