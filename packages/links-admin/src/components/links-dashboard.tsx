'use client'
import { useState, useMemo, useEffect, useRef } from 'react'
import {
  Link2,
  MousePointerClick,
  Activity,
  Crown,
  Plus,
  Search,
  X,
  BarChart3,
  Clock,
  Zap,
} from 'lucide-react'
import { LinkList } from './link-list'
import type { LinkSummary, DashboardKpis, DashboardActivity } from '../types'

export interface LinksDashboardProps {
  links: LinkSummary[]
  metrics: DashboardKpis
  activity?: DashboardActivity
  onCreateLink: () => void
  onDeleteLink: (id: string) => void
  onToggleActive: (id: string) => void
  onSelectLink: (id: string) => void
  onEditLink: (id: string) => void
}

const SOURCE_FILTERS = [
  'all',
  'manual',
  'campaign',
  'newsletter',
  'blog',
  'social',
  'print',
] as const
const STATUS_FILTERS = ['all', 'active', 'paused', 'expired'] as const

type SourceFilter = (typeof SOURCE_FILTERS)[number]
type StatusFilter = (typeof STATUS_FILTERS)[number]

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

const SOURCE_BAR_COLORS: Record<string, string> = {
  manual: 'bg-gray-500',
  campaign: 'bg-blue-500',
  newsletter: 'bg-purple-500',
  blog: 'bg-green-500',
  social: 'bg-pink-500',
  print: 'bg-amber-500',
}

const SOURCE_DOT_COLORS: Record<string, string> = {
  manual: 'bg-gray-400',
  campaign: 'bg-blue-400',
  newsletter: 'bg-purple-400',
  blog: 'bg-green-400',
  social: 'bg-pink-400',
  print: 'bg-amber-400',
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'k'
  return n.toLocaleString()
}

function KpiCard({
  icon,
  label,
  value,
  sub,
  accentClass,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  sub?: string
  accentClass: string
}) {
  return (
    <div className="group rounded-[10px] border border-border bg-card p-4 transition-colors hover:border-muted-foreground/30">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${accentClass}`}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="mt-0.5 text-xl font-extrabold tabular-nums text-foreground">
            {typeof value === 'number' ? formatCompact(value) : value}
          </p>
          {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Weekly Activity Bar Chart
// ---------------------------------------------------------------------------
function WeeklyActivityChart({
  data,
}: {
  data: Array<{ date: string; clicks: number; unique: number }>
}) {
  const days = useMemo(() => {
    const now = new Date()
    const result: Array<{ label: string; clicks: number; unique: number }> = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const iso = d.toISOString().slice(0, 10)
      const match = data.find((x) => x.date === iso)
      result.push({
        label: DAY_LABELS[d.getDay() === 0 ? 6 : d.getDay() - 1],
        clicks: match?.clicks ?? 0,
        unique: match?.unique ?? 0,
      })
    }
    return result
  }, [data])

  const max = Math.max(...days.map((d) => d.clicks), 1)

  return (
    <div>
      <div className="flex items-end gap-1.5" style={{ height: '120px' }}>
        {days.map((d, i) => {
          const pct = Math.max((d.clicks / max) * 100, 3)
          return (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[9px] tabular-nums text-muted-foreground">
                {d.clicks > 0 ? formatCompact(d.clicks) : ''}
              </span>
              <div className="relative flex w-full flex-1 items-end justify-center">
                <div
                  className="w-full max-w-[32px] rounded-t-md bg-indigo-500/70 transition-all hover:bg-indigo-400"
                  style={{ height: `${pct}%` }}
                  title={`${d.label}: ${d.clicks} clicks, ${d.unique} unique`}
                />
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex gap-1.5">
        {days.map((d, i) => (
          <div
            key={i}
            className="flex-1 text-center text-[9px] font-medium text-muted-foreground"
          >
            {d.label}
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Peak Hours Heatmap (7 days × 24 hours)
// ---------------------------------------------------------------------------
function HourlyHeatmap({ data }: { data: number[][] }) {
  const max = useMemo(() => {
    let m = 0
    for (const row of data) for (const v of row) if (v > m) m = v
    return m || 1
  }, [data])

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[420px]">
        {DAY_LABELS.map((day, di) => (
          <div key={day} className="flex items-center gap-1">
            <span className="w-7 shrink-0 text-[9px] font-medium text-muted-foreground">
              {day}
            </span>
            <div className="flex flex-1 gap-px">
              {(data[di] ?? new Array(24).fill(0)).map((v, hi) => {
                const intensity = v / max
                return (
                  <div
                    key={hi}
                    className="aspect-square flex-1 rounded-[2px] transition-colors"
                    style={{
                      backgroundColor:
                        intensity > 0
                          ? `rgba(99, 102, 241, ${0.15 + intensity * 0.75})`
                          : 'rgba(99, 102, 241, 0.06)',
                    }}
                    title={`${day} ${hi}:00 — ${v} clicks`}
                  />
                )
              })}
            </div>
          </div>
        ))}
        <div className="mt-1 flex items-center gap-1">
          <span className="w-7 shrink-0" />
          <div className="flex flex-1 gap-px">
            {Array.from({ length: 24 }, (_, i) => (
              <div
                key={i}
                className="flex-1 text-center text-[8px] text-muted-foreground/60"
              >
                {i % 6 === 0 ? `${i}` : ''}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-2 flex items-center justify-end gap-1.5">
          <span className="text-[8px] text-muted-foreground/50">Less</span>
          {[0.06, 0.2, 0.4, 0.65, 0.9].map((op, i) => (
            <div
              key={i}
              className="h-2.5 w-2.5 rounded-[2px]"
              style={{ backgroundColor: `rgba(99, 102, 241, ${op})` }}
            />
          ))}
          <span className="text-[8px] text-muted-foreground/50">More</span>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Source Breakdown
// ---------------------------------------------------------------------------
function SourceBreakdown({
  data,
}: {
  data: Array<{ source: string; clicks: number }>
}) {
  const sources = useMemo(() => {
    const defaults = ['manual', 'campaign', 'newsletter', 'blog', 'social', 'print']
    const map = new Map(data.map((d) => [d.source, d.clicks]))
    return defaults.map((s) => ({ source: s, clicks: map.get(s) ?? 0 }))
  }, [data])

  const max = Math.max(...sources.map((s) => s.clicks), 1)

  return (
    <div className="space-y-2">
      {sources.map((s) => {
        const pct = Math.max((s.clicks / max) * 100, 4)
        return (
          <div key={s.source} className="flex items-center gap-2">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${SOURCE_DOT_COLORS[s.source] ?? 'bg-gray-400'}`}
            />
            <span className="w-[72px] shrink-0 text-[10px] font-medium capitalize text-muted-foreground">
              {s.source}
            </span>
            <div className="flex-1">
              <div className="h-2 overflow-hidden rounded-full bg-muted/50">
                <div
                  className={`h-full rounded-full transition-all ${SOURCE_BAR_COLORS[s.source] ?? 'bg-gray-500'}`}
                  style={{ width: `${pct}%`, opacity: s.clicks > 0 ? 0.7 : 0.15 }}
                />
              </div>
            </div>
            <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
              {s.clicks > 0 ? formatCompact(s.clicks) : '0'}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty heatmap
// ---------------------------------------------------------------------------
const EMPTY_HEATMAP: number[][] = Array.from({ length: 7 }, () =>
  new Array(24).fill(0),
)

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------
export function LinksDashboard({
  links,
  metrics,
  activity,
  onCreateLink,
  onDeleteLink,
  onToggleActive,
  onSelectLink,
  onEditLink,
}: LinksDashboardProps) {
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        onCreateLink()
      }
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCreateLink])

  const filtered = useMemo(() => {
    let result = links
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (l) =>
          l.title?.toLowerCase().includes(q) ||
          l.code.toLowerCase().includes(q) ||
          l.destination_url.toLowerCase().includes(q),
      )
    }
    if (sourceFilter !== 'all') {
      result = result.filter((l) => l.source_type === sourceFilter)
    }
    if (statusFilter !== 'all') {
      result = result.filter((l) => {
        if (statusFilter === 'active')
          return l.active && !(l.expires_at && new Date(l.expires_at) < new Date())
        if (statusFilter === 'paused') return !l.active
        if (statusFilter === 'expired')
          return !!(l.expires_at && new Date(l.expires_at) < new Date())
        return true
      })
    }
    return result
  }, [links, search, sourceFilter, statusFilter])

  const hasActiveFilters = sourceFilter !== 'all' || statusFilter !== 'all' || search !== ''

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">Links</h1>
          <p className="text-xs text-muted-foreground">
            {links.length} total link{links.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onCreateLink}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-[11px] font-semibold text-white shadow-sm transition-colors hover:bg-indigo-600"
        >
          <Plus className="h-3.5 w-3.5" />
          Create Link
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          icon={<Link2 className="h-4 w-4 text-indigo-400" />}
          label="Total Links"
          value={metrics.totalLinks}
          accentClass="bg-indigo-500/10"
        />
        <KpiCard
          icon={<MousePointerClick className="h-4 w-4 text-green-400" />}
          label="Total Clicks"
          value={metrics.totalClicks}
          accentClass="bg-green-500/10"
        />
        <KpiCard
          icon={<Activity className="h-4 w-4 text-sky-400" />}
          label="Active Links"
          value={metrics.activeLinks}
          accentClass="bg-sky-500/10"
        />
        <KpiCard
          icon={<Crown className="h-4 w-4 text-amber-400" />}
          label="Top Performer"
          value={metrics.topPerformer ? formatCompact(metrics.topPerformer.clicks) : '—'}
          sub={metrics.topPerformer ? `/${metrics.topPerformer.code}` : undefined}
          accentClass="bg-amber-500/10"
        />
      </div>

      {/* Charts Section */}
      <div className="grid gap-3 lg:grid-cols-3">
        {/* Weekly Activity — 2 cols */}
        <div className="rounded-[10px] border border-border bg-card p-4 lg:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <BarChart3 className="h-3.5 w-3.5 text-indigo-400" />
            <span className="text-[11px] font-semibold text-foreground">
              Weekly Activity
            </span>
          </div>
          <WeeklyActivityChart data={activity?.dailyClicks ?? []} />
        </div>

        {/* Source Breakdown */}
        <div className="rounded-[10px] border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 text-purple-400" />
            <span className="text-[11px] font-semibold text-foreground">
              By Source
            </span>
          </div>
          <SourceBreakdown data={activity?.sourceBreakdown ?? []} />
        </div>
      </div>

      {/* Peak Hours Heatmap */}
      <div className="rounded-[10px] border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-sky-400" />
          <span className="text-[11px] font-semibold text-foreground">Peak Hours</span>
          <span className="text-[9px] text-muted-foreground/60">
            Last 7 days · click distribution by day &amp; hour
          </span>
        </div>
        <HourlyHeatmap data={activity?.hourlyHeatmap ?? EMPTY_HEATMAP} />
      </div>

      {/* Filter Bar */}
      <div className="space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search links… (F)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-8 text-[11px] text-foreground placeholder:text-muted-foreground focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {/* Source filters */}
          <div className="flex flex-wrap items-center gap-1">
            <span className="mr-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Source
            </span>
            {SOURCE_FILTERS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSourceFilter(s)}
                className={`rounded-full px-2.5 py-1 text-[10px] font-medium capitalize transition-colors ${
                  sourceFilter === s
                    ? 'bg-indigo-500 text-white'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-border" />

          {/* Status filters */}
          <div className="flex items-center gap-1">
            <span className="mr-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Status
            </span>
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`rounded-full px-2.5 py-1 text-[10px] font-medium capitalize transition-colors ${
                  statusFilter === s
                    ? 'bg-indigo-500 text-white'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {hasActiveFilters && (
            <>
              <div className="h-4 w-px bg-border" />
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  setSourceFilter('all')
                  setStatusFilter('all')
                }}
                className="text-[10px] font-medium text-indigo-400 hover:text-indigo-300"
              >
                Clear filters
              </button>
            </>
          )}
        </div>
      </div>

      {/* Results count when filtered */}
      {hasActiveFilters && (
        <p className="text-[10px] text-muted-foreground">
          Showing {filtered.length} of {links.length} links
        </p>
      )}

      {/* Links Table */}
      <LinkList
        links={filtered}
        onSelect={onSelectLink}
        onToggleActive={onToggleActive}
        onDelete={onDeleteLink}
        onEdit={onEditLink}
        selectedId={null}
      />
    </div>
  )
}
