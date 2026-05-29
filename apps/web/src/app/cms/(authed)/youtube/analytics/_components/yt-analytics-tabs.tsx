'use client'

import { useState, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { YtOverview } from './yt-overview'
import { YtGrades } from './yt-grades'
import { YtGradesV2 } from './yt-grades-v2'
import { YtOutliers } from './yt-outliers'
import { YtOutliersV2 } from './yt-outliers-v2'
import { YtHealthCoach } from './yt-health-coach'
import { YtNotificationsBell } from './yt-notifications-bell'
import { YtDemographicsView } from './yt-demographics'
import { YtSearchTermsView } from './yt-search-terms'
import { CoworkDeepLink } from '@/components/cms/cowork-deep-link'
import { buildCoworkInstruction } from '@/lib/pipeline/cowork-instructions'
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

const SUB_TABS = [
  { id: 'overview', label: 'Visão Geral' },
  { id: 'grades', label: 'Notas' },
  { id: 'coach', label: 'Health Coach' },
  { id: 'outliers', label: 'Outliers' },
  { id: 'demographics', label: 'Demografia' },
  { id: 'search', label: 'Termos de Busca' },
] as const

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

  return (
    <div>
      {channels && channels.length > 1 && (
        <div className="mb-3 flex items-center gap-2">
          <label htmlFor="yt-channel-select" className="text-xs font-medium text-cms-text-muted">Channel:</label>
          <select
            id="yt-channel-select"
            value={activeChannelId ?? ''}
            onChange={(e) => {
              const url = new URL(window.location.href)
              url.searchParams.set('channel', e.target.value)
              router.push(url.pathname + url.search)
            }}
            className="rounded border border-cms-border bg-cms-surface px-2 py-1 text-xs text-cms-text focus:outline-none focus:ring-1 focus:ring-[var(--acc)]"
          >
            {channels.map((ch) => (
              <option key={ch.channelId} value={ch.channelId}>
                {ch.name} ({ch.handle.startsWith('@') ? ch.handle : `@${ch.handle}`})
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mb-4 flex items-center border-b border-cms-border">
        <div
          ref={tablistRef}
          role="tablist"
          aria-label="YouTube Analytics sub-navigation"
          className="flex gap-0"
          onKeyDown={handleKeyDown}
        >
          {SUB_TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              tabIndex={activeTab === tab.id ? 0 : -1}
              id={`tab-yt-${tab.id}`}
              aria-controls={`panel-yt-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-b-2 border-[var(--acc)] text-cms-text'
                  : 'text-cms-text-muted hover:text-cms-text'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2 pr-2">
          <CoworkDeepLink
            instruction={buildCoworkInstruction('youtube-intelligence', {} as Record<string, never>)}
            variant="icon"
          />
          {notifications && (
            <YtNotificationsBell
              notifications={notifications}
              onMarkRead={onMarkNotificationRead ?? (() => Promise.resolve())}
              onMarkAllRead={onMarkAllNotificationsRead ?? (() => Promise.resolve())}
              onDismiss={onDismissNotification ?? (() => Promise.resolve())}
            />
          )}
        </div>
      </div>

      <div
        role="tabpanel"
        id={`panel-yt-${activeTab}`}
        aria-labelledby={`tab-yt-${activeTab}`}
      >
        {activeTab === 'overview' && (
          <YtOverview
            metrics={metrics}
            dailyMetrics={dailyMetrics}
            intelligenceHealthScore={healthScore}
            intelligenceRadar={radarData.length > 0 ? radarData : undefined}
          />
        )}
        {activeTab === 'grades' && (
          intelligenceVideos && intelligenceVideos.length > 0
            ? <YtGradesV2 videos={intelligenceVideos} />
            : <YtGrades grades={grades} />
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
    diagnosis: 'Sua taxa de clique está abaixo da média. Thumbnails e títulos precisam de mais impacto visual.',
    action: 'Teste novas thumbnails com texto overlay e expressões faciais. Considere criar um A/B test.',
  },
  retention: {
    diagnosis: 'Os espectadores estão saindo antes do vídeo terminar. O conteúdo pode precisar de mais ganchos internos.',
    action: 'Adicione pattern interrupts a cada 2-3 minutos. Comece com a promessa mais forte nos primeiros 30 segundos.',
  },
  reach: {
    diagnosis: 'O tráfego vem de poucas fontes. Diversifique para reduzir dependência do browse/sugestões.',
    action: 'Otimize títulos para search (palavras-chave), compartilhe em redes sociais, e crie playlists temáticas.',
  },
  engagement: {
    diagnosis: 'A taxa de interação (likes, comentários, compartilhamentos) está baixa em relação às views.',
    action: 'Inclua CTAs claros pedindo likes/comentários. Faça perguntas ao público no vídeo e na descrição.',
  },
  growth: {
    diagnosis: 'O crescimento diário de views está estagnado ou em declínio.',
    action: 'Publique com mais consistência. Explore tópicos trending no seu nicho. Revise horários de publicação.',
  },
  sub_impact: {
    diagnosis: 'Poucos espectadores estão se inscrevendo após assistir seus vídeos.',
    action: 'Adicione telas finais com botão de inscrição. Mencione o canal no início do vídeo. Ofereça valor exclusivo para inscritos.',
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
