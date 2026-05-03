'use client'

import Link from 'next/link'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { PostCard, BlogTag } from '../../_hub/hub-types'
import type { BlogHubStrings } from '../../_i18n/types'
import { KanbanCard } from './kanban-card'
import { QuickAddInput } from './quick-add-input'

const PUBLISHED_FOOTER_THRESHOLD = 15

interface KanbanColumnProps {
  id: string
  title: string
  color?: string
  cards: PostCard[]
  strings?: BlogHubStrings
  tags?: BlogTag[]
  activeId?: string | null
  onMoveToStatus?: (postId: string, newStatus: string) => Promise<void>
  onDelete?: (postId: string) => Promise<void>
  onReassignTag?: (postId: string, tagId: string | null) => Promise<void>
  onAddLocale?: (postId: string, locale: string) => Promise<void>
  onDuplicate?: (postId: string) => Promise<void>
  onQuickAdd?: (title: string) => Promise<void>
}

export function KanbanColumn({
  id,
  title,
  color,
  cards,
  strings,
  tags,
  activeId,
  onMoveToStatus,
  onDelete,
  onReassignTag,
  onAddLocale,
  onDuplicate,
  onQuickAdd,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id })
  const isDraggingInto = isOver && activeId && !cards.some((c) => c.id === activeId)
  const isPublishedCol = id === 'published'

  return (
    <div
      ref={setNodeRef}
      aria-label={`${title} column, ${cards.length} items`}
      className={`flex w-[220px] shrink-0 flex-col rounded-lg border bg-gray-950 transition-all duration-200 ${
        isDraggingInto
          ? 'border-indigo-500/60 bg-indigo-950/20 ring-1 ring-indigo-500/20'
          : isOver
            ? 'border-indigo-500/30 bg-indigo-950/10'
            : 'border-gray-800'
      }`}
    >
      {/* Column header */}
      <div
        className={`flex items-center gap-2 border-b px-3 py-2 transition-colors ${
          isDraggingInto ? 'border-indigo-500/30' : 'border-gray-800'
        }`}
      >
        {color && (
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
        )}
        <span
          className={`text-[10px] font-semibold uppercase tracking-wider transition-colors ${
            isDraggingInto ? 'text-indigo-400' : 'text-gray-400'
          }`}
        >
          {title}
        </span>
        <span className="ml-auto rounded-full bg-gray-800 px-1.5 py-0.5 text-[8px] font-bold tabular-nums text-gray-500">
          {cards.length}
        </span>
      </div>

      {/* Card list */}
      <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div
          className="flex min-h-[120px] flex-1 flex-col gap-2 overflow-y-auto p-2"
          style={{ maxHeight: 'calc(100vh - 340px)' }}
        >
          {cards.map((card) => (
            <KanbanCard
              key={card.id}
              card={card}
              strings={strings}
              tags={tags}
              onMoveToStatus={onMoveToStatus}
              onDelete={onDelete}
              onReassignTag={onReassignTag}
              onAddLocale={onAddLocale}
              onDuplicate={onDuplicate}
            />
          ))}
          {isDraggingInto && cards.length === 0 && (
            <div className="flex h-16 items-center justify-center rounded-lg border border-dashed border-indigo-500/30 text-[10px] text-indigo-400/60">
              Drop here
            </div>
          )}
        </div>
      </SortableContext>

      {/* Quick-add input (only for idea column) */}
      {id === 'idea' && onQuickAdd && (
        <div className="border-t border-gray-800 p-2">
          <QuickAddInput
            placeholder={strings?.editorial.quickAddPlaceholder ?? 'Quick idea…'}
            onAdd={onQuickAdd}
          />
        </div>
      )}

      {/* Published column footer */}
      {isPublishedCol && cards.length >= PUBLISHED_FOOTER_THRESHOLD && (
        <div className="border-t border-gray-800 px-3 py-2">
          <Link
            href="/cms/blog?status=published"
            className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            {strings?.editorial.viewAllPublished ?? 'View all published'} {cards.length} →
          </Link>
        </div>
      )}
    </div>
  )
}
