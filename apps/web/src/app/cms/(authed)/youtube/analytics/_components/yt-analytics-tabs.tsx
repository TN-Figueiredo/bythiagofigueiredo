'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { YtOverview } from './yt-overview'
import { YtGrades } from './yt-grades'
import { YtOutliers } from './yt-outliers'
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

const SUB_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'grades', label: 'Grades & CTR' },
  { id: 'outliers', label: 'Outliers' },
  { id: 'demographics', label: 'Demographics' },
  { id: 'search', label: 'Search Terms' },
] as const

type TabId = (typeof SUB_TABS)[number]['id']

interface Props {
  siteId: string
  metrics: YtChannelMetrics
  dailyMetrics: YtDailyMetric[]
  grades: YtVideoGrade[]
  searchTerms: YtSearchTerm[]
  demographics: YtDemographics
  channels?: YtConnectedChannel[]
  activeChannelId?: string
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
        {activeTab === 'grades' && <YtGrades grades={grades} />}
        {activeTab === 'outliers' && <YtOutliers grades={grades} />}
        {activeTab === 'demographics' && <YtDemographicsView demographics={demographics} />}
        {activeTab === 'search' && <YtSearchTermsView terms={searchTerms} />}
      </div>
    </div>
  )
}
