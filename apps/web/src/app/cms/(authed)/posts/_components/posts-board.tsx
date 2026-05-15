'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  DndContext,
  closestCorners,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable'
import { PostCard, type PostBoardItem } from './post-card'
import { SortablePostCard } from './sortable-post-card'
import { POST_STAGES } from '@/lib/posts/types'

interface PostsBoardProps {
  items: PostBoardItem[]
}

const COLUMN_COLORS = ['#818cf8', '#8b5cf6', '#22c55e']

export function PostsBoard({ items }: PostsBoardProps) {
  const [localItems, setLocalItems] = useState(items)
  const [activeItem, setActiveItem] = useState<PostBoardItem | null>(null)

  useEffect(() => { setLocalItems(items) }, [items])

  const itemsByStage = POST_STAGES.reduce<Record<string, PostBoardItem[]>>((acc, stage) => {
    acc[stage.dbStatus] = localItems
      .filter(i => i.status === stage.dbStatus)
      .sort((a, b) => a.sortOrder - b.sortOrder)
    return acc
  }, {})

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const item = localItems.find(i => i.id === event.active.id)
    if (item) setActiveItem(item)
  }, [localItems])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveItem(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    setLocalItems(prev => {
      const oldIndex = prev.findIndex(i => i.id === active.id)
      const newIndex = prev.findIndex(i => i.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return prev
      return arrayMove(prev, oldIndex, newIndex)
    })
  }, [])

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-4 min-h-[calc(100vh-14rem)]">
        {POST_STAGES.map((stage, idx) => {
          const stageItems = itemsByStage[stage.dbStatus] ?? []
          return (
            <div key={stage.dbStatus} className="flex-shrink-0 w-72">
              <div className="sticky top-0 pb-2 z-10" style={{ background: 'var(--gem-well, #0f1620)' }}>
                <div
                  className="flex items-center justify-between px-2 py-1.5 rounded-lg"
                  style={{ background: 'var(--gem-surface, #0d1118)', borderLeft: `3px solid ${COLUMN_COLORS[idx]}` }}
                >
                  <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--gem-muted, #8b949e)' }}>
                    {stage.labelPt}
                  </span>
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full"
                    style={{ background: 'var(--gem-border, #1a2030)', color: 'var(--gem-dim, #3d4654)' }}
                  >
                    {stageItems.length}
                  </span>
                </div>
              </div>
              <SortableContext items={stageItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-1.5 min-h-[48px]">
                  {stageItems.map(item => (
                    <SortablePostCard key={item.id} item={item} />
                  ))}
                  {stageItems.length === 0 && (
                    <p className="text-[10px] text-center py-8" style={{ color: 'var(--gem-faint, #181e28)' }}>
                      Nenhum em {stage.labelPt}
                    </p>
                  )}
                </div>
              </SortableContext>
            </div>
          )
        })}
      </div>
      <DragOverlay>
        {activeItem ? (
          <div className="opacity-85 scale-[1.02] shadow-2xl">
            <PostCard item={activeItem} isDragging />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
