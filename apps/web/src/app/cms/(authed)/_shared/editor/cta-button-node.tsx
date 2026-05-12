'use client'

import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react'
import { useState } from 'react'

type ButtonStyle = 'primary' | 'secondary' | 'ghost'

interface CTAButton {
  text: string
  url: string
  style: ButtonStyle
}

const STYLE_LABELS: Record<ButtonStyle, string> = {
  primary: 'Primary',
  secondary: 'Secondary',
  ghost: 'Ghost',
}

const PREVIEW_CLASSES: Record<ButtonStyle, string> = {
  primary: 'bg-purple-600 text-white border border-purple-600',
  secondary: 'bg-transparent text-purple-400 border border-purple-400',
  ghost: 'bg-transparent text-purple-400 border border-transparent underline',
}

const MAX_BUTTONS = 4

function ButtonEditor({
  button,
  index,
  total,
  onChange,
  onRemove,
}: {
  button: CTAButton
  index: number
  total: number
  onChange: (updated: CTAButton) => void
  onRemove: () => void
}) {
  return (
    <div className="border border-[#1f2937] rounded-md p-2 space-y-2 bg-[#0d1525]">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-[#6b7280] font-medium">Button {index + 1}</span>
        {total > 1 && (
          <button
            type="button"
            onClick={onRemove}
            className="text-xs text-red-400 hover:text-red-300 px-1"
            title="Remove button"
          >
            ✕
          </button>
        )}
      </div>
      <input
        className="w-full border border-[#1f2937] bg-[#0a0f1a] text-[#d1d5db] rounded px-2 py-1 text-sm"
        value={button.text}
        onChange={(e) => onChange({ ...button, text: e.target.value })}
        placeholder="Button text"
      />
      <input
        className="w-full border border-[#1f2937] bg-[#0a0f1a] text-[#d1d5db] rounded px-2 py-1 text-sm"
        value={button.url}
        onChange={(e) => onChange({ ...button, url: e.target.value })}
        placeholder="https://..."
      />
      <div className="flex gap-1">
        {(['primary', 'secondary', 'ghost'] as ButtonStyle[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange({ ...button, style: s })}
            className={`flex-1 text-xs px-2 py-1 rounded transition-colors ${
              button.style === s
                ? 'bg-purple-700 text-white border border-purple-500'
                : 'bg-[#111827] text-[#9ca3af] border border-[#1f2937] hover:border-purple-500'
            }`}
          >
            {STYLE_LABELS[s]}
          </button>
        ))}
      </div>
      <div className="pt-1">
        <span
          className={`inline-block text-xs px-3 py-1 rounded-sm cursor-default select-none ${PREVIEW_CLASSES[button.style]}`}
        >
          {button.text || 'Button Text'}
        </span>
      </div>
    </div>
  )
}

function CTAButtonNodeView({ node, updateAttributes }: ReactNodeViewProps) {
  const [editing, setEditing] = useState(false)
  const buttons = node.attrs.buttons as CTAButton[]
  const align = node.attrs.align as string

  function handleButtonChange(index: number, updated: CTAButton) {
    const next = buttons.map((b, i) => (i === index ? updated : b))
    updateAttributes({ buttons: next })
  }

  function handleAddButton() {
    if (buttons.length >= MAX_BUTTONS) return
    updateAttributes({ buttons: [...buttons, { text: 'Click Here', url: '', style: 'primary' }] })
  }

  function handleRemoveButton(index: number) {
    if (buttons.length <= 1) return
    updateAttributes({ buttons: buttons.filter((_, i) => i !== index) })
  }

  if (editing) {
    return (
      <NodeViewWrapper className="my-4">
        <div className="border border-[#1f2937] rounded-lg p-3 space-y-3 bg-[#111827]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#9ca3af] uppercase tracking-wide">CTA Buttons</span>
            <select
              value={align}
              onChange={(e) => updateAttributes({ align: e.target.value })}
              className="border border-[#1f2937] bg-[#0a0f1a] text-[#d1d5db] rounded px-2 py-1 text-xs"
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>

          <div className="space-y-2">
            {buttons.map((btn, i) => (
              <ButtonEditor
                key={i}
                button={btn}
                index={i}
                total={buttons.length}
                onChange={(updated) => handleButtonChange(i, updated)}
                onRemove={() => handleRemoveButton(i)}
              />
            ))}
          </div>

          <div className="flex items-center justify-between pt-1">
            {buttons.length < MAX_BUTTONS ? (
              <button
                type="button"
                onClick={handleAddButton}
                className="text-xs text-purple-400 hover:text-purple-300 border border-dashed border-purple-800 rounded px-3 py-1 hover:border-purple-500 transition-colors"
              >
                + Add button
              </button>
            ) : (
              <span className="text-xs text-[#6b7280]">Max {MAX_BUTTONS} buttons</span>
            )}
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-xs bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700"
            >
              Done
            </button>
          </div>
        </div>
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper
      className="my-4"
      style={{ textAlign: align as 'left' | 'center' | 'right' }}
      onDoubleClick={() => setEditing(true)}
      title="Double-click to edit"
    >
      <span className="inline-flex flex-wrap gap-2 cursor-pointer">
        {buttons.map((btn, i) => (
          <span
            key={i}
            className={`inline-block px-6 py-2 rounded-md font-semibold text-sm select-none ${PREVIEW_CLASSES[btn.style]}`}
          >
            {btn.text || 'Button Text'}
          </span>
        ))}
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
      buttons: {
        default: [{ text: 'Click Here', url: '', style: 'primary' }],
        parseHTML: (element: HTMLElement) => {
          try {
            return JSON.parse(element.getAttribute('data-buttons') ?? '[]')
          } catch {
            return [{ text: 'Click Here', url: '', style: 'primary' }]
          }
        },
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-buttons': JSON.stringify(attributes.buttons),
        }),
      },
      align: { default: 'center' },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div.cta-wrapper',
        getAttrs: (element: HTMLElement) => {
          const dataButtons = element.getAttribute('data-buttons')
          if (dataButtons) {
            try {
              return { buttons: JSON.parse(dataButtons) }
            } catch {
              // fall through to backward-compat parsing
            }
          }
          // Backward compat: old single-button format
          const text = element.querySelector('.cta-button')?.textContent ?? 'Click Here'
          const url = element.querySelector('a')?.getAttribute('href') ?? ''
          return { buttons: [{ text, url, style: 'primary' }] }
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const { buttons, align } = HTMLAttributes as { buttons: CTAButton[]; align: string }
    const safeButtons: CTAButton[] = Array.isArray(buttons) ? buttons : [{ text: 'Click Here', url: '', style: 'primary' }]
    const children = safeButtons.map((btn) => {
      const safeUrl = btn.url && !btn.url.match(/^\s*javascript:/i) ? btn.url : '#'
      return ['a', { class: `cta-button cta-button--${btn.style}`, href: safeUrl }, btn.text]
    })
    return [
      'div',
      mergeAttributes({
        class: 'cta-wrapper',
        style: `text-align:${align ?? 'center'}`,
        'data-buttons': JSON.stringify(safeButtons),
      }),
      ...children,
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(CTAButtonNodeView)
  },
})
