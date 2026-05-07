'use client'

import { useState, useCallback } from 'react'
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

interface SlotManagerProps {
  slots: SlotItem[]
  allPosts: { id: string; cachedImageUrl: string | null; caption: string | null }[]
  onReorder: (slots: { position: number; postId: string | null }[]) => void
  onPinPost: (position: number, postId: string | null) => void
  disabled?: boolean
}

function SortableSlotCard({
  slot,
  onTogglePin,
  disabled,
}: {
  slot: SlotItem
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative rounded-lg border p-2 ${
        slot.postId
          ? 'border-indigo-500/50 bg-indigo-950/30'
          : 'border-slate-600 bg-slate-800/50'
      }`}
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        {slot.thumbnailUrl ? (
          <img
            src={slot.thumbnailUrl}
            alt={slot.caption ?? ''}
            className="aspect-square w-full rounded object-cover"
          />
        ) : (
          <div className="flex aspect-square w-full items-center justify-center rounded bg-slate-700 text-xs text-slate-500">
            Auto
          </div>
        )}
      </div>

      <div className="mt-1 flex items-center justify-between">
        <span className="text-xs text-slate-500">#{slot.position}</span>
        <button
          type="button"
          onClick={onTogglePin}
          disabled={disabled}
          className="text-xs text-slate-400 hover:text-indigo-400 disabled:opacity-50"
        >
          {slot.postId ? 'Unpin' : 'Pin'}
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

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      setSlots((prev) => {
        const oldIndex = prev.findIndex((s) => s.id === active.id)
        const newIndex = prev.findIndex((s) => s.id === over.id)
        const reordered = arrayMove(prev, oldIndex, newIndex).map((s, i) => ({
          ...s,
          position: i + 1,
        }))

        onReorder(reordered.map((s) => ({ position: s.position, postId: s.postId })))
        return reordered
      })
    },
    [onReorder],
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
    } else {
      setPickerSlot(position)
    }
  }

  const handlePickPost = (postId: string) => {
    if (pickerSlot === null) return
    const post = allPosts.find((p) => p.id === postId)
    onPinPost(pickerSlot, postId)
    setSlots((prev) =>
      prev.map((s) =>
        s.position === pickerSlot
          ? { ...s, postId, thumbnailUrl: post?.cachedImageUrl ?? null, caption: post?.caption ?? null }
          : s,
      ),
    )
    setPickerSlot(null)
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs text-slate-400">Drag to reorder · Click Pin/Unpin to assign posts</p>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={slots.map((s) => s.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {slots.map((slot) => (
              <SortableSlotCard
                key={slot.id}
                slot={slot}
                onTogglePin={() => handleTogglePin(slot.position)}
                disabled={disabled}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {pickerSlot !== null && (
        <div className="mt-3 rounded-lg border border-slate-600 bg-slate-800 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm text-slate-300">Select a post for slot #{pickerSlot}</p>
            <button
              type="button"
              onClick={() => setPickerSlot(null)}
              className="text-xs text-slate-500 hover:text-slate-300"
            >
              Cancel
            </button>
          </div>
          <div className="grid max-h-48 grid-cols-6 gap-2 overflow-y-auto">
            {allPosts.map((post) => (
              <button
                key={post.id}
                type="button"
                onClick={() => handlePickPost(post.id)}
                className="rounded border border-slate-700 hover:border-indigo-500"
              >
                {post.cachedImageUrl ? (
                  <img
                    src={post.cachedImageUrl}
                    alt={post.caption ?? ''}
                    className="aspect-square w-full rounded object-cover"
                  />
                ) : (
                  <div className="flex aspect-square items-center justify-center bg-slate-700 text-xs text-slate-500">
                    ?
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
