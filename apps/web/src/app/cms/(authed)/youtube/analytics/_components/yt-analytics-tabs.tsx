/**
 * YtAnalyticsTabs — Performance tab container.
 *
 * Refactored per spec 4.3:
 * - page-head with: title "Desempenho", description, demo-switch, "Pedir diagnostico ao Cowork" button
 * - key={activeTab} on tabpanel for .fade-in re-animation
 * - Replaced "grades"/"Notas" tab with NotesView
 * - Demo-switch toggles Overview / PerfNewChannel
 */
'use client'

import { useState, useRef, useCallback, useMemo, type SyntheticEvent } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { YtOverview } from './yt-overview'
import { YtOutliers } from './yt-outliers'
import { YtOutliersV2 } from './yt-outliers-v2'
import { YtHealthCoach } from './yt-health-coach'
import { YtNotificationsBell } from './yt-notifications-bell'
import { YtDemographicsView } from './yt-demographics'
import { YtSearchTermsView } from './yt-search-terms'
import { NotesView } from './notes-view'
import type { NoteEntry } from './notes-view'
import { PerfNewChannel } from './perf-new-channel'
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
import type { VideoGradeRow, Notification, OutlierVideo } from './types'

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
  notifications?: Notification[]
  healthScore?: number
  onMarkNotificationRead?: (id: string) => Promise<void>
  onMarkAllNotificationsRead?: () => Promise<void>
  onDismissNotification?: (id: string) => Promise<void>
  onRequestAnalysis?: (channelId: string) => Promise<unknown>
  lastAnalysisAt?: string | null
  searchTermsError?: string
  demographicsError?: string
}

/** Demo notes for the NotesView */
const DEMO_NOTES: NoteEntry[] = [
  {
    id: 'n1',
    author: 'Cowork',
    text: 'CTR caiu 12% na ultima semana. Recomendo testar novas thumbnails com texto overlay nos proximos 3 videos.',
    timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
    isBot: true,
  },
  {
    id: 'n2',
    author: 'Thiago',
    text: 'Experimentar formato "talking head" com fundo desfocado nos proximos videos de tutorial.',
    timestamp: new Date(Date.now() - 48 * 3600000).toISOString(),
    isBot: false,
  },
]

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
  notifications,
  healthScore,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onDismissNotification,
  onRequestAnalysis,
  lastAnalysisAt,
  searchTermsError,
  demographicsError,
}: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const isNewChannel = metrics.views === 0 && dailyMetrics.length < 7
  const [analysisState, setAnalysisState] = useState<'idle' | 'pending' | 'cooldown' | 'success'>('idle')
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
    if (!onRequestAnalysis || !channelInternalId || analysisState !== 'idle') return
    setAnalysisState('pending')
    try {
      const result = await onRequestAnalysis(channelInternalId) as { error?: string; ok?: boolean } | null
      if (result && typeof result === 'object' && 'error' in result) {
        if (result.error === 'cooldown' || result.error === 'already_active') {
          setAnalysisState('cooldown')
          setTimeout(() => setAnalysisState('idle'), 10_000)
        } else {
          setAnalysisState('idle')
        }
      } else {
        setAnalysisState('success')
        setTimeout(() => setAnalysisState('idle'), 5_000)
      }
    } catch {
      setAnalysisState('idle')
    }
  }, [onRequestAnalysis, channelInternalId, analysisState])

  const radarData = useMemo(
    () => intelligenceVideos ? computeRadarData(intelligenceVideos) : [],
    [intelligenceVideos]
  )
  const coachingCards = useMemo(
    () => intelligenceVideos ? computeCoachingCards(intelligenceVideos) : [],
    [intelligenceVideos]
  )

  /** Tab badge counts — only shown when > 0 */
  const tabCounts = useMemo(() => {
    const outlierCount = intelligenceOutliers?.length ?? 0
    return {
      notes: DEMO_NOTES.length,
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
            className="btn cowork"
            onClick={() => toast.success('Diagnostico solicitado ao Cowork — chega em instantes.')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
              <path d="M5 18l.7 1.8L7.5 20l-1.8.7L5 22l-.7-1.3L2.5 20l1.8-.2z" />
            </svg>
            Pedir diagnostico ao Cowork
          </button>
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
            />
          )
        )}
        {activeTab === 'notes' && (
          <NotesView notes={DEMO_NOTES} />
        )}
        {activeTab === 'coach' && (
          <YtHealthCoach
            healthScore={healthScore ?? 0}
            radarData={radarData}
            coachingCards={coachingCards}
            videoCount={intelligenceVideos?.length ?? 0}
            lastAnalysisAt={lastAnalysisAt ?? null}
            onRequestAnalysis={onRequestAnalysis && channelInternalId ? handleRequestAnalysis : undefined}
            analysisState={analysisState}
          />
        )}
        {activeTab === 'outliers' && (
          intelligenceOutliers && intelligenceOutliers.length > 0
            ? <YtOutliersV2 outliers={intelligenceOutliers} />
            : intelligenceVideos && intelligenceVideos.length > 0
              ? <YtOutliersV2
                  outliers={[]}
                  hasAnalyticsData={intelligenceVideos.some(v => v.avgViewPercentage > 0 || (v.trafficSources !== null && Object.keys(v.trafficSources).length > 0))}
                />
              : <YtOutliers grades={grades} />
        )}
        {activeTab === 'demographics' && <YtDemographicsView demographics={demographics} apiError={demographicsError} />}
        {activeTab === 'search' && <YtSearchTermsView terms={searchTerms} apiError={searchTermsError} />}
      </div>
    </div>
  )
}

function computeRadarData(videos: VideoGradeRow[]): Array<{ label: string; value: number; grade: string }> {
  const axes: Axis[] = ['ctr', 'retention', 'reach', 'engagement', 'growth', 'sub_impact']
  return axes.map(axis => {
    const scores = videos.map(v => v.axes.find(a => a.axis === axis)?.normalized ?? 0)
    const avg = scores.length > 0 ? scores.reduce((s, v) => s + v, 0) / scores.length : 0
    const grade = avg >= 85 ? 'A' : avg >= 65 ? 'B' : avg >= 40 ? 'C' : 'D'
    return { label: AXIS_LABELS[axis], value: avg, grade }
  })
}

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

function computeCoachingCards(videos: VideoGradeRow[]): Array<{
  axis: Axis
  score: number
  benchmark: number
  channelValue: number
  diagnosis: string
  action: string
  source: 'cowork' | 'fallback'
}> {
  const axes: Axis[] = ['ctr', 'retention', 'reach', 'engagement', 'growth', 'sub_impact']
  return axes
    .map(axis => {
      const scores = videos.map(v => v.axes.find(a => a.axis === axis)?.normalized ?? 0)
      const avg = scores.length > 0 ? scores.reduce((s, v) => s + v, 0) / scores.length : 0
      const normalized10 = avg / 10
      const coaching = COACHING_DIAGNOSTICS[axis]
      return {
        axis,
        score: Math.round(normalized10 * 10) / 10,
        benchmark: 5.0,
        channelValue: avg,
        diagnosis: coaching.diagnosis,
        action: coaching.action,
        source: 'fallback' as const,
      }
    })
    .filter(c => c.score < 6.5)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
}
