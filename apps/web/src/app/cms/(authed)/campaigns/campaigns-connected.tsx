'use client'

import {
  useState,
  useCallback,
  useTransition,
  useMemo,
  useRef,
  useEffect,
} from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  bulkPublishCampaigns,
  bulkArchiveCampaigns,
  bulkDeleteCampaigns,
} from './bulk-actions'

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface CampaignRow {
  id: string
  status: string
  interest: string
  created_at: string
  owner_user_id: string | null
  author_name: string | null
  translations: {
    locale: string
    slug: string
    meta_title: string | null
  }[]
  submission_count: number
  conversion_rate: number
}

interface Props {
  campaigns: CampaignRow[]
  totalCount: number
  page: number
  pageSize: number
}

type SortField = 'title' | 'created' | 'submissions' | 'conversion'
type SortDir = 'asc' | 'desc'
type StatusFilter = '' | 'draft' | 'published' | 'archived'

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
]

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  draft: { bg: 'bg-slate-700', text: 'text-slate-300' },
  published: { bg: 'bg-emerald-900/50', text: 'text-emerald-400' },
  archived: { bg: 'bg-amber-900/50', text: 'text-amber-400' },
  scheduled: { bg: 'bg-blue-900/50', text: 'text-blue-400' },
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function getTitle(c: CampaignRow): string {
  return c.translations[0]?.meta_title ?? c.interest ?? 'Untitled'
}

function getLocales(c: CampaignRow): string[] {
  return c.translations.map((t) => t.locale)
}

function StatusBadge({ status }: { status: string }) {
  const badge = STATUS_BADGE[status] ?? { bg: 'bg-slate-700', text: 'text-slate-300' }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.bg} ${badge.text}`}
      data-testid="status-badge"
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

function SortIcon({
  field,
  current,
  dir,
}: {
  field: SortField
  current: SortField
  dir: SortDir
}) {
  if (field !== current) {
    return (
      <svg
        className="ml-1 inline h-3 w-3 text-cms-text-dim"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path d="M8 9l4-4 4 4M8 15l4 4 4-4" />
      </svg>
    )
  }
  return (
    <svg
      className="ml-1 inline h-3 w-3 text-cms-accent"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      {dir === 'asc' ? <path d="M8 15l4-4 4 4" /> : <path d="M8 9l4 4 4-4" />}
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/*  Context Menu                                                      */
/* ------------------------------------------------------------------ */

function ContextMenu({
  campaign,
  onClose,
  onPublish,
  onArchive,
  onDelete,
}: {
  campaign: CampaignRow
  onClose: () => void
  onPublish: (id: string) => void
  onArchive: (id: string) => void
  onDelete: (id: string) => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  const editUrl = `/cms/campaigns/${campaign.id}/edit`

  return (
    <div
      ref={menuRef}
      className="absolute right-0 top-full z-20 mt-1 w-40 rounded-md border border-cms-border bg-cms-surface shadow-lg"
      role="menu"
      data-testid="context-menu"
    >
      <Link
        href={editUrl}
        className="block w-full px-3 py-2 text-left text-sm text-cms-text hover:bg-cms-surface-hover"
        role="menuitem"
        onClick={onClose}
      >
        Edit
      </Link>
      {campaign.status === 'draft' && (
        <button
          type="button"
          className="block w-full px-3 py-2 text-left text-sm text-cms-text hover:bg-cms-surface-hover"
          role="menuitem"
          onClick={() => {
            onPublish(campaign.id)
            onClose()
          }}
        >
          Publish
        </button>
      )}
      {(campaign.status === 'draft' || campaign.status === 'published') && (
        <button
          type="button"
          className="block w-full px-3 py-2 text-left text-sm text-cms-text hover:bg-cms-surface-hover"
          role="menuitem"
          onClick={() => {
            onArchive(campaign.id)
            onClose()
          }}
        >
          Archive
        </button>
      )}
      {(campaign.status === 'draft' || campaign.status === 'archived') && (
        <button
          type="button"
          className="block w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-cms-surface-hover"
          role="menuitem"
          onClick={() => {
            onDelete(campaign.id)
            onClose()
          }}
        >
          Delete
        </button>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Confirm Dialog                                                    */
/* ------------------------------------------------------------------ */

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      role="dialog"
      aria-modal="true"
      data-testid="confirm-dialog"
    >
      <div className="mx-4 w-full max-w-sm rounded-lg border border-cms-border bg-cms-surface p-6 shadow-xl">
        <h3 className="text-base font-semibold text-cms-text">{title}</h3>
        <p className="mt-2 text-sm text-cms-text-muted">{message}</p>
        <div className="mt-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-cms-border px-3 py-1.5 text-sm text-cms-text-muted hover:bg-cms-surface-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500"
            data-testid="confirm-delete-btn"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Mobile Card                                                       */
/* ------------------------------------------------------------------ */

function MobileCard({
  campaign,
  selected,
  onToggle,
  onPublish,
  onArchive,
  onDelete,
}: {
  campaign: CampaignRow
  selected: boolean
  onToggle: (id: string) => void
  onPublish: (id: string) => void
  onArchive: (id: string) => void
  onDelete: (id: string) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const title = getTitle(campaign)
  const locales = getLocales(campaign)

  return (
    <div
      className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface p-4"
      data-testid="campaign-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggle(campaign.id)}
            className="mt-1 accent-cms-accent"
            aria-label={`Select ${title}`}
          />
          <div className="min-w-0">
            <Link
              href={`/cms/campaigns/${campaign.id}/edit`}
              className="block truncate text-sm font-medium text-cms-text hover:text-cms-accent"
            >
              {title}
            </Link>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <StatusBadge status={campaign.status} />
              {locales.map((l) => (
                <span
                  key={l}
                  className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-300"
                >
                  {l}
                </span>
              ))}
            </div>
            <div className="mt-2 flex gap-4 text-xs text-cms-text-dim">
              <span>{campaign.submission_count} subs</span>
              <span>{campaign.conversion_rate.toFixed(1)}% conv</span>
              <span>{new Date(campaign.created_at).toLocaleDateString()}</span>
            </div>
            {campaign.author_name && (
              <p className="mt-1 text-xs text-cms-text-dim">
                {campaign.author_name}
              </p>
            )}
          </div>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="rounded p-1 text-cms-text-dim hover:bg-cms-surface-hover hover:text-cms-text"
            aria-label="Campaign actions"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <circle cx="12" cy="5" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="12" cy="19" r="2" />
            </svg>
          </button>
          {menuOpen && (
            <ContextMenu
              campaign={campaign}
              onClose={() => setMenuOpen(false)}
              onPublish={onPublish}
              onArchive={onArchive}
              onDelete={onDelete}
            />
          )}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                    */
/* ------------------------------------------------------------------ */

export function CampaignsConnected({
  campaigns,
  totalCount,
  page,
  pageSize,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  // Selection state
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmAction, setConfirmAction] = useState<{
    type: 'delete'
    ids: string[]
  } | null>(null)

  // Context menu per row (desktop)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  // Sort state (client-side, within current page)
  const [sortField, setSortField] = useState<SortField>('created')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // Search input
  const [searchInput, setSearchInput] = useState(
    searchParams.get('search') ?? '',
  )

  const statusFilter = (searchParams.get('status') ?? '') as StatusFilter

  // Derived: sorted campaigns
  const sorted = useMemo(() => {
    const copy = [...campaigns]
    copy.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'title':
          cmp = getTitle(a).localeCompare(getTitle(b))
          break
        case 'created':
          cmp =
            new Date(a.created_at).getTime() -
            new Date(b.created_at).getTime()
          break
        case 'submissions':
          cmp = a.submission_count - b.submission_count
          break
        case 'conversion':
          cmp = a.conversion_rate - b.conversion_rate
          break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return copy
  }, [campaigns, sortField, sortDir])

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  // URL update helper
  const updateParams = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      // Reset page when filter changes
      if (key !== 'page') params.delete('page')
      router.push(`?${params.toString()}`)
    },
    [router, searchParams],
  )

  // Selection helpers
  const toggleOne = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      if (prev.size === campaigns.length) return new Set()
      return new Set(campaigns.map((c) => c.id))
    })
  }, [campaigns])

  // Column sort toggle
  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      } else {
        setSortField(field)
        setSortDir('desc')
      }
    },
    [sortField],
  )

  // Bulk action handlers
  const handleBulkPublish = useCallback(() => {
    const ids = Array.from(selected)
    startTransition(async () => {
      await bulkPublishCampaigns(ids)
      setSelected(new Set())
    })
  }, [selected])

  const handleBulkArchive = useCallback(() => {
    const ids = Array.from(selected)
    startTransition(async () => {
      await bulkArchiveCampaigns(ids)
      setSelected(new Set())
    })
  }, [selected])

  const handleBulkDeleteConfirm = useCallback(() => {
    if (!confirmAction) return
    startTransition(async () => {
      await bulkDeleteCampaigns(confirmAction.ids)
      setSelected(new Set())
      setConfirmAction(null)
    })
  }, [confirmAction])

  const handleBulkDelete = useCallback(() => {
    const ids = Array.from(selected)
    setConfirmAction({ type: 'delete', ids })
  }, [selected])

  // Single-row action helpers (via context menu)
  const handleSinglePublish = useCallback((id: string) => {
    startTransition(async () => {
      await bulkPublishCampaigns([id])
    })
  }, [])

  const handleSingleArchive = useCallback((id: string) => {
    startTransition(async () => {
      await bulkArchiveCampaigns([id])
    })
  }, [])

  const handleSingleDelete = useCallback((id: string) => {
    setConfirmAction({ type: 'delete', ids: [id] })
  }, [])

  // Search submit
  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      updateParams('search', searchInput)
    },
    [searchInput, updateParams],
  )

  return (
    <div className="flex flex-col gap-4" data-testid="campaigns-connected">
      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search campaigns..."
          aria-label="Search campaigns"
          className="h-9 flex-1 rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface px-3 text-sm text-cms-text placeholder-cms-text-dim outline-none focus:border-cms-accent sm:max-w-xs"
        />
        <button
          type="submit"
          className="h-9 rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface px-3 text-sm text-cms-text-muted hover:bg-cms-surface-hover"
        >
          Search
        </button>
      </form>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2" data-testid="filter-pills">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => updateParams('status', f.value)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              statusFilter === f.value
                ? 'bg-cms-accent text-white'
                : 'border border-cms-border text-cms-text-muted hover:bg-cms-surface-hover'
            }`}
            data-testid={`filter-${f.value || 'all'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Desktop table */}
      <div
        className="hidden overflow-hidden rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface md:block"
        data-testid="campaigns-table"
      >
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-cms-border text-xs uppercase tracking-wider text-cms-text-dim">
              <th className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={
                    campaigns.length > 0 && selected.size === campaigns.length
                  }
                  onChange={toggleAll}
                  className="accent-cms-accent"
                  aria-label="Select all campaigns"
                />
              </th>
              <th className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => handleSort('title')}
                  className="inline-flex items-center hover:text-cms-text"
                >
                  Title
                  <SortIcon field="title" current={sortField} dir={sortDir} />
                </button>
              </th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Locales</th>
              <th className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => handleSort('submissions')}
                  className="inline-flex items-center hover:text-cms-text"
                >
                  Submissions
                  <SortIcon
                    field="submissions"
                    current={sortField}
                    dir={sortDir}
                  />
                </button>
              </th>
              <th className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => handleSort('conversion')}
                  className="inline-flex items-center hover:text-cms-text"
                >
                  Conversion
                  <SortIcon
                    field="conversion"
                    current={sortField}
                    dir={sortDir}
                  />
                </button>
              </th>
              <th className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => handleSort('created')}
                  className="inline-flex items-center hover:text-cms-text"
                >
                  Created
                  <SortIcon
                    field="created"
                    current={sortField}
                    dir={sortDir}
                  />
                </button>
              </th>
              <th className="px-4 py-3">Author</th>
              <th className="px-4 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => {
              const title = getTitle(c)
              const locales = getLocales(c)
              return (
                <tr
                  key={c.id}
                  className="border-b border-cms-border last:border-0 hover:bg-cms-surface-hover"
                  data-testid="campaign-row"
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(c.id)}
                      onChange={() => toggleOne(c.id)}
                      className="accent-cms-accent"
                      aria-label={`Select ${title}`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/cms/campaigns/${c.id}/edit`}
                      className="font-medium text-cms-text hover:text-cms-accent"
                    >
                      {title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {locales.map((l) => (
                        <span
                          key={l}
                          className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-300"
                        >
                          {l}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-cms-text-muted">
                    {c.submission_count}
                  </td>
                  <td className="px-4 py-3 text-cms-text-muted">
                    {c.conversion_rate.toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-cms-text-muted">
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-cms-text-muted">
                    {c.author_name ?? '—'}
                  </td>
                  <td className="relative px-4 py-3">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenMenuId(openMenuId === c.id ? null : c.id)
                      }
                      className="rounded p-1 text-cms-text-dim hover:bg-cms-surface-hover hover:text-cms-text"
                      aria-label={`Actions for ${title}`}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <circle cx="12" cy="5" r="2" />
                        <circle cx="12" cy="12" r="2" />
                        <circle cx="12" cy="19" r="2" />
                      </svg>
                    </button>
                    {openMenuId === c.id && (
                      <ContextMenu
                        campaign={c}
                        onClose={() => setOpenMenuId(null)}
                        onPublish={handleSinglePublish}
                        onArchive={handleSingleArchive}
                        onDelete={handleSingleDelete}
                      />
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="flex flex-col gap-3 md:hidden" data-testid="campaign-cards-mobile">
        {sorted.map((c) => (
          <MobileCard
            key={c.id}
            campaign={c}
            selected={selected.has(c.id)}
            onToggle={toggleOne}
            onPublish={handleSinglePublish}
            onArchive={handleSingleArchive}
            onDelete={handleSingleDelete}
          />
        ))}
      </div>

      {/* Empty state */}
      {campaigns.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface px-6 py-16 text-center">
          <p className="text-base font-semibold text-cms-text">
            No campaigns found
          </p>
          <p className="mt-1 text-sm text-cms-text-muted">
            {statusFilter
              ? `No ${statusFilter} campaigns match your filters.`
              : 'Create your first lead-capture campaign.'}
          </p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          className="flex items-center justify-between"
          data-testid="pagination"
        >
          <p className="text-sm text-cms-text-dim">
            Page {page} of {totalPages} ({totalCount} campaigns)
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => updateParams('page', String(page - 1))}
              className="rounded-md border border-cms-border px-3 py-1.5 text-sm text-cms-text-muted hover:bg-cms-surface-hover disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => updateParams('page', String(page + 1))}
              className="rounded-md border border-cms-border px-3 py-1.5 text-sm text-cms-text-muted hover:bg-cms-surface-hover disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div
          className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-between border-t border-cms-border bg-cms-surface px-4 py-3 shadow-lg md:left-56"
          data-testid="bulk-actions-bar"
        >
          <span className="text-sm text-cms-text">
            {selected.size} selected
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleBulkPublish}
              disabled={isPending}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              Publish
            </button>
            <button
              type="button"
              onClick={handleBulkArchive}
              disabled={isPending}
              className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
            >
              Archive
            </button>
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={isPending}
              className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Confirm dialog */}
      {confirmAction && (
        <ConfirmDialog
          title="Delete campaigns"
          message={`Are you sure you want to delete ${confirmAction.ids.length} campaign(s)? This action cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={handleBulkDeleteConfirm}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  )
}
