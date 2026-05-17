'use client'

import { useState, useRef, useCallback } from 'react'
import { YtOverview } from './yt-overview'
import type { YtChannelMetrics, YtDailyMetric } from '@/lib/youtube/analytics-types'

const SUB_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'grades', label: 'Grades & CTR' },
  { id: 'outliers', label: 'Outliers' },
  { id: 'demographics', label: 'Demographics' },
  { id: 'search', label: 'Search Terms' },
] as const

type TabId = typeof SUB_TABS[number]['id']

interface Props {
  siteId: string
  metrics: YtChannelMetrics
  dailyMetrics: YtDailyMetric[]
}

export function YtAnalyticsTabs({ siteId: _siteId, metrics, dailyMetrics }: Props) {
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
        {activeTab === 'grades' && <p className="p-4 text-sm text-cms-text-muted">Grades &amp; CTR — coming in next phase.</p>}
        {activeTab === 'outliers' && <p className="p-4 text-sm text-cms-text-muted">Outliers — coming in next phase.</p>}
        {activeTab === 'demographics' && <p className="p-4 text-sm text-cms-text-muted">Demographics — coming in next phase.</p>}
        {activeTab === 'search' && <p className="p-4 text-sm text-cms-text-muted">Search Terms — coming in next phase.</p>}
      </div>
    </div>
  )
}
