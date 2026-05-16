'use client'

import { useCallback, useId, useMemo, useOptimistic, useRef, useState, useTransition } from 'react'
import {
  DndContext,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
  closestCorners,
  PointerSensor,
  KeyboardSensor,
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
  sortBlogLane,
  isPipelineLane,
  isBlogLane,
  isValidTransition,
} from '../../_hub/hub-utils'
import { KanbanLane } from './kanban-lane'
import { PipelineCard, PipelineCardOverlay } from './pipeline-card'
import { PostCard, PostCardOverlay } from './post-card'
import { PromotionModal } from './promotion-modal'
import { BulkActionBar } from './bulk-action-bar'
import { ScheduleModal } from './schedule-modal'

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
  onReorderPipelineItem: (id: string, version: number, data: { stage?: string; sort_order: number }) => Promise<void>
  onMovePost: (postId: string, newStatus: string, scheduledFor?: string) => Promise<void>
  onDeletePost: (postId: string) => Promise<void>
  onDuplicate: (postId: string) => Promise<void>
  onPromote: (
    siteId: string,
    pipelineItemId: string,
    locale: string,
    scheduledFor?: string,
  ) => Promise<{ ok: boolean; postId?: string }>
  onReturnToPipeline: (postId: string) => Promise<void>
  onBulkPublish: (postIds: string[]) => Promise<void>
  onBulkArchive: (postIds: string[]) => Promise<void>
  onBulkDelete: (postIds: string[]) => Promise<void>
  pipelineProvenanceMap: Map<string, string>
}

type PipelineAction =
  | { type: 'move'; id: string; stage: string }

type PostAction =
  | { type: 'move'; id: string; status: PostCardType['status'] }

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
  )

  const [optPipeline, dispatchPipeline] = useOptimistic(
    pipelineItems,
    (state: PipelineCardItem[], action: PipelineAction) => {
      if (action.type === 'move') {
        return state.map((i) => i.id === action.id ? { ...i, stage: action.stage } : i)
      }
      return state
    },
  )

  const [optPosts, dispatchPosts] = useOptimistic(
    posts,
    (state: PostCardType[], action: PostAction) => {
      if (action.type === 'move') {
        return state.map((p) => p.id === action.id ? { ...p, status: action.status } : p)
      }
      return state
    },
  )

  const [, startTransition] = useTransition()

  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeType, setActiveType] = useState<'pipeline' | 'post' | null>(null)

  const [promotionTarget, setPromotionTarget] = useState<PipelineCardItem | null>(null)
  const [promotionLoading, setPromotionLoading] = useState(false)

  // Schedule modal — for drag-to-scheduled
  const [scheduleTarget, setScheduleTarget] = useState<{ postId: string; title: string } | null>(null)
  const pendingScheduleRef = useRef<{ postId: string } | null>(null)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectionType, setSelectionType] = useState<'pipeline' | 'post' | null>(null)

  const [publishedPage, setPublishedPage] = useState(1)
  const PUBLISHED_PAGE_SIZE = 30

  const lanes = useMemo(() => {
    const raw = buildUnifiedLanes(optPipeline, optPosts)
    return {
      idea: sortPipelineLane(raw.idea, 'idea'),
      draft: sortPipelineLane(raw.draft, 'draft'),
      ready: sortPipelineLane(raw.ready, 'ready'),
      editing: sortBlogLane(raw.editing, 'editing'),
      scheduled: sortBlogLane(raw.scheduled, 'scheduled'),
      published: sortBlogLane(raw.published, 'published').slice(0, publishedPage * PUBLISHED_PAGE_SIZE),
    }
  }, [optPipeline, optPosts, publishedPage])

  const totalPublished = useMemo(
    () => optPosts.filter((p) => p.status === 'published').length,
    [optPosts],
  )

  const findItemLane = useCallback(
    (itemId: string): LaneId | null => {
      for (const [laneId, items] of Object.entries(lanes)) {
        if ((items as Array<{ id: string }>).some((i) => i.id === itemId)) return laneId as LaneId
      }
      return null
    },
    [lanes],
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
      const id = event.active.id as string
      setActiveId(id)
      const lane = findItemLane(id)
      setActiveType(lane && isPipelineLane(lane) ? 'pipeline' : 'post')
    },
    [findItemLane],
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      setActiveId(null)
      setActiveType(null)

      if (!over) return

      const itemId = active.id as string
      const fromLane = findItemLane(itemId)
      const toLane = resolveTargetLane(over.id as string)

      if (!fromLane || !toLane || fromLane === toLane) return

      // Block cross-boundary drags
      if (isPipelineLane(fromLane) && isBlogLane(toLane)) {
        toast.error(
          strings?.pipeline?.promoteToPost
            ? `Use '${strings.pipeline.promoteToPost}' para criar um post.`
            : "Use 'Promover' para criar um post.",
        )
        return
      }
      if (isBlogLane(fromLane) && isPipelineLane(toLane)) {
        toast.error(
          strings?.promotion?.returnToPipeline
            ? `Use '${strings.promotion.returnToPipeline}' no menu do card.`
            : "Use 'Devolver ao Pipeline' no menu do card.",
        )
        return
      }

      // Pipeline-to-pipeline move
      if (isPipelineLane(fromLane) && isPipelineLane(toLane)) {
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
      if (isBlogLane(fromLane) && isBlogLane(toLane)) {
        const card = optPosts.find((p) => p.id === itemId)
        if (!card) return

        // Drag to scheduled lane → open schedule modal
        if (toLane === 'scheduled') {
          pendingScheduleRef.current = { postId: itemId }
          setScheduleTarget({ postId: itemId, title: card.title })
          return
        }

        const statusMap: Record<string, PostCardType['status']> = {
          editing: card.status,
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

  // Schedule modal confirm
  const handleScheduleConfirm = useCallback(
    (scheduledFor: string) => {
      const pending = pendingScheduleRef.current
      if (!pending) return
      const postId = pending.postId
      pendingScheduleRef.current = null
      setScheduleTarget(null)
      startTransition(async () => {
        dispatchPosts({ type: 'move', id: postId, status: 'scheduled' })
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

  // Promotion
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

  // Return to pipeline
  const handleReturnToPipeline = useCallback(
    async (postId: string) => {
      if (!window.confirm(strings?.promotion?.returnConfirm ?? 'Return to pipeline?')) return
      startTransition(async () => {
        try {
          await onReturnToPipeline(postId)
          toast.success(strings?.promotion?.returning ?? 'Returned')
        } catch {
          toast.error(strings?.promotion?.returnFailed ?? 'Failed')
        }
      })
    },
    [onReturnToPipeline, strings, startTransition],
  )

  // Post context menu move
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
        try {
          await onMovePost(postId, newStatus)
        } catch {
          toast.error(strings?.common?.couldntMove ?? "Couldn't move")
        }
      })
    },
    [onMovePost, optPosts, strings, startTransition],
  )

  // Selection
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
        setSelectionType(isPipelineLane(lane) ? 'pipeline' : 'post')
      }
    },
    [findItemLane],
  )

  // Active overlay item
  const activeItem = activeId
    ? activeType === 'pipeline'
      ? optPipeline.find((i) => i.id === activeId)
      : optPosts.find((p) => p.id === activeId)
    : null

  const isInvalidDrop = useCallback(
    (targetLane: LaneId): boolean => {
      if (!activeType) return false
      if (activeType === 'pipeline' && isBlogLane(targetLane)) return true
      if (activeType === 'post' && isPipelineLane(targetLane)) return true
      return false
    },
    [activeType],
  )

  return (
    <>
      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div role="grid" aria-label="Blog editorial kanban" className="flex gap-3 overflow-x-auto pb-4">
          <div role="row" className="flex gap-3">
            {LANE_DEFS.map((lane, idx) => {
              const items = lanes[lane.id]
              const itemIds = (items as Array<{ id: string }>).map((i) => i.id)
              const label = strings?.lanes?.[lane.id] ?? lane.label
              const showBoundary = idx === 3

              return (
                <div key={lane.id} className="flex">
                  {/* Promotion boundary */}
                  {showBoundary && (
                    <div className="flex flex-col items-center justify-center px-2" aria-hidden="true">
                      <div className="h-full w-[2px] bg-indigo-500/30" />
                      <span className="my-2 -rotate-90 whitespace-nowrap text-[8px] font-medium tracking-wider text-indigo-400/50">
                        Publicação →
                      </span>
                      <div className="h-full w-[2px] bg-indigo-500/30" />
                    </div>
                  )}

                  <KanbanLane
                    id={lane.id}
                    title={label}
                    color={lane.color}
                    count={items.length}
                    droppable={true}
                    itemIds={itemIds}
                    emptyMessage={strings?.emptyLanes?.[lane.id]}
                    emptyCta={
                      lane.id === 'idea' ? (
                        <button className="rounded bg-amber-500/20 px-2 py-1 text-[9px] text-amber-400 hover:bg-amber-500/30">
                          {strings?.emptyLanes?.newIdea ?? '+ Nova Ideia'}
                        </button>
                      ) : lane.id === 'editing' ? (
                        <a
                          href="/cms/blog/new"
                          className="rounded bg-blue-500/20 px-2 py-1 text-[9px] text-blue-400 hover:bg-blue-500/30"
                        >
                          {strings?.emptyLanes?.newPost ?? '+ Novo Post'}
                        </a>
                      ) : undefined
                    }
                    isInvalidDrop={isInvalidDrop(lane.id)}
                    paginationLabel={
                      lane.id === 'published' && totalPublished > lanes.published.length
                        ? `${lanes.published.length} de ${totalPublished}`
                        : undefined
                    }
                    footer={
                      lane.id === 'published' && totalPublished > lanes.published.length ? (
                        <button
                          onClick={() => setPublishedPage((p) => p + 1)}
                          className="text-[10px] text-indigo-400 hover:text-indigo-300"
                        >
                          Mostrar mais →
                        </button>
                      ) : undefined
                    }
                  >
                    {isPipelineLane(lane.id)
                      ? (items as PipelineCardItem[]).map((item) => (
                          <PipelineCard
                            key={item.id}
                            item={item}
                            laneId={lane.id as 'idea' | 'draft' | 'ready'}
                            strings={strings}
                            onPromote={handlePromoteClick}
                          />
                        ))
                      : (items as PostCardType[]).map((card) => (
                          <PostCard
                            key={card.id}
                            card={card}
                            laneId={lane.id as 'editing' | 'scheduled' | 'published'}
                            showSubstatus={lane.id === 'editing'}
                            pipelineCode={pipelineProvenanceMap.get(card.id) ?? null}
                            strings={strings}
                            tags={tags}
                            onMoveToStatus={handleMovePostToStatus}
                            onDelete={onDeletePost}
                            onDuplicate={onDuplicate}
                            onReturnToPipeline={handleReturnToPipeline}
                            selected={selectedIds.has(card.id)}
                            onSelect={handleSelect}
                          />
                        ))}
                  </KanbanLane>
                </div>
              )
            })}
          </div>
        </div>

        <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
          {activeItem && activeType === 'pipeline' ? (
            <PipelineCardOverlay item={activeItem as PipelineCardItem} />
          ) : activeItem && activeType === 'post' ? (
            <PostCardOverlay card={activeItem as PostCardType} />
          ) : null}
        </DragOverlay>
      </DndContext>

      <PromotionModal
        isOpen={!!promotionTarget}
        itemTitle={promotionTarget?.title_pt ?? promotionTarget?.title_en ?? 'Untitled'}
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
        onPublishAll={() => {
          void onBulkPublish([...selectedIds])
          setSelectedIds(new Set())
        }}
        onArchiveAll={() => {
          void onBulkArchive([...selectedIds])
          setSelectedIds(new Set())
        }}
        onDeleteAll={() => {
          void onBulkDelete([...selectedIds])
          setSelectedIds(new Set())
        }}
        onClear={() => setSelectedIds(new Set())}
      />
    </>
  )
}
