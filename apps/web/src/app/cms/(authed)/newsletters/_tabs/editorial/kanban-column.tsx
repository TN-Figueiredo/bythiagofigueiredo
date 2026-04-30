'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { EditionCard } from '../../_hub/hub-types'
import { KanbanCard } from './kanban-card'

interface KanbanColumnProps {
  id: string
  title: string
  cards: EditionCard[]
  color?: string
}

export function KanbanColumn({ id, title, cards, color }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      className={`flex w-[220px] shrink-0 flex-col rounded-lg border bg-gray-950 transition-colors ${
        isOver ? 'border-indigo-500/40 bg-indigo-950/10' : 'border-gray-800'
      }`}
    >
      <div className="flex items-center gap-2 border-b border-gray-800 px-3 py-2">
        {color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />}
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{title}</span>
        <span className="ml-auto rounded-full bg-gray-800 px-1.5 py-0.5 text-[8px] font-bold tabular-nums text-gray-500">
          {cards.length}
        </span>
      </div>
      <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2" style={{ maxHeight: 'calc(100vh - 300px)' }}>
          {cards.map((card) => (
            <KanbanCard key={card.id} card={card} />
          ))}
        </div>
      </SortableContext>
    </div>
  )
}
