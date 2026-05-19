'use client'

import { useState, useRef, useMemo, useEffect, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { GripVertical, Plus } from 'lucide-react'
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
  onReorder: (itemIds: string[]) => void
  onAddContent: () => void
  onSearchChange: (search: string) => void
  onWheel: (deltaY: number) => void
}

export function PlaylistSidebar({
  items,
  selectedItemIds,
  viewNumbers,
  filter,
  onSelectItem,
  onRemoveItem,
  onReorder,
  onAddContent,
  onSearchChange,
  onWheel,
}: PlaylistSidebarProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const [localSearch, setLocalSearch] = useState(filter.search)
  const [activeId, setActiveId] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

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

  const canDrag = !filter.search && !hasActiveFilter

  // ── DnD handlers ──────────────────────────────────────────────────────

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = visibleItems.findIndex(i => i.id === active.id)
    const newIndex = visibleItems.findIndex(i => i.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const reordered = arrayMove(visibleItems.map(i => i.id), oldIndex, newIndex)
    onReorder(reordered)
  }, [visibleItems, onReorder])

  const handleDragCancel = useCallback(() => {
    setActiveId(null)
  }, [])

  const handleSearchChange = (value: string) => {
    setLocalSearch(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => onSearchChange(value), 200)
  }

  // ── Scroll selected item into view ────────────────────────────────────

  useEffect(() => {
    if (selectedItemIds.size !== 1) return
    const id = selectedItemIds.values().next().value
    const el = listRef.current?.querySelector(`[data-sidebar-item="${id}"]`)
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selectedItemIds])

  // ── DragOverlay active item ───────────────────────────────────────────

  const activeItem = useMemo(() => {
    if (!activeId) return null
    return visibleItems.find(i => i.id === activeId) ?? null
  }, [activeId, visibleItems])

  // ── Wheel → canvas zoom (non-passive to allow preventDefault) ─────────

  useEffect(() => {
    const el = listRef.current
    if (!el || !canDrag) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      onWheel(e.deltaY)
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [canDrag, onWheel])

  // ── Click-and-drag panning ────────────────────────────────────────────

  const panRef = useRef({ active: false, startY: 0, startScroll: 0, moved: false })

  // Suppress click after a pan gesture (capture phase)
  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const handler = (e: MouseEvent) => {
      if (panRef.current.moved) {
        e.stopPropagation()
        e.preventDefault()
        panRef.current.moved = false
      }
    }
    el.addEventListener('click', handler, true)
    return () => el.removeEventListener('click', handler, true)
  }, [])

  const handlePanDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return
    const target = e.target as HTMLElement
    if (target.closest('[data-drag-handle], button, input, a')) return
    panRef.current = {
      active: true,
      startY: e.clientY,
      startScroll: listRef.current?.scrollTop ?? 0,
      moved: false,
    }
  }, [])

  const handlePanMove = useCallback((e: React.PointerEvent) => {
    if (!panRef.current.active) return
    const dy = e.clientY - panRef.current.startY
    if (Math.abs(dy) > 3) {
      panRef.current.moved = true
      if (listRef.current) {
        listRef.current.scrollTop = panRef.current.startScroll - dy
      }
    }
  }, [])

  const handlePanUp = useCallback(() => {
    panRef.current.active = false
    // Delay reset so capture-phase click handler can still suppress the click
    requestAnimationFrame(() => { panRef.current.moved = false })
  }, [])

  // ── Render ────────────────────────────────────────────────────────────

  const renderItem = (item: PlaylistItemEnriched) => (
    <SortableItem
      key={item.id}
      item={item}
      isDimmed={filter.mode === 'dim' && viewNumbers.get(item.id) === null}
      isSelected={selectedItemIds.has(item.id)}
      viewNumber={viewNumbers.get(item.id) ?? null}
      canDrag={canDrag}
      onSelect={() => onSelectItem(item.id)}
      onRemove={() => onRemoveItem(item.id)}
    />
  )

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
      <div className="border-b border-white/5 px-3 py-1.5">
        <input
          type="text"
          placeholder="Search items…"
          value={localSearch}
          onChange={e => handleSearchChange(e.target.value)}
          className="w-full rounded-md bg-white/5 px-2 py-1 text-xs text-white/70 placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
        />
      </div>

      {/* Items list — click-drag to pan, wheel to zoom */}
      <div
        ref={listRef}
        className="flex-1 cursor-grab select-none overflow-y-auto active:cursor-grabbing"
        onPointerDown={handlePanDown}
        onPointerMove={handlePanMove}
        onPointerUp={handlePanUp}
        onPointerLeave={handlePanUp}
      >
        {visibleItems.length === 0 ? (
          <div className="p-4 text-center text-xs text-white/30">
            {items.length === 0
              ? 'No items yet. Use + Add to include content.'
              : 'No items match the current filter.'}
          </div>
        ) : hasActiveFilter ? (
          /* Grouped rendering when filter is active */
          <div>
            {Array.from(groups.entries()).map(([groupLabel, groupItems]) => (
              <div key={groupLabel}>
                <div className="sticky top-0 border-b border-white/5 bg-[#0a0a12] px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-wider text-white/20">
                  {groupLabel} ({groupItems.length})
                </div>
                <ul className="divide-y divide-white/5">
                  {groupItems.map(renderItem)}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          /* Flat sortable rendering */
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <SortableContext items={visibleItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
              <ul className="divide-y divide-white/5">
                {visibleItems.map(renderItem)}
              </ul>
            </SortableContext>
            <DragOverlay dropAnimation={null}>
              {activeItem ? (
                <OverlayItem
                  item={activeItem}
                  isDimmed={filter.mode === 'dim' && viewNumbers.get(activeItem.id) === null}
                  isSelected={selectedItemIds.has(activeItem.id)}
                  viewNumber={viewNumbers.get(activeItem.id) ?? null}
                />
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared item content (used by both SortableItem and OverlayItem)
// ---------------------------------------------------------------------------

interface ItemContentProps {
  item: PlaylistItemEnriched
  isDimmed: boolean
  isSelected: boolean
  viewNumber: number | null
  dragHandle?: React.ReactNode
  onSelect?: () => void
  onRemove?: () => void
}

function ItemContent({ item, isDimmed, isSelected, viewNumber, dragHandle, onSelect, onRemove }: ItemContentProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && onSelect) onSelect() }}
      className={`flex w-full cursor-pointer items-center gap-1.5 px-1 py-1.5 text-left transition-colors hover:bg-white/5 ${
        isSelected ? 'bg-indigo-500/10' : ''
      } ${isDimmed ? 'opacity-30' : ''}`}
    >
      {dragHandle}

      <span className="w-5 flex-shrink-0 text-right text-[0.6rem] font-bold text-white/30">
        {viewNumber ?? '—'}
      </span>

      <span
        className={`h-2 w-2 flex-shrink-0 rounded-full ${
          item.content_type ? TYPE_DOT_COLORS[item.content_type] : 'bg-white/20'
        }`}
      />

      {item.language && (
        <span className={`text-[0.55rem] font-semibold ${item.language === 'pt-br' ? 'text-amber-400' : 'text-blue-400'}`}>
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

      {onRemove && (
        <button
          type="button"
          onClick={e => {
            e.stopPropagation()
            onRemove()
          }}
          className="flex-shrink-0 rounded p-0.5 text-[0.6rem] text-white/20 hover:bg-red-500/10 hover:text-red-400"
          aria-label={`Remove ${item.title}`}
        >
          &times;
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// SortableItem — grip handle for reorder, row body for select/pan
// ---------------------------------------------------------------------------

interface SortableItemProps {
  item: PlaylistItemEnriched
  isDimmed: boolean
  isSelected: boolean
  viewNumber: number | null
  canDrag: boolean
  onSelect: () => void
  onRemove: () => void
}

function SortableItem({ item, isDimmed, isSelected, viewNumber, canDrag, onSelect, onRemove }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: !canDrag })

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.2 : 1,
  }

  const handle = canDrag ? (
    <button
      type="button"
      data-drag-handle
      className="flex-shrink-0 touch-none text-white/20 hover:text-white/50 cursor-grab active:cursor-grabbing"
      aria-label="Drag to reorder"
      {...listeners}
    >
      <GripVertical size={12} />
    </button>
  ) : null

  return (
    <li
      ref={setNodeRef}
      style={style}
      data-sidebar-item={item.id}
      {...attributes}
    >
      <ItemContent
        item={item}
        isDimmed={isDimmed}
        isSelected={isSelected}
        viewNumber={viewNumber}
        dragHandle={handle}
        onSelect={onSelect}
        onRemove={onRemove}
      />
    </li>
  )
}

// ---------------------------------------------------------------------------
// OverlayItem — the floating drag preview
// ---------------------------------------------------------------------------

interface OverlayItemProps {
  item: PlaylistItemEnriched
  isDimmed: boolean
  isSelected: boolean
  viewNumber: number | null
}

function OverlayItem({ item, isDimmed, isSelected, viewNumber }: OverlayItemProps) {
  return (
    <div className="w-64 scale-[1.02] rounded-md bg-[#14142a] opacity-90 shadow-xl shadow-indigo-500/10 ring-1 ring-indigo-500/40">
      <ItemContent
        item={item}
        isDimmed={isDimmed}
        isSelected={isSelected}
        viewNumber={viewNumber}
        dragHandle={
          <span className="flex-shrink-0 text-white/40">
            <GripVertical size={12} />
          </span>
        }
      />
    </div>
  )
}
