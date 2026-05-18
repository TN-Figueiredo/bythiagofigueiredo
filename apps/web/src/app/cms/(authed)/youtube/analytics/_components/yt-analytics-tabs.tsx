'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { YtOverview } from './yt-overview'
import { YtGrades } from './yt-grades'
import { YtGradesV2 } from './yt-grades-v2'
import { YtOutliers } from './yt-outliers'
import { YtOutliersV2 } from './yt-outliers-v2'
import { YtHealthCoach } from './yt-health-coach'
import { YtNotificationsBell } from './yt-notifications-bell'
import { YtBootstrapBanner } from './yt-bootstrap-banner'
import { YtDemographicsView } from './yt-demographics'
import { YtSearchTermsView } from './yt-search-terms'
import type {
  YtChannelMetrics,
  YtDailyMetric,
  YtVideoGrade,
  YtSearchTerm,
  YtDemographics,
} from '@/lib/youtube/analytics-types'
import type { YtConnectedChannel } from '@/lib/youtube/analytics-client'
import type { Axis, Grade, TrendDirection } from '@/lib/youtube/scoring-types'
import { AXIS_LABELS } from '@/lib/youtube/scoring-types'

const SUB_TABS = [
  { id: 'overview', label: 'Visão Geral' },
  { id: 'grades', label: 'Notas' },
  { id: 'coach', label: 'Health Coach' },
  { id: 'outliers', label: 'Outliers' },
  { id: 'demographics', label: 'Demografia' },
  { id: 'search', label: 'Termos de Busca' },
] as const

type TabId = (typeof SUB_TABS)[number]['id']

interface VideoGradeRow {
  videoId: string
  title: string
  thumbnailUrl: string
  grade: Grade
  score: number
  axes: Array<{ axis: Axis; normalized: number }>
  trend: { direction: TrendDirection; velocity: number }
  optimizationState: string | null
  retentionCurve: number[] | null
  avgViewPercentage: number
  diagnosis: string | null
  recommendation: string | null
  trafficSources: Record<string, number> | null
}

interface Notification {
  id: string
  type: string
  priority: number
  title: string
  message: string
  read: boolean
  action_href: string | null
  created_at: string
}

interface OutlierVideo {
  videoId: string
  title: string
  score: number
  modifiedZ: number
  direction: 'positive' | 'negative'
  axis: Axis
}

interface Props {
  siteId: string
  metrics: YtChannelMetrics
  dailyMetrics: YtDailyMetric[]
  grades: YtVideoGrade[]
  searchTerms: YtSearchTerm[]
  demographics: YtDemographics
  channels?: YtConnectedChannel[]
  activeChannelId?: string
  intelligenceVideos?: VideoGradeRow[]
  intelligenceOutliers?: OutlierVideo[]
  notifications?: Notification[]
  healthScore?: number
  weeksSinceFirstGrade?: number
  onMarkNotificationRead?: (id: string) => void
  onMarkAllNotificationsRead?: () => void
  onDismissNotification?: (id: string) => void
  onCreateAbTest?: (videoId: string, testType: string) => void
  onRequestAnalysis?: () => void
  analysisState?: 'idle' | 'pending' | 'running' | 'cooldown'
  lastAnalysisAt?: string | null
}

export function YtAnalyticsTabs({
  siteId: _siteId,
  metrics,
  dailyMetrics,
  grades,
  searchTerms,
  demographics,
  channels,
  activeChannelId,
  intelligenceVideos,
  intelligenceOutliers,
  notifications,
  healthScore,
  weeksSinceFirstGrade,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onDismissNotification,
  onCreateAbTest,
  onRequestAnalysis,
  analysisState = 'idle',
  lastAnalysisAt,
}: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const tablistRef = useRef<HTMLDivElement>(null)

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const tabs = SUB_TABS.map(t => t.id)
    const i = tabs.indexOf(activeTab)
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      setActiveTab(tabs[(i + 1) % tabs.length]!)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      setActiveTab(tabs[(i - 1 + tabs.length) % tabs.length]!)
    } else if (e.key === 'Home') {
      e.preventDefault()
      setActiveTab(tabs[0]!)
    } else if (e.key === 'End') {
      e.preventDefault()
      setActiveTab(tabs[tabs.length - 1]!)
    }
  }, [activeTab])

  return (
    <div>
      {channels && channels.length > 1 && (
        <div className="mb-3 flex items-center gap-2">
          <span className="text-xs font-medium text-cms-text-muted">Channel:</span>
          <select
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

      {weeksSinceFirstGrade !== undefined && weeksSinceFirstGrade < 2 && (
        <div className="mb-4">
          <YtBootstrapBanner weeksSinceFirstGrade={weeksSinceFirstGrade} />
        </div>
      )}

      <div className="mb-4 flex items-center gap-0 border-b border-cms-border">
        {notifications && onMarkNotificationRead && onMarkAllNotificationsRead && onDismissNotification && (
          <div className="ml-auto pr-2">
            <YtNotificationsBell
              notifications={notifications}
              onMarkRead={onMarkNotificationRead}
              onMarkAllRead={onMarkAllNotificationsRead}
              onDismiss={onDismissNotification}
            />
          </div>
        )}
      </div>

      <div
        ref={tablistRef}
        role="tablist"
        aria-label="YouTube Analytics sub-navigation"
        className="mb-4 flex gap-0 border-b border-cms-border"
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

      <div
        role="tabpanel"
        id={`panel-yt-${activeTab}`}
        aria-labelledby={`tab-yt-${activeTab}`}
      >
        {activeTab === 'overview' && <YtOverview metrics={metrics} dailyMetrics={dailyMetrics} />}
        {activeTab === 'grades' && (
          intelligenceVideos && intelligenceVideos.length > 0
            ? <YtGradesV2 videos={intelligenceVideos} onCreateAbTest={onCreateAbTest} />
            : <YtGrades grades={grades} />
        )}
        {activeTab === 'coach' && (
          <YtHealthCoach
            healthScore={healthScore ?? 0}
            radarData={intelligenceVideos
              ? computeRadarData(intelligenceVideos)
              : []}
            coachingCards={[]}
            videoCount={intelligenceVideos?.length ?? 0}
            lastAnalysisAt={lastAnalysisAt ?? null}
            onRequestAnalysis={onRequestAnalysis}
            analysisState={analysisState}
          />
        )}
        {activeTab === 'outliers' && (
          intelligenceOutliers && intelligenceOutliers.length > 0
            ? <YtOutliersV2 outliers={intelligenceOutliers} />
            : intelligenceVideos && intelligenceVideos.length > 0
              ? <YtOutliersV2 outliers={[]} />
              : <YtOutliers grades={grades} />
        )}
        {activeTab === 'demographics' && <YtDemographicsView demographics={demographics} />}
        {activeTab === 'search' && <YtSearchTermsView terms={searchTerms} />}
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
