'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback } from 'react'
import { OverviewTab } from './overview-tab'
import { NewslettersTab } from './newsletters-tab'
import { CampaignsTab } from './campaigns-tab'
import { ContentTab } from './content-tab'

const TABS = ['Overview', 'Newsletters', 'Campaigns', 'Content'] as const
type Tab = (typeof TABS)[number]

const PERIODS = ['7d', '30d', '90d', '12m'] as const
type Period = (typeof PERIODS)[number]

const PERIOD_LABELS: Record<Period, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  '12m': 'Last 12 months',
}

export function AnalyticsTabs() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const tab = (searchParams.get('tab') as Tab) ?? 'Overview'
  const period = (searchParams.get('period') as Period) ?? '30d'

  const navigate = useCallback(
    (newTab?: Tab, newPeriod?: Period) => {
      const params = new URLSearchParams(searchParams.toString())
      if (newTab) params.set('tab', newTab)
      if (newPeriod) params.set('period', newPeriod)
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams],
  )

  return (
    <div className="space-y-6">
      {/* Tab nav + period selector */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          className="flex gap-1 p-1 rounded-[8px] w-fit"
          style={{ background: 'var(--cms-bg, #0f1117)' }}
        >
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => navigate(t)}
              data-active={t === tab}
              className="px-3 py-1.5 rounded-[6px] text-sm font-medium transition-colors
                data-[active=true]:text-[var(--cms-text,#e4e4e7)]
                hover:text-[var(--cms-text,#e4e4e7)]"
              style={{
                color:
                  t === tab
                    ? 'var(--cms-text, #e4e4e7)'
                    : 'var(--cms-text-muted, #71717a)',
                background:
                  t === tab
                    ? 'var(--cms-surface, #1a1d27)'
                    : 'transparent',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span
            className="text-xs"
            style={{ color: 'var(--cms-text-dim, #52525b)' }}
          >
            {PERIOD_LABELS[period]}
          </span>
          <div className="flex gap-1">
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => navigate(undefined, p)}
                className="px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors border"
                style={{
                  borderColor:
                    p === period
                      ? 'var(--cms-accent, #6366f1)'
                      : 'var(--cms-border, #2a2d3a)',
                  color:
                    p === period
                      ? 'var(--cms-accent, #6366f1)'
                      : 'var(--cms-text-muted, #71717a)',
                  background:
                    p === period
                      ? 'var(--cms-accent-subtle, rgba(99,102,241,.12))'
                      : 'transparent',
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
      {tab === 'Overview' && <OverviewTab period={period} />}
      {tab === 'Newsletters' && <NewslettersTab period={period} />}
      {tab === 'Campaigns' && <CampaignsTab period={period} />}
      {tab === 'Content' && <ContentTab period={period} />}
    </div>
  )
}
