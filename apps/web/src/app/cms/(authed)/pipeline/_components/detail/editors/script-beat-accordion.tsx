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
  const initialContent = useMemo(() => roteiroToTipTap(beat), []) // eslint-disable-line react-hooks/exhaustive-deps

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
      const lines = tipTapToRoteiro(e.getJSON())
      onBeatChange({ ...beat, script: lines })
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
        {expanded && (
          <span className="text-[9px] tabular-nums shrink-0" style={{ color: 'var(--gem-dim)' }}>
            {wordCount}w
          </span>
        )}

        {/* Status toggle */}
        {isEditing && (
          <button
            type="button"
            onClick={handleToggleStatus}
            className="p-0.5 rounded hover:bg-white/5"
            style={{ color: beat.status === 'DONE' ? '#22c55e' : 'var(--gem-dim)' }}
            title={beat.status === 'DONE' ? 'Mark pending' : 'Mark done'}
            aria-label={`Status: ${beat.status}`}
          >
            {beat.status === 'DONE' ? <Check size={14} /> : <Clock size={14} />}
          </button>
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
