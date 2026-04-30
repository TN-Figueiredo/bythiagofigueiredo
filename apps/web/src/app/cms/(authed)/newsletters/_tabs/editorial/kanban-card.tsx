'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { EditionCard } from '../../_hub/hub-types'
import { formatRelativeDate } from '../../_hub/hub-utils'

interface KanbanCardProps {
  card: EditionCard
}

export function KanbanCard({ card }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-grab rounded-lg border border-gray-800 bg-gray-900 p-3 transition-colors hover:border-gray-700 active:cursor-grabbing"
    >
      {card.typeColor && (
        <div className="mb-2 h-1 w-full rounded-full" style={{ backgroundColor: card.typeColor, opacity: 0.6 }} />
      )}
      <p className="text-[11px] font-medium leading-snug text-gray-200">{card.subject || 'Untitled'}</p>
      {card.typeName && (
        <span className="mt-1 inline-block text-[9px] text-gray-500">{card.typeName}</span>
      )}
      {card.ideaNotes && card.status === 'idea' && (
        <p className="mt-1.5 line-clamp-2 text-[10px] text-gray-500">{card.ideaNotes}</p>
      )}
      <div className="mt-2 flex items-center justify-between">
        <time className="text-[9px] text-gray-600">{formatRelativeDate(card.createdAt)}</time>
        {card.stats && (
          <span className="text-[9px] tabular-nums text-gray-500">
            {card.stats.opens}o · {card.stats.clicks}c
          </span>
        )}
      </div>
    </div>
  )
}
