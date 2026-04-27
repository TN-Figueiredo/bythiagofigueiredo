'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { TypeCards } from './_components/type-cards'
import { retryEdition } from './actions'

/* ─────────── Types ─────────── */

interface TypeCardData {
  id: string
  name: string
  color: string
  subscribers: number
  avgOpenRate: number
  lastSent: string | null
  cadence: string
  editionCount: number
  isPaused: boolean
}

interface EditionRow {
  id: string
  subject: string
  status: 'idea' | 'draft' | 'ready' | 'queued' | 'scheduled' | 'sending' | 'sent' | 'failed' | 'cancelled'
  newsletter_type_id: string
  newsletter_type_name?: string
  newsletter_type_color?: string
  stats_delivered?: number | null
  stats_opens?: number | null
  stats_clicks?: number | null
  stats_bounces?: number | null
  total_subscribers?: number | null
  sent_at?: string | null
  scheduled_at?: string | null
  created_at?: string | null
  updated_at?: string | null
  error_message?: string | null
  retry_count?: number | null
  max_retries?: number | null
  source_post_id?: string | null
  is_best_performer?: boolean
}

interface KpiData {
  uniqueSubscribers: number
  editionsSent30d: number
  avgOpenRate30d: number
  avgOpenRateDelta: number | null
  bounceRate: number
}

interface LastEditionBanner {
  id: string
  subject: string
  sentAt: string
  delivered: number
  opens: number
  clicks: number
  openRate: number
}

interface NewslettersConnectedProps {
  types: TypeCardData[]
  editions: EditionRow[]
  kpis: KpiData
  lastEdition: LastEditionBanner | null
  totalEditions: number
}

/* ─────────── Helpers ─────────── */

type SortKey = 'subject' | 'type' | 'delivered' | 'opens' | 'clicks' | 'date'
type SortDir = 'asc' | 'desc'

const STATUS_OPTIONS = ['all', 'idea', 'draft', 'ready', 'scheduled', 'sending', 'sent', 'failed', 'cancelled'] as const

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '--'
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatPct(value: number | null | undefined): string {
  if (value == null) return '--'
  return `${value.toFixed(1)}%`
}

function getOpenRate(row: EditionRow): number {
  const delivered = row.stats_delivered ?? 0
  const opens = row.stats_opens ?? 0
  return delivered > 0 ? (opens / delivered) * 100 : 0
}

function getClickRate(row: EditionRow): number {
  const delivered = row.stats_delivered ?? 0
  const clicks = row.stats_clicks ?? 0
  return delivered > 0 ? (clicks / delivered) * 100 : 0
}

function getSendProgress(row: EditionRow): { sent: number; total: number; pct: number } | null {
  if (row.status !== 'sending') return null
  const sent = row.stats_delivered ?? 0
  const total = row.total_subscribers ?? 0
  return { sent, total, pct: total > 0 ? (sent / total) * 100 : 0 }
}

function bounceHealthColor(rate: number): string {
  if (rate > 5) return 'text-[var(--cms-red,#ef4444)]'
  if (rate >= 2) return 'text-[var(--cms-amber,#f59e0b)]'
  return 'text-[var(--cms-green,#22c55e)]'
}

function bounceHealthLabel(rate: number): string {
  if (rate > 5) return 'auto-pause'
  if (rate >= 2) return 'warning'
  return 'healthy'
}

/* ─────────── KPI Strip ─────────── */

function KpiCard({
  label,
  value,
  sub,
  color,
  testId,
}: {
  label: string
  value: string | number
  sub?: string
  color?: 'green' | 'amber' | 'red' | 'indigo' | 'default'
  testId?: string
}) {
  const accentMap: Record<string, string> = {
    green: 'border-t-[var(--cms-green,#22c55e)]',
    amber: 'border-t-[var(--cms-amber,#f59e0b)]',
    red: 'border-t-[var(--cms-red,#ef4444)]',
    indigo: 'border-t-cms-accent',
    default: 'border-t-cms-border',
  }
  return (
    <div
      className={`rounded-[var(--cms-radius)] border border-cms-border border-t-2 bg-cms-surface px-4 py-4 ${accentMap[color ?? 'default']}`}
      data-testid={testId}
    >
      <p className="text-[11px] font-medium uppercase tracking-[1.5px] text-cms-text-muted">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold leading-none text-cms-text">
        {value}
      </p>
      {sub && <p className="mt-1 text-[11px] text-cms-text-dim">{sub}</p>}
    </div>
  )
}

function KpiStrip({ kpis }: { kpis: KpiData }) {
  const deltaStr =
    kpis.avgOpenRateDelta != null
      ? `${kpis.avgOpenRateDelta > 0 ? '+' : ''}${kpis.avgOpenRateDelta.toFixed(1)}pp`
      : undefined

  return (
    <div
      className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      data-testid="newsletter-kpis"
    >
      <KpiCard
        label="Unique Subscribers"
        value={kpis.uniqueSubscribers.toLocaleString()}
        sub="across all types"
        color="indigo"
        testId="kpi-unique-subs"
      />
      <KpiCard
        label="Editions Sent"
        value={kpis.editionsSent30d}
        sub="last 30 days"
        color="green"
        testId="kpi-editions-sent"
      />
      <KpiCard
        label="Avg Open Rate"
        value={formatPct(kpis.avgOpenRate30d)}
        sub={deltaStr ? `${deltaStr} vs prior 30d` : 'last 30 days'}
        color={kpis.avgOpenRate30d >= 30 ? 'green' : kpis.avgOpenRate30d >= 15 ? 'default' : 'amber'}
        testId="kpi-avg-open-rate"
      />
      <KpiCard
        label="Bounce Rate"
        value={formatPct(kpis.bounceRate)}
        sub={bounceHealthLabel(kpis.bounceRate)}
        color={kpis.bounceRate > 5 ? 'red' : kpis.bounceRate >= 2 ? 'amber' : 'green'}
        testId="kpi-bounce-rate"
      />
    </div>
  )
}

/* ─────────── Last Newsletter Banner ─────────── */

function LastNewsletterBanner({ edition }: { edition: LastEditionBanner }) {
  return (
    <div
      className="relative overflow-hidden rounded-[var(--cms-radius)] border border-cms-border bg-gradient-to-r from-cms-accent/10 via-cms-surface to-cms-surface p-5"
      data-testid="last-newsletter-banner"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[1.5px] text-cms-text-muted">
            Last Newsletter
          </p>
          <p className="mt-1 truncate text-base font-semibold text-cms-text">
            {edition.subject}
          </p>
          <p className="mt-0.5 text-xs text-cms-text-dim">
            Sent {formatDate(edition.sentAt)}
          </p>
        </div>
        <div className="flex shrink-0 gap-4 text-center text-xs" data-testid="last-nl-stats">
          <div>
            <div className="text-lg font-semibold text-cms-text">{edition.delivered}</div>
            <div className="text-cms-text-dim">Delivered</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-[var(--cms-green,#22c55e)]">
              {formatPct(edition.openRate)}
            </div>
            <div className="text-cms-text-dim">Opens</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-cms-text">{edition.clicks}</div>
            <div className="text-cms-text-dim">Clicks</div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─────────── Context Menu ─────────── */

interface ContextMenuProps {
  edition: EditionRow
  onRetry: (id: string) => void
  isRetrying: boolean
}

function ContextMenu({ edition, onRetry, isRetrying }: ContextMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    if (open) document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open])

  const items = getMenuItems(edition, onRetry, isRetrying)
  if (items.length === 0) return null

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="rounded p-1 text-cms-text-muted hover:bg-cms-surface-hover hover:text-cms-text"
        aria-label="Edition actions"
        data-testid={`ctx-menu-btn-${edition.id}`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </button>
      {open && (
        <div
          className="absolute right-0 top-8 z-50 min-w-[160px] rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface py-1 shadow-lg"
          data-testid={`ctx-menu-${edition.id}`}
          role="menu"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                item.action()
                setOpen(false)
              }}
              disabled={item.disabled}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors ${
                item.destructive
                  ? 'text-[var(--cms-red,#ef4444)] hover:bg-[var(--cms-red,#ef4444)]/10'
                  : 'text-cms-text hover:bg-cms-surface-hover'
              } disabled:opacity-40`}
              data-testid={`ctx-action-${item.testId}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface MenuItem {
  label: string
  action: () => void
  destructive?: boolean
  disabled?: boolean
  testId: string
}

function getMenuItems(
  edition: EditionRow,
  onRetry: (id: string) => void,
  isRetrying: boolean,
): MenuItem[] {
  const items: MenuItem[] = []
  const editHref = `/cms/newsletters/${edition.id}/edit`
  const analyticsHref = `/cms/newsletters/${edition.id}/analytics`

  switch (edition.status) {
    case 'draft':
    case 'ready':
      items.push(
        { label: 'Edit', action: () => { window.location.href = editHref }, testId: 'edit' },
        { label: 'Send Test', action: () => { window.location.href = `${editHref}?test=1` }, testId: 'test' },
        { label: 'Duplicate', action: () => { /* handled by parent */ }, testId: 'duplicate' },
        { label: 'Delete', action: () => { /* handled by parent */ }, destructive: true, testId: 'delete' },
      )
      break
    case 'scheduled':
      items.push(
        { label: 'Edit', action: () => { window.location.href = editHref }, testId: 'edit' },
        { label: 'Cancel', action: () => { /* handled by parent */ }, testId: 'cancel' },
        { label: 'Reschedule', action: () => { /* handled by parent */ }, testId: 'reschedule' },
      )
      break
    case 'sent':
      items.push(
        { label: 'Analytics', action: () => { window.location.href = analyticsHref }, testId: 'analytics' },
        { label: 'Archive', action: () => { /* handled by parent */ }, testId: 'archive' },
        { label: 'Duplicate', action: () => { /* handled by parent */ }, testId: 'duplicate' },
      )
      break
    case 'failed': {
      const remaining = (edition.max_retries ?? 3) - (edition.retry_count ?? 0)
      items.push(
        {
          label: `Retry${remaining > 0 ? ` (${remaining} remaining)` : ''}`,
          action: () => onRetry(edition.id),
          disabled: isRetrying || remaining <= 0,
          testId: 'retry',
        },
        { label: 'Edit', action: () => { window.location.href = editHref }, testId: 'edit' },
        { label: 'Delete', action: () => { /* handled by parent */ }, destructive: true, testId: 'delete' },
      )
      break
    }
    case 'sending':
      // No actions during active send
      break
    case 'queued':
      items.push(
        { label: 'Edit', action: () => { window.location.href = editHref }, testId: 'edit' },
        { label: 'Unslot', action: () => { /* handled by parent */ }, testId: 'unslot' },
      )
      break
    case 'idea':
      items.push(
        { label: 'Convert to Draft', action: () => { window.location.href = `${editHref}?convert=1` }, testId: 'convert' },
        { label: 'Edit', action: () => { window.location.href = editHref }, testId: 'edit' },
        { label: 'Delete', action: () => { /* handled by parent */ }, destructive: true, testId: 'delete' },
      )
      break
    case 'cancelled':
      items.push(
        { label: 'Revert to Draft', action: () => { /* handled by parent */ }, testId: 'revert' },
        { label: 'Delete', action: () => { /* handled by parent */ }, destructive: true, testId: 'delete' },
      )
      break
  }
  return items
}

/* ─────────── Sort Header ─────────── */

function SortHeader({
  label,
  sortKey,
  currentSort,
  currentDir,
  onSort,
}: {
  label: string
  sortKey: SortKey
  currentSort: SortKey
  currentDir: SortDir
  onSort: (key: SortKey) => void
}) {
  const isActive = currentSort === sortKey
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className="group inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-cms-text-muted hover:text-cms-text"
      data-testid={`sort-${sortKey}`}
    >
      {label}
      <span className={isActive ? 'text-cms-accent' : 'opacity-0 group-hover:opacity-50'}>
        {isActive && currentDir === 'asc' ? '↑' : '↓'}
      </span>
    </button>
  )
}

/* ─────────── Row Variants ─────────── */

function StatusBadge({ status }: { status: EditionRow['status'] }) {
  const styles: Record<string, string> = {
    idea: 'bg-[var(--cms-purple,#a855f7)]/20 text-[var(--cms-purple,#a855f7)]',
    draft: 'bg-[var(--cms-text-dim,#64748b)]/20 text-[var(--cms-text-dim,#64748b)]',
    ready: 'bg-cms-accent/20 text-cms-accent',
    queued: 'bg-cms-accent/20 text-cms-accent',
    scheduled: 'bg-[var(--cms-amber,#f59e0b)]/20 text-[var(--cms-amber,#f59e0b)]',
    sending: 'bg-[var(--cms-green,#22c55e)]/20 text-[var(--cms-green,#22c55e)]',
    sent: 'bg-[var(--cms-green,#22c55e)]/20 text-[var(--cms-green,#22c55e)]',
    failed: 'bg-[var(--cms-red,#ef4444)]/20 text-[var(--cms-red,#ef4444)]',
    cancelled: 'bg-[var(--cms-text-dim,#64748b)]/20 text-[var(--cms-text-dim,#64748b)]',
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${styles[status] ?? ''}`}
      data-testid={`status-badge-${status}`}
    >
      {status === 'sending' && (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--cms-green,#22c55e)] opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--cms-green,#22c55e)]" />
        </span>
      )}
      {status}
    </span>
  )
}

function EditionRowComponent({
  row,
  onRetry,
  isRetrying,
}: {
  row: EditionRow
  onRetry: (id: string) => void
  isRetrying: boolean
}) {
  const progress = getSendProgress(row)
  const isFailed = row.status === 'failed'
  const isBest = row.is_best_performer && row.status === 'sent'
  const hasSourcePost = !!row.source_post_id

  return (
    <tr
      className={`border-b border-cms-border transition-colors hover:bg-cms-surface-hover ${
        isFailed ? 'bg-[var(--cms-red,#ef4444)]/5' : ''
      }`}
      data-testid={`edition-row-${row.id}`}
    >
      {/* Edition + Type dot */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: row.newsletter_type_color ?? '#6366f1' }}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Link
                href={`/cms/newsletters/${row.id}/edit`}
                className="truncate text-sm font-medium text-cms-text hover:text-cms-accent"
              >
                {row.subject}
              </Link>
              {isBest && (
                <span className="shrink-0 text-[var(--cms-amber,#f59e0b)]" title="Best performer" data-testid="best-performer-badge">
                  &#9733;
                </span>
              )}
              {hasSourcePost && (
                <span className="shrink-0 text-cms-text-dim" title="From blog post" data-testid="source-post-indicator">
                  &#128279;
                </span>
              )}
            </div>
            {isFailed && row.error_message && (
              <p className="mt-0.5 text-[11px] text-[var(--cms-red,#ef4444)]" data-testid="error-message">
                {row.error_message}
              </p>
            )}
            {progress && (
              <div className="mt-1 flex items-center gap-2" data-testid="sending-progress">
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-cms-border">
                  <div
                    className="h-full rounded-full bg-[var(--cms-green,#22c55e)] transition-all"
                    style={{ width: `${Math.min(progress.pct, 100)}%` }}
                  />
                </div>
                <span className="text-[11px] text-cms-text-dim">
                  {progress.sent}/{progress.total} ({progress.pct.toFixed(0)}%)
                </span>
              </div>
            )}
          </div>
        </div>
      </td>

      {/* Type */}
      <td className="hidden px-4 py-3 text-sm text-cms-text-muted lg:table-cell">
        {row.newsletter_type_name ?? '--'}
      </td>

      {/* Delivered */}
      <td className="hidden px-4 py-3 text-right text-sm text-cms-text sm:table-cell">
        {row.stats_delivered?.toLocaleString() ?? '--'}
      </td>

      {/* Opens % */}
      <td className="hidden px-4 py-3 text-right text-sm sm:table-cell">
        <span className={isBest ? 'font-semibold text-[var(--cms-green,#22c55e)]' : 'text-cms-text'}>
          {row.status === 'sent' ? formatPct(getOpenRate(row)) : '--'}
        </span>
      </td>

      {/* Clicks % */}
      <td className="hidden px-4 py-3 text-right text-sm text-cms-text md:table-cell">
        {row.status === 'sent' ? formatPct(getClickRate(row)) : '--'}
      </td>

      {/* Date */}
      <td className="px-4 py-3 text-right text-xs text-cms-text-dim">
        <StatusBadge status={row.status} />
        <div className="mt-0.5">
          {row.status === 'scheduled' && row.scheduled_at
            ? formatDate(row.scheduled_at)
            : row.status === 'sent' && row.sent_at
              ? formatDate(row.sent_at)
              : formatDate(row.updated_at ?? row.created_at)}
        </div>
      </td>

      {/* Actions */}
      <td className="px-2 py-3 text-right">
        <ContextMenu edition={row} onRetry={onRetry} isRetrying={isRetrying} />
      </td>
    </tr>
  )
}

/* ─────────── Search Input ─────────── */

function SearchInput({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <input
      ref={inputRef}
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Search editions..."
      aria-label="Search editions"
      className="h-9 w-64 rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface px-3 text-sm text-cms-text placeholder-cms-text-dim outline-none focus:border-cms-accent"
      data-testid="edition-search"
    />
  )
}

/* ─────────── Pagination ─────────── */

const PAGE_SIZE = 20

function Pagination({
  total,
  page,
  onPageChange,
}: {
  total: number
  page: number
  onPageChange: (p: number) => void
}) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  if (totalPages <= 1) return null

  return (
    <div
      className="flex items-center justify-between border-t border-cms-border px-4 py-3"
      data-testid="pagination"
    >
      <span className="text-xs text-cms-text-dim">
        Page {page} of {totalPages} ({total} editions)
      </span>
      <div className="flex gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="rounded px-2 py-1 text-sm text-cms-text-muted hover:bg-cms-surface-hover disabled:opacity-40"
          data-testid="page-prev"
        >
          Prev
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="rounded px-2 py-1 text-sm text-cms-text-muted hover:bg-cms-surface-hover disabled:opacity-40"
          data-testid="page-next"
        >
          Next
        </button>
      </div>
    </div>
  )
}

/* ─────────── Empty State ─────────── */

function EditionsEmpty({ hasFilters, search, filterName }: { hasFilters: boolean; search: string; filterName: string }) {
  if (hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center" data-testid="empty-filtered">
        <p className="text-sm text-cms-text-muted">
          No editions matching {search ? `"${search}"` : ''}{filterName ? ` in ${filterName}` : ''}
        </p>
        <Link
          href="/cms/newsletters"
          className="mt-3 text-sm text-cms-accent hover:underline"
        >
          Clear filters
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center" data-testid="empty-zero">
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="mb-4 text-cms-text-dim"
        aria-hidden="true"
      >
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="M22 7L12 13L2 7" />
      </svg>
      <p className="text-base font-semibold text-cms-text">No editions yet</p>
      <p className="mt-1 text-sm text-cms-text-muted">
        Create your first newsletter edition.
      </p>
      <Link
        href="/cms/newsletters/new"
        className="mt-6 inline-flex items-center gap-2 rounded-[var(--cms-radius)] bg-cms-accent px-4 py-2 text-sm font-medium text-white hover:bg-cms-accent-hover"
      >
        + New Edition
      </Link>
    </div>
  )
}

/* ─────────── Main Component ─────────── */

export function NewslettersConnected({
  types,
  editions: initialEditions,
  kpis,
  lastEdition,
  totalEditions,
}: NewslettersConnectedProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [retryingId, setRetryingId] = useState<string | null>(null)

  // URL-driven state
  const selectedTypeId = searchParams.get('type')
  const currentStatus = searchParams.get('status') ?? 'all'
  const searchQuery = searchParams.get('q') ?? ''
  const currentPage = parseInt(searchParams.get('page') ?? '1', 10)
  const sortParam = searchParams.get('sort') ?? 'date'
  const dirParam = (searchParams.get('dir') ?? 'desc') as SortDir
  const sortKey = sortParam as SortKey
  const sortDir = dirParam

  // Client-side search filter
  const [localSearch, setLocalSearch] = useState(searchQuery)

  // Debounced search push
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const handleSearchChange = useCallback(
    (value: string) => {
      setLocalSearch(value)
      clearTimeout(searchTimerRef.current)
      searchTimerRef.current = setTimeout(() => {
        const sp = new URLSearchParams(searchParams.toString())
        if (value) sp.set('q', value)
        else sp.delete('q')
        sp.delete('page')
        router.push(`/cms/newsletters?${sp.toString()}`)
      }, 300)
    },
    [searchParams, router],
  )

  // Sort handler
  const handleSort = useCallback(
    (key: SortKey) => {
      const sp = new URLSearchParams(searchParams.toString())
      if (key === sortKey) {
        sp.set('dir', sortDir === 'asc' ? 'desc' : 'asc')
      } else {
        sp.set('sort', key)
        sp.set('dir', 'desc')
      }
      sp.delete('page')
      router.push(`/cms/newsletters?${sp.toString()}`)
    },
    [searchParams, sortKey, sortDir, router],
  )

  // Page handler
  const handlePageChange = useCallback(
    (page: number) => {
      const sp = new URLSearchParams(searchParams.toString())
      if (page > 1) sp.set('page', String(page))
      else sp.delete('page')
      router.push(`/cms/newsletters?${sp.toString()}`)
    },
    [searchParams, router],
  )

  // Status filter handler
  const handleStatusFilter = useCallback(
    (status: string) => {
      const sp = new URLSearchParams(searchParams.toString())
      if (status && status !== 'all') sp.set('status', status)
      else sp.delete('status')
      sp.delete('page')
      router.push(`/cms/newsletters?${sp.toString()}`)
    },
    [searchParams, router],
  )

  // Retry handler
  const handleRetry = useCallback(
    (editionId: string) => {
      setRetryingId(editionId)
      startTransition(async () => {
        try {
          await retryEdition(editionId)
          router.refresh()
        } finally {
          setRetryingId(null)
        }
      })
    },
    [router],
  )

  // Client-side sort
  const sorted = [...initialEditions].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1
    switch (sortKey) {
      case 'subject':
        return dir * a.subject.localeCompare(b.subject)
      case 'type':
        return dir * (a.newsletter_type_name ?? '').localeCompare(b.newsletter_type_name ?? '')
      case 'delivered':
        return dir * ((a.stats_delivered ?? 0) - (b.stats_delivered ?? 0))
      case 'opens':
        return dir * (getOpenRate(a) - getOpenRate(b))
      case 'clicks':
        return dir * (getClickRate(a) - getClickRate(b))
      case 'date': {
        const aDate = a.sent_at ?? a.scheduled_at ?? a.updated_at ?? a.created_at ?? ''
        const bDate = b.sent_at ?? b.scheduled_at ?? b.updated_at ?? b.created_at ?? ''
        return dir * aDate.localeCompare(bDate)
      }
      default:
        return 0
    }
  })

  // Client-side search filter
  const filtered = localSearch
    ? sorted.filter((e) => e.subject.toLowerCase().includes(localSearch.toLowerCase()))
    : sorted

  // Paginate
  const paginatedEditions = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  )

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return
      if (e.key === '/' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        const searchInput = document.querySelector('[data-testid="edition-search"]') as HTMLInputElement | null
        searchInput?.focus()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  const hasFilters = !!searchQuery || currentStatus !== 'all' || !!selectedTypeId
  const currentTypeName = selectedTypeId
    ? types.find((t) => t.id === selectedTypeId)?.name ?? ''
    : ''
  const filterLabel = [
    currentStatus !== 'all' ? currentStatus : '',
    currentTypeName,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <div className="space-y-6" data-testid="newsletters-connected">
      {/* Last Newsletter Banner */}
      {lastEdition && <LastNewsletterBanner edition={lastEdition} />}

      {/* KPI Strip */}
      <KpiStrip kpis={kpis} />

      {/* Type Cards */}
      <TypeCards
        types={types}
        selectedTypeId={selectedTypeId}
        currentStatus={currentStatus !== 'all' ? currentStatus : undefined}
      />

      {/* Status Filters */}
      <div className="flex items-center gap-1 text-xs" data-testid="status-filters">
        {STATUS_OPTIONS.map((s) => {
          const isActive = currentStatus === s
          return (
            <button
              key={s}
              type="button"
              onClick={() => handleStatusFilter(s)}
              className={`rounded-full px-3 py-1.5 font-medium capitalize transition-colors ${
                isActive
                  ? 'bg-cms-accent text-white'
                  : 'text-cms-text-muted hover:bg-cms-surface-hover hover:text-cms-text'
              }`}
              data-testid={`filter-${s}`}
            >
              {s}
            </button>
          )
        })}
      </div>

      {/* Search + New Edition */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchInput value={localSearch} onChange={handleSearchChange} />
        <Link
          href="/cms/newsletters/new"
          className="inline-flex items-center gap-2 rounded-[var(--cms-radius)] bg-cms-accent px-4 py-2 text-sm font-medium text-white hover:bg-cms-accent-hover"
          data-testid="new-edition-btn"
        >
          + New Edition
        </Link>
      </div>

      {/* Editions Table */}
      {filtered.length === 0 ? (
        <EditionsEmpty hasFilters={hasFilters} search={localSearch} filterName={filterLabel} />
      ) : (
        <div className="overflow-hidden rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface">
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="editions-table">
              <thead>
                <tr className="border-b border-cms-border text-left">
                  <th className="px-4 py-3">
                    <SortHeader label="Edition" sortKey="subject" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="hidden px-4 py-3 lg:table-cell">
                    <SortHeader label="Type" sortKey="type" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="hidden px-4 py-3 text-right sm:table-cell">
                    <SortHeader label="Delivered" sortKey="delivered" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="hidden px-4 py-3 text-right sm:table-cell">
                    <SortHeader label="Opens %" sortKey="opens" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="hidden px-4 py-3 text-right md:table-cell">
                    <SortHeader label="Clicks %" sortKey="clicks" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="px-4 py-3 text-right">
                    <SortHeader label="Date" sortKey="date" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="w-10 px-2 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedEditions.map((edition) => (
                  <EditionRowComponent
                    key={edition.id}
                    row={edition}
                    onRetry={handleRetry}
                    isRetrying={retryingId === edition.id}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            total={filtered.length}
            page={currentPage}
            onPageChange={handlePageChange}
          />
        </div>
      )}

      {isPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
          <div className="rounded-[var(--cms-radius)] bg-cms-surface px-4 py-3 text-sm text-cms-text shadow-lg">
            Processing...
          </div>
        </div>
      )}
    </div>
  )
}
