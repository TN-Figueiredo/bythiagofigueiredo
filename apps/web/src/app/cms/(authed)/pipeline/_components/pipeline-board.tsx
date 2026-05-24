'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  DndContext,
  closestCorners,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { toast } from 'sonner'
import { getPipelineStages } from '@/lib/pipeline/workflows'
import { GemCard, type GemCardItem } from './gem-card'
import { SortableGemCard } from './sortable-gem-card'
import { PipelineFilterBar } from './pipeline-filter-bar'
import { CreateItemModal } from './create-item-modal'
import { reorderPipelineItem } from '../actions'
import type { Format } from '@/lib/pipeline/schemas'

interface PipelineBoardProps {
  format: Format
  items: GemCardItem[]
  showCreate?: boolean
}

function isGraduated(item: GemCardItem): boolean {
  return !!(item.blog_post_id || item.youtube_video_id || item.newsletter_edition_id || item.campaign_id || item.social_post_id)
}

function findStageForItem(id: string, stages: string[], itemsByStage: Record<string, GemCardItem[]>): string | null {
  for (const stage of stages) {
    if (itemsByStage[stage]?.some((i) => i.id === id)) return stage
  }
  return null
}

function DroppableColumn({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id })
  return <div ref={setNodeRef} className="space-y-1.5 min-h-[48px]">{children}</div>
}

export function PipelineBoard({ format, items, showCreate }: PipelineBoardProps) {
  const stages = getPipelineStages(format)
  const stageKeys = stages.map((s) => s.stage)
  const searchParams = useSearchParams()
  const router = useRouter()

  const handlePromote = useCallback((itemId: string) => {
    router.push(`/cms/blog/new?pipelineId=${itemId}`)
  }, [router])

  const langFilter = searchParams.get('lang')
  const priorityFilter = searchParams.get('priority')
  const linkFilter = searchParams.get('link')

  const [localItems, setLocalItems] = useState(items)
  const [activeItem, setActiveItem] = useState<GemCardItem | null>(null)
  const [createOpen, setCreateOpen] = useState(showCreate ?? false)
  const snapshotRef = useRef<GemCardItem[]>([])
  const originStageRef = useRef<string>('')

  useEffect(() => {
    setLocalItems(items)
  }, [items])

  const filtered = localItems.filter((item) => {
    if (langFilter && item.language !== langFilter) return false
    if (priorityFilter && item.priority !== Number(priorityFilter)) return false
    if (linkFilter === 'linked' && !item.blog_post_id) return false
    if (linkFilter === 'unlinked' && item.blog_post_id) return false
    return true
  })

  const itemsByStage = useMemo(() => stages.reduce<Record<string, GemCardItem[]>>((acc, stage) => {
    acc[stage.stage] = filtered
      .filter((i) => i.stage === stage.stage)
      .sort((a, b) => a.sort_order - b.sort_order)
    return acc
  }, {}), [stages, filtered])

  const hasActiveFilters = !!(langFilter || priorityFilter || linkFilter)
  const noResults = filtered.length === 0 && hasActiveFilters

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const item = localItems.find((i) => i.id === event.active.id)
    if (item) {
      setActiveItem(item)
      snapshotRef.current = localItems
      originStageRef.current = item.stage
    }
  }, [localItems])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string
    if (activeId === overId) return

    const activeStage = findStageForItem(activeId, stageKeys, itemsByStage)
    let overStage = findStageForItem(overId, stageKeys, itemsByStage)

    if (!overStage && stageKeys.includes(overId)) {
      overStage = overId
    }

    if (!activeStage || !overStage || activeStage === overStage) return

    setLocalItems((prev) =>
      prev.map((item) => (item.id === activeId ? { ...item, stage: overStage } : item))
    )
  }, [stageKeys, itemsByStage])

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveItem(null)

    if (!over) {
      setLocalItems(snapshotRef.current)
      return
    }

    const activeId = active.id as string
    const overId = over.id as string
    if (activeId === overId) return

    const item = localItems.find((i) => i.id === activeId)
    if (!item) return

    let targetStage = findStageForItem(activeId, stageKeys, itemsByStage) ?? item.stage
    if (targetStage === originStageRef.current) {
      const overStage = findStageForItem(overId, stageKeys, itemsByStage)
        ?? (stageKeys.includes(overId) ? overId : null)
      if (overStage) targetStage = overStage
    }

    if (targetStage === 'published' && !isGraduated(item)) {
      setLocalItems(snapshotRef.current)
      toast.error('Vincule a um post antes de mover para Publicado')
      return
    }

    const stageChanged = targetStage !== originStageRef.current
    const targetItems = itemsByStage[targetStage] ?? []
    const oldIndex = targetItems.findIndex((i) => i.id === activeId)
    const newIndex = targetItems.findIndex((i) => i.id === overId)

    if (!stageChanged && (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex)) {
      return
    }

    const reordered = oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex
      ? arrayMove(targetItems, oldIndex, newIndex)
      : targetItems
    const movedIdx = newIndex !== -1 ? newIndex : reordered.findIndex((i) => i.id === activeId)

    let newSortOrder: number
    if (reordered.length <= 1 || movedIdx === -1) {
      const existingItems = targetItems.filter((i) => i.id !== activeId)
      const lastItem = existingItems[existingItems.length - 1]
      newSortOrder = lastItem ? lastItem.sort_order + 1000 : 1000
    } else {
      const prev = movedIdx > 0 ? reordered[movedIdx - 1] : null
      const next = movedIdx < reordered.length - 1 ? reordered[movedIdx + 1] : null
      if (!prev) newSortOrder = (next!.sort_order) - 1000
      else if (!next) newSortOrder = prev.sort_order + 1000
      else newSortOrder = Math.floor((prev.sort_order + next.sort_order) / 2)
    }

    const snapshotItem = snapshotRef.current.find((i) => i.id === activeId)
    if (!stageChanged && newSortOrder === (snapshotItem?.sort_order ?? item.sort_order)) return

    setLocalItems((prev) =>
      prev.map((i) =>
        i.id === activeId
          ? { ...i, stage: targetStage, sort_order: newSortOrder }
          : i
      )
    )

    const result = await reorderPipelineItem(item.id, snapshotItem?.version ?? item.version, {
      stage: stageChanged ? targetStage : undefined,
      sort_order: newSortOrder,
    })

    if (!result.ok) {
      setLocalItems(snapshotRef.current)
      toast.error(result.error)
    } else if (result.ok && result.data) {
      setLocalItems((prev) =>
        prev.map((i) =>
          i.id === activeId
            ? { ...i, version: result.data.version, sort_order: result.data.sort_order, stage: result.data.stage }
            : i
        )
      )
    }
  }, [localItems, stageKeys, itemsByStage])

  const handleDragCancel = useCallback(() => {
    setLocalItems(snapshotRef.current)
    setActiveItem(null)
  }, [])

  const announcements = {
    onDragStart: ({ active }: DragStartEvent) =>
      `Arrastando ${localItems.find((i) => i.id === active.id)?.title_pt || 'item'}`,
    onDragOver: () => '',
    onDragEnd: ({ active, over }: DragEndEvent) => {
      const found = localItems.find((i) => i.id === active.id)
      return over ? `${found?.title_pt || 'Item'} movido` : 'Arrasto cancelado'
    },
    onDragCancel: () => 'Arrasto cancelado',
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <PipelineFilterBar />
        <button
          onClick={() => setCreateOpen(true)}
          className="text-xs px-3 py-1.5 rounded-lg shrink-0 transition-opacity hover:opacity-80"
          style={{ backgroundColor: 'var(--gem-accent)', color: 'white' }}
        >
          + New item
        </button>
      </div>
      {noResults && (
        <div className="rounded-lg border p-8 text-center mb-4" style={{ backgroundColor: 'var(--gem-surface)', borderColor: 'var(--gem-border)' }}>
          <p className="text-sm mb-1" style={{ color: 'var(--gem-muted)' }}>Nenhum item corresponde aos filtros aplicados.</p>
          <p className="text-xs" style={{ color: 'var(--gem-dim)' }}>{localItems.length} items total neste formato</p>
        </div>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
        accessibility={{ announcements }}
      >
        <div className="flex gap-3 overflow-x-auto pb-4 min-h-[calc(100vh-14rem)]">
          {stages.map((stage, idx) => {
            const stageColors = ['var(--gem-accent, #6366f1)', 'var(--gem-purple, #8b5cf6)', 'var(--gem-sky, #0ea5e9)', '#06b6d4', 'var(--gem-done, #10b981)', '#22c55e', '#84cc16']
            const stageAccent = stageColors[idx % stageColors.length]
            const stageItems = itemsByStage[stage.stage] ?? []
            return (
              <div key={stage.stage} className="flex-1 min-w-[260px]">
                <div className="sticky top-0 pb-2 z-10" style={{ backgroundColor: 'var(--gem-well)' }}>
                  <div className="flex items-center justify-between px-2 py-1.5 rounded-lg" style={{ backgroundColor: 'var(--gem-surface)', borderLeft: `3px solid ${stageAccent}` }}>
                    <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--gem-muted)' }}>{stage.label_pt}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--gem-border)', color: 'var(--gem-dim)' }}>
                      {stageItems.length}
                    </span>
                  </div>
                </div>
                <SortableContext
                  items={stageItems.map((i) => i.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <DroppableColumn id={stage.stage}>
                    {stageItems.map((item) => (
                      <SortableGemCard
                        key={item.id}
                        item={item}
                        onPromote={stage.stage === 'ready' ? handlePromote : undefined}
                      />
                    ))}
                    {stageItems.length === 0 && (
                      <p className="text-[10px] text-center py-8" style={{ color: 'var(--gem-faint)' }}>Nenhum em {stage.label_pt}</p>
                    )}
                  </DroppableColumn>
                </SortableContext>
              </div>
            )
          })}
        </div>
        <DragOverlay>
          {activeItem ? (
            <div className="opacity-85 scale-[1.02] shadow-2xl">
              <GemCard item={activeItem} isDragging />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      <CreateItemModal
        format={format}
        open={createOpen}
        onClose={() => {
          setCreateOpen(false)
          router.replace(`/cms/pipeline/${format}`, { scroll: false })
        }}
      />
    </div>
  )
}
