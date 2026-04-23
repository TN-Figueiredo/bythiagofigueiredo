'use client'

import { useState } from 'react'
import Link from 'next/link'

export interface EditionRow {
  id: string
  subject: string
  preheader?: string | null
  status: string
  typeName: string
  typeColor: string
  newsletter_type_id: string
  sendCount: number
  statsDelivered: number
  statsOpens: number
  statsClicks: number
  sentAt: string | null
  scheduledAt: string | null
  createdAt: string
}

interface EditionsTableProps {
  editions: EditionRow[]
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; dot?: string }> = {
    draft: {
      label: 'Draft',
      cls: 'bg-cms-amber-subtle text-[var(--cms-amber)] border-[rgba(245,158,11,.3)]',
    },
    ready: {
      label: 'Ready',
      cls: 'bg-cms-cyan-subtle text-[var(--cms-cyan)] border-[rgba(6,182,212,.3)]',
    },
    scheduled: {
      label: 'Scheduled',
      cls: 'bg-cms-cyan-subtle text-[var(--cms-cyan)] border-[rgba(6,182,212,.3)]',
    },
    sending: {
      label: 'Sending',
      cls: 'bg-cms-purple-subtle text-[var(--cms-purple)] border-[rgba(139,92,246,.3)]',
      dot: 'animate-pulse',
    },
    sent: {
      label: 'Sent',
      cls: 'bg-cms-green-subtle text-[var(--cms-green)] border-[rgba(34,197,94,.3)]',
    },
    failed: {
      label: 'Failed',
      cls: 'bg-cms-red-subtle text-[var(--cms-red)] border-[rgba(239,68,68,.3)]',
    },
  }
  const badge = map[status] ?? {
    label: status,
    cls: 'bg-[rgba(113,113,122,.12)] text-cms-text-muted border-[rgba(113,113,122,.3)]',
  }
  return (
    <span
      data-status={status}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${badge.cls}`}
    >
      {badge.dot && (
        <span className={`inline-block h-1.5 w-1.5 rounded-full bg-current ${badge.dot}`} />
      )}
      {badge.label}
    </span>
  )
}

function TypeDot({ color, name }: { color: string; name: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      <span className="text-xs text-cms-text-muted truncate">{name}</span>
    </div>
  )
}

function OpenRate({ opens, delivered }: { opens: number; delivered: number }) {
  if (delivered === 0) return <span className="text-xs text-cms-text-dim">—</span>
  const rate = Math.round((opens / delivered) * 100)
  return <span className="text-xs font-medium text-[var(--cms-green)]">{rate}%</span>
}

const PAGE_SIZE = 20

function Pagination({
  total,
  page,
  onPage,
}: {
  total: number
  page: number
  onPage: (p: number) => void
}) {
  const pages = Math.ceil(total / PAGE_SIZE)
  if (pages <= 1) return null
  return (
    <nav
      className="flex items-center justify-between border-t border-cms-border px-4 py-3 text-sm text-cms-text-muted"
      aria-label="Pagination"
    >
      <span>
        {Math.min((page - 1) * PAGE_SIZE + 1, total)}–{Math.min(page * PAGE_SIZE, total)} of{' '}
        {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page === 1}
          className="rounded px-2 py-1 text-xs hover:bg-cms-surface-hover disabled:opacity-30"
          aria-label="Previous page"
        >
          ‹ Prev
        </button>
        {Array.from({ length: pages }, (_, i) => i + 1)
          .filter((p) => p === 1 || p === pages || Math.abs(p - page) <= 1)
          .reduce<(number | '…')[]>((acc, p, i, arr) => {
            if (i > 0 && typeof arr[i - 1] === 'number' && (p as number) - (arr[i - 1] as number) > 1) {
              acc.push('…')
            }
            acc.push(p)
            return acc
          }, [])
          .map((p, i) =>
            p === '…' ? (
              <span key={`ellipsis-${i}`} className="px-1">…</span>
            ) : (
              <button
                key={p}
                onClick={() => onPage(p as number)}
                aria-current={p === page ? 'page' : undefined}
                className={`min-w-[28px] rounded px-2 py-1 text-xs ${
                  p === page ? 'bg-cms-accent text-white' : 'hover:bg-cms-surface-hover'
                }`}
              >
                {p}
              </button>
            ),
          )}
        <button
          onClick={() => onPage(page + 1)}
          disabled={page === pages}
          className="rounded px-2 py-1 text-xs hover:bg-cms-surface-hover disabled:opacity-30"
          aria-label="Next page"
        >
          Next ›
        </button>
      </div>
    </nav>
  )
}

function DesktopRow({ edition }: { edition: EditionRow }) {
  const isSending = edition.status === 'sending'
  const isFailed = edition.status === 'failed'

  return (
    <tr
      className={`border-b border-cms-border transition-colors hover:bg-cms-surface-hover
        ${isSending ? 'bg-cms-purple-subtle' : ''}
        ${isFailed ? 'bg-cms-red-subtle' : ''}`}
    >
      <td className="px-4 py-3">
        <div className="min-w-0">
          <Link
            href={`/cms/newsletters/${edition.id}/edit`}
            className="block truncate text-sm font-medium text-cms-text hover:text-cms-accent"
          >
            {edition.subject || 'Untitled'}
          </Link>
          {edition.preheader && (
            <p className="mt-0.5 truncate text-[11px] text-cms-text-dim">{edition.preheader}</p>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <TypeDot color={edition.typeColor} name={edition.typeName} />
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={edition.status} />
      </td>
      <td className="px-4 py-3 text-xs text-cms-text tabular-nums">
        {edition.sendCount > 0 ? edition.sendCount.toLocaleString() : '—'}
      </td>
      <td className="px-4 py-3">
        <OpenRate opens={edition.statsOpens} delivered={edition.statsDelivered} />
      </td>
      <td className="px-4 py-3 text-xs text-cms-text-muted">
        {edition.sentAt
          ? new Date(edition.sentAt).toLocaleDateString('en', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : edition.scheduledAt
            ? `Sched. ${new Date(edition.scheduledAt).toLocaleDateString('en', { month: 'short', day: 'numeric' })}`
            : new Date(edition.createdAt).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Link
            href={`/cms/newsletters/${edition.id}/edit`}
            className="rounded px-2 py-1 text-xs text-cms-text-muted hover:bg-cms-surface-hover hover:text-cms-text"
          >
            Edit
          </Link>
          {edition.status === 'sent' && (
            <Link
              href={`/cms/newsletters/${edition.id}/analytics`}
              className="rounded px-2 py-1 text-xs text-cms-text-muted hover:bg-cms-surface-hover hover:text-cms-text"
            >
              Analytics
            </Link>
          )}
        </div>
      </td>
    </tr>
  )
}

function MobileCard({ edition }: { edition: EditionRow }) {
  const isSending = edition.status === 'sending'
  const isFailed = edition.status === 'failed'

  return (
    <div
      className={`rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface p-4
        ${isSending ? 'border-[var(--cms-purple)] bg-cms-purple-subtle' : ''}
        ${isFailed ? 'border-[var(--cms-red)] bg-cms-red-subtle' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <Link
            href={`/cms/newsletters/${edition.id}/edit`}
            className="block truncate text-sm font-medium text-cms-text hover:text-cms-accent"
          >
            {edition.subject || 'Untitled'}
          </Link>
          {edition.preheader && (
            <p className="mt-0.5 truncate text-[11px] text-cms-text-dim">{edition.preheader}</p>
          )}
        </div>
        <StatusBadge status={edition.status} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <TypeDot color={edition.typeColor} name={edition.typeName} />
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-cms-text-muted">
        <div className="flex items-center gap-3">
          {edition.sendCount > 0 && (
            <span>
              <span className="font-medium text-cms-text">{edition.sendCount.toLocaleString()}</span>{' '}
              sent
            </span>
          )}
          {edition.statsDelivered > 0 && (
            <span>
              <OpenRate opens={edition.statsOpens} delivered={edition.statsDelivered} /> opens
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Link
            href={`/cms/newsletters/${edition.id}/edit`}
            className="rounded px-2 py-1 text-xs hover:bg-cms-surface-hover"
          >
            Edit
          </Link>
          {edition.status === 'sent' && (
            <Link
              href={`/cms/newsletters/${edition.id}/analytics`}
              className="rounded px-2 py-1 text-xs hover:bg-cms-surface-hover"
            >
              Analytics
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

export function EditionsTable({ editions }: EditionsTableProps) {
  const [page, setPage] = useState(1)

  const paginated = editions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  if (editions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="editions-empty">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-cms-text-dim mb-3" aria-hidden="true">
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="M22 7l-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        </svg>
        <p className="text-sm font-medium text-cms-text">No editions yet</p>
        <p className="mt-1 text-xs text-cms-text-dim">Create your first newsletter edition</p>
      </div>
    )
  }

  return (
    <div
      className="overflow-hidden rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface"
      data-testid="editions-table"
    >
      <div className="hidden md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-cms-border text-left">
              {['Subject', 'Type', 'Status', 'Sent', 'Opens', 'Date', 'Actions'].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-[11px] font-medium uppercase tracking-[1.5px] text-cms-text-muted"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.map((e) => (
              <DesktopRow key={e.id} edition={e} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-3 p-3 md:hidden">
        {paginated.map((e) => (
          <MobileCard key={e.id} edition={e} />
        ))}
      </div>
      <Pagination total={editions.length} page={page} onPage={setPage} />
    </div>
  )
}
