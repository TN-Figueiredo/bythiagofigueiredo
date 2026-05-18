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
import { Plus, Printer } from 'lucide-react'
import type { RoteiroContent, RoteiroBeat, RoteiroMeta, ScriptLine } from '@/lib/pipeline/roteiro-schemas'
import { createEmptyBeat } from '@/lib/pipeline/roteiro-schemas'
import { ScriptMetaEditor } from './script-meta-editor'
import { ScriptBeatAccordion } from './script-beat-accordion'

interface ScriptEditModeProps {
  content: RoteiroContent
  isEditing: boolean
  onChange: (content: RoteiroContent) => void
}

const POINTER_ACTIVATION = { distance: 5 } as const

function useStableBeatKeys(beatCount: number): string[] {
  const keysRef = useRef<string[]>([])
  while (keysRef.current.length < beatCount) {
    keysRef.current.push(crypto.randomUUID())
  }
  if (keysRef.current.length > beatCount) {
    keysRef.current.length = beatCount
  }
  return keysRef.current
}

function fmtDur(sec: number): string {
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return s > 0 ? `${m}m${String(s).padStart(2, '0')}s` : `${m}m`
}

function beatReadTime(beat: RoteiroBeat): number {
  const words = beat.script
    .filter((l): l is ScriptLine & { type: 'line' } => l.type === 'line')
    .reduce((n, l) => n + l.text.split(/\s+/).length, 0)
  const pauses = beat.script
    .filter((l): l is ScriptLine & { type: 'pause' } => l.type === 'pause')
    .reduce((n, l) => n + l.duration, 0)
  return Math.ceil(words / 2.5 + pauses)
}

function BeatsOverview({ beats }: { beats: RoteiroBeat[] }) {
  const totalDur = beats.reduce((s, b) => s + (b.duration ?? 0), 0)
  const totalRead = beats.reduce((s, b) => s + beatReadTime(b), 0)

  return (
    <div
      className="rounded-md overflow-hidden"
      style={{ border: '1px solid var(--gem-border)', background: 'var(--gem-well)' }}
    >
      <table className="w-full text-[10px]" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--gem-border)' }}>
            <th className="px-3 py-1.5 text-left font-bold uppercase tracking-wider text-[8px]" style={{ color: 'var(--gem-dim)', width: 32 }} />
            <th className="px-2 py-1.5 text-left font-bold uppercase tracking-wider text-[8px]" style={{ color: 'var(--gem-dim)' }}>Beat</th>
            <th className="px-2 py-1.5 text-center font-bold uppercase tracking-wider text-[8px]" style={{ color: 'var(--gem-dim)', width: 50 }}>Status</th>
            <th className="px-2 py-1.5 text-right font-bold uppercase tracking-wider text-[8px]" style={{ color: 'var(--gem-dim)', width: 50 }}>Dur</th>
            <th className="px-3 py-1.5 text-right font-bold uppercase tracking-wider text-[8px]" style={{ color: 'var(--gem-dim)', width: 60 }}>Leitura</th>
          </tr>
        </thead>
        <tbody>
          {beats.map((b) => (
            <tr key={b.idx} style={{ borderBottom: '1px solid color-mix(in srgb, var(--gem-border) 50%, transparent)' }}>
              <td className="px-3 py-1 font-bold tabular-nums" style={{ color: 'var(--gem-accent)' }}>#{b.idx}</td>
              <td className="px-2 py-1 font-medium truncate" style={{ color: 'var(--gem-muted)' }}>{b.name}</td>
              <td className="px-2 py-1 text-center text-[8px] font-bold uppercase" style={{ color: b.status === 'DONE' ? 'var(--gem-done, #22c55e)' : 'var(--gem-dim)' }}>{b.status === 'DONE' ? '✓' : '―'}</td>
              <td className="px-2 py-1 text-right tabular-nums font-mono text-[9px]" style={{ color: 'var(--gem-dim)' }}>{b.duration ? fmtDur(b.duration) : '-'}</td>
              <td className="px-3 py-1 text-right tabular-nums font-mono text-[9px]" style={{ color: 'var(--gem-dim)' }}>~{beatReadTime(b)}s</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: '1px solid var(--gem-border)' }}>
            <td className="px-3 py-1.5" />
            <td className="px-2 py-1.5 font-semibold" style={{ color: 'var(--gem-muted)' }}>Total</td>
            <td className="px-2 py-1.5" />
            <td className="px-2 py-1.5 text-right tabular-nums font-mono text-[9px] font-semibold" style={{ color: 'var(--gem-muted)' }}>{fmtDur(totalDur)}</td>
            <td className="px-3 py-1.5 text-right tabular-nums font-mono text-[9px] font-semibold" style={{ color: 'var(--gem-muted)' }}>~{totalRead}s</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

export function ScriptEditMode({ content, isEditing, onChange }: ScriptEditModeProps) {
  const stableKeys = useStableBeatKeys(content.beats.length)

  const pointerSensor = useSensor(PointerSensor, { activationConstraint: POINTER_ACTIVATION })
  const keyboardSensor = useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  const sensors = useSensors(pointerSensor, keyboardSensor)

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
  }, [content, onChange])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = stableKeys.indexOf(active.id as string)
      const newIndex = stableKeys.indexOf(over.id as string)
      if (oldIndex === -1 || newIndex === -1) return

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

  const handlePrint = useCallback(() => {
    window.print()
  }, [])

  return (
    <div className="script-section p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span
          className="text-[8px] font-bold uppercase tracking-widest"
          style={{ color: 'var(--gem-dim)' }}
        >
          Roteiro {'·'} v{content.version ?? 2} {'·'} {content.beats.length} beats
        </span>
        <button
          type="button"
          onClick={handlePrint}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-medium transition-colors hover:bg-white/5"
          style={{ color: 'var(--gem-dim)', border: '1px solid var(--gem-border)' }}
          title="Imprimir roteiro (Ctrl+P)"
        >
          <Printer size={11} />
          Print
        </button>
      </div>

      {/* Meta grid */}
      <ScriptMetaEditor
        meta={content.meta}
        isEditing={isEditing}
        onChange={handleMetaChange}
      />

      {/* Beats overview table */}
      {content.beats.length > 0 && <BeatsOverview beats={content.beats} />}

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
