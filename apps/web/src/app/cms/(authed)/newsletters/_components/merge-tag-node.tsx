'use client'

import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react'

export interface MergeTag {
  value: string
  label: string
}

export const MERGE_TAGS: MergeTag[] = [
  { value: 'subscriber.email', label: 'Subscriber Email' },
  { value: 'subscriber.name', label: 'Subscriber Name' },
  { value: 'edition.subject', label: 'Edition Subject' },
  { value: 'newsletter.name', label: 'Newsletter Name' },
  { value: 'urls.unsubscribe', label: 'Unsubscribe URL' },
  { value: 'urls.preferences', label: 'Preferences URL' },
  { value: 'urls.web_archive', label: 'View in Browser URL' },
]

function MergeTagNodeView({ node }: ReactNodeViewProps) {
  const tag = MERGE_TAGS.find((t) => t.value === node.attrs.tag)
  return (
    <NodeViewWrapper as="span" className="inline">
      <span
        className="inline-flex items-center rounded bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-700 select-none"
        contentEditable={false}
      >
        {`{{${tag?.label ?? node.attrs.tag}}}`}
      </span>
    </NodeViewWrapper>
  )
}

export const MergeTagExtension = Node.create({
  name: 'mergeTag',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return { tag: { default: 'subscriber.name' } }
  },

  parseHTML() {
    return [{ tag: 'span[data-merge-tag]', getAttrs: (el) => ({ tag: (el as HTMLElement).getAttribute('data-merge-tag') }) }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes({ 'data-merge-tag': HTMLAttributes.tag }, HTMLAttributes), `{{${HTMLAttributes.tag}}}`]
  },

  addNodeView() {
    return ReactNodeViewRenderer(MergeTagNodeView)
  },
})
