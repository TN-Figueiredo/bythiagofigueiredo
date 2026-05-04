'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { EditionCard, NewsletterType } from '../../_hub/hub-types'
import type { NewsletterHubStrings } from '../../_i18n/types'
import { KanbanCard } from './kanban-card'
import { QuickAddInput } from '../../../_shared/editor/quick-add-input'

interface KanbanColumnProps {
  id: string
  title: string
  cards: EditionCard[]
  confirmedIds?: Set<string>
  color?: string
  hint?: string
  strings?: NewsletterHubStrings
  types?: NewsletterType[]
  onReassignType?: (editionId: string, typeId: string | null) => void
  onMoveToStatus?: (editionId: string, newStatus: string) => void | Promise<void>
  onDelete?: (editionId: string) => Promise<void>
  onQuickAdd?: (title: string) => Promise<void>
  activeId?: string | null
}

export function KanbanColumn({ id, title, cards, confirmedIds, color, hint, strings, types, onReassignType, onMoveToStatus, onDelete, onQuickAdd, activeId }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id })
  const isDraggingInto = isOver && activeId && !cards.some((c) => c.id === activeId)

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
      <div className={`border-b px-3 py-2 transition-colors ${
        isDraggingInto ? 'border-indigo-500/30' : 'border-gray-800'
      }`}>
        <div className="flex items-center gap-2">
          {color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />}
          <span className={`text-[10px] font-semibold uppercase tracking-wider transition-colors ${
            isDraggingInto ? 'text-indigo-400' : 'text-gray-400'
          }`}>{title}</span>
          <span className="ml-auto rounded-full bg-gray-800 px-1.5 py-0.5 text-[8px] font-bold tabular-nums text-gray-500">
            {cards.length}
          </span>
        </div>
        {hint && <p className="mt-0.5 text-[9px] text-gray-600">{hint}</p>}
      </div>
      <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-[120px] flex-1 flex-col gap-2 overflow-y-auto p-2" style={{ maxHeight: 'calc(100vh - 320px)' }}>
          {cards.map((card) => (
            <KanbanCard key={card.id} card={card} confirmed={confirmedIds?.has(card.id)} strings={strings} types={types} onReassignType={onReassignType} onMoveToStatus={onMoveToStatus} onDeleteEdition={onDelete} />
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
    </div>
  )
}
