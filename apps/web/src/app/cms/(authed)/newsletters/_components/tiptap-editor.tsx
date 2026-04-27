'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import type { JSONContent } from '@tiptap/core'
import { MergeTagExtension } from './merge-tag-node'
import { CTAButtonExtension } from './cta-button-node'
import { EditorToolbar } from './editor-toolbar'

interface TipTapEditorProps {
  content: JSONContent | null
  onChange: (json: JSONContent, html: string) => void
  onImageUpload: (file: File) => Promise<string | null>
  editable?: boolean
  placeholder?: string
}

export function TipTapEditor({
  content,
  onChange,
  onImageUpload,
  editable = true,
  placeholder = 'Start writing your newsletter...',
}: TipTapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: 'noopener noreferrer nofollow' },
      }),
      Image.configure({
        HTMLAttributes: { loading: 'lazy' },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Placeholder.configure({ placeholder }),
      CharacterCount,
      MergeTagExtension,
      CTAButtonExtension,
    ],
    content: content ?? undefined,
    editable,
    onUpdate: ({ editor: e }) => {
      onChange(e.getJSON(), e.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[400px] px-6 py-4',
      },
      transformPastedHTML(html) {
        return html
          .replace(/class="[^"]*"/gi, '')
          .replace(/style="[^"]*mso[^"]*"/gi, '')
          .replace(/<o:p>[\s\S]*?<\/o:p>/gi, '')
          .replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, '')
      },
      handleDrop(view, event) {
        const files = event.dataTransfer?.files
        if (!files || files.length === 0) return false
        const file = files[0]
        if (!file || !file.type.startsWith('image/')) return false

        event.preventDefault()
        onImageUpload(file).then((url) => {
          if (url) {
            const { schema } = view.state
            const imageNode = schema.nodes['image']
            if (!imageNode) return
            const node = imageNode.create({ src: url })
            const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })
            if (pos) {
              const tr = view.state.tr.insert(pos.pos, node)
              view.dispatch(tr)
            }
          }
        })
        return true
      },
      handlePaste(view, event) {
        const items = event.clipboardData?.items
        if (!items) return false

        for (const item of Array.from(items)) {
          if (item.type.startsWith('image/')) {
            event.preventDefault()
            const file = item.getAsFile()
            if (!file) return false
            onImageUpload(file).then((url) => {
              if (url) {
                const { schema } = view.state
                const imageNode = schema.nodes['image']
                if (!imageNode) return
                const node = imageNode.create({ src: url })
                const tr = view.state.tr.replaceSelectionWith(node)
                view.dispatch(tr)
              }
            })
            return true
          }
        }
        return false
      },
    },
  })

  const charCount = editor?.storage.characterCount
  const wordCount = charCount?.words() ?? 0

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <EditorToolbar
        editor={editor}
        onInsertMergeTag={(tag) => {
          editor?.chain().focus().insertContent({
            type: 'mergeTag',
            attrs: { tag },
          }).run()
        }}
        onInsertCTAButton={() => {
          editor?.chain().focus().insertContent({
            type: 'ctaButton',
            attrs: { text: 'Click Here', url: '', color: '#7c3aed', align: 'center' },
          }).run()
        }}
        onImageUpload={onImageUpload}
      />
      <EditorContent editor={editor} />
      <div className="border-t border-gray-200 px-4 py-2 text-xs text-gray-400 flex justify-between">
        <span>{charCount?.characters() ?? 0} characters</span>
        <span>~{wordCount} words</span>
      </div>
    </div>
  )
}
