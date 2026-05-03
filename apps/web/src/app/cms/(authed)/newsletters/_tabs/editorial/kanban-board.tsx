'use client'

import { useCallback, useId, useMemo, useOptimistic, useRef, useState, useTransition } from 'react'
import {
  DndContext, DragOverlay,
  type DragStartEvent, type DragOverEvent, type DragEndEvent,
  closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { toast } from 'sonner'
import type { EditionCard, NewsletterType } from '../../_hub/hub-types'
import type { NewsletterHubStrings } from '../../_i18n/types'
import { KanbanColumn } from './kanban-column'
import { KanbanCardOverlay } from './kanban-card'
import { SlotPickerModal, type CadenceSlotOption } from '../../_components/slot-picker-modal'
import { ScheduleModal } from '../../_components/schedule-modal'
import { getAvailableSlots, scheduleEditionToSlot, scheduleEditionAsSpecial } from '../../actions'

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

interface SlotPickerState {
  editionId: string
  displayId: string
  subject: string
  typeId: string
  typeName: string
  patternDescription: string
  slots: CadenceSlotOption[]
  hasMore: boolean
  loading: boolean
}

interface SpecialScheduleState {
  editionId: string
}

interface KanbanBoardProps {
  editions: EditionCard[]
  onMoveEdition?: (editionId: string, newStatus: string, scheduledFor?: string) => Promise<void>
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
  const [slotPickerState, setSlotPickerState] = useState<SlotPickerState | null>(null)
  const [specialScheduleState, setSpecialScheduleState] = useState<SpecialScheduleState | null>(null)

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

  // ─── Slot Picker Logic ──────────────────────────────────────────────────────

  const openSlotPicker = useCallback(async (edition: EditionCard) => {
    const typeId = edition.typeId
    if (!typeId) {
      // No type assigned — go straight to special schedule
      setSpecialScheduleState({ editionId: edition.id })
      return
    }

    const typeName = edition.typeName ?? ''
    const displayId = edition.displayId

    // Set loading state while fetching slots
    setSlotPickerState({
      editionId: edition.id,
      displayId,
      subject: edition.subject,
      typeId,
      typeName,
      patternDescription: '',
      slots: [],
      hasMore: false,
      loading: true,
    })

    const result = await getAvailableSlots(typeId)
    if (!result.ok) {
      // No cadence pattern or error — fallback to special schedule
      setSlotPickerState(null)
      setSpecialScheduleState({ editionId: edition.id })
      return
    }

    setSlotPickerState({
      editionId: edition.id,
      displayId,
      subject: edition.subject,
      typeId,
      typeName,
      patternDescription: result.patternDescription,
      slots: result.slots,
      hasMore: result.slots.length >= 20,
      loading: false,
    })
  }, [])

  const handleSlotConfirm = useCallback(async (date: string) => {
    if (!slotPickerState) return
    const { editionId, typeId } = slotPickerState
    setSlotPickerState(null)

    startTransition(async () => {
      setOptimistic((prev) =>
        prev.map((e) => (e.id === editionId ? { ...e, status: 'scheduled' as const } : e)),
      )
      const result = await scheduleEditionToSlot(editionId, date, typeId)
      if (result.ok) {
        toast.success(strings?.common.moved ?? 'Scheduled')
      } else if (result.error === 'slot_taken') {
        toast.error('Slot already taken — refreshing...')
        // Re-open with fresh slots
        const edition = editions.find((e) => e.id === editionId)
        if (edition) openSlotPicker(edition)
      } else {
        toast.error(result.error ?? "Couldn't schedule")
      }
    })
  }, [slotPickerState, editions, openSlotPicker, setOptimistic, startTransition, strings])

  const handleSlotLoadMore = useCallback(async () => {
    if (!slotPickerState) return
    const { typeId, slots } = slotPickerState

    setSlotPickerState((prev) => prev ? { ...prev, loading: true } : prev)

    const result = await getAvailableSlots(typeId, slots.length + 10)
    if (result.ok) {
      setSlotPickerState((prev) => prev ? {
        ...prev,
        slots: result.slots,
        hasMore: result.slots.length >= slots.length + 10,
        loading: false,
      } : prev)
    } else {
      setSlotPickerState((prev) => prev ? { ...prev, loading: false } : prev)
    }
  }, [slotPickerState])

  const handleSwitchToSpecial = useCallback(() => {
    if (!slotPickerState) return
    const { editionId } = slotPickerState
    setSlotPickerState(null)
    setSpecialScheduleState({ editionId })
  }, [slotPickerState])

  const handleSlotPickerCancel = useCallback(() => {
    setSlotPickerState(null)
  }, [])

  // ─── Special Schedule (ScheduleModal) Logic ─────────────────────────────────

  const handleSpecialScheduleConfirm = useCallback((scheduledAt: string) => {
    if (!specialScheduleState) return
    const { editionId } = specialScheduleState
    setSpecialScheduleState(null)

    startTransition(async () => {
      setOptimistic((prev) =>
        prev.map((e) => (e.id === editionId ? { ...e, status: 'scheduled' as const } : e)),
      )
      const result = await scheduleEditionAsSpecial(editionId, scheduledAt)
      if (result.ok) {
        toast.success(strings?.common.moved ?? 'Scheduled')
      } else {
        toast.error(result.error ?? "Couldn't schedule")
      }
    })
  }, [specialScheduleState, setOptimistic, startTransition, strings])

  const handleSpecialScheduleCancel = useCallback(() => {
    setSpecialScheduleState(null)
  }, [])

  // ─── DnD Handlers ──────────────────────────────────────────────────────────

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
    const { active, over } = event
    setActiveId(null)

    const editionId = active.id as string
    const currentLocal = localEditionsRef.current
    const edition = currentLocal?.find((e) => e.id === editionId)
    const originalEdition = optimisticEditions.find((e) => e.id === editionId)

    setLocalEditions(null)
    localEditionsRef.current = null

    if (!originalEdition) return

    // Determine target column: prefer the drag-over state (ref), fall back to event.over
    let targetColumn: EditionCard['status'] | null = null
    if (edition && edition.status !== originalEdition.status) {
      targetColumn = edition.status
    } else if (over) {
      const resolved = resolveColumn(over.id as string, optimisticEditions)
      if (resolved && resolved !== originalEdition.status) {
        targetColumn = resolved
      }
    }

    if (!targetColumn) return

    // Intercept drops to 'scheduled' — only from 'ready', show slot picker
    if (targetColumn === 'scheduled') {
      if (originalEdition.status !== 'ready') {
        toast.error('Move to Ready first')
        return
      }
      openSlotPicker(originalEdition)
      return
    }

    const finalOrder = currentLocal ?? optimisticEditions

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
  }, [onMoveEdition, setOptimistic, startTransition, optimisticEditions, strings, openSlotPicker])

  const handleDragCancel = useCallback(() => {
    setActiveId(null)
    setLocalEditions(null)
    localEditionsRef.current = null
  }, [])

  const handleMoveToStatus = useCallback(async (editionId: string, newStatus: string) => {
    if (newStatus === 'scheduled') {
      const edition = optimisticEditions.find((e) => e.id === editionId)
      if (edition && edition.status !== 'ready') {
        toast.error('Move to Ready first')
        return
      }
      if (edition) openSlotPicker(edition)
      return
    }
    startTransition(async () => {
      setOptimistic((prev) =>
        prev.map((e) => (e.id === editionId ? { ...e, status: newStatus as EditionCard['status'] } : e)),
      )
      try {
        await onMoveEdition?.(editionId, newStatus)
        toast.success(strings?.common.moved ?? 'Moved')
      } catch {
        toast.error(strings?.common.couldntMove ?? "Couldn't move")
      }
    })
  }, [onMoveEdition, optimisticEditions, setOptimistic, startTransition, strings, openSlotPicker])

  return (
    <>
      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCenter}
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
                hint={col.id === 'scheduled' ? 'Only ready editions' : undefined}
                cards={cards}
                strings={strings}
                types={types}
                onReassignType={onReassignType}
                onMoveToStatus={handleMoveToStatus}
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

      <SlotPickerModal
        open={!!slotPickerState && !slotPickerState.loading}
        editionDisplayId={slotPickerState?.displayId ?? ''}
        typeName={slotPickerState?.typeName ?? ''}
        patternDescription={slotPickerState?.patternDescription ?? ''}
        availableSlots={slotPickerState?.slots ?? []}
        hasMore={slotPickerState?.hasMore ?? false}
        onLoadMore={handleSlotLoadMore}
        onConfirmSlot={handleSlotConfirm}
        onSwitchToSpecial={handleSwitchToSpecial}
        onCancel={handleSlotPickerCancel}
        allSlotsFull={slotPickerState ? slotPickerState.slots.length === 0 && !slotPickerState.loading : false}
      />

      <ScheduleModal
        open={!!specialScheduleState}
        audienceCount={0}
        onConfirm={handleSpecialScheduleConfirm}
        onCancel={handleSpecialScheduleCancel}
      />
    </>
  )
}
