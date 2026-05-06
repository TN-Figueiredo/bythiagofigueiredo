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
} from 'lucide-react'
import { LinkList } from './link-list'
import type { LinkSummary, DashboardKpis } from '../types'

export interface LinksDashboardProps {
  links: LinkSummary[]
  metrics: DashboardKpis
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

export function LinksDashboard({
  links,
  metrics,
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
