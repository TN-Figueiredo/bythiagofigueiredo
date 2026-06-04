'use client'

import { useCallback, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { StatusBadge } from '@tn-figueiredo/cms-ui/client'
import type { StatusVariant } from '@tn-figueiredo/cms-ui/client'

// ── Types ────────────────────────────────────────────────────────────

export interface PostRow {
  id: string
  title: string
  slug: string
  status: string
  locales: string[]
  authorName: string
  authorId: string
  authorInitials: string
  updatedAt: string
  readingTime: number
  coverImageUrl: string | null
  viewCount: number
}

export interface Author {
  id: string
  display_name: string
}

export interface PostsListConnectedProps {
  posts: PostRow[]
  total: number
  page: number
  pageSize: number
  counts: Record<string, number>
  authors: Author[]
  onBulkPublish: (ids: string[]) => Promise<{ ok: boolean; count?: number; error?: string }>
  onBulkArchive: (ids: string[]) => Promise<{ ok: boolean; count?: number; error?: string }>
  onBulkDelete: (ids: string[]) => Promise<{ ok: boolean; count?: number; error?: string }>
  onBulkChangeAuthor: (ids: string[], authorId: string) => Promise<{ ok: boolean; count?: number; error?: string }>
}

// ── Constants ────────────────────────────────────────────────────────

const STATUS_PILLS = [
  { value: '', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'published', label: 'Published' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'archived', label: 'Archived' },
] as const

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'recently_published', label: 'Recently Published' },
  { value: 'most_viewed', label: 'Most Viewed' },
] as const

// ── Component ────────────────────────────────────────────────────────

export function PostsListConnected({
  posts,
  total,
  page,
  pageSize,
  counts,
  authors,
  onBulkPublish,
  onBulkArchive,
  onBulkDelete,
  onBulkChangeAuthor,
}: PostsListConnectedProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  // Selection state
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkAuthorId, setBulkAuthorId] = useState('')

  // Search debounce
  const [searchValue, setSearchValue] = useState(searchParams.get('q') ?? '')
  const debounceRef = useRef<NodeJS.Timeout>(null)

  // Derived
  const currentStatus = searchParams.get('status') ?? ''
  const currentSort = searchParams.get('sort') ?? 'newest'
  const totalAll = Object.values(counts).reduce((a, b) => a + b, 0)

  // ── URL helpers ──────────────────────────────────────────────────

  const pushParam = useCallback(
    (key: string, value: string) => {
      const sp = new URLSearchParams(searchParams.toString())
      if (value) sp.set(key, value)
      else sp.delete(key)
      sp.delete('page')
      startTransition(() => router.push(`/cms/blog?${sp.toString()}`))
    },
    [searchParams, router, startTransition],
  )

  const goToPage = useCallback(
    (p: number) => {
      const sp = new URLSearchParams(searchParams.toString())
      sp.set('page', String(p))
      startTransition(() => router.push(`/cms/blog?${sp.toString()}`))
    },
    [searchParams, router, startTransition],
  )

  // ── Selection ────────────────────────────────────────────────────

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      if (prev.size === posts.length) return new Set()
      return new Set(posts.map((p) => p.id))
    })
  }, [posts])

  const clearSelection = useCallback(() => setSelected(new Set()), [])

  // ── Bulk actions ─────────────────────────────────────────────────

  const handleBulkAction = useCallback(
    async (action: (ids: string[]) => Promise<{ ok: boolean }>) => {
      const ids = Array.from(selected)
      startTransition(async () => {
        await action(ids)
        setSelected(new Set())
      })
    },
    [selected, startTransition],
  )

  const handleBulkChangeAuthor = useCallback(() => {
    if (!bulkAuthorId) return
    const ids = Array.from(selected)
    startTransition(async () => {
      await onBulkChangeAuthor(ids, bulkAuthorId)
      setSelected(new Set())
      setBulkAuthorId('')
    })
  }, [selected, bulkAuthorId, onBulkChangeAuthor, startTransition])

  // ── Search ───────────────────────────────────────────────────────

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value
      setSearchValue(val)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => pushParam('q', val), 300)
    },
    [pushParam],
  )

  // ── Empty states ─────────────────────────────────────────────────

  const hasFilters = !!(searchParams.get('status') || searchParams.get('q') || searchParams.get('sort'))

  if (posts.length === 0 && !hasFilters) {
    return (
      <div data-testid="posts-empty-state" className="flex flex-col items-center justify-center rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface px-6 py-16 text-center">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-4 text-cms-text-dim" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
        <p className="text-base font-semibold text-cms-text">No posts yet</p>
        <p className="mt-1 text-sm text-cms-text-muted">Write your first blog post.</p>
        <Link
          href="/cms/blog/new"
          className="mt-6 inline-flex items-center gap-2 rounded-[var(--cms-radius)] bg-cms-accent px-4 py-2 text-sm font-medium text-white hover:bg-cms-accent-hover"
        >
          Create first post
        </Link>
      </div>
    )
  }

  if (posts.length === 0 && hasFilters) {
    return (
      <div>
        {/* Filter bar still shown for clearing */}
        <FilterBar
          currentStatus={currentStatus}
          currentSort={currentSort}
          searchValue={searchValue}
          counts={counts}
          totalAll={totalAll}
          authors={authors}
          onStatusChange={(v) => pushParam('status', v)}
          onSortChange={(v) => pushParam('sort', v)}
          onSearchChange={handleSearchChange}
        />
        <div data-testid="posts-filtered-empty" className="flex flex-col items-center justify-center rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface px-6 py-16 text-center mt-4">
          <p className="text-base font-semibold text-cms-text">No posts match your filters</p>
          {searchParams.get('q') && (
            <p className="mt-1 text-sm text-cms-text-muted">
              No results for &quot;{searchParams.get('q')}&quot;
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              startTransition(() => router.push('/cms/blog'))
            }}
            className="mt-4 text-sm text-cms-accent hover:underline"
          >
            Clear filters
          </button>
        </div>
      </div>
    )
  }

  // ── Main list render ─────────────────────────────────────────────

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div data-testid="posts-list" className="space-y-4">
      {/* Filter bar */}
      <FilterBar
        currentStatus={currentStatus}
        currentSort={currentSort}
        searchValue={searchValue}
        counts={counts}
        totalAll={totalAll}
        authors={authors}
        onStatusChange={(v) => pushParam('status', v)}
        onSortChange={(v) => pushParam('sort', v)}
        onSearchChange={handleSearchChange}
      />

      {/* Table */}
      <div className="bg-cms-surface border border-cms-border rounded-[var(--cms-radius)] overflow-hidden">
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm" data-testid="posts-table">
            <thead>
              <tr className="border-b border-cms-border text-left">
                <th className="py-3 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={selected.size === posts.length && posts.length > 0}
                    onChange={toggleAll}
                    aria-label="Select all posts"
                    className="accent-cms-accent"
                    data-testid="select-all-checkbox"
                  />
                </th>
                <th className="py-3 px-4 text-xs font-medium text-cms-text-dim w-12">Cover</th>
                <th className="py-3 px-4 text-xs font-medium text-cms-text-dim">Title</th>
                <th className="py-3 px-4 text-xs font-medium text-cms-text-dim">Author</th>
                <th className="py-3 px-4 text-xs font-medium text-cms-text-dim">Status</th>
                <th className="py-3 px-4 text-xs font-medium text-cms-text-dim">Locale</th>
                <th className="py-3 px-4 text-xs font-medium text-cms-text-dim">Date</th>
                <th className="py-3 px-4 text-xs font-medium text-cms-text-dim w-16" />
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => {
                const isSelected = selected.has(post.id)
                const isPendingReview = post.status === 'pending_review'
                return (
                  <tr
                    key={post.id}
                    data-testid={`post-row-${post.id}`}
                    className={`border-b border-cms-border-subtle hover:bg-cms-surface-hover transition-colors group ${isPendingReview ? 'bg-amber-900/10' : ''}`}
                  >
                    <td className="py-3 px-4">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(post.id)}
                        aria-label={`Select ${post.title}`}
                        className="accent-cms-accent"
                      />
                    </td>
                    <td className="py-3 px-4">
                      {post.coverImageUrl ? (
                        <div className="w-10 h-7 rounded bg-cms-surface-hover overflow-hidden">
                          <img src={post.coverImageUrl} alt="" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-10 h-7 rounded bg-cms-surface-hover" />
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <Link href={`/cms/blog/${post.id}/edit`} className="block">
                        <div className={`text-[13px] font-medium truncate max-w-xs ${post.status === 'draft' ? 'text-cms-text-muted' : 'text-cms-text'} ${!post.title ? 'italic' : ''}`}>
                          {post.title || 'Sem titulo'}
                        </div>
                        <div className="text-[11px] text-cms-text-dim">
                          {post.readingTime} min read{post.status === 'published' && post.viewCount > 0 ? ` · ${post.viewCount} views` : ''}
                        </div>
                      </Link>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-cms-accent flex items-center justify-center text-[9px] text-white font-semibold">
                          {post.authorInitials}
                        </div>
                        <span className="text-xs text-cms-text-muted">{post.authorName}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge variant={post.status as StatusVariant} />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-1">
                        {post.locales.map((l) => (
                          <span key={l} className="text-[10px] px-1.5 py-0.5 rounded border border-cms-border text-cms-text-muted">
                            {l.replace('pt-BR', 'PT').replace('en', 'EN')}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-cms-text-dim">{post.updatedAt}</td>
                    <td className="py-3 px-4">
                      <Link
                        href={`/cms/blog/${post.id}/edit`}
                        className="text-xs text-cms-accent opacity-0 group-hover:opacity-100 transition-opacity"
                        data-testid={`edit-post-${post.id}`}
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-2 p-3">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/cms/blog/${post.id}/edit`}
              className="block p-3 bg-cms-surface border border-cms-border rounded-[var(--cms-radius)]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-[13px] font-medium text-cms-text line-clamp-2">
                  {post.title || 'Sem titulo'}
                </div>
                <StatusBadge variant={post.status as StatusVariant} />
              </div>
              <div className="text-[11px] text-cms-text-dim mt-1">
                {post.authorName} · {post.updatedAt}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div
          data-testid="bulk-actions-bar"
          className="flex items-center gap-3 p-3 bg-cms-surface border border-cms-border rounded-[var(--cms-radius)]"
        >
          <span className="text-sm text-cms-text font-medium">
            {selected.size} selected
          </span>
          <button
            type="button"
            onClick={() => handleBulkAction(onBulkPublish)}
            disabled={isPending}
            data-testid="bulk-publish-btn"
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-green-600/20 text-green-400 hover:bg-green-600/30 disabled:opacity-50"
          >
            Publish
          </button>
          <div className="flex items-center gap-1">
            <select
              value={bulkAuthorId}
              onChange={(e) => setBulkAuthorId(e.target.value)}
              aria-label="Select author for bulk change"
              data-testid="bulk-author-select"
              className="h-7 px-2 text-xs bg-cms-bg border border-cms-border rounded text-cms-text"
            >
              <option value="">Change Author...</option>
              {authors.map((a) => (
                <option key={a.id} value={a.id}>{a.display_name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleBulkChangeAuthor}
              disabled={isPending || !bulkAuthorId}
              data-testid="bulk-change-author-btn"
              className="px-2 py-1 text-xs font-medium rounded-md bg-cms-accent/20 text-cms-accent hover:bg-cms-accent/30 disabled:opacity-50"
            >
              Apply
            </button>
          </div>
          <button
            type="button"
            onClick={() => handleBulkAction(onBulkArchive)}
            disabled={isPending}
            data-testid="bulk-archive-btn"
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-amber-600/20 text-amber-400 hover:bg-amber-600/30 disabled:opacity-50"
          >
            Archive
          </button>
          <button
            type="button"
            onClick={() => handleBulkAction(onBulkDelete)}
            disabled={isPending}
            data-testid="bulk-delete-btn"
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-red-600/20 text-red-400 hover:bg-red-600/30 disabled:opacity-50"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={clearSelection}
            className="ml-auto text-xs text-cms-text-muted hover:text-cms-text"
          >
            Clear
          </button>
        </div>
      )}

      {/* Pagination */}
      {total > pageSize && (
        <div data-testid="posts-pagination" className="flex items-center justify-between text-xs text-cms-text-muted">
          <span>
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
          </span>
          <div className="flex gap-1">
            {page > 1 && (
              <button
                type="button"
                onClick={() => goToPage(page - 1)}
                data-testid="pagination-prev"
                className="px-2 py-1 border border-cms-border rounded hover:bg-cms-surface-hover"
              >
                Prev
              </button>
            )}
            {page < totalPages && (
              <button
                type="button"
                onClick={() => goToPage(page + 1)}
                data-testid="pagination-next"
                className="px-2 py-1 border border-cms-border rounded hover:bg-cms-surface-hover"
              >
                Next
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Filter bar sub-component ─────────────────────────────────────────

function FilterBar({
  currentStatus,
  currentSort,
  searchValue,
  counts,
  totalAll,
  authors: _authors,
  onStatusChange,
  onSortChange,
  onSearchChange,
}: {
  currentStatus: string
  currentSort: string
  searchValue: string
  counts: Record<string, number>
  totalAll: number
  authors: Author[]
  onStatusChange: (v: string) => void
  onSortChange: (v: string) => void
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <div className="space-y-3" data-testid="posts-filter-bar">
      {/* Status pills */}
      <div className="flex gap-1 flex-wrap" data-testid="status-pills">
        {STATUS_PILLS.map((pill) => {
          const isActive = currentStatus === pill.value
          const count = pill.value ? (counts[pill.value] ?? 0) : totalAll
          return (
            <button
              type="button"
              key={pill.value}
              onClick={() => onStatusChange(pill.value)}
              data-testid={`status-pill-${pill.value || 'all'}`}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors
                ${isActive ? 'bg-cms-accent-subtle text-cms-accent' : 'text-cms-text-muted hover:bg-cms-surface-hover'}`}
            >
              {pill.label} <span className="opacity-60 ml-1">{count}</span>
            </button>
          )
        })}
      </div>

      {/* Search + Sort row */}
      <div className="flex gap-3 items-center flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <input
            type="search"
            value={searchValue}
            onChange={onSearchChange}
            placeholder="Search posts..."
            aria-label="Search posts"
            data-testid="posts-search-input"
            className="w-full px-3 py-2 text-sm bg-cms-bg border border-cms-border rounded-[var(--cms-radius)] text-cms-text placeholder:text-cms-text-dim focus:border-cms-accent focus:outline-none"
          />
        </div>
        <select
          value={currentSort}
          onChange={(e) => onSortChange(e.target.value)}
          aria-label="Sort posts"
          data-testid="posts-sort-select"
          className="h-9 px-3 text-sm bg-cms-bg border border-cms-border rounded-[var(--cms-radius)] text-cms-text focus:border-cms-accent focus:outline-none"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
