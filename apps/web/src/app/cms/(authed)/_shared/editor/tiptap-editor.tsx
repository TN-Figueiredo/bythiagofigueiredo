'use client'

import './editor-styles.css'
import { useRef, useState, useMemo, useEffect, type MutableRefObject } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
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
import { SocialEmbedExtension, detectProvider, type EmbedProvider } from './social-embed-node'
import { EditorToolbar } from './editor-toolbar'
import { EditorBubbleMenu } from './bubble-menu'
import { createSlashCommandExtension } from './slash-commands'

interface TipTapEditorProps {
  content: JSONContent | string | null
  onChange: (json: JSONContent, html: string) => void
  onImageInserted?: () => void
  onImageUpload: (file: File) => Promise<string | null>
  editable?: boolean
  placeholder?: string
  onOpenGallery?: () => void
  /** Exposes the TipTap editor instance to the parent (e.g. for gallery image insertion). */
  editorInstanceRef?: MutableRefObject<Editor | null>
}

export function TipTapEditor({
  content,
  onChange,
  onImageInserted,
  onImageUpload,
  editable = true,
  placeholder = 'Start writing your newsletter... Type / for commands',
  onOpenGallery,
  editorInstanceRef,
}: TipTapEditorProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<ReturnType<typeof useEditor>>(null)
  const onImageUploadRef = useRef(onImageUpload)
  onImageUploadRef.current = onImageUpload
  const onImageInsertedRef = useRef(onImageInserted)
  onImageInsertedRef.current = onImageInserted

  const insertEmbed = (provider: EmbedProvider, url: string) => {
    editorRef.current?.chain().focus().insertContent({
      type: 'socialEmbed',
      attrs: { provider, url },
    }).run()
  }

  const slashCommandExtension = useMemo(
    () =>
      createSlashCommandExtension({
        onImageUpload: () => fileInputRef.current?.click(),
        onInsertCTAButton: () => {
          editorRef.current?.chain().focus().insertContent({
            type: 'ctaButton',
            attrs: { text: 'Click Here', url: '', color: '#7c3aed', align: 'center' },
          }).run()
        },
        onInsertMergeTag: (tag: string) => {
          editorRef.current?.chain().focus().insertContent({
            type: 'mergeTag',
            attrs: { tag },
          }).run()
        },
        onInsertSocialEmbed: insertEmbed,
      }),
    [],
  )

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
      SocialEmbedExtension,
      slashCommandExtension,
    ],
    content: content ?? undefined,
    editable,
    immediatelyRender: false,
    onUpdate: ({ editor: e }) => {
      onChange(e.getJSON(), e.getHTML())
    },
    editorProps: {
      attributes: {
        class: '',
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
        onImageUploadRef.current(file).then((url) => {
          if (url) {
            const { schema } = view.state
            const imageNode = schema.nodes['image']
            if (!imageNode) return
            const node = imageNode.create({ src: url })
            const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })
            if (pos) {
              const tr = view.state.tr.insert(pos.pos, node)
              view.dispatch(tr)
              onImageInsertedRef.current?.()
            }
          }
        })
        return true
      },
      handlePaste(view, event) {
        const items = event.clipboardData?.items
        if (!items) return false

        const text = event.clipboardData?.getData('text/plain')?.trim()
        if (text) {
          const provider = detectProvider(text)
          if (provider) {
            event.preventDefault()
            const { schema } = view.state
            const embedNode = schema.nodes['socialEmbed']
            if (embedNode) {
              const node = embedNode.create({ provider, url: text })
              const tr = view.state.tr.replaceSelectionWith(node)
              view.dispatch(tr)
            }
            return true
          }
        }

        for (const item of Array.from(items)) {
          if (item.type.startsWith('image/')) {
            event.preventDefault()
            const file = item.getAsFile()
            if (!file) return false
            onImageUploadRef.current(file).then((url) => {
              if (url) {
                const { schema } = view.state
                const imageNode = schema.nodes['image']
                if (!imageNode) return
                const node = imageNode.create({ src: url })
                const tr = view.state.tr.replaceSelectionWith(node)
                view.dispatch(tr)
                onImageInsertedRef.current?.()
              }
            })
            return true
          }
        }
        return false
      },
    },
  })

  editorRef.current = editor
  if (editorInstanceRef) editorInstanceRef.current = editor

  useEffect(() => {
    if (!isFullscreen) return
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsFullscreen(false)
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [isFullscreen])

  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isFullscreen])

  const charCount = editor?.storage.characterCount
  const wordCount = charCount?.words() ?? 0

  return (
    <div className={`newsletter-editor border border-[#1f2937] rounded-lg overflow-hidden flex flex-col ${
      isFullscreen ? 'fixed inset-0 z-50 rounded-none border-0' : ''
    }`}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0]
          if (!file || !editor) return
          const url = await onImageUpload(file)
          if (url) {
            editor.chain().focus().setImage({ src: url }).run()
            onImageInsertedRef.current?.()
          }
          e.target.value = ''
        }}
      />
      <EditorToolbar
        editor={editor}
        onImageInserted={onImageInserted}
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
        onInsertSocialEmbed={(provider, url) => {
          editor?.chain().focus().insertContent({
            type: 'socialEmbed',
            attrs: { provider, url },
          }).run()
        }}
        onImageUpload={onImageUpload}
        isFullscreen={isFullscreen}
        onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
        onOpenGallery={onOpenGallery}
      />
      <div className="flex-1 overflow-y-auto">
        {editor && <EditorBubbleMenu editor={editor} />}
        <EditorContent editor={editor} />
      </div>
      <div className="sticky bottom-0 border-t border-[#1f2937] px-4 py-2 text-xs text-[#6b7280] flex justify-between bg-[#030712]">
        <span>{charCount?.characters() ?? 0} characters</span>
        <div className="flex items-center gap-4">
          <span className="opacity-50">Type / for commands</span>
          <span>~{wordCount} words</span>
        </div>
      </div>
    </div>
  )
}
