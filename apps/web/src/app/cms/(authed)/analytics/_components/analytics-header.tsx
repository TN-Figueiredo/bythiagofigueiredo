'use client'

import { useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { AnalyticsTab } from '../types'

const TABS: { id: AnalyticsTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'content', label: 'Content' },
  { id: 'links', label: 'Links' },
  { id: 'audience', label: 'Audience' },
  { id: 'fans', label: 'Fans' },
  { id: 'revenue', label: 'Revenue' },
]

const PERIODS = ['7d', '30d', '90d'] as const

interface Props {
  activeTab: AnalyticsTab
  activePeriod: string
}

export function AnalyticsHeader({ activeTab, activePeriod }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(updates)) {
        params.set(key, value)
      }
      router.replace(`?${params.toString()}`)
    },
    [router, searchParams],
  )

  const handleTabChange = useCallback(
    (tab: AnalyticsTab) => {
      updateParams({ tab })
    },
    [updateParams],
  )

  const handlePeriodChange = useCallback(
    (period: string) => {
      updateParams({ period })
    },
    [updateParams],
  )

  return (
    <div className="sticky top-0 z-30 border-b border-cms-border bg-cms-bg/95 backdrop-blur-sm">
      <div className="flex items-center justify-between px-4 py-3 md:px-6">
        <h1 className="text-lg font-semibold text-cms-text">Analytics</h1>
        <div
          className="flex items-center gap-1 rounded-lg border border-cms-border p-0.5"
          role="group"
          aria-label="Period selector"
        >
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => handlePeriodChange(p)}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                activePeriod === p
                  ? 'bg-[var(--acc)] font-medium text-white'
                  : 'text-cms-text-muted hover:text-cms-text'
              }`}
              data-testid={`period-${p}`}
            >
              {p === '7d' ? '7 days' : p === '30d' ? '30 days' : '90 days'}
            </button>
          ))}
        </div>
      </div>
      <nav className="flex gap-0 px-4 md:px-6" role="tablist" aria-label="Analytics tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`relative px-4 py-2.5 text-sm transition-colors ${
              activeTab === tab.id
                ? 'font-medium text-[var(--acc)]'
                : 'text-cms-text-muted hover:text-cms-text'
            }`}
            data-testid={`tab-${tab.id}`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[var(--acc)]" />
            )}
          </button>
        ))}
      </nav>
    </div>
  )
}
