'use client'

import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'

const TAG_OPTIONS = ['VISUAL', 'DIRECTION', 'NARRACAO'] as const
type ScriptTagName = (typeof TAG_OPTIONS)[number]

const TAG_STYLE: Record<ScriptTagName, { bg: string; color: string; border: string; label: string }> = {
  VISUAL:    { bg: '#7c3aed15', color: '#a78bfa', border: '#7c3aed30', label: 'VISUAL' },
  DIRECTION: { bg: '#f4364515', color: '#fb7185', border: '#f4364530', label: 'DIRECTION' },
  NARRACAO:  { bg: '#0ea5e915', color: '#67e8f9', border: '#0ea5e930', label: 'NARRACAO' },
}

function ScriptTagNodeView({ node, updateAttributes }: NodeViewProps) {
  const tag = (TAG_OPTIONS.includes(node.attrs.tag as ScriptTagName)
    ? node.attrs.tag
    : 'VISUAL') as ScriptTagName
  const style = TAG_STYLE[tag]

  return (
    <NodeViewWrapper>
      <div
        className="script-tag-block flex items-start gap-2 my-1 py-1.5 px-2 rounded"
        style={{
          background: style.bg,
          borderLeft: `3px solid ${style.border}`,
        }}
      >
        <select
          className="shrink-0 text-[8px] font-bold uppercase tracking-wide rounded px-1.5 py-0.5 border-0 cursor-pointer"
          style={{
            background: style.bg,
            color: style.color,
            outline: 'none',
          }}
          value={tag}
          onChange={(e) => updateAttributes({ tag: e.target.value })}
          aria-label="Tag type"
        >
          {TAG_OPTIONS.map((t) => (
            <option key={t} value={t}>{TAG_STYLE[t].label}</option>
          ))}
        </select>
        <NodeViewContent
          className="flex-1 min-w-0 outline-none text-[11.5px] leading-relaxed"
          style={{ color: style.color }}
        />
      </div>
    </NodeViewWrapper>
  )
}

export const ScriptTagExtension = Node.create({
  name: 'scriptTag',
  group: 'block',
  content: 'inline*',

  addAttributes() {
    return {
      tag: { default: 'VISUAL' },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-script-tag]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-script-tag': HTMLAttributes.tag ?? 'VISUAL',
        class: `script-tag script-tag--${(HTMLAttributes.tag ?? 'visual').toLowerCase()}`,
      }),
      0,
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ScriptTagNodeView)
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-v': () => {
        return this.editor.chain().focus()
          .insertContent({ type: 'scriptTag', attrs: { tag: 'VISUAL' }, content: [{ type: 'text', text: ' ' }] })
          .run()
      },
      'Mod-Shift-d': () => {
        return this.editor.chain().focus()
          .insertContent({ type: 'scriptTag', attrs: { tag: 'DIRECTION' }, content: [{ type: 'text', text: ' ' }] })
          .run()
      },
      'Mod-Shift-n': () => {
        return this.editor.chain().focus()
          .insertContent({ type: 'scriptTag', attrs: { tag: 'NARRACAO' }, content: [{ type: 'text', text: ' ' }] })
          .run()
      },
    }
  },
})

export { TAG_STYLE, TAG_OPTIONS }
export type { ScriptTagName }
