'use client'

import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'

const RATIOS = ['1:1', '2:1', '1:2', '1:1:1'] as const
type ColumnRatio = (typeof RATIOS)[number]

const GRID_STYLES: Record<ColumnRatio, string> = {
  '1:1': '1fr 1fr',
  '2:1': '2fr 1fr',
  '1:2': '1fr 2fr',
  '1:1:1': '1fr 1fr 1fr',
}

function ColumnsNodeView({ node, updateAttributes }: NodeViewProps) {
  const ratio: ColumnRatio = RATIOS.includes(node.attrs.ratio as ColumnRatio)
    ? (node.attrs.ratio as ColumnRatio)
    : '1:1'

  return (
    <NodeViewWrapper>
      <div className="columns-editor-block" style={{ margin: '8px 0' }}>
        <div className="flex items-center gap-1 mb-2" contentEditable={false}>
          {RATIOS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => updateAttributes({ ratio: r })}
              className={`px-2 py-0.5 rounded text-xs font-mono ${
                ratio === r ? 'bg-[#6366f1]/20 text-[#a5b4fc] ring-1 ring-[#6366f1]/40' : 'text-[#6b7280] hover:text-[#d1d5db]'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: GRID_STYLES[ratio] ?? '1fr 1fr',
            gap: '12px',
          }}
        >
          <NodeViewContent />
        </div>
      </div>
    </NodeViewWrapper>
  )
}

export const ColumnsExtension = Node.create({
  name: 'columns',
  group: 'block',
  content: 'column{2,3}',

  addAttributes() {
    return {
      ratio: { default: '1:1' },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-columns]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-columns': '' }), 0]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ColumnsNodeView)
  },
})

export const ColumnExtension = Node.create({
  name: 'column',
  content: 'block+',

  parseHTML() {
    return [{ tag: 'div[data-column]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-column': '',
      style: 'border: 1px dashed #374151; border-radius: 6px; padding: 8px; min-height: 60px;',
    }), 0]
  },
})
