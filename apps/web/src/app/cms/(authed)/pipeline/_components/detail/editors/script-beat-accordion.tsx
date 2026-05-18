'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useEditor, EditorContent, type JSONContent } from '@tiptap/react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  GripVertical,
  ChevronDown,
  ChevronRight,
  Trash2,
  Check,
  Clock,
} from 'lucide-react'
import type { RoteiroBeat } from '@/lib/pipeline/roteiro-schemas'
import { roteiroToTipTap, tipTapToRoteiro } from '@/lib/pipeline/script-serializer'
import { getScriptExtensions } from './script-extensions'
import { ScriptBeatToolbar } from './script-beat-toolbar'

interface ScriptBeatAccordionProps {
  beat: RoteiroBeat
  isEditing: boolean
  onBeatChange: (beat: RoteiroBeat) => void
  onDelete: (idx: number) => void
}

export function ScriptBeatAccordion({
  beat,
  isEditing,
  onBeatChange,
  onDelete,
}: ScriptBeatAccordionProps) {
  const [expanded, setExpanded] = useState(true)
  const [editingName, setEditingName] = useState(false)

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `beat-${beat.idx}`, disabled: !isEditing })

  const sortableStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const extensions = useMemo(() => getScriptExtensions(), [])
  // beat.idx is the stable identity for a beat instance — intentionally
  // computed only on mount so the editor is not re-initialised on every
  // keystroke.  The eslint-disable is intentional.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialContent = useMemo(() => roteiroToTipTap(beat), [beat.idx])

  const editor = useEditor({
    extensions,
    content: initialContent,
    editable: isEditing,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'script-beat-prosemirror',
      },
    },
    onUpdate: ({ editor: e }) => {
      try {
        const lines = tipTapToRoteiro(e.getJSON())
        onBeatChange({ ...beat, script: lines })
      } catch {
        // Serialisation failed (e.g. malformed node) — discard this update
        // rather than propagating an exception into the TipTap update cycle.
      }
    },
  })

  useEffect(() => {
    if (editor && editor.isEditable !== isEditing) {
      editor.setEditable(isEditing)
    }
  }, [editor, isEditing])

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onBeatChange({ ...beat, name: e.target.value })
    },
    [beat, onBeatChange],
  )

  const handleToggleStatus = useCallback(() => {
    onBeatChange({
      ...beat,
      status: beat.status === 'DONE' ? 'PENDING' : 'DONE',
    })
  }, [beat, onBeatChange])

  const wordCount = editor?.storage.characterCount?.words() ?? 0

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      className="rounded-md overflow-hidden"
      data-beat-idx={beat.idx}
      style={{
        ...sortableStyle,
        border: '1px solid var(--gem-border)',
        borderLeft: `3px solid ${beat.status === 'DONE' ? 'var(--gem-done, #22c55e)' : 'var(--gem-border)'}`,
        background: isDragging ? 'var(--gem-well)' : 'transparent',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-1.5"
        style={{ background: 'var(--gem-well)', borderBottom: expanded ? '1px solid var(--gem-border)' : 'none' }}
      >
        {/* Drag handle */}
        {isEditing && (
          <button
            ref={setActivatorNodeRef}
            {...listeners}
            type="button"
            className="cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-white/5"
            style={{ color: 'var(--gem-dim)' }}
            aria-label="Drag to reorder beat"
          >
            <GripVertical size={14} />
          </button>
        )}

        {/* Expand toggle */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="p-0.5 rounded hover:bg-white/5"
          style={{ color: 'var(--gem-dim)' }}
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse beat' : 'Expand beat'}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

        {/* Beat number */}
        <span
          className="text-[10px] font-bold tabular-nums shrink-0"
          style={{ color: 'var(--gem-accent)', minWidth: '1.5rem' }}
        >
          #{beat.idx}
        </span>

        {/* Beat name */}
        {editingName && isEditing ? (
          <input
            className="flex-1 text-[11px] font-medium bg-transparent border-b outline-none"
            style={{ color: 'var(--gem-text)', borderColor: 'var(--gem-accent)' }}
            value={beat.name}
            onChange={handleNameChange}
            onBlur={() => setEditingName(false)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setEditingName(false) }}
            autoFocus
            aria-label="Beat name"
          />
        ) : (
          <span
            className="text-[11px] font-medium flex-1 truncate"
            style={{ color: 'var(--gem-text)', cursor: isEditing ? 'pointer' : 'default' }}
            onClick={() => isEditing && setEditingName(true)}
            title={isEditing ? 'Click to rename' : beat.name}
          >
            {beat.name}
          </span>
        )}

        {/* Word count */}
        <span className="text-[9px] tabular-nums shrink-0" style={{ color: 'var(--gem-dim)' }}>
          {wordCount}w
        </span>

        {/* Duration input (edit mode) or display (read mode) */}
        {isEditing && (
          <div className="flex items-center gap-0.5 shrink-0" title="Beat duration (seconds)">
            <input
              type="number"
              className="w-10 bg-transparent text-right outline-none tabular-nums text-[9px]"
              style={{ color: 'var(--gem-dim)', borderBottom: '1px solid var(--gem-border)' }}
              value={beat.duration ?? ''}
              onChange={(e) => {
                const val = e.target.value === '' ? undefined : Math.max(0, Number(e.target.value))
                onBeatChange({ ...beat, duration: val })
              }}
              placeholder="—"
              min="0"
              step="1"
              aria-label="Beat duration in seconds"
            />
            <span className="text-[8px]" style={{ color: 'var(--gem-dim)' }}>s</span>
          </div>
        )}
        {!isEditing && beat.duration != null && (
          <span className="text-[9px] tabular-nums shrink-0" style={{ color: 'var(--gem-dim)' }}>
            {beat.duration}s
          </span>
        )}

        {/* Status badge (read-only) or toggle (editing) */}
        {isEditing ? (
          <button
            type="button"
            onClick={handleToggleStatus}
            className="p-0.5 rounded hover:bg-white/5"
            style={{ color: beat.status === 'DONE' ? 'var(--gem-done, #22c55e)' : 'var(--gem-dim)' }}
            title={beat.status === 'DONE' ? 'Mark pending' : 'Mark done'}
            aria-label={`Status: ${beat.status}`}
          >
            {beat.status === 'DONE' ? <Check size={14} /> : <Clock size={14} />}
          </button>
        ) : (
          <span
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider"
            style={{
              background: beat.status === 'DONE' ? 'color-mix(in srgb, var(--gem-done, #22c55e) 10%, transparent)' : 'color-mix(in srgb, var(--gem-dim) 12%, transparent)',
              color: beat.status === 'DONE' ? 'var(--gem-done, #22c55e)' : 'var(--gem-dim)',
              border: `1px solid ${beat.status === 'DONE' ? 'color-mix(in srgb, var(--gem-done, #22c55e) 15%, transparent)' : 'transparent'}`,
            }}
          >
            {beat.status === 'DONE' ? <Check size={10} /> : <Clock size={10} />}
            {beat.status === 'DONE' ? 'Gravado' : 'Pendente'}
          </span>
        )}

        {/* Delete */}
        {isEditing && (
          <button
            type="button"
            onClick={() => onDelete(beat.idx)}
            className="p-0.5 rounded hover:bg-red-500/10"
            style={{ color: 'var(--gem-dim)' }}
            title="Delete beat"
            aria-label="Delete beat"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {/* Body */}
      {expanded && editor && (
        <div className="script-beat-editor">
          {isEditing && <ScriptBeatToolbar editor={editor} />}
          <div
            className="px-3 py-2"
            style={{ background: isEditing ? 'var(--gem-well)' : 'transparent' }}
          >
            <EditorContent editor={editor} />
          </div>
        </div>
      )}
    </div>
  )
}
