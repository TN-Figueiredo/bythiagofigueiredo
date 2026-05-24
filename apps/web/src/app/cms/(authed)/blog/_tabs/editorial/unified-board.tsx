'use client'

import { useCallback, useId, useMemo, useOptimistic, useRef, useState, useTransition, KeyboardEvent } from 'react'
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
} from '../../_hub/hub-utils'
import { KanbanLane } from './kanban-lane'
import { PipelineCard, PipelineCardOverlay } from './pipeline-card'
import { PromotionModal } from './promotion-modal'
import { BulkActionBar } from './bulk-action-bar'

const DRAG_OVERLAY_ANIMATION: DropAnimation = { duration: 200, easing: 'ease' }
const PUBLISHED_PAGE_SIZE = 30
/** Lanes that accept cards dropped via DnD. `scheduled` and `published` are publish-flow only. */
const DND_VALID_TARGETS = new Set(['idea', 'draft', 'ready'])

interface UnifiedBoardProps {
  pipelineItems: PipelineCardItem[]
  strings?: BlogHubStrings
  supportedLocales: string[]
  defaultLocale: string
  siteTimezone: string
  siteId: string
  onMovePipelineItem: (id: string, version: number, stage: string) => Promise<boolean>
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

type PipelineAction =
  | { type: 'move'; id: string; stage: 'idea' | 'draft' | 'ready' | 'scheduled' | 'published' | 'archived' }
  | { type: 'remove'; id: string }

export function UnifiedBoard({
  pipelineItems,
  strings,
  supportedLocales,
  defaultLocale,
  siteTimezone,
  siteId,
  onMovePipelineItem,
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

  const [optPipeline, dispatchPipeline] = useOptimistic(
    pipelineItems,
    (state: PipelineCardItem[], action: PipelineAction) => {
      if (action.type === 'move') {
        return state.map((i) => i.id === action.id ? { ...i, stage: action.stage } : i)
      }
      if (action.type === 'remove') {
        return state.filter((i) => i.id !== action.id)
      }
      return state
    },
  )

  const [isPending, startTransition] = useTransition()

  const [activeId, setActiveId] = useState<string | null>(null)

  const [promotionTarget, setPromotionTarget] = useState<PipelineCardItem | null>(null)
  const [promotionLoading, setPromotionLoading] = useState(false)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const [publishedPage, setPublishedPage] = useState(1)

  const { lanes, totalPublished } = useMemo(() => {
    const raw = buildUnifiedLanes(optPipeline)
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
  }, [optPipeline, publishedPage])

  const itemLaneMap = useMemo(() => {
    const map = new Map<string, LaneId>()
    for (const [laneId, items] of Object.entries(lanes)) {
      for (const item of items) {
        map.set(item.id, laneId as LaneId)
      }
    }
    return map
  }, [lanes])

  const findItemLane = useCallback(
    (itemId: string): LaneId | null => {
      return itemLaneMap.get(itemId) ?? null
    },
    [itemLaneMap],
  )

  const resolveTargetLane = useCallback(
    (overId: string): LaneId | null => {
      const laneDef = LANE_DEFS.find((l) => l.id === overId)
      if (laneDef) return laneDef.id
      return findItemLane(overId)
    },
    [findItemLane],
  )

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      setActiveId(String(event.active.id))
    },
    [],
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      setActiveId(null)

      if (!over) return

      const itemId = String(active.id)
      const fromLane = findItemLane(itemId)
      const toLane = resolveTargetLane(String(over.id))

      if (!fromLane || !toLane || fromLane === toLane) return

      // Bug 1: guard against invalid DnD targets (scheduled/published are publish-flow only)
      if (!DND_VALID_TARGETS.has(toLane)) {
        if (toLane === 'published') {
          toast.error('Use o fluxo de publicação para mover para Publicado')
        } else if (toLane === 'scheduled') {
          toast.error('Use o fluxo de agendamento para mover para Agendado')
        } else {
          toast.error(strings?.common?.couldntMove ?? "Couldn't move")
        }
        return
      }

      const item = optPipeline.find((i) => i.id === itemId)
      if (!item) return

      startTransition(() => {
        dispatchPipeline({ type: 'move', id: itemId, stage: toLane })
      })
      onMovePipelineItem(itemId, item.version, toLane).then((ok) => {
        if (!ok) {
          toast.error(strings?.common?.couldntMove ?? "Couldn't move")
          // router.refresh() is already called by the parent on failure, which resets optimistic state
        }
      }).catch(() => {
        toast.error(strings?.common?.couldntMove ?? "Couldn't move")
      })
    },
    [
      findItemLane,
      resolveTargetLane,
      optPipeline,
      onMovePipelineItem,
      strings,
      dispatchPipeline,
    ],
  )

  const handleDragCancel = useCallback(() => {
    setActiveId(null)
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
      const item = optPipeline.find((i) => i.id === itemId)
      if (item) setPromotionTarget(item)
    },
    [optPipeline],
  )

  const handlePromoteConfirm = useCallback(
    async (locale: string, scheduledFor?: string) => {
      if (!promotionTarget) return
      setPromotionLoading(true)
      try {
        const result = await onPromote(siteId, promotionTarget.id, locale, scheduledFor)
        if (result.ok) {
          startTransition(() => {
            dispatchPipeline({ type: 'remove', id: promotionTarget.id })
          })
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
    [promotionTarget, siteId, onPromote, strings, startTransition, dispatchPipeline],
  )

  const activeItem = useMemo(
    () => activeId ? optPipeline.find((i) => i.id === activeId) ?? null : null,
    [activeId, optPipeline],
  )

  const getItemTitle = useCallback(
    (id: string | number): string => {
      const sid = String(id)
      const item = optPipeline.find((i) => i.id === sid)
      return item?.title_pt ?? item?.title_en ?? (strings?.editorial?.untitled ?? 'Untitled')
    },
    [optPipeline, strings],
  )

  const getLaneTitle = useCallback(
    (id: string | number): string => {
      const sid = String(id)
      const laneDef = LANE_DEFS.find((l) => l.id === sid)
      if (laneDef) return strings?.lanes?.[laneDef.id] ?? laneDef.label
      const itemLane = findItemLane(sid)
      if (itemLane) {
        const def = LANE_DEFS.find((l) => l.id === itemLane)
        return def ? (strings?.lanes?.[def.id] ?? def.label) : itemLane
      }
      return sid
    },
    [findItemLane, strings],
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
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div ref={boardRef} role="region" aria-label={strings?.tabs?.editorial ?? 'Blog editorial kanban'} aria-description={strings?.editorial?.laneShortcutHint ?? 'Alt+1 through Alt+5 to jump to lanes'} aria-busy={isPending} tabIndex={0} onKeyDown={handleBoardKeyDown} className="flex gap-3 overflow-x-auto pb-4">
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
