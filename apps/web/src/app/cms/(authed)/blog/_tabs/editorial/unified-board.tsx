'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState, KeyboardEvent } from 'react'
import {
  DndContext,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  type DragCancelEvent,
  type DropAnimation,
  closestCorners,
  PointerSensor,
  KeyboardSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { toast } from 'sonner'
import type { PipelineCardItem, LaneId } from '../../_hub/hub-types'
import type { BlogHubStrings } from '../../_i18n/types'
import {
  LANE_DEFS,
  buildUnifiedLanes,
  sortPipelineLane,
  resolveLaneFromOver,
  computeNewSortOrder,
  isEditableLane,
} from '../../_hub/hub-utils'
import { KanbanLane } from './kanban-lane'
import { PipelineCard, PipelineCardOverlay } from './pipeline-card'
import { PromotionModal } from './promotion-modal'
import { BulkActionBar } from './bulk-action-bar'

const DRAG_OVERLAY_ANIMATION: DropAnimation = { duration: 200, easing: 'ease' }
const PUBLISHED_PAGE_SIZE = 30

export interface ReorderResult {
  ok: boolean
  error?: string
  data?: { version: number; sort_order: number; stage: PipelineCardItem['stage'] }
}

interface UnifiedBoardProps {
  pipelineItems: PipelineCardItem[]
  strings?: BlogHubStrings
  supportedLocales: string[]
  defaultLocale: string
  siteTimezone: string
  siteId: string
  onReorderPipelineItem: (
    id: string,
    version: number,
    input: { stage?: string; sort_order: number },
  ) => Promise<ReorderResult>
  onPromote: (
    siteId: string,
    pipelineItemId: string,
    locale: string,
    scheduledFor?: string,
  ) => Promise<{ ok: boolean; postId?: string }>
  onBulkPublish: (postIds: string[]) => Promise<void>
  onBulkArchive: (postIds: string[]) => Promise<void>
  onBulkDelete: (postIds: string[]) => Promise<void>
}

export function UnifiedBoard({
  pipelineItems,
  strings,
  supportedLocales,
  defaultLocale,
  siteTimezone,
  siteId,
  onReorderPipelineItem,
  onPromote,
  onBulkPublish,
  onBulkArchive,
  onBulkDelete,
}: UnifiedBoardProps) {
  const dndId = useId()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  )

  // Local drag model (mirrors pipeline-board): optimistic during drag, resynced from
  // the server prop whenever it changes. Plain useState beats useOptimistic here because
  // onDragOver fires many times per drag and needs synchronous, mid-drag updates.
  const [localItems, setLocalItems] = useState<PipelineCardItem[]>(pipelineItems)
  useEffect(() => {
    setLocalItems(pipelineItems)
  }, [pipelineItems])

  const [activeId, setActiveId] = useState<string | null>(null)
  const snapshotRef = useRef<PipelineCardItem[]>([])
  const originLaneRef = useRef<LaneId | null>(null)

  const [promotionTarget, setPromotionTarget] = useState<PipelineCardItem | null>(null)
  const [promotionLoading, setPromotionLoading] = useState(false)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const [publishedPage, setPublishedPage] = useState(1)

  const { lanes, totalPublished } = useMemo(() => {
    const raw = buildUnifiedLanes(localItems)
    return {
      lanes: {
        idea: sortPipelineLane(raw.idea, 'idea'),
        draft: sortPipelineLane(raw.draft, 'draft'),
        ready: sortPipelineLane(raw.ready, 'ready'),
        scheduled: sortPipelineLane(raw.scheduled, 'scheduled'),
        published: sortPipelineLane(raw.published, 'published').slice(0, publishedPage * PUBLISHED_PAGE_SIZE),
      },
      totalPublished: raw.published.length,
    }
  }, [localItems, publishedPage])

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const id = String(event.active.id)
      setActiveId(id)
      snapshotRef.current = localItems
      originLaneRef.current = resolveLaneFromOver(id, lanes)
    },
    [localItems, lanes],
  )

  // Reparent the dragged card into the lane it's hovering, so it visually moves between
  // columns during the drag. Only editable lanes (idea/draft/ready) participate.
  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event
      if (!over) return
      const activeIdStr = String(active.id)
      const overId = String(over.id)
      if (activeIdStr === overId) return

      const fromLane = resolveLaneFromOver(activeIdStr, lanes)
      const toLane = resolveLaneFromOver(overId, lanes)
      if (!fromLane || !toLane || fromLane === toLane) return
      if (!isEditableLane(fromLane) || !isEditableLane(toLane)) return

      setLocalItems((prev) =>
        prev.map((i) => (i.id === activeIdStr ? { ...i, stage: toLane } : i)),
      )
    },
    [lanes],
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      setActiveId(null)

      const activeIdStr = String(active.id)
      const snapshot = snapshotRef.current
      const originLane = originLaneRef.current

      if (!over || !originLane) {
        setLocalItems(snapshot)
        return
      }

      const item = localItems.find((i) => i.id === activeIdStr)
      if (!item) {
        setLocalItems(snapshot)
        return
      }

      // Target lane: prefer the optimistic lane set by onDragOver, fall back to over.id.
      let toLane = resolveLaneFromOver(activeIdStr, lanes) ?? originLane
      if (toLane === originLane) {
        const overLane = resolveLaneFromOver(String(over.id), lanes)
        if (overLane) toLane = overLane
      }

      const laneChanged = toLane !== originLane

      // Read-only targets (scheduled/published) go through the publish flow, not DnD.
      if (!isEditableLane(toLane)) {
        setLocalItems(snapshot)
        if (toLane === 'published') {
          toast.error('Use o fluxo de publicação para mover para Publicado')
        } else if (toLane === 'scheduled') {
          toast.error('Use o fluxo de agendamento para mover para Agendado')
        } else {
          toast.error(strings?.common?.couldntMove ?? "Couldn't move")
        }
        return
      }
      // Cards from read-only lanes are not draggable, but fail closed just in case.
      if (!isEditableLane(originLane)) {
        setLocalItems(snapshot)
        return
      }

      const targetItems = lanes[toLane]
      const overId = String(over.id)
      const oldIndex = targetItems.findIndex((i) => i.id === activeIdStr)
      const newIndex = targetItems.findIndex((i) => i.id === overId)

      // No-op same-lane drop (released on itself / no real move).
      if (!laneChanged && (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex)) {
        return
      }

      const newSortOrder = computeNewSortOrder(targetItems, activeIdStr, overId)
      const snapshotItem = snapshot.find((i) => i.id === activeIdStr)
      if (!laneChanged && newSortOrder === (snapshotItem?.sort_order ?? item.sort_order)) {
        return
      }

      setLocalItems((prev) =>
        prev.map((i) =>
          i.id === activeIdStr ? { ...i, stage: toLane, sort_order: newSortOrder } : i,
        ),
      )

      onReorderPipelineItem(activeIdStr, snapshotItem?.version ?? item.version, {
        stage: laneChanged ? toLane : undefined,
        sort_order: newSortOrder,
      })
        .then((result) => {
          if (!result.ok) {
            setLocalItems(snapshotRef.current)
            toast.error(result.error ?? strings?.common?.couldntMove ?? "Couldn't move")
          } else if (result.data) {
            const data = result.data
            setLocalItems((prev) =>
              prev.map((i) =>
                i.id === activeIdStr
                  ? { ...i, version: data.version, sort_order: data.sort_order, stage: data.stage }
                  : i,
              ),
            )
          }
        })
        .catch(() => {
          setLocalItems(snapshotRef.current)
          toast.error(strings?.common?.couldntMove ?? "Couldn't move")
        })
    },
    [localItems, lanes, onReorderPipelineItem, strings],
  )

  const handleDragCancel = useCallback(() => {
    setActiveId(null)
    setLocalItems(snapshotRef.current)
  }, [])

  const boardRef = useRef<HTMLDivElement>(null)

  const handleBoardKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (!e.altKey) return
    const num = parseInt(e.key, 10)
    if (num < 1 || num > 5) return
    e.preventDefault()
    const laneIndex = num - 1
    const laneEl = boardRef.current?.querySelector<HTMLElement>(`[data-lane-index="${laneIndex}"]`)
    if (!laneEl) return
    const firstFocusable = laneEl.querySelector<HTMLElement>('a[href], button:not([disabled]), [tabindex="0"]')
    firstFocusable?.focus()
  }, [])

  const handlePromoteClick = useCallback(
    (itemId: string) => {
      const item = localItems.find((i) => i.id === itemId)
      if (item) setPromotionTarget(item)
    },
    [localItems],
  )

  const handlePromoteConfirm = useCallback(
    async (locale: string, scheduledFor?: string) => {
      if (!promotionTarget) return
      setPromotionLoading(true)
      try {
        const result = await onPromote(siteId, promotionTarget.id, locale, scheduledFor)
        if (result.ok) {
          setLocalItems((prev) => prev.filter((i) => i.id !== promotionTarget.id))
          toast.success(strings?.promotion?.promote ?? 'Promoted')
          setPromotionTarget(null)
        } else {
          toast.error(strings?.promotion?.promoteFailed ?? 'Failed to promote')
        }
      } catch {
        toast.error(strings?.promotion?.promoteFailed ?? 'Failed to promote')
      } finally {
        setPromotionLoading(false)
      }
    },
    [promotionTarget, siteId, onPromote, strings],
  )

  const activeItem = useMemo(
    () => (activeId ? localItems.find((i) => i.id === activeId) ?? null : null),
    [activeId, localItems],
  )

  const getItemTitle = useCallback(
    (id: string | number): string => {
      const sid = String(id)
      const item = localItems.find((i) => i.id === sid)
      return item?.title_pt ?? item?.title_en ?? (strings?.editorial?.untitled ?? 'Untitled')
    },
    [localItems, strings],
  )

  const getLaneTitle = useCallback(
    (id: string | number): string => {
      const sid = String(id)
      const laneDef = LANE_DEFS.find((l) => l.id === sid)
      if (laneDef) return strings?.lanes?.[laneDef.id] ?? laneDef.label
      const itemLane = resolveLaneFromOver(sid, lanes)
      if (itemLane) {
        const def = LANE_DEFS.find((l) => l.id === itemLane)
        return def ? (strings?.lanes?.[def.id] ?? def.label) : itemLane
      }
      return sid
    },
    [lanes, strings],
  )

  const announcements = useMemo(() => ({
    onDragStart({ active }: DragStartEvent) {
      const title = getItemTitle(active.id)
      const tpl = strings?.editorial?.dndPickedUp ?? 'Picked up {title}'
      return tpl.replace('{title}', title)
    },
    onDragOver({ active, over }: DragOverEvent) {
      if (!over) return ''
      const title = getItemTitle(active.id)
      const lane = getLaneTitle(over.id)
      const tpl = strings?.editorial?.dndMovingOver ?? 'Moving {title} over {lane}'
      return tpl.replace('{title}', title).replace('{lane}', lane)
    },
    onDragEnd({ active, over }: DragEndEvent) {
      const title = getItemTitle(active.id)
      if (!over) {
        const tpl = strings?.editorial?.dndCancelled ?? 'Cancelled moving {title}'
        return tpl.replace('{title}', title)
      }
      const lane = getLaneTitle(over.id)
      const tpl = strings?.editorial?.dndDropped ?? 'Dropped {title} into {lane}'
      return tpl.replace('{title}', title).replace('{lane}', lane)
    },
    onDragCancel({ active }: DragCancelEvent) {
      const title = getItemTitle(active.id)
      const tpl = strings?.editorial?.dndCancelled ?? 'Cancelled moving {title}'
      return tpl.replace('{title}', title)
    },
  }), [getItemTitle, getLaneTitle, strings])

  const handlePublishAll = useCallback(async () => {
    try {
      await onBulkPublish([...selectedIds])
    } catch {
      toast.error(strings?.common?.couldntMove ?? 'Operation failed')
    } finally {
      setSelectedIds(new Set())
    }
  }, [onBulkPublish, selectedIds, strings])

  const handleArchiveAll = useCallback(async () => {
    try {
      await onBulkArchive([...selectedIds])
    } catch {
      toast.error(strings?.common?.couldntMove ?? 'Operation failed')
    } finally {
      setSelectedIds(new Set())
    }
  }, [onBulkArchive, selectedIds, strings])

  const handleDeleteAll = useCallback(async () => {
    try {
      await onBulkDelete([...selectedIds])
    } catch {
      toast.error(strings?.common?.couldntMove ?? 'Operation failed')
    } finally {
      setSelectedIds(new Set())
    }
  }, [onBulkDelete, selectedIds, strings])

  return (
    <>
      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCorners}
        accessibility={{ announcements }}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div ref={boardRef} role="region" aria-label={strings?.tabs?.editorial ?? 'Blog editorial kanban'} aria-description={strings?.editorial?.laneShortcutHint ?? 'Alt+1 through Alt+5 to jump to lanes'} aria-busy={activeId !== null} tabIndex={0} onKeyDown={handleBoardKeyDown} className="flex gap-3 overflow-x-auto pb-4">
          <div className="flex gap-3">
            {LANE_DEFS.map((lane, idx) => {
              const items = lanes[lane.id]
              const itemIds = items.map((i) => i.id)
              const label = strings?.lanes?.[lane.id] ?? lane.label
              return (
                <div key={lane.id} className="flex">
                  <KanbanLane
                    id={lane.id}
                    index={idx}
                    title={label}
                    color={lane.color}
                    count={items.length}
                    droppable={true}
                    itemIds={itemIds}
                    emptyMessage={strings?.emptyLanes?.[lane.id]}
                    dropHereLabel={strings?.editorial?.dropHere ?? 'Drop here'}
                    itemsLabel={strings?.common?.posts ?? 'items'}
                    emptyCta={
                      lane.id === 'idea' ? (
                        <span className="rounded bg-amber-500/20 px-2 py-1 text-[9px] text-amber-400">
                          {strings?.emptyLanes?.newIdea ?? '+ New Idea'}
                        </span>
                      ) : undefined
                    }
                    paginationLabel={
                      lane.id === 'published' && totalPublished > lanes.published.length
                        ? `${lanes.published.length}/${totalPublished}`
                        : undefined
                    }
                    footer={
                      lane.id === 'published' && totalPublished > lanes.published.length ? (
                        <button
                          onClick={() => setPublishedPage((p) => p + 1)}
                          aria-label={`${strings?.common?.showMore ?? 'Show more'} (${lanes.published.length} of ${totalPublished})`}
                          className="text-[10px] text-indigo-400 hover:text-indigo-300"
                        >
                          {strings?.common?.showMore ?? 'Show more'} →
                        </button>
                      ) : undefined
                    }
                  >
                    {items.map((item) => (
                      <PipelineCard
                        key={item.id}
                        item={item}
                        laneId={lane.id}
                        strings={strings}
                        onPromote={handlePromoteClick}
                      />
                    ))}
                  </KanbanLane>
                </div>
              )
            })}
          </div>
        </div>

        <DragOverlay dropAnimation={DRAG_OVERLAY_ANIMATION}>
          {activeItem ? (
            <PipelineCardOverlay item={activeItem} strings={strings} />
          ) : null}
        </DragOverlay>
      </DndContext>

      <PromotionModal
        isOpen={!!promotionTarget}
        itemTitle={promotionTarget?.title_pt ?? promotionTarget?.title_en ?? (strings?.editorial?.untitled ?? 'Untitled')}
        itemCode={promotionTarget?.code ?? ''}
        supportedLocales={supportedLocales}
        defaultLocale={defaultLocale}
        siteTimezone={siteTimezone}
        strings={strings}
        onPromote={handlePromoteConfirm}
        onCancel={() => setPromotionTarget(null)}
        loading={promotionLoading}
      />

      <BulkActionBar
        count={selectedIds.size}
        cardType="pipeline"
        strings={strings}
        allInReady={[...selectedIds].every((id) => lanes.ready.some((i) => i.id === id))}
        onPublishAll={handlePublishAll}
        onArchiveAll={handleArchiveAll}
        onDeleteAll={handleDeleteAll}
        onClear={() => setSelectedIds(new Set())}
      />
    </>
  )
}
