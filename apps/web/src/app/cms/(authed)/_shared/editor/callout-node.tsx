'use client'

import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { Info, AlertTriangle, Lightbulb, XCircle } from 'lucide-react'

const VARIANTS = ['info', 'warning', 'tip', 'error'] as const
type CalloutVariant = (typeof VARIANTS)[number]

const VARIANT_CONFIG: Record<CalloutVariant, { icon: typeof Info; color: string; label: string }> = {
  info:    { icon: Info,          color: '#6366f1', label: 'Info' },
  warning: { icon: AlertTriangle, color: '#eab308', label: 'Warning' },
  tip:     { icon: Lightbulb,     color: '#22c55e', label: 'Tip' },
  error:   { icon: XCircle,       color: '#ef4444', label: 'Error' },
}

function CalloutNodeView({ node, updateAttributes }: NodeViewProps) {
  const variant: CalloutVariant = VARIANTS.includes(node.attrs.variant as CalloutVariant)
    ? (node.attrs.variant as CalloutVariant)
    : 'info'
  const config = VARIANT_CONFIG[variant] ?? VARIANT_CONFIG.info
  const Icon = config.icon

  return (
    <NodeViewWrapper>
      <div
        className="callout-editor-block"
        style={{
          borderLeft: `3px solid ${config.color}`,
          background: `${config.color}10`,
          borderRadius: 8,
          padding: '12px 16px',
          margin: '8px 0',
        }}
      >
        <div className="flex items-center gap-1 mb-2">
          {VARIANTS.map((v) => {
            const VIcon = VARIANT_CONFIG[v].icon
            return (
              <button
                key={v}
                type="button"
                onClick={() => updateAttributes({ variant: v })}
                className={`p-1 rounded text-xs ${variant === v ? 'bg-white/20 ring-1 ring-white/30' : 'opacity-40 hover:opacity-70'}`}
                title={VARIANT_CONFIG[v].label}
              >
                <VIcon size={14} style={{ color: VARIANT_CONFIG[v].color }} />
              </button>
            )
          })}
        </div>
        <div className="flex items-start gap-3">
          <Icon size={18} style={{ color: config.color, flexShrink: 0, marginTop: 2 }} />
          <NodeViewContent className="callout-content flex-1 min-w-0 outline-none" />
        </div>
      </div>
    </NodeViewWrapper>
  )
}

export const CalloutExtension = Node.create({
  name: 'callout',
  group: 'block',
  content: 'inline*',

  addAttributes() {
    return {
      variant: { default: 'info' },
    }
  },

  parseHTML() {
    return [{ tag: 'aside[data-callout]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['aside', mergeAttributes(HTMLAttributes, { 'data-callout': '', class: `callout callout-${HTMLAttributes.variant ?? 'info'}` }), 0]
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutNodeView)
  },
})
