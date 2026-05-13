'use client'

import { useEffect, useRef } from 'react'
import { Plus } from 'lucide-react'
import type { PlaylistItemEnriched, ContentType } from '@/lib/playlists/types'

const TYPE_LABELS: Record<ContentType, string> = {
  blog_post: 'Blog',
  newsletter: 'Newsletter',
  pipeline: 'Pipeline',
}

const TYPE_DOT_COLORS: Record<ContentType, string> = {
  blog_post: 'bg-indigo-500',
  newsletter: 'bg-green-500',
  pipeline: 'bg-purple-500',
}

interface PlaylistSidebarProps {
  items: PlaylistItemEnriched[]
  selectedItemIds: Set<string>
  onSelectItem: (itemId: string) => void
  onRemoveItem: (itemId: string) => void
  onAddContent: () => void
}

export function PlaylistSidebar({
  items,
  selectedItemIds,
  onSelectItem,
  onRemoveItem,
  onAddContent,
}: PlaylistSidebarProps) {
  const sortedItems = [...items].sort((a, b) => a.sort_order - b.sort_order)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (selectedItemIds.size !== 1) return
    const id = selectedItemIds.values().next().value
    const el = listRef.current?.querySelector(`[data-sidebar-item="${id}"]`)
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selectedItemIds])

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

      {/* Items list */}
      <div ref={listRef} className="flex-1 overflow-y-auto">
        {sortedItems.length === 0 ? (
          <div className="p-4 text-center text-xs text-white/30">
            No items yet. Drag content from the library or use Add Content.
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {sortedItems.map(item => (
              <li key={item.id} data-sidebar-item={item.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectItem(item.id)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onSelectItem(item.id) }}
                  className={`flex w-full items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-white/5 cursor-pointer ${
                    selectedItemIds.has(item.id) ? 'bg-indigo-500/10' : ''
                  }`}
                >
                  <span
                    className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${
                      item.content_type ? TYPE_DOT_COLORS[item.content_type] : 'bg-white/20'
                    }`}
                  />
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
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
