'use client'

import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import type { ReactNodeViewProps } from '@tiptap/react'
import { useState, useCallback } from 'react'

function ScriptPauseNodeView({ node, updateAttributes, deleteNode }: ReactNodeViewProps) {
  const [editing, setEditing] = useState(false)
  const duration = typeof node.attrs.duration === 'number' ? node.attrs.duration : 0

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value)
      if (!isNaN(val) && val >= 0 && val <= 30) {
        updateAttributes({ duration: val })
      }
    },
    [updateAttributes],
  )

  return (
    <NodeViewWrapper>
      <div
        className="script-pause-block inline-flex items-center gap-1 my-1 px-2.5 py-1 rounded cursor-pointer select-none"
        style={{
          background: '#22c55e12',
          border: '1px solid #22c55e25',
          color: '#4ade80',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '10px',
          letterSpacing: '0.04em',
        }}
        onClick={() => setEditing(true)}
        onDoubleClick={deleteNode}
        title="Click to edit, double-click to remove"
      >
        <span style={{ opacity: 0.7 }}>&#9208;</span>
        {editing ? (
          <input
            type="number"
            className="w-12 bg-transparent border-b text-center outline-none"
            style={{ color: '#4ade80', borderColor: '#4ade8050' }}
            value={duration}
            onChange={handleChange}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setEditing(false) }}
            step="0.5"
            min="0"
            max="30"
            autoFocus
            aria-label="Pause duration in seconds"
          />
        ) : (
          <span>{duration}s</span>
        )}
      </div>
    </NodeViewWrapper>
  )
}

export const ScriptPauseExtension = Node.create({
  name: 'scriptPause',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      duration: { default: 0.5 },
    }
  },

  parseHTML() {
    return [{
      tag: 'div[data-script-pause]',
      getAttrs: (el) => ({
        duration: parseFloat((el as HTMLElement).getAttribute('data-duration') ?? '0.5'),
      }),
    }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes({
        'data-script-pause': '',
        'data-duration': String(HTMLAttributes.duration ?? 0.5),
        class: 'script-pause',
        style: 'font-family:monospace;font-size:10px;color:#4ade80;margin:4px 0',
      }),
      `⏸ ${HTMLAttributes.duration ?? 0.5}s`,
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ScriptPauseNodeView)
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-p': () => {
        return this.editor.chain().focus()
          .insertContent({ type: 'scriptPause', attrs: { duration: 0.5 } })
          .run()
      },
    }
  },
})
