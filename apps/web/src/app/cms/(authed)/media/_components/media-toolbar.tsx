'use client'

import { memo, useRef, useCallback } from 'react'
import type { MediaAssetType } from '@/lib/media/types'
import type { MediaSortOption, MediaViewMode, MediaColumnCount } from '../../_shared/media/types'
import type { MediaGalleryStrings } from '../../_shared/media/_i18n/types'

interface FilterCount {
  all: number
  cover: number
  inline: number
  avatar: number
  og: number
  orphan: number
}

interface MediaToolbarProps {
  filter: 'all' | MediaAssetType
  search: string
  sort: MediaSortOption
  view: MediaViewMode
  cols: MediaColumnCount
  resultCount: number
  totalCount: number
  checkedCount: number
  filterCounts: FilterCount
  onFilterChange: (filter: 'all' | MediaAssetType) => void
  onSearchChange: (search: string) => void
  onSortChange: (sort: MediaSortOption) => void
  onViewChange: (view: MediaViewMode) => void
  onColsChange: (cols: MediaColumnCount) => void
  onSelectAll: () => void
  onDeselectAll: () => void
  t: MediaGalleryStrings
}

const FILTER_OPTIONS: Array<{ key: 'all' | MediaAssetType; tKey: keyof MediaGalleryStrings['toolbar'] }> = [
  { key: 'all', tKey: 'filterAll' },
  { key: 'cover', tKey: 'filterCovers' },
  { key: 'inline', tKey: 'filterInline' },
  { key: 'avatar', tKey: 'filterAvatars' },
  { key: 'og', tKey: 'filterOg' },
  { key: 'orphan', tKey: 'filterUnused' },
]

const SORT_OPTIONS: Array<{ value: MediaSortOption; tKey: keyof MediaGalleryStrings['toolbar'] }> = [
  { value: 'newest', tKey: 'sortNewest' },
  { value: 'oldest', tKey: 'sortOldest' },
  { value: 'largest', tKey: 'sortLargest' },
  { value: 'smallest', tKey: 'sortSmallest' },
  { value: 'name', tKey: 'sortName' },
]

export const MediaToolbar = memo(function MediaToolbar({
  filter,
  search,
  sort,
  view,
  cols,
  resultCount,
  totalCount,
  checkedCount,
  filterCounts,
  onFilterChange,
  onSearchChange,
  onSortChange,
  onViewChange,
  onColsChange,
  onSelectAll,
  onDeselectAll,
  t,
}: MediaToolbarProps) {
  const searchRef = useRef<HTMLInputElement>(null)

  const handleSearchClear = useCallback(() => {
    onSearchChange('')
    searchRef.current?.focus()
  }, [onSearchChange])

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-cms-border bg-cms-surface px-3 py-2">
      {/* Select-all checkbox */}
      <button
        type="button"
        role="checkbox"
        aria-checked={checkedCount === 0 ? false : checkedCount === totalCount ? true : 'mixed'}
        onClick={checkedCount > 0 ? onDeselectAll : onSelectAll}
        className="flex h-5 w-5 items-center justify-center rounded border border-cms-border transition-colors hover:border-cms-accent"
        aria-label={checkedCount > 0 ? t.toolbar.deselectAll : t.toolbar.selectAll}
        data-testid="select-all-checkbox"
      >
        {checkedCount > 0 && checkedCount < totalCount && (
          <svg width="10" height="2" viewBox="0 0 10 2"><rect width="10" height="2" rx="1" fill="currentColor" className="text-cms-accent" /></svg>
        )}
        {checkedCount > 0 && checkedCount === totalCount && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-cms-accent" /></svg>
        )}
      </button>

      {/* Divider */}
      <div className="h-5 w-px bg-cms-border" />

      {/* Search */}
      <div className="relative flex-1 min-w-[180px] max-w-[320px]">
        <svg aria-hidden="true" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-cms-text-dim" width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.2" />
          <path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        <input
          ref={searchRef}
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t.library.searchPlaceholder}
          className="w-full rounded-md border border-cms-border bg-cms-bg py-1.5 pl-8 pr-16 text-sm text-cms-text placeholder:text-cms-text-dim focus:border-cms-accent focus:outline-none"
          aria-label={t.toolbar.searchLabel}
          data-testid="media-search"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {search && (
            <>
              <span className="text-[10px] text-cms-text-muted tabular-nums">
                {t.toolbar.searchCount.replace('{count}', String(resultCount))}
              </span>
              <button
                type="button"
                onClick={handleSearchClear}
                className="rounded p-0.5 text-cms-text-dim hover:text-cms-text"
                aria-label={t.toolbar.clearSearch}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
              </button>
            </>
          )}
          {!search && (
            <kbd className="rounded border border-cms-border bg-cms-bg px-1 py-0.5 text-[10px] text-cms-text-dim">
              {t.toolbar.searchHint}
            </kbd>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="h-5 w-px bg-cms-border" />

      {/* Filter pills */}
      <div className="flex gap-1">
        {FILTER_OPTIONS.map(({ key, tKey }) => {
          const count = filterCounts[key as keyof FilterCount] ?? 0
          const isActive = filter === key
          return (
            <button
              key={key}
              type="button"
              aria-pressed={isActive}
              onClick={() => onFilterChange(key)}
              className={`
                flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-all
                ${isActive
                  ? 'bg-cms-accent text-white shadow-sm'
                  : 'bg-cms-bg text-cms-text-muted hover:bg-cms-surface-hover hover:text-cms-text'}
              `}
              data-testid={`filter-${key}`}
            >
              {t.toolbar[tKey]}
              <span className={`tabular-nums ${isActive ? 'text-white/70' : 'text-cms-text-dim'}`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Sort */}
      <select
        value={sort}
        onChange={(e) => onSortChange(e.target.value as MediaSortOption)}
        className="rounded-md border border-cms-border bg-cms-bg px-2 py-1 text-xs text-cms-text focus:border-cms-accent focus:outline-none"
        aria-label={t.toolbar.sortLabel}
        data-testid="media-sort"
      >
        {SORT_OPTIONS.map(({ value, tKey }) => (
          <option key={value} value={value}>{t.toolbar[tKey]}</option>
        ))}
      </select>

      {/* Column density */}
      <div className="flex gap-0.5 rounded-md border border-cms-border bg-cms-bg p-0.5">
        {([2, 3, 4] as const).map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={cols === n}
            onClick={() => onColsChange(n)}
            className={`rounded px-2 py-1.5 text-xs transition-colors ${
              cols === n ? 'bg-cms-accent text-white' : 'text-cms-text-muted hover:text-cms-text'
            }`}
            aria-label={`${n} ${t.toolbar.columns}`}
          >
            {n}
          </button>
        ))}
      </div>

      {/* View toggle */}
      <div className="flex gap-0.5 rounded-md border border-cms-border bg-cms-bg p-0.5">
        <button
          type="button"
          aria-pressed={view === 'grid'}
          onClick={() => onViewChange('grid')}
          className={`rounded p-1 transition-colors ${view === 'grid' ? 'bg-cms-accent text-white' : 'text-cms-text-muted hover:text-cms-text'}`}
          aria-label={t.toolbar.viewGrid}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" /><rect x="8" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" /><rect x="1" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" /><rect x="8" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" /></svg>
        </button>
        <button
          type="button"
          aria-pressed={view === 'list'}
          onClick={() => onViewChange('list')}
          className={`rounded p-1 transition-colors ${view === 'list' ? 'bg-cms-accent text-white' : 'text-cms-text-muted hover:text-cms-text'}`}
          aria-label={t.toolbar.viewList}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 3h12M1 7h12M1 11h12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
        </button>
      </div>
    </div>
  )
})
