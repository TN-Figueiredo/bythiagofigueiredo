'use client'

import { useState, useCallback, useOptimistic, useTransition } from 'react'
import { DndContext, type DragEndEvent, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { EditionCard } from '../../_hub/hub-types'
import { KanbanColumn } from './kanban-column'

const COLUMNS = [
  { id: 'idea', title: 'Idea', color: '#9ca3af' },
  { id: 'draft', title: 'Draft', color: '#6366f1' },
  { id: 'review', title: 'Review', color: '#f59e0b' },
  { id: 'scheduled', title: 'Scheduled', color: '#8b5cf6' },
  { id: 'sending', title: 'Sending', color: '#3b82f6' },
  { id: 'sent', title: 'Sent', color: '#22c55e' },
  { id: 'failed', title: 'Issues', color: '#ef4444' },
] as const

interface KanbanBoardProps {
  editions: EditionCard[]
  onMoveEdition?: (editionId: string, newStatus: string) => Promise<void>
}

export function KanbanBoard({ editions, onMoveEdition }: KanbanBoardProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const [optimisticEditions, setOptimistic] = useOptimistic(editions)
  const [, startTransition] = useTransition()

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const editionId = active.id as string
    const targetColumn = COLUMNS.find((c) => c.id === over.id)?.id ?? (over.id as string)

    startTransition(async () => {
      setOptimistic((prev) =>
        prev.map((e) => (e.id === editionId ? { ...e, status: targetColumn as EditionCard['status'] } : e)),
      )
      await onMoveEdition?.(editionId, targetColumn)
    })
  }, [onMoveEdition, setOptimistic, startTransition])

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            id={col.id}
            title={col.title}
            color={col.color}
            cards={optimisticEditions.filter((e) => e.status === col.id)}
          />
        ))}
      </div>
    </DndContext>
  )
}
