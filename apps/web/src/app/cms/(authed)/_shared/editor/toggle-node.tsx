'use client'

import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import { useState } from 'react'
import { ChevronRight } from 'lucide-react'

function ToggleWrapperView() {
  const [open, setOpen] = useState(true)

  return (
    <NodeViewWrapper>
      <div
        className="toggle-editor-block"
        style={{
          border: '1px solid #1f2937',
          borderRadius: 8,
          margin: '8px 0',
          overflow: 'hidden',
        }}
      >
        <div
          className="flex items-center cursor-pointer px-3 py-2 bg-[#111827] select-none"
          onClick={() => setOpen(!open)}
          contentEditable={false}
        >
          <ChevronRight
            size={14}
            className="text-[#6366f1] transition-transform mr-2"
            style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
          />
          <span className="text-xs text-[#6b7280] uppercase tracking-wider font-semibold">Toggle</span>
        </div>
        <NodeViewContent className={open ? '' : 'hidden'} />
      </div>
    </NodeViewWrapper>
  )
}

export const ToggleWrapperExtension = Node.create({
  name: 'toggleWrapper',
  group: 'block',
  content: 'toggleTitle toggleBody',

  parseHTML() {
    return [{ tag: 'div[data-toggle]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-toggle': '' }), 0]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ToggleWrapperView)
  },
})

export const ToggleTitleExtension = Node.create({
  name: 'toggleTitle',
  content: 'inline*',

  parseHTML() {
    return [{ tag: 'div[data-toggle-title]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-toggle-title': '', class: 'toggle-title-editor px-3 py-2 font-semibold text-[#f3f4f6] bg-[#111827] border-b border-[#1f2937]' }), 0]
  },
})

export const ToggleBodyExtension = Node.create({
  name: 'toggleBody',
  content: 'block+',

  parseHTML() {
    return [{ tag: 'div[data-toggle-body]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-toggle-body': '', class: 'toggle-body-editor px-3 py-2' }), 0]
  },
})
