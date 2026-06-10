'use client'

import { memo, type ReactNode } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'

const LANE_MAX_HEIGHT = 'calc(100vh - var(--kanban-lane-offset, 260px))'

const FALLBACK_EMPTY: Record<string, string> = {
  idea: 'Sem ideias ainda',
  draft: 'Sem rascunhos',
  ready: 'Sem itens prontos',
  scheduled: 'Nenhum post agendado',
  published: 'Nenhum post publicado',
}

interface KanbanLaneProps {
  id: string
  index?: number
  title: string
  color: string
  count: number
  children: ReactNode
  droppable: boolean
  itemIds: string[]
  emptyMessage?: string
  emptyCta?: ReactNode
  isInvalidDrop?: boolean
  footer?: ReactNode
  paginationLabel?: string
  dropHereLabel?: string
  itemsLabel?: string
}

export const KanbanLane = memo(function KanbanLane({
  id,
  index,
  title,
  color,
  count,
  children,
  droppable,
  itemIds,
  emptyMessage,
  emptyCta,
  isInvalidDrop,
  footer,
  paginationLabel,
  dropHereLabel,
  itemsLabel,
}: KanbanLaneProps) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: !droppable })
  const showDropZone = isOver && !isInvalidDrop

  return (
    <div
      ref={setNodeRef}
      role="group"
      data-lane-index={index}
      aria-label={itemsLabel ? `${title}: ${count} ${itemsLabel}` : `${title}: ${count}`}
      className={`flex min-w-[220px] max-w-[320px] flex-1 flex-col rounded-lg border bg-gray-950 transition-all duration-200 ${
        isInvalidDrop && isOver
          ? 'border-red-500/30 bg-red-950/10 opacity-60'
          : showDropZone
            ? 'border-[rgba(255,130,64,0.6)] bg-[rgba(255,130,64,0.06)] ring-1 ring-[rgba(255,130,64,0.2)]'
            : 'border-gray-800'
      }`}
    >
      <div
        className={`flex items-center gap-2 border-b px-3 py-2 transition-colors ${
          showDropZone ? 'border-[rgba(255,130,64,0.3)]' : 'border-gray-800'
        }`}
      >
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
        <span
          className={`text-[11px] font-semibold uppercase tracking-wider transition-colors ${
            showDropZone ? 'text-[#ff9a5e]' : 'text-gray-300'
          }`}
        >
          {title}
        </span>
        <span
          className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums transition-colors ${
            showDropZone && count > 0
              ? 'bg-[rgba(255,130,64,0.15)] text-[#ff9a5e]'
              : 'bg-gray-800 text-gray-400'
          }`}
        >
          {paginationLabel ?? count}
        </span>
      </div>

      <SortableContext items={itemIds} strategy={verticalListSortingStrategy} disabled={!droppable}>
        <div
          className="flex min-h-[120px] flex-1 flex-col gap-2 overflow-y-auto p-2"
          style={{ maxHeight: LANE_MAX_HEIGHT }}
        >
          {count === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-8">
              <p className="text-center text-[11px] text-gray-600">{emptyMessage || FALLBACK_EMPTY[id] || 'Nenhum item'}</p>
              {emptyCta}
            </div>
          )}
          {children}
          {showDropZone && count === 0 && (
            <div className="flex h-16 items-center justify-center rounded-lg border border-dashed border-[rgba(255,130,64,0.3)] text-[10px] text-[rgba(255,154,94,0.6)]">
              {dropHereLabel ?? 'Drop here'}
            </div>
          )}
        </div>
      </SortableContext>

      {footer && (
        <div className="border-t border-gray-800/50 px-3 py-2">
          {footer}
        </div>
      )}
    </div>
  )
})
