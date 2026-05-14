'use client'

import { useState, useRef, useMemo, useEffect } from 'react'
import { Plus } from 'lucide-react'
import type { PlaylistItemEnriched, ContentType, FilterState } from '@/lib/playlists/types'

const TYPE_LABELS: Record<ContentType, string> = {
  blog_post: 'Blog',
  newsletter: 'Newsletter',
  pipeline: 'Pipeline',
  video: 'Video',
}

const TYPE_DOT_COLORS: Record<ContentType, string> = {
  blog_post: 'bg-indigo-500',
  newsletter: 'bg-green-500',
  pipeline: 'bg-purple-500',
  video: 'bg-red-500',
}

interface PlaylistSidebarProps {
  items: PlaylistItemEnriched[]
  selectedItemIds: Set<string>
  viewNumbers: Map<string, number | null>
  filter: FilterState
  onSelectItem: (itemId: string) => void
  onRemoveItem: (itemId: string) => void
  onAddContent: () => void
  onSearchChange: (search: string) => void
}

export function PlaylistSidebar({
  items,
  selectedItemIds,
  viewNumbers,
  filter,
  onSelectItem,
  onRemoveItem,
  onAddContent,
  onSearchChange,
}: PlaylistSidebarProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const [localSearch, setLocalSearch] = useState(filter.search)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  const handleSearchChange = (value: string) => {
    setLocalSearch(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => onSearchChange(value), 200)
  }

  // Sort by sort_order, then apply search filter
  const sortedItems = useMemo(() => {
    const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order)
    if (!filter.search) return sorted
    const q = filter.search.toLowerCase()
    return sorted.filter(item => item.title.toLowerCase().includes(q))
  }, [items, filter.search])

  // Apply filter.mode: hide items not matching viewNumbers
  const visibleItems = useMemo(() => {
    if (filter.mode === 'hide') {
      return sortedItems.filter(item => viewNumbers.get(item.id) !== null)
    }
    return sortedItems
  }, [sortedItems, filter.mode, viewNumbers])

  // Group by content type + language when filter is active
  const hasActiveFilter = filter.types.size > 0 || filter.languages.size > 0
  const groups = useMemo(() => {
    const map = new Map<string, PlaylistItemEnriched[]>()
    for (const item of visibleItems) {
      const typeLabel = item.content_type ? (TYPE_LABELS[item.content_type] ?? 'Unknown') : 'Unknown'
      const langLabel = item.language === 'pt-br' ? 'PT-BR' : item.language === 'en' ? 'EN' : ''
      const key = [typeLabel, langLabel].filter(Boolean).join(' — ')
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(item)
    }
    return map
  }, [visibleItems])

  useEffect(() => {
    if (selectedItemIds.size !== 1) return
    const id = selectedItemIds.values().next().value
    const el = listRef.current?.querySelector(`[data-sidebar-item="${id}"]`)
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selectedItemIds])

  const renderItem = (item: PlaylistItemEnriched) => {
    const isDimmed = filter.mode === 'dim' && viewNumbers.get(item.id) === null
    return (
      <li key={item.id} data-sidebar-item={item.id}>
        <div
          role="button"
          tabIndex={0}
          onClick={() => onSelectItem(item.id)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onSelectItem(item.id) }}
          className={`flex w-full items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-white/5 cursor-pointer ${
            selectedItemIds.has(item.id) ? 'bg-indigo-500/10' : ''
          } ${isDimmed ? 'opacity-30' : ''}`}
        >
          {/* View number */}
          <span className="mt-0.5 w-5 flex-shrink-0 text-right text-[0.6rem] font-bold text-white/30">
            {viewNumbers.get(item.id) ?? '—'}
          </span>

          {/* Type dot */}
          <span
            className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${
              item.content_type ? TYPE_DOT_COLORS[item.content_type] : 'bg-white/20'
            }`}
          />

          {/* Language badge */}
          {item.language && (
            <span className={`mt-0.5 text-[0.55rem] font-semibold ${item.language === 'pt-br' ? 'text-amber-400' : 'text-blue-400'}`}>
              {item.language === 'pt-br' ? 'PT' : 'EN'}
            </span>
          )}

          <div className="min-w-0 flex-1">
            <p
              className={`truncate text-xs font-medium ${
                item.is_ghost ? 'text-white/30 line-through' : 'text-white/80'
              }`}
            >
              {item.title}
            </p>
            <p className="text-[0.6rem] text-white/30">
              {item.content_type ? TYPE_LABELS[item.content_type] : 'Removed'}
              {item.status ? ` · ${item.status}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={e => {
              e.stopPropagation()
              onRemoveItem(item.id)
            }}
            className="mt-0.5 flex-shrink-0 rounded p-0.5 text-[0.6rem] text-white/20 hover:bg-red-500/10 hover:text-red-400"
            aria-label={`Remove ${item.title}`}
          >
            &times;
          </button>
        </div>
      </li>
    )
  }

  return (
    <div className="flex h-full w-64 flex-col border-r border-white/10 bg-[#0a0a12]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-white/40">
          Items ({items.length})
        </h2>
        <button
          type="button"
          onClick={onAddContent}
          className="flex items-center gap-1 rounded-md bg-indigo-600 px-2 py-1 text-[0.65rem] font-medium text-white hover:bg-indigo-700"
          aria-label="Add content to playlist"
        >
          <Plus size={12} />
          Add
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-1.5 border-b border-white/5">
        <input
          type="text"
          placeholder="Search items…"
          value={localSearch}
          onChange={e => handleSearchChange(e.target.value)}
          className="w-full rounded-md bg-white/5 px-2 py-1 text-xs text-white/70 placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
        />
      </div>

      {/* Items list */}
      <div ref={listRef} className="flex-1 overflow-y-auto">
        {visibleItems.length === 0 ? (
          <div className="p-4 text-center text-xs text-white/30">
            {items.length === 0
              ? 'No items yet. Drag content from the library or use Add Content.'
              : 'No items match the current filter.'}
          </div>
        ) : hasActiveFilter ? (
          /* Grouped rendering when filter is active */
          <div>
            {Array.from(groups.entries()).map(([groupLabel, groupItems]) => (
              <div key={groupLabel}>
                <div className="sticky top-0 bg-[#0a0a12] px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-wider text-white/20 border-b border-white/5">
                  {groupLabel} ({groupItems.length})
                </div>
                <ul className="divide-y divide-white/5">
                  {groupItems.map(renderItem)}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          /* Flat rendering */
          <ul className="divide-y divide-white/5">
            {visibleItems.map(renderItem)}
          </ul>
        )}
      </div>
    </div>
  )
}
