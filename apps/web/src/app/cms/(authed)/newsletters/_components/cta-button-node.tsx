'use client'

import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react'
import { useState } from 'react'

function CTAButtonNodeView({ node, updateAttributes }: ReactNodeViewProps) {
  const [editing, setEditing] = useState(false)
  const text = node.attrs.text as string
  const url = node.attrs.url as string
  const color = node.attrs.color as string
  const align = node.attrs.align as string

  if (editing) {
    return (
      <NodeViewWrapper className="my-4">
        <div className="border rounded-lg p-3 space-y-2 bg-gray-50">
          <input
            className="w-full border rounded px-2 py-1 text-sm"
            value={text}
            onChange={(e) => updateAttributes({ text: e.target.value })}
            placeholder="Button text"
          />
          <input
            className="w-full border rounded px-2 py-1 text-sm"
            value={url}
            onChange={(e) => updateAttributes({ url: e.target.value })}
            placeholder="https://..."
          />
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={color}
              onChange={(e) => updateAttributes({ color: e.target.value })}
              className="w-8 h-8 rounded cursor-pointer"
            />
            <select
              value={align}
              onChange={(e) => updateAttributes({ align: e.target.value })}
              className="border rounded px-2 py-1 text-sm"
            >
              <option value="center">Center</option>
              <option value="left">Left</option>
              <option value="right">Right</option>
            </select>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="ml-auto text-xs bg-gray-200 px-2 py-1 rounded"
            >
              Done
            </button>
          </div>
        </div>
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper className="my-4" style={{ textAlign: align as 'left' | 'center' | 'right' }}>
      <span
        onDoubleClick={() => setEditing(true)}
        className="inline-block cursor-pointer"
        title="Double-click to edit"
      >
        <span
          style={{ backgroundColor: color }}
          className="inline-block px-8 py-3 rounded-md text-white font-semibold text-sm select-none"
        >
          {text || 'Button Text'}
        </span>
      </span>
    </NodeViewWrapper>
  )
}

export const CTAButtonExtension = Node.create({
  name: 'ctaButton',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      text: { default: 'Click Here' },
      url: { default: '' },
      color: { default: '#7c3aed' },
      align: { default: 'center' },
    }
  },

  parseHTML() {
    return [{
      tag: 'div.cta-wrapper',
      getAttrs: (el) => {
        const div = el as HTMLElement
        const link = div.querySelector('a.cta-button')
        if (!link) return false
        const bgMatch = link.getAttribute('style')?.match(/background:([^;"]+)/)
        return {
          text: link.textContent ?? 'Click Here',
          url: link.getAttribute('href') ?? '',
          color: bgMatch?.[1]?.trim() ?? '#7c3aed',
          align: (div as HTMLElement).style.textAlign || 'center',
        }
      },
    }]
  },

  renderHTML({ HTMLAttributes }) {
    const { text, url, color, align } = HTMLAttributes
    const safeUrl = url && !url.match(/^\s*javascript:/i) ? url : '#'
    return [
      'div',
      mergeAttributes({ class: 'cta-wrapper', style: `text-align:${align}` }),
      ['a', { class: 'cta-button', href: safeUrl, style: `background:${color}` }, text],
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(CTAButtonNodeView)
  },
})
