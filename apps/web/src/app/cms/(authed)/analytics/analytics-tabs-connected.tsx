'use client'

import {
  useState,
  useCallback,
  useEffect,
  useTransition,
  useRef,
} from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  fetchOverview,
  fetchNewsletterStats,
  fetchCampaignStats,
  fetchContentStats,
  refreshStats,
  exportReport,
} from './actions'
import type {
  OverviewStats,
  NewsletterEditionStat,
  CampaignStat,
  ContentStat,
  PeriodInput,
  ExportFormat,
} from './types'

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

type TabId = 'overview' | 'newsletters' | 'campaigns' | 'content'

interface Props {
  initialTab: TabId
  initialPeriod: string
  initialCompare: boolean
  initialCustomStart?: string
  initialCustomEnd?: string
  initialOverview: OverviewStats | null
  canExport: boolean
}

const TABS: { id: TabId; label: string; shortcut: string }[] = [
  { id: 'overview', label: 'Overview', shortcut: '1' },
  { id: 'newsletters', label: 'Newsletters', shortcut: '2' },
  { id: 'campaigns', label: 'Campaigns', shortcut: '3' },
  { id: 'content', label: 'Content', shortcut: '4' },
]

const PERIODS = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
] as const

/* ------------------------------------------------------------------ */
/*  Shared helpers                                                    */
/* ------------------------------------------------------------------ */

function cardCls() {
  return 'rounded-lg border border-slate-700 bg-slate-800/50 p-4'
}

function formatDelta(current: number, previous: number | null): string | null {
  if (previous === null) return null
  if (previous === 0) return current > 0 ? '+100%' : '0%'
  const delta = Math.round(((current - previous) / previous) * 100)
  return delta >= 0 ? `+${delta}%` : `${delta}%`
}

function deltaColor(current: number, previous: number | null): string {
  if (previous === null) return ''
  return current >= previous ? 'text-emerald-400' : 'text-red-400'
}

/* ------------------------------------------------------------------ */
/*  KPI Card                                                          */
/* ------------------------------------------------------------------ */

function KpiCard({
  label,
  value,
  suffix,
  previous,
  compare,
}: {
  label: string
  value: number
  suffix?: string
  previous: number | null
  compare: boolean
}) {
  const delta = compare ? formatDelta(value, previous) : null
  return (
    <div className={cardCls()} data-testid={`kpi-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-100">
        {value.toLocaleString()}
        {suffix && <span className="text-base font-normal text-slate-400">{suffix}</span>}
      </p>
      {delta && (
        <p className={`mt-1 text-sm ${deltaColor(value, previous)}`}>
          {delta} vs prev period
        </p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Overview Tab                                                      */
/* ------------------------------------------------------------------ */

function OverviewTab({
  stats,
  compare,
  loading,
}: {
  stats: OverviewStats | null
  compare: boolean
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`${cardCls()} animate-pulse`}>
            <div className="h-4 w-24 rounded bg-slate-700" />
            <div className="mt-2 h-8 w-16 rounded bg-slate-700" />
          </div>
        ))}
      </div>
    )
  }

  if (!stats) {
    return <p className="text-sm text-slate-500">No data available.</p>
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Posts Published"
          value={stats.postsPublished}
          previous={stats.prevPostsPublished}
          compare={compare}
        />
        <KpiCard
          label="Total Views"
          value={stats.totalViews}
          previous={stats.prevTotalViews}
          compare={compare}
        />
        <KpiCard
          label="Subscribers"
          value={stats.subscribers}
          previous={stats.prevSubscribers}
          compare={compare}
        />
        <KpiCard
          label="Open Rate"
          value={stats.openRate}
          suffix="%"
          previous={stats.prevOpenRate}
          compare={compare}
        />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Newsletters Tab                                                   */
/* ------------------------------------------------------------------ */

function NewslettersTab({
  editions,
  loading,
}: {
  editions: NewsletterEditionStat[]
  loading: boolean
}) {
  if (loading) {
    return (
      <div className={`${cardCls()} animate-pulse`}>
        <div className="h-6 w-32 rounded bg-slate-700" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 rounded bg-slate-700" />
          ))}
        </div>
      </div>
    )
  }

  if (editions.length === 0) {
    return <p className="text-sm text-slate-500">No newsletter editions in this period.</p>
  }

  return (
    <div className={cardCls()}>
      <h3 className="text-sm font-medium text-slate-300 mb-4">Edition Stats</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="newsletter-stats-table">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="px-3 py-2 text-left text-slate-400 font-medium">Subject</th>
              <th className="px-3 py-2 text-right text-slate-400 font-medium">Delivered</th>
              <th className="px-3 py-2 text-right text-slate-400 font-medium">Opens</th>
              <th className="px-3 py-2 text-right text-slate-400 font-medium">Clicks</th>
              <th className="px-3 py-2 text-right text-slate-400 font-medium">Bounces</th>
            </tr>
          </thead>
          <tbody>
            {editions.map((ed) => (
              <tr key={ed.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                <td className="px-3 py-2 text-slate-200 max-w-xs truncate">{ed.subject}</td>
                <td className="px-3 py-2 text-right text-slate-300">{ed.stats_delivered}</td>
                <td className="px-3 py-2 text-right text-slate-300">{ed.stats_opens}</td>
                <td className="px-3 py-2 text-right text-slate-300">{ed.stats_clicks}</td>
                <td className="px-3 py-2 text-right text-slate-300">{ed.stats_bounces}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Campaigns Tab                                                     */
/* ------------------------------------------------------------------ */

function CampaignsTab({
  campaigns,
  loading,
}: {
  campaigns: CampaignStat[]
  loading: boolean
}) {
  if (loading) {
    return (
      <div className={`${cardCls()} animate-pulse`}>
        <div className="h-6 w-32 rounded bg-slate-700" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 rounded bg-slate-700" />
          ))}
        </div>
      </div>
    )
  }

  if (campaigns.length === 0) {
    return <p className="text-sm text-slate-500">No campaigns in this period.</p>
  }

  return (
    <div className={cardCls()}>
      <h3 className="text-sm font-medium text-slate-300 mb-4">Campaign Stats</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="campaign-stats-table">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="px-3 py-2 text-left text-slate-400 font-medium">Title</th>
              <th className="px-3 py-2 text-left text-slate-400 font-medium">Status</th>
              <th className="px-3 py-2 text-right text-slate-400 font-medium">Submissions</th>
              <th className="px-3 py-2 text-left text-slate-400 font-medium">Published</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                <td className="px-3 py-2 text-slate-200 max-w-xs truncate">{c.title}</td>
                <td className="px-3 py-2">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                    c.status === 'published'
                      ? 'bg-emerald-900/50 text-emerald-400'
                      : 'bg-slate-700 text-slate-400'
                  }`}>
                    {c.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-right text-slate-300">{c.submissions_count}</td>
                <td className="px-3 py-2 text-sm text-slate-400">
                  {c.published_at ? new Date(c.published_at).toLocaleDateString() : '--'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Content Tab                                                       */
/* ------------------------------------------------------------------ */

function ContentTab({
  posts,
  loading,
}: {
  posts: ContentStat[]
  loading: boolean
}) {
  if (loading) {
    return (
      <div className={`${cardCls()} animate-pulse`}>
        <div className="h-6 w-32 rounded bg-slate-700" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 rounded bg-slate-700" />
          ))}
        </div>
      </div>
    )
  }

  if (posts.length === 0) {
    return <p className="text-sm text-slate-500">No content in this period.</p>
  }

  return (
    <div className={cardCls()}>
      <h3 className="text-sm font-medium text-slate-300 mb-4">Content Stats</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="content-stats-table">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="px-3 py-2 text-left text-slate-400 font-medium">Title</th>
              <th className="px-3 py-2 text-left text-slate-400 font-medium">Locale</th>
              <th className="px-3 py-2 text-left text-slate-400 font-medium">Status</th>
              <th className="px-3 py-2 text-left text-slate-400 font-medium">Published</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((p) => (
              <tr key={p.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                <td className="px-3 py-2 text-slate-200 max-w-xs truncate">{p.title}</td>
                <td className="px-3 py-2 text-sm text-slate-400">{p.locale}</td>
                <td className="px-3 py-2">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                    p.status === 'published'
                      ? 'bg-emerald-900/50 text-emerald-400'
                      : p.status === 'draft'
                        ? 'bg-slate-700 text-slate-400'
                        : 'bg-amber-900/50 text-amber-400'
                  }`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-sm text-slate-400">
                  {p.published_at ? new Date(p.published_at).toLocaleDateString() : '--'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Export Dialog                                                      */
/* ------------------------------------------------------------------ */

function ExportDialog({
  open,
  onClose,
  period,
}: {
  open: boolean
  onClose: () => void
  period: PeriodInput
}) {
  const [format, setFormat] = useState<ExportFormat>('json')
  const [sections, setSections] = useState<Record<string, boolean>>({
    overview: true,
    newsletters: true,
    campaigns: true,
    content: true,
  })
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  const toggleSection = useCallback((key: string) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const handleExport = useCallback(async () => {
    setError(null)
    const selected = Object.entries(sections)
      .filter(([, v]) => v)
      .map(([k]) => k)
    if (selected.length === 0) {
      setError('Select at least one section')
      return
    }
    setExporting(true)
    try {
      const result = await exportReport(format, selected, period)
      if (!result.ok) {
        setError(result.error)
        return
      }
      // Trigger download
      const blob = new Blob([result.data], {
        type: format === 'json' ? 'application/json' : 'text/csv',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `analytics-report.${format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      onClose()
    } finally {
      setExporting(false)
    }
  }, [format, sections, period, onClose])

  if (!open) return null

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 z-50 m-auto w-full max-w-md rounded-lg border border-slate-700 bg-[#0f172a] p-0 text-slate-200 backdrop:bg-black/60"
      onClose={onClose}
      data-testid="export-dialog"
    >
      <div className="p-6">
        <h2 className="text-lg font-semibold text-slate-100">Export Report</h2>
        <p className="mt-1 text-sm text-slate-400">
          Download analytics data for the current period.
        </p>

        <div className="mt-4">
          <h3 className="text-sm font-medium text-slate-300 mb-2">Format</h3>
          <div className="flex gap-3">
            {(['csv', 'json'] as const).map((f) => (
              <label key={f} className="inline-flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="radio"
                  name="format"
                  value={f}
                  checked={format === f}
                  onChange={() => setFormat(f)}
                  className="accent-indigo-500"
                />
                {f.toUpperCase()}
              </label>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <h3 className="text-sm font-medium text-slate-300 mb-2">Sections</h3>
          <div className="space-y-2">
            {TABS.map((tab) => (
              <label key={tab.id} className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={sections[tab.id] ?? false}
                  onChange={() => toggleSection(tab.id)}
                  className="accent-indigo-500"
                />
                {tab.label}
              </label>
            ))}
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
            data-testid="export-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex items-center gap-2 rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
            data-testid="export-download"
          >
            {exporting && (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            )}
            Download
          </button>
        </div>
      </div>
    </dialog>
  )
}

/* ------------------------------------------------------------------ */
/*  Main component                                                    */
/* ------------------------------------------------------------------ */

export function AnalyticsTabsConnected({
  initialTab,
  initialPeriod,
  initialCompare,
  initialCustomStart,
  initialCustomEnd,
  initialOverview,
  canExport,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [activeTab, setActiveTab] = useState<TabId>(initialTab)
  const [period, setPeriod] = useState(initialPeriod)
  const [compare, setCompare] = useState(initialCompare)
  const [customStart, setCustomStart] = useState(initialCustomStart ?? '')
  const [customEnd, setCustomEnd] = useState(initialCustomEnd ?? '')

  const [overview, setOverview] = useState<OverviewStats | null>(initialOverview)
  const [newsletters, setNewsletters] = useState<NewsletterEditionStat[]>([])
  const [campaigns, setCampaigns] = useState<CampaignStat[]>([])
  const [content, setContent] = useState<ContentStat[]>([])

  const [loading, setLoading] = useState(false)
  const [, startTransition] = useTransition()
  const [exportOpen, setExportOpen] = useState(false)

  // Track which tabs have been loaded for current period
  const [loadedTabs, setLoadedTabs] = useState<Set<TabId>>(
    new Set(initialOverview ? ['overview'] : []),
  )

  const buildPeriodInput = useCallback((): PeriodInput => {
    if (period === 'custom' && customStart && customEnd) {
      return { type: 'custom', start: customStart, end: customEnd }
    }
    const preset = period === '7d' || period === '90d' ? period : '30d'
    return { type: 'preset', value: preset }
  }, [period, customStart, customEnd])

  const syncUrl = useCallback(
    (tab: TabId, per: string, cmp: boolean) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('tab', tab)
      params.set('period', per)
      if (cmp) params.set('compare', 'true')
      else params.delete('compare')
      if (per === 'custom' && customStart) params.set('start', customStart)
      if (per === 'custom' && customEnd) params.set('end', customEnd)
      router.replace(`?${params.toString()}`)
    },
    [router, searchParams, customStart, customEnd],
  )

  const loadTabData = useCallback(
    (tab: TabId, force = false) => {
      if (!force && loadedTabs.has(tab)) return
      setLoading(true)
      const periodInput = buildPeriodInput()
      startTransition(async () => {
        try {
          switch (tab) {
            case 'overview': {
              const r = await fetchOverview(periodInput, compare)
              if (r.ok) setOverview(r.data)
              break
            }
            case 'newsletters': {
              const r = await fetchNewsletterStats(periodInput)
              if (r.ok) setNewsletters(r.data)
              break
            }
            case 'campaigns': {
              const r = await fetchCampaignStats(periodInput)
              if (r.ok) setCampaigns(r.data)
              break
            }
            case 'content': {
              const r = await fetchContentStats(periodInput)
              if (r.ok) setContent(r.data)
              break
            }
          }
          setLoadedTabs((prev) => new Set([...prev, tab]))
        } finally {
          setLoading(false)
        }
      })
    },
    [buildPeriodInput, compare, loadedTabs],
  )

  const handleTabChange = useCallback(
    (tab: TabId) => {
      setActiveTab(tab)
      syncUrl(tab, period, compare)
      loadTabData(tab)
    },
    [period, compare, syncUrl, loadTabData],
  )

  const handlePeriodChange = useCallback(
    (per: string) => {
      setPeriod(per)
      setLoadedTabs(new Set())
      syncUrl(activeTab, per, compare)
      // Reload current tab data with new period
      setLoading(true)
      const periodInput: PeriodInput =
        per === 'custom' && customStart && customEnd
          ? { type: 'custom', start: customStart, end: customEnd }
          : { type: 'preset', value: (per === '7d' || per === '90d' ? per : '30d') as '7d' | '30d' | '90d' }
      startTransition(async () => {
        try {
          switch (activeTab) {
            case 'overview': {
              const r = await fetchOverview(periodInput, compare)
              if (r.ok) setOverview(r.data)
              break
            }
            case 'newsletters': {
              const r = await fetchNewsletterStats(periodInput)
              if (r.ok) setNewsletters(r.data)
              break
            }
            case 'campaigns': {
              const r = await fetchCampaignStats(periodInput)
              if (r.ok) setCampaigns(r.data)
              break
            }
            case 'content': {
              const r = await fetchContentStats(periodInput)
              if (r.ok) setContent(r.data)
              break
            }
          }
          setLoadedTabs(new Set([activeTab]))
        } finally {
          setLoading(false)
        }
      })
    },
    [activeTab, compare, customStart, customEnd, syncUrl],
  )

  const handleCompareToggle = useCallback(() => {
    const next = !compare
    setCompare(next)
    setLoadedTabs(new Set())
    syncUrl(activeTab, period, next)
    // Reload overview with compare
    if (activeTab === 'overview') {
      setLoading(true)
      const periodInput = buildPeriodInput()
      startTransition(async () => {
        try {
          const r = await fetchOverview(periodInput, next)
          if (r.ok) setOverview(r.data)
          setLoadedTabs(new Set(['overview']))
        } finally {
          setLoading(false)
        }
      })
    }
  }, [compare, activeTab, period, syncUrl, buildPeriodInput])

  const handleRefresh = useCallback(() => {
    startTransition(async () => {
      await refreshStats()
      loadTabData(activeTab, true)
    })
  }, [activeTab, loadTabData])

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
      if (isInput) return

      // 1-4 switch tabs
      if (e.key >= '1' && e.key <= '4') {
        const idx = Number(e.key) - 1
        if (TABS[idx]) handleTabChange(TABS[idx].id)
        return
      }

      // P = period selector focus (cycle through periods)
      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault()
        const currentIdx = PERIODS.findIndex((p) => p.value === period)
        const nextIdx = (currentIdx + 1) % PERIODS.length
        const next = PERIODS[nextIdx]
        if (next) handlePeriodChange(next.value)
        return
      }

      // E = export dialog
      if ((e.key === 'e' || e.key === 'E') && canExport) {
        e.preventDefault()
        setExportOpen(true)
        return
      }

      // R = refresh
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        handleRefresh()
        return
      }

      // Escape = close dialog
      if (e.key === 'Escape' && exportOpen) {
        setExportOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [activeTab, period, compare, canExport, exportOpen, handleTabChange, handlePeriodChange, handleRefresh])

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#0f172a]">
      {/* Topbar */}
      <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3 md:px-6">
        <h1 className="text-lg font-semibold text-slate-100">Analytics</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            className="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700"
            title="Refresh (R)"
            data-testid="refresh-btn"
          >
            Refresh
          </button>
          {canExport && (
            <button
              type="button"
              onClick={() => setExportOpen(true)}
              className="rounded-md bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-400"
              title="Export (E)"
              data-testid="export-btn"
            >
              Export
            </button>
          )}
        </div>
      </div>

      {/* Period selector + Compare toggle */}
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-700 px-4 py-3 md:px-6">
        <div className="flex items-center gap-1 rounded-md border border-slate-600 p-0.5" role="group" aria-label="Period selector">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => handlePeriodChange(p.value)}
              className={`rounded px-3 py-1 text-sm transition-colors ${
                period === p.value
                  ? 'bg-indigo-500 text-white font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              data-testid={`period-${p.value}`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <label className="inline-flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={compare}
            onChange={handleCompareToggle}
            className="accent-indigo-500"
            data-testid="compare-toggle"
          />
          Compare
        </label>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-700 px-4 md:px-6">
        <nav className="flex gap-0" role="tablist" aria-label="Analytics tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`relative px-4 py-3 text-sm transition-colors ${
                activeTab === tab.id
                  ? 'text-indigo-400 font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              data-testid={`tab-${tab.id}`}
            >
              <span className="mr-1.5 text-xs text-slate-600">{tab.shortcut}</span>
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500" />
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="p-4 md:p-6">
        {activeTab === 'overview' && (
          <OverviewTab stats={overview} compare={compare} loading={loading} />
        )}
        {activeTab === 'newsletters' && (
          <NewslettersTab editions={newsletters} loading={loading && !loadedTabs.has('newsletters')} />
        )}
        {activeTab === 'campaigns' && (
          <CampaignsTab campaigns={campaigns} loading={loading && !loadedTabs.has('campaigns')} />
        )}
        {activeTab === 'content' && (
          <ContentTab posts={content} loading={loading && !loadedTabs.has('content')} />
        )}
      </div>

      {/* Export dialog */}
      {canExport && (
        <ExportDialog
          open={exportOpen}
          onClose={() => setExportOpen(false)}
          period={buildPeriodInput()}
        />
      )}
    </div>
  )
}
