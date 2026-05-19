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

/** Return a safe ScriptTagName, falling back to 'VISUAL' for unrecognised values.
 *  Prevents CSS injection when user-provided tag values are interpolated into
 *  class names or style attributes via renderHTML. */
function sanitiseTag(raw: unknown): ScriptTagName {
  return TAG_OPTIONS.includes(raw as ScriptTagName) ? (raw as ScriptTagName) : 'VISUAL'
}

function ScriptTagNodeView({ node, updateAttributes }: NodeViewProps) {
  const tag = sanitiseTag(node.attrs.tag)
  const s = TAG_STYLE[tag]

  return (
    <NodeViewWrapper>
      <div
        className="script-tag-block flex items-start gap-2 my-0.5 py-1 px-2.5 rounded-sm"
        style={{
          background: s.bg,
          borderLeft: `3px solid ${s.color}`,
        }}
      >
        <select
          className="shrink-0 text-[7.5px] font-bold uppercase tracking-wider rounded px-1.5 py-0.5 border-0 cursor-pointer mt-px"
          style={{
            background: `${s.color}18`,
            color: s.color,
            outline: 'none',
          }}
          value={tag}
          onChange={(e) => updateAttributes({ tag: sanitiseTag(e.target.value) })}
          aria-label="Tag type"
        >
          {TAG_OPTIONS.map((t) => (
            <option key={t} value={t}>{TAG_STYLE[t].label}</option>
          ))}
        </select>
        <NodeViewContent
          className="flex-1 min-w-0 outline-none text-[11px] leading-snug"
          style={{ color: `${s.color}cc` }}
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
    const safeTag = sanitiseTag(HTMLAttributes.tag)
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-script-tag': safeTag,
        class: `script-tag script-tag--${safeTag.toLowerCase()}`,
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
