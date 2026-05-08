'use client'

import { useState, useCallback, useMemo } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface SlotItem {
  id: string
  position: number
  postId: string | null
  thumbnailUrl: string | null
  caption: string | null
}

interface PostItem {
  id: string
  cachedImageUrl: string | null
  caption: string | null
}

interface SlotManagerProps {
  slots: SlotItem[]
  allPosts: PostItem[]
  onReorder: (slots: { position: number; postId: string | null }[]) => void
  onPinPost: (position: number, postId: string | null) => void
  disabled?: boolean
}

function SortableSlotCard({
  slot,
  autoPreviewUrl,
  isPinned,
  isTargeted,
  onTogglePin,
  disabled,
}: {
  slot: SlotItem
  autoPreviewUrl: string | null
  isPinned: boolean
  isTargeted: boolean
  onTogglePin: () => void
  disabled?: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: slot.id, disabled })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const thumbnailUrl = slot.thumbnailUrl ?? autoPreviewUrl

  const borderClass = isTargeted
    ? 'border-amber-400 bg-amber-950/30 ring-1 ring-amber-400/50'
    : isPinned
      ? 'border-indigo-500/50 bg-indigo-950/30'
      : 'border-slate-600 bg-slate-800/50'

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative rounded-lg border p-2 ${borderClass}`}
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        {thumbnailUrl ? (
          <div className="relative">
            <img
              src={thumbnailUrl}
              alt={slot.caption ?? ''}
              className={`aspect-square w-full rounded object-cover ${!isPinned ? 'opacity-50' : ''}`}
            />
            {!isPinned && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="rounded bg-slate-900/70 px-1.5 py-0.5 text-[10px] font-medium text-slate-300">
                  Auto
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex aspect-square w-full items-center justify-center rounded bg-slate-700 text-xs text-slate-500">
            {isTargeted ? '← Pick' : 'Empty'}
          </div>
        )}
      </div>

      <div className="mt-1 flex items-center justify-between">
        <span className="text-xs text-slate-500">#{slot.position}</span>
        <button
          type="button"
          onClick={onTogglePin}
          disabled={disabled}
          className={`text-xs disabled:opacity-50 ${
            isTargeted
              ? 'font-medium text-amber-400'
              : isPinned
                ? 'text-red-400 hover:text-red-300'
                : 'text-slate-400 hover:text-indigo-400'
          }`}
        >
          {isPinned ? 'Unpin' : isTargeted ? 'Cancel' : 'Pin'}
        </button>
      </div>
    </div>
  )
}

export function SlotManager({
  slots: initialSlots,
  allPosts,
  onReorder,
  onPinPost,
  disabled,
}: SlotManagerProps) {
  const [slots, setSlots] = useState(initialSlots)
  const [pickerSlot, setPickerSlot] = useState<number | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const pinnedPostIds = useMemo(
    () => new Set(slots.filter(s => s.postId).map(s => s.postId)),
    [slots],
  )

  const autoPreviewMap = useMemo(() => {
    const map = new Map<number, string | null>()
    const availablePosts = allPosts.filter(p => !pinnedPostIds.has(p.id))
    let autoIdx = 0
    for (const slot of slots) {
      if (!slot.postId && autoIdx < availablePosts.length) {
        map.set(slot.position, availablePosts[autoIdx]?.cachedImageUrl ?? null)
        autoIdx++
      }
    }
    return map
  }, [slots, allPosts, pinnedPostIds])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = slots.findIndex((s) => s.id === active.id)
      const newIndex = slots.findIndex((s) => s.id === over.id)
      const reordered = arrayMove(slots, oldIndex, newIndex).map((s, i) => ({
        ...s,
        position: i + 1,
      }))

      setSlots(reordered)
      onReorder(reordered.map((s) => ({ position: s.position, postId: s.postId })))
    },
    [slots, onReorder],
  )

  const handleTogglePin = (position: number) => {
    const slot = slots.find((s) => s.position === position)
    if (slot?.postId) {
      onPinPost(position, null)
      setSlots((prev) =>
        prev.map((s) =>
          s.position === position ? { ...s, postId: null, thumbnailUrl: null, caption: null } : s,
        ),
      )
    } else if (pickerSlot === position) {
      setPickerSlot(null)
    } else {
      setPickerSlot(position)
    }
  }

  const assignPost = (postId: string, position: number) => {
    const post = allPosts.find((p) => p.id === postId)
    onPinPost(position, postId)
    setSlots((prev) =>
      prev.map((s) =>
        s.position === position
          ? { ...s, postId, thumbnailUrl: post?.cachedImageUrl ?? null, caption: post?.caption ?? null }
          : s,
      ),
    )
    setPickerSlot(null)
  }

  const handlePickPost = (postId: string) => {
    const targetPosition = pickerSlot ?? slots.find(s => !s.postId)?.position
    if (!targetPosition) return
    assignPost(postId, targetPosition)
  }

  const firstEmptySlot = slots.find(s => !s.postId)?.position ?? null
  const canPickPosts = pickerSlot !== null || firstEmptySlot !== null

  return (
    <div>
      <div className="mb-2">
        <p className="text-xs text-slate-400">
          {pickerSlot
            ? `Select a post below to pin to slot #${pickerSlot}`
            : 'Click a post to pin it · Drag slots to reorder'}
        </p>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={slots.map((s) => s.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {slots.map((slot) => (
              <SortableSlotCard
                key={slot.id}
                slot={slot}
                autoPreviewUrl={autoPreviewMap.get(slot.position) ?? null}
                isPinned={!!slot.postId}
                isTargeted={pickerSlot === slot.position}
                onTogglePin={() => handleTogglePin(slot.position)}
                disabled={disabled}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {allPosts.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-slate-400">
            Synced Posts ({allPosts.length})
            {!pickerSlot && firstEmptySlot && (
              <span className="ml-1 font-normal text-slate-500">— click to pin to slot #{firstEmptySlot}</span>
            )}
          </p>
          <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
            {allPosts.map((post) => {
              const isPinned = pinnedPostIds.has(post.id)
              return (
                <button
                  key={post.id}
                  type="button"
                  onClick={() => !isPinned && canPickPosts && handlePickPost(post.id)}
                  disabled={disabled || isPinned || !canPickPosts}
                  className={`relative overflow-hidden rounded border transition-all ${
                    isPinned
                      ? 'border-indigo-500/50 opacity-40'
                      : canPickPosts
                        ? 'cursor-pointer border-slate-600 hover:border-amber-400 hover:ring-1 hover:ring-amber-400/50'
                        : 'border-slate-700 opacity-70'
                  }`}
                  title={post.caption ?? undefined}
                >
                  {post.cachedImageUrl ? (
                    <img
                      src={post.cachedImageUrl}
                      alt={post.caption ?? ''}
                      className="aspect-square w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-square items-center justify-center bg-slate-700 text-xs text-slate-500">
                      ?
                    </div>
                  )}
                  {isPinned && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <span className="text-[10px] font-medium text-indigo-300">Pinned</span>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
