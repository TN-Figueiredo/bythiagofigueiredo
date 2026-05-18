'use client'

import { useCallback, useMemo, useRef } from 'react'
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
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import type { RoteiroContent, RoteiroBeat, RoteiroMeta } from '@/lib/pipeline/roteiro-schemas'
import { createEmptyBeat } from '@/lib/pipeline/roteiro-schemas'
import { ScriptMetaEditor } from './script-meta-editor'
import { ScriptBeatAccordion } from './script-beat-accordion'

interface ScriptEditModeProps {
  content: RoteiroContent
  isEditing: boolean
  onChange: (content: RoteiroContent) => void
}

// Stable activation constraint — defined outside the component to avoid re-creating on every render
const POINTER_ACTIVATION = { distance: 5 } as const

/**
 * Returns a stable key for each beat position in the array.
 * Keys are assigned once when a beat first appears and travel with the beat
 * through reorders, so TipTap editors never remount due to key changes.
 *
 * The ref holds a parallel array of UUID strings that mirrors `beats` length.
 * On each render we grow or shrink it to match — we never replace existing
 * entries (reorder leaves the array unchanged; delete/add adjusts length).
 */
function useStableBeatKeys(beatCount: number): string[] {
  const keysRef = useRef<string[]>([])

  // Grow
  while (keysRef.current.length < beatCount) {
    keysRef.current.push(crypto.randomUUID())
  }
  // Shrink (deletion)
  if (keysRef.current.length > beatCount) {
    keysRef.current.length = beatCount
  }

  return keysRef.current
}

export function ScriptEditMode({ content, isEditing, onChange }: ScriptEditModeProps) {
  const stableKeys = useStableBeatKeys(content.beats.length)

  const pointerSensor = useSensor(PointerSensor, { activationConstraint: POINTER_ACTIVATION })
  const keyboardSensor = useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  const sensors = useSensors(pointerSensor, keyboardSensor)

  // DnD IDs are derived from stable keys so they survive idx reassignment
  const sortableIds = useMemo(
    () => stableKeys.slice(0, content.beats.length),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [content.beats.length, stableKeys],
  )

  const handleMetaChange = useCallback(
    (meta: RoteiroMeta) => {
      onChange({ ...content, meta })
    },
    [content, onChange],
  )

  const handleBeatChange = useCallback(
    (updated: RoteiroBeat) => {
      const beats = content.beats.map((b) => (b.idx === updated.idx ? updated : b))
      onChange({ ...content, beats })
    },
    [content, onChange],
  )

  const handleDeleteBeat = useCallback(
    (idx: number) => {
      const position = content.beats.findIndex((b) => b.idx === idx)
      const beats = content.beats
        .filter((b) => b.idx !== idx)
        .map((b, i) => ({ ...b, idx: i }))
      // Remove the stable key at the deleted position so future keys stay aligned
      if (position !== -1) {
        stableKeys.splice(position, 1)
      }
      onChange({ ...content, beats })
    },
    [content, onChange, stableKeys],
  )

  const handleAddBeat = useCallback(() => {
    const nextIdx = content.beats.length
    onChange({
      ...content,
      beats: [...content.beats, createEmptyBeat(nextIdx)],
    })
    // New key will be appended by useStableBeatKeys on next render
  }, [content, onChange])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = stableKeys.indexOf(active.id as string)
      const newIndex = stableKeys.indexOf(over.id as string)
      if (oldIndex === -1 || newIndex === -1) return

      // Move the stable key in lockstep with the beat
      const [movedKey] = stableKeys.splice(oldIndex, 1)
      stableKeys.splice(newIndex, 0, movedKey!)

      const reordered = [...content.beats]
      const [moved] = reordered.splice(oldIndex, 1)
      reordered.splice(newIndex, 0, moved!)

      const beats = reordered.map((b, i) => ({ ...b, idx: i }))
      onChange({ ...content, beats })
    },
    [content, onChange, stableKeys],
  )

  return (
    <div className="p-5 space-y-4">
      {/* Header label */}
      <div className="flex items-baseline gap-2">
        <span
          className="text-[8px] font-bold uppercase tracking-widest"
          style={{ color: 'var(--gem-dim)' }}
        >
          Roteiro {'·'} v{content.version ?? 2} {'·'} {content.beats.length} beats
        </span>
      </div>

      {/* Meta grid */}
      <ScriptMetaEditor
        meta={content.meta}
        isEditing={isEditing}
        onChange={handleMetaChange}
      />

      {/* Beats with drag-to-reorder */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {content.beats.map((beat, i) => (
              <ScriptBeatAccordion
                key={stableKeys[i]}
                beat={beat}
                isEditing={isEditing}
                onBeatChange={handleBeatChange}
                onDelete={handleDeleteBeat}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Add beat button */}
      {isEditing && (
        <button
          type="button"
          onClick={handleAddBeat}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-md text-[11px] font-medium transition-colors hover:bg-white/5"
          style={{
            color: 'var(--gem-dim)',
            border: '1px dashed var(--gem-border)',
          }}
        >
          <Plus size={14} />
          Adicionar beat
        </button>
      )}

      {/* Empty state */}
      {content.beats.length === 0 && !isEditing && (
        <div className="text-[11px] text-center py-4" style={{ color: 'var(--gem-dim)' }}>
          Nenhum beat encontrado no roteiro.
        </div>
      )}
    </div>
  )
}
