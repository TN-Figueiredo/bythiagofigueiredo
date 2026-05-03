'use client'

import { useCallback, useId, useMemo, useOptimistic, useRef, useState, useTransition } from 'react'
import {
  DndContext,
  DragOverlay,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
  closestCorners,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { toast } from 'sonner'
import type { PostCard, BlogTag } from '../../_hub/hub-types'
import type { BlogHubStrings } from '../../_i18n/types'
import { mapStatusToColumn } from '../../_hub/hub-utils'
import { KanbanColumn } from './kanban-column'
import { KanbanCardOverlay } from './kanban-card'
import { ScheduleModal } from './schedule-modal'

const COLUMN_DEFS = [
  { id: 'idea', key: 'idea' as const, color: '#9ca3af' },
  { id: 'draft', key: 'draft' as const, color: '#6366f1' },
  { id: 'ready', key: 'ready' as const, color: '#06b6d4' },
  { id: 'scheduled', key: 'scheduled' as const, color: '#8b5cf6' },
  { id: 'published', key: 'published' as const, color: '#22c55e' },
] as const

const COLUMN_IDS: Set<string> = new Set(COLUMN_DEFS.map((c) => c.id))

const FALLBACK_TITLES: Record<string, string> = {
  idea: 'Idea',
  draft: 'Draft',
  ready: 'Ready',
  scheduled: 'Scheduled',
  published: 'Published',
}

// Map blog post status → kanban column id
function resolveColumn(id: string, posts: PostCard[]): string | null {
  if (COLUMN_IDS.has(id)) return id
  const card = posts.find((p) => p.id === id)
  return card ? mapStatusToColumn(card.status) : null
}

interface KanbanBoardProps {
  posts: PostCard[]
  onMovePost?: (postId: string, newStatus: string, scheduledFor?: string) => Promise<void>
  onDeletePost?: (postId: string) => Promise<void>
  onReassignTag?: (postId: string, tagId: string | null) => Promise<void>
  onAddLocale?: (postId: string, locale: string) => Promise<void>
  onDuplicate?: (postId: string) => Promise<void>
  onQuickAdd?: (title: string) => Promise<void>
  strings?: BlogHubStrings
  tags?: BlogTag[]
  supportedLocales?: string[]
}

export function KanbanBoard({
  posts,
  onMovePost,
  onDeletePost,
  onReassignTag,
  onAddLocale,
  onDuplicate,
  onQuickAdd,
  strings,
  tags,
  supportedLocales,
}: KanbanBoardProps) {
  const dndId = useId()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const [optimisticPosts, setOptimistic] = useOptimistic(posts)
  const [, startTransition] = useTransition()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [localPosts, setLocalPosts] = useState<PostCard[] | null>(null)
  const localPostsRef = useRef<PostCard[] | null>(null)
  const [pendingSchedule, setPendingSchedule] = useState<{ postId: string; postTitle: string } | null>(null)

  const working = localPosts ?? optimisticPosts
  const activeCard = activeId ? working.find((p) => p.id === activeId) ?? null : null

  // Bucket posts by column id (maps draft+pending_review → 'draft', ready+queued → 'ready', etc.)
  const columnCards = useMemo(() => {
    const map = new Map<string, PostCard[]>()
    for (const col of COLUMN_DEFS) map.set(col.id, [])
    for (const p of working) {
      const colId = mapStatusToColumn(p.status)
      const arr = map.get(colId)
      if (arr) arr.push(p)
    }
    return map
  }, [working])

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      setActiveId(event.active.id as string)
      const snapshot = [...optimisticPosts]
      setLocalPosts(snapshot)
      localPostsRef.current = snapshot
    },
    [optimisticPosts],
  )

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activePostId = active.id as string
    const overId = over.id as string

    setLocalPosts((prev) => {
      if (!prev) return prev
      const post = prev.find((p) => p.id === activePostId)
      if (!post) return prev

      const targetCol = resolveColumn(overId, prev)
      if (!targetCol) return prev

      const currentCol = mapStatusToColumn(post.status)

      let next: PostCard[]

      if (currentCol === targetCol) {
        if (COLUMN_IDS.has(overId)) return prev
        const colCards = prev.filter((p) => mapStatusToColumn(p.status) === targetCol)
        const oldIndex = colCards.findIndex((p) => p.id === activePostId)
        const newIndex = colCards.findIndex((p) => p.id === overId)
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return prev
        const reordered = arrayMove(colCards, oldIndex, newIndex)
        const others = prev.filter((p) => mapStatusToColumn(p.status) !== targetCol)
        next = [...others, ...reordered]
      } else {
        // Move post to a new column — update the status to the first canonical status of target column
        const targetStatus = targetCol as PostCard['status']
        const updated = prev.map((p) =>
          p.id === activePostId ? { ...p, status: targetStatus } : p,
        )
        if (!COLUMN_IDS.has(overId)) {
          const colCards = updated.filter((p) => mapStatusToColumn(p.status) === targetCol)
          const movedIdx = colCards.findIndex((p) => p.id === activePostId)
          const targetIdx = colCards.findIndex((p) => p.id === overId)
          if (movedIdx !== -1 && targetIdx !== -1 && movedIdx !== targetIdx) {
            const reordered = arrayMove(colCards, movedIdx, targetIdx)
            const others = updated.filter((p) => mapStatusToColumn(p.status) !== targetCol)
            next = [...others, ...reordered]
          } else {
            next = updated
          }
        } else {
          next = updated
        }
      }

      localPostsRef.current = next
      return next
    })
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active } = event
      setActiveId(null)

      const postId = active.id as string
      const currentLocal = localPostsRef.current
      const post = currentLocal?.find((p) => p.id === postId)
      const originalPost = optimisticPosts.find((p) => p.id === postId)

      setLocalPosts(null)
      localPostsRef.current = null

      if (!post || !originalPost) return

      const newCol = mapStatusToColumn(post.status)
      const origCol = mapStatusToColumn(originalPost.status)
      if (newCol === origCol) return

      // When dropping into 'scheduled', open the schedule modal instead of moving immediately
      if (newCol === 'scheduled') {
        setPendingSchedule({ postId, postTitle: post.title || 'Untitled' })
        return
      }

      const finalOrder = currentLocal!

      startTransition(async () => {
        setOptimistic(() =>
          finalOrder.map((p) => (p.id === postId ? { ...p, status: post.status } : p)),
        )
        try {
          await onMovePost?.(postId, post.status)
          toast.success(strings?.common.moved ?? 'Moved')
        } catch {
          toast.error(strings?.common.couldntMove ?? "Couldn't move")
        }
      })
    },
    [onMovePost, setOptimistic, startTransition, optimisticPosts, strings],
  )

  const handleDragCancel = useCallback(() => {
    setActiveId(null)
    setLocalPosts(null)
    localPostsRef.current = null
  }, [])

  const handleScheduleConfirm = useCallback((scheduledFor: string) => {
    if (!pendingSchedule) return
    const { postId } = pendingSchedule
    setPendingSchedule(null)
    startTransition(async () => {
      try {
        await onMovePost?.(postId, 'scheduled', scheduledFor)
        toast.success(strings?.common.moved ?? 'Moved')
      } catch {
        toast.error(strings?.common.couldntMove ?? "Couldn't move")
      }
    })
  }, [pendingSchedule, onMovePost, strings, startTransition])

  const handleScheduleCancel = useCallback(() => {
    setPendingSchedule(null)
  }, [])

  // Intercept 'scheduled' moves from context menu to open the modal instead
  const handleMoveToStatus = useCallback(async (postId: string, newStatus: string) => {
    if (newStatus === 'scheduled') {
      const card = working.find((p) => p.id === postId)
      setPendingSchedule({ postId, postTitle: card?.title ?? 'Untitled' })
      return
    }
    await onMovePost?.(postId, newStatus)
  }, [onMovePost, working])

  return (
    <>
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
              tags={tags}
              supportedLocales={supportedLocales}
              activeId={activeId}
              onMoveToStatus={handleMoveToStatus}
              onDelete={onDeletePost}
              onReassignTag={onReassignTag}
              onAddLocale={onAddLocale}
              onDuplicate={onDuplicate}
              onQuickAdd={col.id === 'idea' ? onQuickAdd : undefined}
            />
          )
        })}
      </div>
      <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
        {activeCard ? <KanbanCardOverlay card={activeCard} /> : null}
      </DragOverlay>
    </DndContext>
    <ScheduleModal
      isOpen={!!pendingSchedule}
      postTitle={pendingSchedule?.postTitle ?? ''}
      onConfirm={handleScheduleConfirm}
      onCancel={handleScheduleCancel}
      strings={strings}
    />
    </>
  )
}
