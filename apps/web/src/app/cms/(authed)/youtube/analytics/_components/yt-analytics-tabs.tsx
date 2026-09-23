/**
 * YtAnalyticsTabs — Performance tab container.
 *
 * Refactored per spec 4.3:
 * - page-head with: title "Desempenho", description, demo-switch, "Pedir diagnostico" button
 * - key={activeTab} on tabpanel for .fade-in re-animation
 * - Replaced "grades"/"Notas" tab with NotesView
 * - Demo-switch toggles Overview / PerfNewChannel
 */
'use client'

import { useState, useRef, useCallback, useMemo, type SyntheticEvent } from 'react'
import { useRouter } from 'next/navigation'
import { YtOverview } from './yt-overview'
import { YtOutliers } from './yt-outliers'
import { YtOutliersV2 } from './yt-outliers-v2'
import { YtHealthCoach } from './yt-health-coach'
import { YtDemographicsView } from './yt-demographics'
import { YtSearchTermsView } from './yt-search-terms'
import { NotesView } from './notes-view'
import type { NoteEntry } from './notes-view'
import { PerfNewChannel } from './perf-new-channel'
import { toast } from 'sonner'
import {
  useAnalysisTask,
  progressButtonLabel,
  progressAnnouncement,
  YtAnalysisProgress,
} from './yt-analysis-progress'
import { YtAnalysisHistory } from './yt-analysis-history'
import { isActive as isTaskActive, type AnalysisTaskSnapshot } from '@/lib/youtube/analysis-progress'
import type { HistoryEntry } from '@/lib/youtube/analysis-history'
import type {
  YtChannelMetrics,
  YtDailyMetric,
  YtVideoGrade,
  YtSearchTerm,
  YtDemographics,
} from '@/lib/youtube/analytics-types'
import type { YtConnectedChannel } from '@/lib/youtube/analytics-client'
import { AXIS_LABELS } from '@/lib/youtube/scoring-types'
import type { Axis } from '@/lib/youtube/scoring-types'
import type { CoachingOutput } from '@/lib/youtube/intelligence-types'
import type { VideoGradeRow, OutlierVideo } from './types'

/** Alinhado ao .filter(c => c.score < COACHING_BENCHMARK) abaixo — 5.0 era incoerente com o corte real. */
const COACHING_BENCHMARK = 6.5

function ChannelAvatar({ url, name }: { url: string | null; name: string }) {
  const [failed, setFailed] = useState(false)
  if (!url || failed) {
    return <span className="ch-tab-av ch-tab-av-fallback">{name.charAt(0)}</span>
  }
  return <img src={url} alt="" className="ch-tab-av" onError={() => setFailed(true)} />
}

const SUB_TABS = [
  { id: 'overview', label: 'Visao geral', countKey: null },
  { id: 'notes', label: 'Notas', countKey: 'notes' },
  { id: 'coach', label: 'Health Coach', countKey: 'coach' },
  { id: 'outliers', label: 'Outliers', countKey: 'outliers' },
  { id: 'demographics', label: 'Demografia', countKey: null },
  { id: 'search', label: 'Busca', countKey: 'search' },
] as const

const TAB_ICONS: Record<string, React.ReactNode> = {
  overview: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
  notes: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  coach: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M5 18l.7 1.8L7.5 20l-1.8.7L5 22l-.7-1.3L2.5 20l1.8-.2z"/></svg>,
  outliers: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 2c1 3 4 5 4 9a4 4 0 0 1-8 0c0-1 .5-2 1-2.5C9 11 12 8 12 2Z"/></svg>,
  demographics: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13A4 4 0 0 1 16 11"/></svg>,
  search: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>,
}

type TabId = (typeof SUB_TABS)[number]['id']

interface Props {
  metrics: YtChannelMetrics
  dailyMetrics: YtDailyMetric[]
  grades: YtVideoGrade[]
  searchTerms: YtSearchTerm[]
  demographics: YtDemographics
  channels?: YtConnectedChannel[]
  activeChannelId?: string
  channelInternalId?: string
  intelligenceVideos?: VideoGradeRow[]
  intelligenceOutliers?: OutlierVideo[]
  /**
   * `cards` is the analysis the coaching cards come from, set only when it is NOT the row
   * carrying the banner — the forja writes a summary with `priorities: []` by design, and
   * without it the newest row buries the last analysis that had cards. Mirrors
   * ChannelCoachingResult in ../actions.ts (re-declared, not imported: a client component
   * must not reach into a 'use server' module).
   */
  channelCoaching?: {
    coaching: CoachingOutput
    source: 'cowork' | 'forja'
    generatedLabel: string
    cards?: { coaching: CoachingOutput; source: 'cowork' | 'forja'; generatedLabel: string } | null
  } | null
  notes?: NoteEntry[]
  healthScore?: number
  onCreateNote?: (input: { channelId: string; text: string }) => Promise<{ ok: boolean; error?: string }>
  onDeleteNote?: (noteId: string) => Promise<{ ok: boolean; error?: string }>
  onRequestAnalysis?: (channelId: string) => Promise<unknown>
  /** The channel's newest task at render time, and the action that re-reads it. */
  initialTask?: AnalysisTaskSnapshot | null
  onPollTask?: (channelId: string) => Promise<AnalysisTaskSnapshot | null>
  /** Channel-level analyses, newest first (fetchAnalysisHistory). */
  history?: HistoryEntry[]
  lastAnalysisAt?: string | null
  searchTermsError?: string
  demographicsError?: string
}

export function YtAnalyticsTabs({
  metrics,
  dailyMetrics,
  grades,
  searchTerms,
  demographics,
  channels,
  activeChannelId,
  channelInternalId,
  intelligenceVideos,
  intelligenceOutliers,
  channelCoaching,
  notes,
  healthScore,
  onCreateNote,
  onDeleteNote,
  onRequestAnalysis,
  initialTask,
  onPollTask,
  history,
  lastAnalysisAt,
  searchTermsError,
  demographicsError,
}: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const isNewChannel = metrics.views === 0 && dailyMetrics.length < 7
  const [analysisState, setAnalysisState] = useState<'idle' | 'pending' | 'cooldown' | 'success'>('idle')
  const progress = useAnalysisTask(channelInternalId, initialTask ?? null, onPollTask)
  const refreshTask = progress.refresh
  // Busy while the request call is in flight AND for as long as the task is open: the button
  // used to fall back to "Pedir diagnostico" after 5 s while the forja had not even started.
  const busy = analysisState === 'pending' || isTaskActive(progress.task)
  const buttonProgress = progressButtonLabel(progress.view, progress.now)
  const activeChannelName = channels?.find(c => c.internalId === channelInternalId)?.name ?? 'canal'
  const tablistRef = useRef<HTMLDivElement>(null)

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const tabs = SUB_TABS.map(t => t.id)
    const i = tabs.indexOf(activeTab)
    let nextId: string | undefined
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      nextId = tabs[(i + 1) % tabs.length]!
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      nextId = tabs[(i - 1 + tabs.length) % tabs.length]!
    } else if (e.key === 'Home') {
      e.preventDefault()
      nextId = tabs[0]!
    } else if (e.key === 'End') {
      e.preventDefault()
      nextId = tabs[tabs.length - 1]!
    }
    if (nextId) {
      setActiveTab(nextId as TabId)
      document.getElementById(`tab-yt-${nextId}`)?.focus()
    }
  }, [activeTab])

  const handleRequestAnalysis = useCallback(async () => {
    if (!onRequestAnalysis || !channelInternalId || busy) return
    setAnalysisState('pending')
    try {
      const result = await onRequestAnalysis(channelInternalId) as { error?: string; ok?: boolean; hours_remaining?: number } | null
      if (result && typeof result === 'object' && 'error' in result) {
        if (result.error === 'cooldown') {
          const h = typeof result.hours_remaining === 'number' ? result.hours_remaining : null
          toast.info(h !== null
            ? `Um diagnóstico foi pedido há menos de 24 h. Novo pedido liberado em ~${h} h.`
            : 'Um diagnóstico foi pedido há menos de 24 h.')
        } else if (result.error === 'already_active') {
          toast.info('Já existe um pedido aberto para este canal.')
        } else {
          toast.error('Não foi possível registrar o pedido. Tente de novo.')
        }
      }
      // Success or "already active": the card shows the task from here on.
      await refreshTask()
    } catch {
      toast.error('Não foi possível registrar o pedido. Tente de novo.')
    } finally {
      setAnalysisState('idle')
    }
  }, [onRequestAnalysis, channelInternalId, busy, refreshTask])

  const radarData = useMemo(
    () => intelligenceVideos ? computeRadarData(intelligenceVideos) : [],
    [intelligenceVideos]
  )
  const unavailableAxes = useMemo(
    () => intelligenceVideos ? computeUnavailableAxes(intelligenceVideos) : [],
    [intelligenceVideos]
  )
  const coachingCards = useMemo(
    () => computeCoachingCards(
      intelligenceVideos ?? [],
      channelCoaching?.coaching ?? null,
      channelCoaching?.cards?.coaching ?? null,
    ),
    [intelligenceVideos, channelCoaching]
  )

  // `coaching` is an `as CoachingOutput` over jsonb and `summary: string` is a TypeScript
  // promise, not a database one: no row written before this commit went through Zod, and
  // `.not('coaching','is',null)` does not exclude `{}`. Without this narrowing, `.trim()`
  // of undefined is a TypeError inside a client component.
  const coachingMeta = useMemo(
    () => channelCoaching
      ? {
          source: channelCoaching.source,
          generatedLabel: channelCoaching.generatedLabel,
          summary: typeof channelCoaching.coaching.summary === 'string' ? channelCoaching.coaching.summary : '',
          // Null whenever banner and cards are the same analysis, so the label prints one
          // provenance, never the same source and date twice.
          cardsSource: channelCoaching.cards?.source ?? null,
          cardsGeneratedLabel: channelCoaching.cards?.generatedLabel ?? null,
        }
      : null,
    [channelCoaching],
  )

  /** Tab badge counts — only shown when > 0 */
  const tabCounts = useMemo(() => {
    const outlierCount = intelligenceOutliers?.length ?? 0
    return {
      notes: notes?.length ?? 0,
      coach: coachingCards.length,
      outliers: outlierCount,
      search: searchTerms.length,
    } as Record<string, number>
  }, [coachingCards, intelligenceOutliers, searchTerms])

  return (
    <div>
      {/* Channel tabs (multi-channel) */}
      {channels && channels.length > 1 && (
        <div className="ch-tabs mb-4">
          {channels.map((ch, i) => {
            const isActive = ch.channelId === activeChannelId
            const handle = ch.handle.startsWith('@') ? ch.handle : `@${ch.handle}`
            return (
              <button
                key={ch.channelId}
                type="button"
                className={`ch-tab${isActive ? ' active' : ''}`}
                style={{ '--ch-i': i, '--ch-n': channels.length } as React.CSSProperties}
                onClick={() => {
                  if (isActive) return
                  const url = new URL(window.location.href)
                  url.searchParams.set('channel', ch.channelId)
                  router.push(url.pathname + url.search)
                }}
              >
                <ChannelAvatar url={ch.thumbnailUrl} name={ch.name} />
                <span className="ch-tab-info">
                  <span className="ch-tab-name">{ch.name}</span>
                  <span className="ch-tab-handle">{handle}</span>
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Page head */}
      <div className="page-head mb-4">
        <div>
          <h2 className="page-h1">Desempenho</h2>
          <p className="page-desc">
            Saude do canal, retencao e os numeros que movem o ponteiro — dados reais da YouTube Analytics.
          </p>
        </div>
        <div className="flex items-center" style={{ gap: 10 }}>
          <button
            type="button"
            className="btn"
            disabled={!onRequestAnalysis || !channelInternalId || busy}
            onClick={handleRequestAnalysis}
          >
            {buttonProgress ? <span className="run-dot" aria-hidden="true" /> : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
                <path d="M5 18l.7 1.8L7.5 20l-1.8.7L5 22l-.7-1.3L2.5 20l1.8-.2z" />
              </svg>
            )}
            {buttonProgress
              ? <>{buttonProgress.text}{buttonProgress.small && <span className="run-sm">{buttonProgress.small}</span>}</>
              : analysisState === 'pending' ? 'Solicitando...' : 'Pedir diagnostico'}
          </button>
          {/* One sentence per STATE, never per second: the countdown lives outside this region. */}
          <span className="sr-only" aria-live="polite">{progressAnnouncement(progress.view)}</span>
        </div>
      </div>

      {/* Sub-tab bar */}
      <div
        ref={tablistRef}
        role="tablist"
        aria-label="YouTube Analytics sub-navigation"
        className="subtabs mb-4"
        onKeyDown={handleKeyDown}
      >
        {SUB_TABS.map((tab) => {
          const count = tab.countKey ? tabCounts[tab.countKey] : undefined
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              tabIndex={activeTab === tab.id ? 0 : -1}
              id={`tab-yt-${tab.id}`}
              aria-controls={`panel-yt-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`subtab${activeTab === tab.id ? ' active' : ''}`}
            >
              {TAB_ICONS[tab.id]}
              {tab.label}
              {count != null && count > 0 && (
                <span className="subtab-count">{count}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Tab panel — key forces remount for .fade-in animation */}
      <div
        key={activeTab}
        role="tabpanel"
        id={`panel-yt-${activeTab}`}
        aria-labelledby={`tab-yt-${activeTab}`}
      >
        {activeTab === 'overview' && (
          isNewChannel ? (
            <PerfNewChannel />
          ) : (
            <YtOverview
              metrics={metrics}
              dailyMetrics={dailyMetrics}
              intelligenceHealthScore={healthScore}
              intelligenceRadar={radarData.length > 0 ? radarData : undefined}
              intelligenceUnavailable={unavailableAxes}
            />
          )
        )}
        {activeTab === 'notes' && (
          <NotesView
            notes={notes ?? []}
            channelId={channelInternalId ?? ''}
            onCreateNote={onCreateNote}
            onDeleteNote={onDeleteNote}
          />
        )}
        {activeTab === 'coach' && (
          <YtHealthCoach
            healthScore={healthScore ?? 0}
            radarData={radarData}
            unavailableAxes={unavailableAxes}
            coachingCards={coachingCards}
            videoCount={intelligenceVideos?.length ?? 0}
            lastAnalysisAt={lastAnalysisAt ?? null}
            coachingMeta={coachingMeta}
            onRequestAnalysis={onRequestAnalysis && channelInternalId ? handleRequestAnalysis : undefined}
            analysisState={busy ? 'pending' : 'idle'}
            bannerArrived={progress.arrivedTaskId !== null}
            progressSlot={progress.view && progress.now && progress.task ? (
              <YtAnalysisProgress
                view={progress.view}
                now={progress.now}
                channelName={activeChannelName}
                requestedAt={new Date(progress.task.requestedAt)}
                retryCount={progress.task.retryCount}
                onRequestAgain={onRequestAnalysis && channelInternalId ? handleRequestAnalysis : undefined}
              />
            ) : null}
            historySlot={history && history.length > 0 ? <YtAnalysisHistory entries={history} /> : null}
          />
        )}
        {activeTab === 'outliers' && (
          intelligenceOutliers && intelligenceOutliers.length > 0
            ? <YtOutliersV2 outliers={intelligenceOutliers} />
            : intelligenceVideos && intelligenceVideos.length > 0
              ? <YtOutliersV2
                  outliers={[]}
                  hasAnalyticsData={intelligenceVideos.some(v => (v.avgViewPercentage !== null && v.avgViewPercentage > 0) || (v.trafficSources !== null && Object.keys(v.trafficSources).length > 0))}
                />
              : <YtOutliers grades={grades} />
        )}
        {activeTab === 'demographics' && <YtDemographicsView demographics={demographics} apiError={demographicsError} />}
        {activeTab === 'search' && <YtSearchTermsView terms={searchTerms} apiError={searchTermsError} />}
      </div>
    </div>
  )
}

export function computeRadarData(videos: VideoGradeRow[]): Array<{ label: string; value: number; grade: string }> {
  const axes: Axis[] = ['ctr', 'retention', 'reach', 'engagement', 'growth', 'sub_impact']
  // Same rule as `computeCoachingCards` below: an axis missing from a video's
  // `axes` was not measured, so it is left out — `?? 0` would draw a spoke at
  // zero and make "we never measured growth" look like "growth is terrible".
  return axes.flatMap(axis => {
    const scores = videos
      .map(v => v.axes.find(a => a.axis === axis))
      .filter((a): a is NonNullable<typeof a> => a !== undefined)
      .map(a => a.normalized)
    if (scores.length === 0) return []
    const avg = scores.reduce((s, v) => s + v, 0) / scores.length
    const grade = avg >= 85 ? 'A' : avg >= 65 ? 'B' : avg >= 40 ? 'C' : 'D'
    return [{ label: AXIS_LABELS[axis], value: avg, grade }]
  })
}

/**
 * What the screen says in place of a score, per axis. The scoring reasons are
 * written for engineers (and the Cowork API); this is the owner-facing short
 * form, with the technical reason kept for the tooltip.
 */
const UNAVAILABLE_NOTES: Record<Axis, string> = {
  ctr: 'a API do YouTube nao fornece CTR',
  retention: 'o sync nao coleta a % assistida',
  reach: 'sem dado de alcance',
  engagement: 'nenhum video com analytics na janela',
  growth: 'o historico guarda totais, nao views diarias',
  sub_impact: 'a API do YouTube nao fornece impressoes',
}

export interface UnavailableAxisView {
  axis: Axis
  label: string
  note: string
  reason: string
}

/**
 * Axes that NO video could be scored on — the channel-level counterpart of
 * `VideoScore.unavailableAxes`. They are listed as "indisponivel" instead of
 * vanishing from the radar (which hides that anything is missing) or being
 * averaged in as 0 (which claims the channel is bad at them). An axis that at
 * least one video has a score on is measured, and belongs to the radar.
 */
export function computeUnavailableAxes(videos: VideoGradeRow[]): UnavailableAxisView[] {
  const axes: Axis[] = ['ctr', 'retention', 'reach', 'engagement', 'growth', 'sub_impact']
  return axes.flatMap(axis => {
    if (videos.some(v => v.axes.some(a => a.axis === axis))) return []
    const reported = videos
      .flatMap(v => v.unavailableAxes)
      .find(u => u.axis === axis)
    if (reported === undefined) return []
    return [{ axis, label: AXIS_LABELS[axis], note: UNAVAILABLE_NOTES[axis], reason: reported.reason }]
  })
}

/** Static coaching fallbacks. TODO: replace with intelligence pipeline when available (source: 'cowork'). */
const COACHING_DIAGNOSTICS: Record<Axis, { diagnosis: string; action: string }> = {
  ctr: {
    diagnosis: 'Sua taxa de clique esta abaixo da media. Thumbnails e titulos precisam de mais impacto visual.',
    action: 'Teste novas thumbnails com texto overlay e expressoes faciais. Considere criar um A/B test.',
  },
  retention: {
    diagnosis: 'Os espectadores estao saindo antes do video terminar. O conteudo pode precisar de mais ganchos internos.',
    action: 'Adicione pattern interrupts a cada 2-3 minutos. Comece com a promessa mais forte nos primeiros 30 segundos.',
  },
  reach: {
    diagnosis: 'O trafego vem de poucas fontes. Diversifique para reduzir dependencia do browse/sugestoes.',
    action: 'Otimize titulos para search (palavras-chave), compartilhe em redes sociais, e crie playlists tematicas.',
  },
  engagement: {
    diagnosis: 'A taxa de interacao (likes, comentarios, compartilhamentos) esta baixa em relacao as views.',
    action: 'Inclua CTAs claros pedindo likes/comentarios. Faca perguntas ao publico no video e na descricao.',
  },
  growth: {
    diagnosis: 'O crescimento diario de views esta estagnado ou em declinio.',
    action: 'Publique com mais consistencia. Explore topicos trending no seu nicho. Revise horarios de publicacao.',
  },
  sub_impact: {
    diagnosis: 'Poucos espectadores estao se inscrevendo apos assistir seus videos.',
    action: 'Adicione telas finais com botao de inscricao. Mencione o canal no inicio do video. Ofereca valor exclusivo para inscritos.',
  },
}

export function computeCoachingCards(
  videos: VideoGradeRow[],
  channelCoaching: CoachingOutput | null,
  /**
   * The newest analysis that carries priorities, when that is not `channelCoaching` itself.
   * Kept separate because the two arguments answer different questions: `channelCoaching`
   * answers "does a real analysis exist?" (its presence is what suppresses the heuristic),
   * this one answers "which analysis has cards to show?".
   */
  prioritiesCoaching: CoachingOutput | null = null,
): Array<{
  axis: Axis
  score: number
  benchmark: number
  channelValue: number
  diagnosis: string
  action: string
  source: 'cowork' | 'fallback'
}> {
  // Tested for null, not for a non-empty priorities array: with `priorities: []` the old
  // guard fell through to the heuristic branch and invented up to 3 fallback cards on top
  // of a real analysis. `?? []` because `coaching` is an `as CoachingOutput` over jsonb —
  // a row written before this commit never went through Zod.
  if (channelCoaching != null) {
    // A forja row is a real analysis with `priorities: []` — it suppresses the heuristic (the
    // guard above) but has no cards of its own, so the cards come from the newest analysis
    // that has them. Falling back to `channelCoaching` keeps the single-row case identical.
    return ((prioritiesCoaching ?? channelCoaching).priorities ?? [])
      .map(p => ({
        axis: p.axis,
        score: p.score,
        benchmark: COACHING_BENCHMARK,
        channelValue: p.score * 10,
        diagnosis: p.diagnosis,
        action: p.action,
        source: 'cowork' as const,
      }))
      .sort((a, b) => a.score - b.score)
      .slice(0, 3)
  }

  // Every card asserts something concrete and negative about the channel, so it needs a
  // sample behind it. `?? 0` used to collapse "this video has no score on this axis" into
  // "this video scores 0": a channel with zero videos averaged 0 on all six axes, all six
  // cleared the < 6.5 filter, and the tab badge said 3 while the panel below said "Nenhuma
  // analise ... disponivel ainda". `VideoGradeRow.axes` carries a non-nullable `normalized`,
  // so absence is expressed by the entry missing from the array — `find()` returning
  // undefined is the distinction, and it is the one preserved here. A video that genuinely
  // scores 0 on an axis is a sample and still earns its card.
  const axes: Axis[] = ['ctr', 'retention', 'reach', 'engagement', 'growth', 'sub_impact']
  return axes
    .flatMap(axis => {
      const scores = videos
        .map(v => v.axes.find(a => a.axis === axis))
        .filter((a): a is { axis: Axis; normalized: number } => a !== undefined)
        .map(a => a.normalized)
      if (scores.length === 0) return []
      const avg = scores.reduce((s, v) => s + v, 0) / scores.length
      const normalized10 = avg / 10
      const coaching = COACHING_DIAGNOSTICS[axis]
      return [{
        axis,
        score: Math.round(normalized10 * 10) / 10,
        benchmark: COACHING_BENCHMARK,
        channelValue: avg,
        diagnosis: coaching.diagnosis,
        action: coaching.action,
        source: 'fallback' as const,
      }]
    })
    .filter(c => c.score < COACHING_BENCHMARK)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
}
