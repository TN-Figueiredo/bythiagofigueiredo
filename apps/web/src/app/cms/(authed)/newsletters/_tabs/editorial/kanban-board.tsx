'use client'

import { useCallback, useId, useMemo, useOptimistic, useRef, useState, useTransition } from 'react'
import {
  DndContext, DragOverlay,
  type DragStartEvent, type DragOverEvent, type DragEndEvent,
  closestCorners, PointerSensor, KeyboardSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { toast } from 'sonner'
import type { EditionCard, NewsletterType } from '../../_hub/hub-types'
import type { NewsletterHubStrings } from '../../_i18n/types'
import { KanbanColumn } from './kanban-column'
import { KanbanCardOverlay } from './kanban-card'

const COLUMN_DEFS = [
  { id: 'idea', key: 'idea' as const, color: '#9ca3af' },
  { id: 'draft', key: 'draft' as const, color: '#6366f1' },
  { id: 'ready', key: 'ready' as const, color: '#06b6d4' },
  { id: 'scheduled', key: 'scheduled' as const, color: '#8b5cf6' },
  { id: 'sent', key: 'sent' as const, color: '#22c55e' },
] as const

const COLUMN_IDS: Set<string> = new Set(COLUMN_DEFS.map((c) => c.id))

const FALLBACK_TITLES: Record<string, string> = {
  idea: 'Idea', draft: 'Draft', ready: 'Ready',
  scheduled: 'Scheduled', sent: 'Sent',
}

function resolveColumn(id: string, editions: EditionCard[]): EditionCard['status'] | null {
  if (COLUMN_IDS.has(id)) return id as EditionCard['status']
  const card = editions.find((e) => e.id === id)
  return card ? card.status : null
}

interface KanbanBoardProps {
  editions: EditionCard[]
  onMoveEdition?: (editionId: string, newStatus: string) => Promise<void>
  onDeleteEdition?: (editionId: string) => Promise<void>
  strings?: NewsletterHubStrings
  types?: NewsletterType[]
  onReassignType?: (editionId: string, typeId: string | null) => void
}

export function KanbanBoard({ editions, onMoveEdition, onDeleteEdition, strings, types, onReassignType }: KanbanBoardProps) {
  const dndId = useId()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const [optimisticEditions, setOptimistic] = useOptimistic(editions)
  const [, startTransition] = useTransition()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [localEditions, setLocalEditions] = useState<EditionCard[] | null>(null)
  const localEditionsRef = useRef<EditionCard[] | null>(null)

  const working = localEditions ?? optimisticEditions
  const activeCard = activeId ? working.find((e) => e.id === activeId) ?? null : null

  const columnCards = useMemo(() => {
    const map = new Map<string, EditionCard[]>()
    for (const col of COLUMN_DEFS) map.set(col.id, [])
    for (const e of working) {
      const arr = map.get(e.status)
      if (arr) arr.push(e)
    }
    return map
  }, [working])

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string)
    const snapshot = [...optimisticEditions]
    setLocalEditions(snapshot)
    localEditionsRef.current = snapshot
  }, [optimisticEditions])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeEditionId = active.id as string
    const overId = over.id as string

    setLocalEditions((prev) => {
      if (!prev) return prev
      const edition = prev.find((e) => e.id === activeEditionId)
      if (!edition) return prev

      const targetCol = resolveColumn(overId, prev)
      if (!targetCol) return prev

      let next: EditionCard[]

      if (edition.status === targetCol) {
        if (COLUMN_IDS.has(overId)) return prev
        const colCards = prev.filter((e) => e.status === targetCol)
        const oldIndex = colCards.findIndex((e) => e.id === activeEditionId)
        const newIndex = colCards.findIndex((e) => e.id === overId)
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return prev
        const reordered = arrayMove(colCards, oldIndex, newIndex)
        const otherCards = prev.filter((e) => e.status !== targetCol)
        next = [...otherCards, ...reordered]
      } else {
        const updated = prev.map((e) =>
          e.id === activeEditionId ? { ...e, status: targetCol } : e,
        )
        if (!COLUMN_IDS.has(overId)) {
          const colCards = updated.filter((e) => e.status === targetCol)
          const movedIdx = colCards.findIndex((e) => e.id === activeEditionId)
          const targetIdx = colCards.findIndex((e) => e.id === overId)
          if (movedIdx !== -1 && targetIdx !== -1 && movedIdx !== targetIdx) {
            const reordered = arrayMove(colCards, movedIdx, targetIdx)
            const otherCards = updated.filter((e) => e.status !== targetCol)
            next = [...otherCards, ...reordered]
          } else {
            next = updated
          }
        } else {
          next = updated
        }
      }

      localEditionsRef.current = next
      return next
    })
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active } = event
    setActiveId(null)

    const editionId = active.id as string
    const currentLocal = localEditionsRef.current
    const edition = currentLocal?.find((e) => e.id === editionId)
    const originalEdition = optimisticEditions.find((e) => e.id === editionId)

    setLocalEditions(null)
    localEditionsRef.current = null

    if (!edition || !originalEdition) return
    if (edition.status === originalEdition.status) return

    const targetColumn = edition.status
    // Preserve the ordering from the local drag state so the card
    // stays at the position where it was dropped instead of jumping
    // back to its created_at-based position.
    const finalOrder = currentLocal!

    startTransition(async () => {
      setOptimistic(() =>
        finalOrder.map((e) => (e.id === editionId ? { ...e, status: targetColumn } : e)),
      )
      try {
        await onMoveEdition?.(editionId, targetColumn)
        toast.success(strings?.common.moved ?? 'Moved')
      } catch {
        toast.error(strings?.common.couldntMove ?? "Couldn't move")
      }
    })
  }, [onMoveEdition, setOptimistic, startTransition, optimisticEditions, strings])

  const handleDragCancel = useCallback(() => {
    setActiveId(null)
    setLocalEditions(null)
    localEditionsRef.current = null
  }, [])

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex gap-3 overflow-x-auto pb-4">
        {COLUMN_DEFS.map((col) => {
          const cards = columnCards.get(col.id) ?? []
          return (
            <KanbanColumn
              key={col.id}
              id={col.id}
              title={strings?.editorial[col.key] ?? FALLBACK_TITLES[col.key] ?? col.key}
              color={col.color}
              cards={cards}
              strings={strings}
              types={types}
              onReassignType={onReassignType}
              onMoveToStatus={onMoveEdition}
              onDelete={onDeleteEdition}
              activeId={activeId}
            />
          )
        })}
      </div>
      <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
        {activeCard ? <KanbanCardOverlay card={activeCard} /> : null}
      </DragOverlay>
    </DndContext>
  )
}
