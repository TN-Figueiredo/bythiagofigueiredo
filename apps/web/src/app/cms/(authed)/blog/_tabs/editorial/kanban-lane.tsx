'use client'

import { memo, type ReactNode } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'

interface KanbanLaneProps {
  id: string
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
}

export const KanbanLane = memo(function KanbanLane({
  id,
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
}: KanbanLaneProps) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: !droppable })
  const showDropZone = isOver && !isInvalidDrop

  return (
    <div
      ref={setNodeRef}
      role="group"
      aria-label={`${title} — ${count} items`}
      className={`flex min-w-[220px] max-w-[320px] flex-1 flex-col rounded-lg border bg-gray-950 transition-all duration-200 ${
        isInvalidDrop && isOver
          ? 'border-red-500/30 bg-red-950/10 opacity-60'
          : showDropZone
            ? 'border-indigo-500/60 bg-indigo-950/20 ring-1 ring-indigo-500/20'
            : 'border-gray-800'
      }`}
    >
      <div
        className={`flex items-center gap-2 border-b px-3 py-2 transition-colors ${
          showDropZone ? 'border-indigo-500/30' : 'border-gray-800'
        }`}
      >
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
        <span
          className={`text-[10px] font-semibold uppercase tracking-wider transition-colors ${
            showDropZone ? 'text-indigo-400' : 'text-gray-400'
          }`}
        >
          {title}
        </span>
        <span className="ml-auto rounded-full bg-gray-800 px-1.5 py-0.5 text-[8px] font-bold tabular-nums text-gray-500">
          {paginationLabel ?? count}
        </span>
      </div>

      <SortableContext items={itemIds} strategy={verticalListSortingStrategy} disabled={!droppable}>
        <div
          className="flex min-h-[120px] flex-1 flex-col gap-2 overflow-y-auto p-2"
          style={{ maxHeight: 'calc(100vh - 260px)' }}
        >
          {count === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-8 opacity-50">
              <p className="text-center text-[10px] text-gray-500">{emptyMessage}</p>
              {emptyCta}
            </div>
          )}
          {children}
          {showDropZone && count === 0 && (
            <div className="flex h-16 items-center justify-center rounded-lg border border-dashed border-indigo-500/30 text-[10px] text-indigo-400/60">
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
