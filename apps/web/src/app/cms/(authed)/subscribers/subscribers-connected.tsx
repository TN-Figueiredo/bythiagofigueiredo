'use client'

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  useTransition,
  type ChangeEvent,
} from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import {
  exportSubscribers,
  batchUnsubscribe,
  toggleTrackingConsent,
} from './actions'

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export type SubscriberStatus =
  | 'confirmed'
  | 'pending'
  | 'bounced'
  | 'unsubscribed'
  | 'complained'

export interface SubscriberRow {
  id: string
  email: string
  status: SubscriberStatus
  newsletter_type_name: string
  newsletter_type_color: string | null
  tracking_consent: boolean
  subscribed_at: string
  confirmed_at: string | null
  is_anonymized: boolean
}

interface NewsletterType {
  id: string
  name: string
  color: string | null
}

interface StatsData {
  totalConfirmed: number
  totalPending: number
  totalUnsubscribed: number
  trackingConsentedPct: number
}

interface Props {
  initialRows: SubscriberRow[]
  totalCount: number
  page: number
  perPage: number
  newsletterTypes: NewsletterType[]
  stats: StatsData
  currentSearch: string
  currentStatus: string
  currentType: string
}

type SortField = 'email' | 'subscribed_at' | 'status'
type SortDir = 'asc' | 'desc'

const STATUS_LABELS: Record<SubscriberStatus, string> = {
  confirmed: 'Confirmed',
  pending: 'Pending',
  bounced: 'Bounced',
  unsubscribed: 'Unsubscribed',
  complained: 'Complained',
}

const STATUS_COLORS: Record<SubscriberStatus, { bg: string; text: string }> = {
  confirmed: { bg: 'bg-emerald-900/50', text: 'text-emerald-400' },
  pending: { bg: 'bg-amber-900/50', text: 'text-amber-400' },
  bounced: { bg: 'bg-red-900/50', text: 'text-red-400' },
  unsubscribed: { bg: 'bg-slate-700', text: 'text-slate-400' },
  complained: { bg: 'bg-rose-900/50', text: 'text-rose-400' },
}

const FILTER_STATUSES: Array<{ value: string; label: string }> = [
  { value: '', label: 'All' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'pending', label: 'Pending' },
  { value: 'unsubscribed', label: 'Unsubscribed' },
]

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function StatusBadge({ status }: { status: SubscriberStatus }) {
  const colors = STATUS_COLORS[status] ?? STATUS_COLORS.pending
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}
      data-testid="status-badge"
    >
      {STATUS_LABELS[status]}
    </span>
  )
}

function SortIndicator({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="ml-1 text-slate-600">{'↕'}</span>
  return (
    <span className="ml-1 text-indigo-400">
      {dir === 'asc' ? '↑' : '↓'}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/*  Detail Panel                                                      */
/* ------------------------------------------------------------------ */

function DetailPanel({
  row,
  onClose,
  onToggleConsent,
  isPending,
}: {
  row: SubscriberRow
  onClose: () => void
  onToggleConsent: (id: string, enabled: boolean) => void
  isPending: boolean
}) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/50 md:bg-transparent"
        onClick={onClose}
        data-testid="detail-overlay"
      />
      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Subscriber detail"
        data-testid="detail-panel"
        className="fixed inset-y-0 right-0 z-50 w-full bg-[#0f172a] border-l border-slate-700 shadow-xl overflow-y-auto md:w-[420px]"
      >
        <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-100">
            Subscriber Detail
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            aria-label="Close detail panel"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="space-y-6 p-4">
          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Email
            </label>
            <p className="font-mono text-sm text-slate-200 break-all">
              {row.email}
            </p>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Status
            </label>
            <StatusBadge status={row.status} />
          </div>

          {/* Newsletter type */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Newsletter Type
            </label>
            <span className="text-sm text-slate-200">
              {row.newsletter_type_name}
            </span>
          </div>

          {/* Subscribed date */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Subscribed
            </label>
            <span className="text-sm text-slate-200">
              {new Date(row.subscribed_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </span>
          </div>

          {/* Confirmed date */}
          {row.confirmed_at && (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Confirmed
              </label>
              <span className="text-sm text-slate-200">
                {new Date(row.confirmed_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
          )}

          {/* Tracking consent toggle */}
          {!row.is_anonymized && (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2">
                Tracking Consent
              </label>
              <button
                type="button"
                role="switch"
                aria-checked={row.tracking_consent}
                aria-label="Toggle tracking consent"
                disabled={isPending}
                onClick={() =>
                  onToggleConsent(row.id, !row.tracking_consent)
                }
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 ${
                  row.tracking_consent ? 'bg-indigo-500' : 'bg-slate-600'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transition-transform ${
                    row.tracking_consent ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className="ml-2 text-xs text-slate-400">
                {row.tracking_consent ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          )}

          {/* Anonymized badge */}
          {row.is_anonymized && (
            <div className="rounded-md border border-amber-800/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-300">
              This subscriber has been anonymized per LGPD. PII is no longer
              available.
            </div>
          )}
        </div>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Mobile Card                                                       */
/* ------------------------------------------------------------------ */

function MobileCard({
  row,
  selected,
  onToggleSelect,
  onOpenDetail,
}: {
  row: SubscriberRow
  selected: boolean
  onToggleSelect: () => void
  onOpenDetail: () => void
}) {
  return (
    <div
      className="rounded-lg border border-slate-700 bg-slate-800/50 p-3 mb-2"
      data-testid="subscriber-mobile-card"
    >
      <div className="flex items-start gap-2">
        {!row.is_anonymized && (
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            className="mt-1 rounded accent-indigo-500"
            aria-label={`Select ${row.email}`}
          />
        )}
        <div className="flex-1 min-w-0">
          <button
            type="button"
            onClick={onOpenDetail}
            className="block w-full text-left"
          >
            <p
              className={`font-mono text-xs truncate ${
                row.is_anonymized
                  ? 'italic text-slate-500'
                  : 'text-slate-200'
              }`}
            >
              {row.email}
            </p>
          </button>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <StatusBadge status={row.status} />
            <span className="text-xs text-slate-500">
              {row.newsletter_type_name}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              {new Date(row.subscribed_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
            <span className="text-xs text-slate-500">
              {row.tracking_consent ? 'Tracking: Yes' : 'Tracking: No'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                    */
/* ------------------------------------------------------------------ */

export function SubscribersConnected({
  initialRows,
  totalCount,
  page,
  perPage,
  newsletterTypes,
  stats,
  currentSearch,
  currentStatus,
  currentType,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  // Local state
  const [searchInput, setSearchInput] = useState(currentSearch)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [detailRow, setDetailRow] = useState<SubscriberRow | null>(null)
  const [sortField, setSortField] = useState<SortField>('subscribed_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [batchMsg, setBatchMsg] = useState<string | null>(null)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Derived
  const totalPages = Math.ceil(totalCount / perPage)
  const startRow = (page - 1) * perPage + 1
  const endRow = Math.min(page * perPage, totalCount)

  // Sort rows locally
  const sortedRows = [...initialRows].sort((a, b) => {
    const mul = sortDir === 'asc' ? 1 : -1
    if (sortField === 'email') return mul * a.email.localeCompare(b.email)
    if (sortField === 'status') return mul * a.status.localeCompare(b.status)
    // subscribed_at default
    return mul * (new Date(a.subscribed_at).getTime() - new Date(b.subscribed_at).getTime())
  })

  const selectableIds = sortedRows.filter((r) => !r.is_anonymized).map((r) => r.id)
  const allSelected =
    selectableIds.length > 0 &&
    selectableIds.every((id) => selectedIds.has(id))

  /* ---- URL helpers ---- */

  const buildUrl = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, val] of Object.entries(updates)) {
        if (val) params.set(key, val)
        else params.delete(key)
      }
      if (!('page' in updates)) params.delete('page')
      const qs = params.toString()
      return qs ? `${pathname}?${qs}` : pathname
    },
    [pathname, searchParams],
  )

  /* ---- Handlers ---- */

  const handleSearchChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value
      setSearchInput(val)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        router.push(buildUrl({ search: val }))
      }, 300)
    },
    [router, buildUrl],
  )

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const handleStatusFilter = useCallback(
    (status: string) => {
      router.push(buildUrl({ status }))
    },
    [router, buildUrl],
  )

  const handleTypeFilter = useCallback(
    (typeId: string) => {
      router.push(buildUrl({ type: typeId }))
    },
    [router, buildUrl],
  )

  const handlePageChange = useCallback(
    (newPage: number) => {
      router.push(buildUrl({ page: String(newPage) }))
    },
    [router, buildUrl],
  )

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  function toggleAll() {
    if (allSelected) setSelectedIds(new Set())
    else setSelectedIds(new Set(selectableIds))
  }

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  /* ---- Batch actions ---- */

  function handleBatchUnsubscribe() {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    if (
      !window.confirm(
        `Unsubscribe ${ids.length} subscriber${ids.length > 1 ? 's' : ''}?`,
      )
    )
      return

    startTransition(async () => {
      const res = await batchUnsubscribe(ids)
      if (res.ok) {
        setSelectedIds(new Set())
        setBatchMsg(`${ids.length} subscriber(s) unsubscribed.`)
        setTimeout(() => setBatchMsg(null), 3000)
      } else {
        setBatchMsg('Error: ' + ('error' in res ? res.error : 'Unknown'))
        setTimeout(() => setBatchMsg(null), 5000)
      }
    })
  }

  function handleBatchExport() {
    setExportDialogOpen(true)
  }

  function handleExport(format: 'csv' | 'json') {
    startTransition(async () => {
      const res = await exportSubscribers(format, {
        status: currentStatus,
        search: currentSearch,
        typeId: currentType || undefined,
      })
      if (res.ok && 'data' in res) {
        const blob = new Blob([res.data], {
          type: format === 'csv' ? 'text/csv' : 'application/json',
        })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `subscribers.${format}`
        a.click()
        URL.revokeObjectURL(url)
      }
      setExportDialogOpen(false)
    })
  }

  function handleToggleConsent(id: string, enabled: boolean) {
    startTransition(async () => {
      const res = await toggleTrackingConsent(id, enabled)
      if (res.ok && detailRow && detailRow.id === id) {
        setDetailRow({ ...detailRow, tracking_consent: enabled })
      }
    })
  }

  /* ---- Render ---- */

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div
        className="grid grid-cols-2 gap-3 md:grid-cols-4"
        data-testid="stats-bar"
      >
        <StatCard label="Confirmed" value={stats.totalConfirmed} accent="emerald" />
        <StatCard label="Pending" value={stats.totalPending} accent="amber" />
        <StatCard label="Unsubscribed" value={stats.totalUnsubscribed} accent="slate" />
        <StatCard
          label="Tracking Consent"
          value={`${stats.trackingConsentedPct}%`}
          accent="indigo"
        />
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 p-3">
        <input
          type="search"
          value={searchInput}
          onChange={handleSearchChange}
          placeholder="Search by email..."
          aria-label="Search subscribers"
          className="min-w-[180px] flex-1 rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <select
          value={currentType}
          onChange={(e) => handleTypeFilter(e.target.value)}
          aria-label="Filter by newsletter type"
          className="rounded-md border border-slate-600 bg-slate-800 px-2 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All types</option>
          {newsletterTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <div className="flex gap-1 flex-wrap" role="group" aria-label="Status filters">
          {FILTER_STATUSES.map((s) => (
            <button
              type="button"
              key={s.value}
              onClick={() => handleStatusFilter(s.value)}
              aria-pressed={currentStatus === s.value}
              data-testid={`filter-pill-${s.value || 'all'}`}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                currentStatus === s.value
                  ? 'border-indigo-500 bg-indigo-500/20 text-indigo-400'
                  : 'border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-300'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Export button in topbar */}
        <button
          type="button"
          onClick={() => setExportDialogOpen(true)}
          className="ml-auto rounded-md border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700"
          data-testid="export-btn"
        >
          Export
        </button>
      </div>

      {/* Batch actions bar */}
      {selectedIds.size > 0 && (
        <div
          className="flex items-center gap-3 rounded-lg border border-indigo-500/30 bg-indigo-950/30 px-4 py-2"
          data-testid="batch-bar"
        >
          <span className="text-sm font-medium text-indigo-300">
            {selectedIds.size} selected
          </span>
          <button
            type="button"
            onClick={handleBatchUnsubscribe}
            disabled={isPending}
            className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-50"
          >
            Unsubscribe
          </button>
          <button
            type="button"
            onClick={handleBatchExport}
            disabled={isPending}
            className="rounded-md border border-slate-600 px-3 py-1 text-xs font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-50"
          >
            Export Selected
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto text-xs text-slate-400 hover:text-slate-200"
          >
            Clear
          </button>
        </div>
      )}

      {/* Batch message */}
      {batchMsg && (
        <div
          className={`rounded-md px-4 py-2 text-sm ${
            batchMsg.startsWith('Error')
              ? 'border border-red-800/50 bg-red-950/30 text-red-300'
              : 'border border-emerald-800/50 bg-emerald-950/30 text-emerald-300'
          }`}
          data-testid="batch-message"
        >
          {batchMsg}
        </div>
      )}

      {/* Empty state */}
      {initialRows.length === 0 && (
        <div
          className="rounded-lg border border-slate-700 bg-slate-800/50 p-12 text-center"
          data-testid="empty-state"
        >
          <p className="text-sm text-slate-400">No subscribers found.</p>
        </div>
      )}

      {/* Desktop table */}
      {initialRows.length > 0 && (
        <div className="hidden md:block overflow-x-auto">
          <table
            className="w-full text-sm border-collapse"
            data-testid="subscriber-table"
          >
            <thead>
              <tr className="text-left text-xs uppercase text-slate-400" style={{ letterSpacing: '0.06em' }}>
                <th className="pb-2 pr-3 w-8">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Select all"
                    className="rounded accent-indigo-500"
                  />
                </th>
                <th className="pb-2 pr-4">
                  <button
                    type="button"
                    onClick={() => toggleSort('email')}
                    className="inline-flex items-center hover:text-slate-200"
                    data-testid="sort-email"
                  >
                    Email
                    <SortIndicator
                      active={sortField === 'email'}
                      dir={sortDir}
                    />
                  </button>
                </th>
                <th className="pb-2 pr-4">
                  <button
                    type="button"
                    onClick={() => toggleSort('status')}
                    className="inline-flex items-center hover:text-slate-200"
                    data-testid="sort-status"
                  >
                    Status
                    <SortIndicator
                      active={sortField === 'status'}
                      dir={sortDir}
                    />
                  </button>
                </th>
                <th className="pb-2 pr-4">Newsletter Type</th>
                <th className="pb-2 pr-4">
                  <button
                    type="button"
                    onClick={() => toggleSort('subscribed_at')}
                    className="inline-flex items-center hover:text-slate-200"
                    data-testid="sort-date"
                  >
                    Subscribed
                    <SortIndicator
                      active={sortField === 'subscribed_at'}
                      dir={sortDir}
                    />
                  </button>
                </th>
                <th className="pb-2 pr-4">Tracking</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-slate-700 transition-colors hover:bg-slate-800/80 cursor-pointer"
                  onClick={() => setDetailRow(row)}
                  data-testid="subscriber-row"
                >
                  <td
                    className="py-2.5 pr-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {!row.is_anonymized ? (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.id)}
                        onChange={() => toggleRow(row.id)}
                        aria-label={`Select ${row.email}`}
                        className="rounded accent-indigo-500"
                      />
                    ) : (
                      <input
                        type="checkbox"
                        disabled
                        className="rounded opacity-30"
                      />
                    )}
                  </td>
                  <td className="py-2.5 pr-4 max-w-[220px]">
                    <span
                      className={`font-mono text-xs truncate block ${
                        row.is_anonymized
                          ? 'italic text-slate-500'
                          : 'text-slate-200'
                      }`}
                    >
                      {row.email}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="py-2.5 pr-4">
                    <span
                      className="text-xs px-1.5 py-0.5 rounded font-medium"
                      style={{
                        background: (row.newsletter_type_color ?? '#6b7280') + '22',
                        color: row.newsletter_type_color ?? '#6b7280',
                        border: `1px solid ${row.newsletter_type_color ?? '#6b7280'}44`,
                      }}
                    >
                      {row.newsletter_type_name}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-xs text-slate-400 whitespace-nowrap">
                    {new Date(row.subscribed_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="py-2.5 pr-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${
                        row.tracking_consent
                          ? 'bg-emerald-900/50 text-emerald-400'
                          : 'bg-slate-700 text-slate-400'
                      }`}
                    >
                      {row.tracking_consent ? 'Yes' : 'No'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile cards */}
      {initialRows.length > 0 && (
        <div className="md:hidden" data-testid="mobile-card-list">
          {sortedRows.map((row) => (
            <MobileCard
              key={row.id}
              row={row}
              selected={selectedIds.has(row.id)}
              onToggleSelect={() => toggleRow(row.id)}
              onOpenDetail={() => setDetailRow(row)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <nav
          className="flex items-center justify-between border-t border-slate-700 pt-4 text-sm"
          aria-label="Pagination"
          data-testid="pagination"
        >
          <span className="text-xs text-slate-400">
            Showing {startRow}--{endRow} of {totalCount}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1}
              className="rounded border border-slate-600 px-3 py-1.5 text-xs text-slate-300 disabled:opacity-40"
            >
              Previous
            </button>
            {Array.from(
              { length: Math.min(totalPages, 5) },
              (_, i) => i + 1,
            ).map((p) => (
              <button
                type="button"
                key={p}
                onClick={() => handlePageChange(p)}
                aria-current={p === page ? 'page' : undefined}
                className={`rounded border px-3 py-1.5 text-xs ${
                  p === page
                    ? 'border-indigo-500 bg-indigo-500/20 text-indigo-400'
                    : 'border-slate-600 text-slate-300'
                }`}
              >
                {p}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages}
              className="rounded border border-slate-600 px-3 py-1.5 text-xs text-slate-300 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </nav>
      )}

      {/* Detail slide-in panel */}
      {detailRow && (
        <DetailPanel
          row={detailRow}
          onClose={() => setDetailRow(null)}
          onToggleConsent={handleToggleConsent}
          isPending={isPending}
        />
      )}

      {/* Export dialog */}
      {exportDialogOpen && (
        <ExportDialog
          onExport={handleExport}
          onClose={() => setExportDialogOpen(false)}
          isPending={isPending}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Stat Card                                                         */
/* ------------------------------------------------------------------ */

function StatCard({
  label,
  value,
  accent,
}: {
  label: string
  value: string | number
  accent: 'emerald' | 'amber' | 'slate' | 'indigo'
}) {
  const textColors: Record<typeof accent, string> = {
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    slate: 'text-slate-400',
    indigo: 'text-indigo-400',
  }

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4" data-testid="stat-card">
      <span className="block text-xs font-medium text-slate-400 mb-1">
        {label}
      </span>
      <span className={`text-2xl font-bold ${textColors[accent]}`}>
        {value}
      </span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Export Dialog                                                      */
/* ------------------------------------------------------------------ */

function ExportDialog({
  onExport,
  onClose,
  isPending,
}: {
  onExport: (format: 'csv' | 'json') => void
  onClose: () => void
  isPending: boolean
}) {
  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/50"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-label="Export subscribers"
        data-testid="export-dialog"
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border border-slate-700 bg-[#0f172a] p-6 shadow-xl"
      >
        <h3 className="text-sm font-semibold text-slate-100 mb-4">
          Export Subscribers
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          Choose export format. Anonymized subscribers are excluded.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onExport('csv')}
            disabled={isPending}
            className="flex-1 rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
          >
            CSV
          </button>
          <button
            type="button"
            onClick={() => onExport('json')}
            disabled={isPending}
            className="flex-1 rounded-md border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-50"
          >
            JSON
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full text-center text-xs text-slate-400 hover:text-slate-200"
        >
          Cancel
        </button>
      </div>
    </>
  )
}
