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
import type { PostCard as PostCardType, PipelineCardItem, BlogTag, LaneId } from '../../_hub/hub-types'
import type { BlogHubStrings } from '../../_i18n/types'
import {
  LANE_DEFS,
  buildUnifiedLanes,
  sortPipelineLane,
  isEditableLane,
  isReadOnlyLane,
  isValidTransition,
} from '../../_hub/hub-utils'
import { KanbanLane } from './kanban-lane'
import { PipelineCard, PipelineCardOverlay } from './pipeline-card'
import { PromotionModal } from './promotion-modal'
import { BulkActionBar } from './bulk-action-bar'
import { ScheduleModal } from './schedule-modal'
import { ConfirmDialog } from './confirm-dialog'

const DRAG_OVERLAY_ANIMATION: DropAnimation = { duration: 200, easing: 'ease' }
const PUBLISHED_PAGE_SIZE = 30

interface UnifiedBoardProps {
  pipelineItems: PipelineCardItem[]
  posts: PostCardType[]
  strings?: BlogHubStrings
  tags?: BlogTag[]
  supportedLocales: string[]
  defaultLocale: string
  siteTimezone: string
  siteId: string
  onMovePipelineItem: (id: string, version: number, stage: string) => Promise<void>
  onMovePost: (postId: string, newStatus: string, scheduledFor?: string) => Promise<void>
  onDeletePost: (postId: string) => void
  onDuplicate: (postId: string) => Promise<void>
  onPromote: (
    siteId: string,
    pipelineItemId: string,
    locale: string,
    scheduledFor?: string,
  ) => Promise<{ ok: boolean; postId?: string }>
  onReturnToPipeline: (postId: string) => void
  onBulkPublish: (postIds: string[]) => Promise<void>
  onBulkArchive: (postIds: string[]) => Promise<void>
  onBulkDelete: (postIds: string[]) => Promise<void>
  pipelineProvenanceMap: Map<string, string>
}

type PipelineAction =
  | { type: 'move'; id: string; stage: 'idea' | 'draft' | 'ready' | 'archived' }
  | { type: 'remove'; id: string }

type PostAction =
  | { type: 'move'; id: string; status: PostCardType['status']; scheduledFor?: string }

export function UnifiedBoard({
  pipelineItems,
  posts,
  strings,
  tags,
  supportedLocales,
  defaultLocale,
  siteTimezone,
  siteId,
  onMovePipelineItem,
  onMovePost,
  onDeletePost,
  onDuplicate,
  onPromote,
  onReturnToPipeline,
  onBulkPublish,
  onBulkArchive,
  onBulkDelete,
  pipelineProvenanceMap,
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

  const [optPosts, dispatchPosts] = useOptimistic(
    posts,
    (state: PostCardType[], action: PostAction) => {
      if (action.type === 'move') {
        return state.map((p) =>
          p.id === action.id
            ? { ...p, status: action.status, ...(action.scheduledFor ? { scheduledFor: action.scheduledFor } : {}) }
            : p,
        )
      }
      return state
    },
  )

  const [isPending, startTransition] = useTransition()

  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeType, setActiveType] = useState<'pipeline' | 'post' | null>(null)

  const [promotionTarget, setPromotionTarget] = useState<PipelineCardItem | null>(null)
  const [promotionLoading, setPromotionLoading] = useState(false)

  const [scheduleTarget, setScheduleTarget] = useState<{ postId: string; title: string } | null>(null)
  const pendingScheduleRef = useRef<{ postId: string } | null>(null)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectionType, setSelectionType] = useState<'pipeline' | 'post' | null>(null)

  const [publishedPage, setPublishedPage] = useState(1)

  const [returnConfirmPostId, setReturnConfirmPostId] = useState<string | null>(null)
  const returnTriggerRef = useRef<string | null>(null)

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
      const id = String(event.active.id)
      setActiveId(id)
      const lane = findItemLane(id)
      setActiveType(lane && isEditableLane(lane) ? 'pipeline' : 'post')
    },
    [findItemLane],
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      setActiveId(null)
      setActiveType(null)

      if (!over) return

      const itemId = String(active.id)
      const fromLane = findItemLane(itemId)
      const toLane = resolveTargetLane(String(over.id))

      if (!fromLane || !toLane || fromLane === toLane) return

      if (isEditableLane(fromLane) && isReadOnlyLane(toLane)) {
        toast.error(strings?.editorial?.dndPromoteHint ?? "Use 'Promote to Blog' to create a post.")
        return
      }
      if (isReadOnlyLane(fromLane) && isEditableLane(toLane)) {
        toast.error(strings?.editorial?.dndReturnHint ?? "Use 'Return to Pipeline' from the card menu.")
        return
      }

      // Pipeline-to-pipeline move
      if (isEditableLane(fromLane) && isEditableLane(toLane)) {
        const item = optPipeline.find((i) => i.id === itemId)
        if (!item) return
        startTransition(async () => {
          dispatchPipeline({ type: 'move', id: itemId, stage: toLane })
          try {
            await onMovePipelineItem(itemId, item.version, toLane)
          } catch {
            toast.error(strings?.common?.couldntMove ?? "Couldn't move")
          }
        })
        return
      }

      // Blog-to-blog move
      if (isReadOnlyLane(fromLane) && isReadOnlyLane(toLane)) {
        const card = optPosts.find((p) => p.id === itemId)
        if (!card) return

        // Drag to scheduled lane → open schedule modal
        if (toLane === 'scheduled') {
          pendingScheduleRef.current = { postId: itemId }
          setScheduleTarget({ postId: itemId, title: card.title })
          return
        }

        const statusMap: Record<string, PostCardType['status']> = {
          draft: 'draft',
          published: 'published',
        }
        const targetStatus = statusMap[toLane]
        if (!targetStatus) return

        if (!isValidTransition(card.status, targetStatus)) {
          toast.error(strings?.editorial?.readyFirst ?? 'Invalid transition. Move to Ready first.')
          return
        }

        startTransition(async () => {
          dispatchPosts({ type: 'move', id: itemId, status: targetStatus })
          try {
            await onMovePost(itemId, targetStatus)
          } catch {
            toast.error(strings?.common?.couldntMove ?? "Couldn't move")
          }
        })
      }
    },
    [
      findItemLane,
      resolveTargetLane,
      optPipeline,
      optPosts,
      onMovePipelineItem,
      onMovePost,
      strings,
      startTransition,
      dispatchPipeline,
      dispatchPosts,
    ],
  )

  const handleDragCancel = useCallback(() => {
    setActiveId(null)
    setActiveType(null)
  }, [])

  const boardRef = useRef<HTMLDivElement>(null)

  const handleBoardKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (!e.altKey) return
    const num = parseInt(e.key, 10)
    if (num < 1 || num > 6) return
    e.preventDefault()
    const laneIndex = num - 1
    const laneEl = boardRef.current?.querySelector<HTMLElement>(`[data-lane-index="${laneIndex}"]`)
    if (!laneEl) return
    const firstFocusable = laneEl.querySelector<HTMLElement>('a[href], button:not([disabled]), [tabindex="0"]')
    firstFocusable?.focus()
  }, [])

  const handleScheduleConfirm = useCallback(
    (scheduledFor: string) => {
      const pending = pendingScheduleRef.current
      if (!pending) return
      const postId = pending.postId
      pendingScheduleRef.current = null
      setScheduleTarget(null)
      startTransition(async () => {
        dispatchPosts({ type: 'move', id: postId, status: 'scheduled', scheduledFor })
        try {
          await onMovePost(postId, 'scheduled', scheduledFor)
        } catch {
          toast.error(strings?.common?.couldntMove ?? "Couldn't move")
        }
      })
    },
    [onMovePost, strings, startTransition, dispatchPosts],
  )

  const handleScheduleCancel = useCallback(() => {
    pendingScheduleRef.current = null
    setScheduleTarget(null)
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

  const handleReturnToPipeline = useCallback(
    (postId: string) => {
      returnTriggerRef.current = postId
      setReturnConfirmPostId(postId)
    },
    [],
  )

  const handleReturnConfirm = useCallback(() => {
    const postId = returnTriggerRef.current
    setReturnConfirmPostId(null)
    if (!postId) return
    startTransition(async () => {
      try {
        await onReturnToPipeline(postId)
        toast.success(strings?.promotion?.returning ?? 'Returned')
      } catch {
        toast.error(strings?.promotion?.returnFailed ?? 'Failed')
      }
    })
  }, [onReturnToPipeline, strings, startTransition])

  const handleReturnCancel = useCallback(() => {
    returnTriggerRef.current = null
    setReturnConfirmPostId(null)
  }, [])

  const handleMovePostToStatus = useCallback(
    async (postId: string, newStatus: string) => {
      // Scheduling via menu → open schedule modal
      if (newStatus === 'scheduled') {
        const card = optPosts.find((p) => p.id === postId)
        if (card) {
          pendingScheduleRef.current = { postId }
          setScheduleTarget({ postId, title: card.title })
        }
        return
      }
      startTransition(async () => {
        dispatchPosts({ type: 'move', id: postId, status: newStatus as PostCardType['status'] })
        try {
          await onMovePost(postId, newStatus)
        } catch {
          toast.error(strings?.common?.couldntMove ?? "Couldn't move")
        }
      })
    },
    [onMovePost, optPosts, strings, startTransition, dispatchPosts],
  )

  const handleSelect = useCallback(
    (id: string, multi: boolean) => {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        if (multi) {
          if (next.has(id)) next.delete(id)
          else next.add(id)
        } else {
          next.clear()
          next.add(id)
        }
        return next
      })
      const lane = findItemLane(id)
      if (lane) {
        setSelectionType(isEditableLane(lane) ? 'pipeline' : 'post')
      }
    },
    [findItemLane],
  )

  const activeItem = useMemo(
    () =>
      activeId
        ? activeType === 'pipeline'
          ? optPipeline.find((i) => i.id === activeId)
          : optPosts.find((p) => p.id === activeId)
        : null,
    [activeId, activeType, optPipeline, optPosts],
  )

  const isInvalidDrop = useCallback(
    (targetLane: LaneId): boolean => {
      if (!activeType) return false
      if (activeType === 'pipeline' && isReadOnlyLane(targetLane)) return true
      if (activeType === 'post' && isEditableLane(targetLane)) return true
      return false
    },
    [activeType],
  )

  const getItemTitle = useCallback(
    (id: string | number): string => {
      const sid = String(id)
      const pipelineItem = optPipeline.find((i) => i.id === sid)
      if (pipelineItem) return pipelineItem.title_pt ?? pipelineItem.title_en ?? (strings?.editorial?.untitled ?? 'Untitled')
      const post = optPosts.find((p) => p.id === sid)
      return post?.title || (strings?.editorial?.untitled ?? 'Untitled')
    },
    [optPipeline, optPosts, strings],
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
      const fromLane = findItemLane(String(active.id))
      const toLane = resolveTargetLane(String(over.id))
      if (fromLane && toLane && fromLane !== toLane) {
        if (isEditableLane(fromLane) && isReadOnlyLane(toLane)) {
          return strings?.editorial?.dndInvalidPipelineToBlog ?? 'Cannot drop here. Use Promote to create a post.'
        }
        if (isReadOnlyLane(fromLane) && isEditableLane(toLane)) {
          return strings?.editorial?.dndInvalidBlogToPipeline ?? 'Cannot drop here. Use Return to Pipeline from the card menu.'
        }
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
  }), [getItemTitle, getLaneTitle, findItemLane, resolveTargetLane, strings])

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
        <div ref={boardRef} role="region" aria-label={strings?.tabs?.editorial ?? 'Blog editorial kanban'} aria-description={strings?.editorial?.laneShortcutHint ?? 'Alt+1 through Alt+6 to jump to lanes'} aria-busy={isPending} tabIndex={0} onKeyDown={handleBoardKeyDown} className="flex gap-3 overflow-x-auto pb-4">
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
                    isInvalidDrop={isInvalidDrop(lane.id)}
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
                    {items.filter((i): i is PipelineCardItem => 'stage' in i).map((item) => (
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
          {activeItem && 'stage' in activeItem ? (
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

      <ScheduleModal
        isOpen={!!scheduleTarget}
        postTitle={scheduleTarget?.title ?? ''}
        siteTimezone={siteTimezone}
        strings={strings}
        onConfirm={handleScheduleConfirm}
        onCancel={handleScheduleCancel}
      />

      <BulkActionBar
        count={selectedIds.size}
        cardType={selectionType ?? 'post'}
        strings={strings}
        allInReady={
          selectionType === 'pipeline' &&
          [...selectedIds].every((id) => lanes.ready.some((i) => i.id === id))
        }
        onPublishAll={handlePublishAll}
        onArchiveAll={handleArchiveAll}
        onDeleteAll={handleDeleteAll}
        onClear={() => setSelectedIds(new Set())}
      />

      {returnConfirmPostId !== null && (
        <ConfirmDialog
          title={strings?.promotion?.returnToPipeline ?? 'Return to Pipeline'}
          message={strings?.promotion?.returnConfirm ?? 'This will delete the blog post and return the item to the pipeline. Continue?'}
          confirmLabel={strings?.confirmDialog?.confirmReturn ?? 'Continue'}
          cancelLabel={strings?.confirmDialog?.cancel ?? 'Cancel'}
          onConfirm={handleReturnConfirm}
          onCancel={handleReturnCancel}
        />
      )}
    </>
  )
}
