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

export function ScriptEditMode({ content, isEditing, onChange }: ScriptEditModeProps) {
  // Keep a stable ref to onChange so callbacks that close over it stay stable
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const pointerSensor = useSensor(PointerSensor, { activationConstraint: POINTER_ACTIVATION })
  const keyboardSensor = useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  const sensors = useSensors(pointerSensor, keyboardSensor)

  const sortableIds = useMemo(
    () => content.beats.map((b) => `beat-${b.idx}`),
    [content.beats],
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
      const beats = content.beats
        .filter((b) => b.idx !== idx)
        .map((b, i) => ({ ...b, idx: i }))
      onChange({ ...content, beats })
    },
    [content, onChange],
  )

  const handleAddBeat = useCallback(() => {
    const nextIdx = content.beats.length
    onChange({
      ...content,
      beats: [...content.beats, createEmptyBeat(nextIdx)],
    })
  }, [content, onChange])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = content.beats.findIndex((b) => `beat-${b.idx}` === active.id)
      const newIndex = content.beats.findIndex((b) => `beat-${b.idx}` === over.id)
      if (oldIndex === -1 || newIndex === -1) return

      const reordered = [...content.beats]
      const [moved] = reordered.splice(oldIndex, 1)
      reordered.splice(newIndex, 0, moved!)

      const beats = reordered.map((b, i) => ({ ...b, idx: i }))
      onChange({ ...content, beats })
    },
    [content, onChange],
  )

  return (
    <div className="p-5 space-y-4">
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
            {content.beats.map((beat) => (
              <ScriptBeatAccordion
                key={beat.idx}
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
