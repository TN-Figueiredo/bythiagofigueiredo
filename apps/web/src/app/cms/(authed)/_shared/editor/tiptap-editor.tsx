'use client'

import './editor-styles.css'
import { useRef, useState, useMemo, useEffect, type MutableRefObject } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import type { Extension, Mark, Node as TiptapNode } from '@tiptap/core'
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
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableCell } from '@tiptap/extension-table-cell'
import { MergeTagExtension } from './merge-tag-node'
import { CTAButtonExtension } from './cta-button-node'
import { SocialEmbedExtension, detectProvider, type EmbedProvider } from './social-embed-node'
import { CalloutExtension } from './callout-node'
import { ToggleWrapperExtension, ToggleTitleExtension, ToggleBodyExtension } from './toggle-node'
import { ColumnsExtension, ColumnExtension } from './columns-node'
import { PlaylistEmbedExtension } from './playlist-embed-node'
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
  /** Additional TipTap extensions to register (e.g. BlogImageExtension for blog editor). */
  extraExtensions?: Array<Extension | Mark | TiptapNode>
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
  extraExtensions,
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
            attrs: { text: 'Click Here', url: '', align: 'center' },
          }).run()
        },
        onInsertMergeTag: (tag: string) => {
          editorRef.current?.chain().focus().insertContent({
            type: 'mergeTag',
            attrs: { tag },
          }).run()
        },
        onInsertSocialEmbed: insertEmbed,
        onInsertCallout: () => {
          editorRef.current?.chain().focus().insertContent({
            type: 'callout',
            attrs: { variant: 'info' },
            content: [{ type: 'text', text: '' }],
          }).run()
        },
        onInsertToggle: () => {
          editorRef.current?.chain().focus().insertContent({
            type: 'toggleWrapper',
            content: [
              { type: 'toggleTitle', content: [{ type: 'text', text: 'Click to expand' }] },
              { type: 'toggleBody', content: [{ type: 'paragraph' }] },
            ],
          }).run()
        },
        onInsertColumns: () => {
          editorRef.current?.chain().focus().insertContent({
            type: 'columns',
            attrs: { ratio: '1:1' },
            content: [
              { type: 'column', content: [{ type: 'paragraph' }] },
              { type: 'column', content: [{ type: 'paragraph' }] },
            ],
          }).run()
        },
        onInsertTable: () => {
          editorRef.current?.chain().focus().insertContentAt(
            editorRef.current.state.selection.anchor,
            {
              type: 'table',
              content: Array.from({ length: 3 }, (_, i) => ({
                type: 'tableRow',
                content: Array.from({ length: 3 }, () => ({
                  type: i === 0 ? 'tableHeader' : 'tableCell',
                  content: [{ type: 'paragraph' }],
                })),
              })),
            },
          )
        },
        onInsertChecklist: () => {
          editorRef.current?.chain().focus().insertContent({
            type: 'taskList',
            content: [{ type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph' }] }],
          }).run()
        },
        onInsertPlaylist: () => {
          editorRef.current?.chain().focus().insertContent({
            type: 'playlistEmbed',
            attrs: {},
          }).run()
        },
      }),
    [],
  )

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
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
      CalloutExtension,
      ToggleWrapperExtension,
      ToggleTitleExtension,
      ToggleBodyExtension,
      ColumnsExtension,
      ColumnExtension,
      PlaylistEmbedExtension,
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      slashCommandExtension,
      ...(extraExtensions ?? []),
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

  // `editable` só é aplicado na criação pelo useEditor — sincroniza toggles em
  // runtime (ex.: lápis View/Edit do editor de blog) no editor vivo.
  useEffect(() => {
    if (editor && editor.isEditable !== editable) editor.setEditable(editable)
  }, [editor, editable])

  // Sync initial content into editor when it becomes available.
  // With `immediatelyRender: false`, the editor is created in a useEffect after
  // mount. If the `content` prop was available during creation, the editor should
  // already have it. However, TipTap silently drops content if nodeFromJSON fails
  // (e.g., due to extension registration timing with `next/dynamic`), falling back
  // to an empty doc. This effect retries up to MAX_SYNC_ATTEMPTS with a delay to
  // account for extension registration timing.
  const contentSyncAttemptRef = useRef(0)
  const MAX_SYNC_ATTEMPTS = 3

  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    if (!content || typeof content === 'string') return

    const jsonContent = content as JSONContent

    // Check if `content` prop actually has meaningful content
    const nodes = jsonContent.content ?? []
    const isContentEmpty =
      nodes.length === 0 ||
      (nodes.length === 1 &&
        nodes[0]?.type === 'paragraph' &&
        (!nodes[0]?.content || nodes[0]?.content?.length === 0))

    if (isContentEmpty) return

    // Reset attempt counter when content identity changes
    contentSyncAttemptRef.current = 0
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    function trySync() {
      if (!editor || editor.isDestroyed) return
      if (contentSyncAttemptRef.current >= MAX_SYNC_ATTEMPTS) return

      const doc = editor.getJSON()
      const isEditorEmpty =
        doc.content?.length === 1 &&
        doc.content[0]?.type === 'paragraph' &&
        (!doc.content[0]?.content || doc.content[0]?.content?.length === 0)

      if (isEditorEmpty) {
        contentSyncAttemptRef.current++
        editor.commands.setContent(jsonContent, { emitUpdate: false })

        // Verify it took — if still empty, retry after a delay
        const afterDoc = editor.getJSON()
        const stillEmpty =
          afterDoc.content?.length === 1 &&
          afterDoc.content[0]?.type === 'paragraph' &&
          (!afterDoc.content[0]?.content || afterDoc.content[0]?.content?.length === 0)

        if (stillEmpty && contentSyncAttemptRef.current < MAX_SYNC_ATTEMPTS) {
          retryTimer = setTimeout(trySync, 150)
        }
      }
    }

    // First attempt immediately, then retry with delay if needed
    trySync()

    return () => {
      if (retryTimer) clearTimeout(retryTimer)
    }
  }, [editor, content])

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
            attrs: { text: 'Click Here', url: '', align: 'center' },
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
        onInsertCallout={() => {
          editorRef.current?.chain().focus().insertContent({
            type: 'callout',
            attrs: { variant: 'info' },
            content: [{ type: 'text', text: '' }],
          }).run()
        }}
        onInsertTable={() => {
          editorRef.current?.chain().focus().insertContentAt(
            editorRef.current.state.selection.anchor,
            {
              type: 'table',
              content: Array.from({ length: 3 }, (_, i) => ({
                type: 'tableRow',
                content: Array.from({ length: 3 }, () => ({
                  type: i === 0 ? 'tableHeader' : 'tableCell',
                  content: [{ type: 'paragraph' }],
                })),
              })),
            },
          )
        }}
        onInsertColumns={() => {
          editorRef.current?.chain().focus().insertContent({
            type: 'columns',
            attrs: { ratio: '1:1' },
            content: [
              { type: 'column', content: [{ type: 'paragraph' }] },
              { type: 'column', content: [{ type: 'paragraph' }] },
            ],
          }).run()
        }}
        onInsertPlaylist={() => {
          editorRef.current?.chain().focus().insertContent({
            type: 'playlistEmbed',
            attrs: {},
          }).run()
        }}
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
