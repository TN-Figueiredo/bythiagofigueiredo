'use client'

import { useEffect } from 'react'
import { useEditor, EditorContent, useEditorState } from '@tiptap/react'
import type { Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import Link from '@tiptap/extension-link'
import { TaskList } from '@tiptap/extension-task-list'
import { TaskItem } from '@tiptap/extension-task-item'
import { Placeholder } from '@tiptap/extensions'
import {
  Bold as BoldIcon,
  Italic as ItalicIcon,
  Underline as UnderlineIcon,
  Highlighter,
  Heading2,
  Heading3,
  Quote,
  List,
  ListOrdered,
  ListChecks,
  Link as LinkIcon,
  Undo2,
  Redo2,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TipTapEditorProps {
  html: string
  editable: boolean
  onChange?: (html: string) => void
  placeholder?: string
}

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

interface ToolbarProps {
  editor: Editor
}

function TipTapToolbar({ editor }: ToolbarProps) {
  // Subscribe to the editor's active-mark/node state so the toolbar highlights
  // track pure caret moves (selection changes don't re-render on their own).
  const active = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      highlight: e.isActive('highlight'),
      h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }),
      blockquote: e.isActive('blockquote'),
      bulletList: e.isActive('bulletList'),
      orderedList: e.isActive('orderedList'),
      taskList: e.isActive('taskList'),
      link: e.isActive('link'),
    }),
  })

  const onLink = () => {
    const previous = (editor.getAttributes('link').href as string | undefined) ?? ''
    const url = window.prompt('URL do link:', previous)
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  return (
    <div className="tt-toolbar">
      <button
        type="button"
        className={'tt-btn' + (active.bold ? ' on' : '')}
        title="Negrito"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <BoldIcon size={15} />
      </button>
      <button
        type="button"
        className={'tt-btn' + (active.italic ? ' on' : '')}
        title="Itálico"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <ItalicIcon size={15} />
      </button>
      <button
        type="button"
        className={'tt-btn' + (active.underline ? ' on' : '')}
        title="Sublinhado"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon size={15} />
      </button>
      <button
        type="button"
        className={'tt-btn hl' + (active.highlight ? ' on' : '')}
        title="Destaque"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleHighlight().run()}
      >
        <Highlighter size={15} />
      </button>

      <span className="tt-sep" />

      <button
        type="button"
        className={'tt-btn' + (active.h2 ? ' on' : '')}
        title="Título"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 size={15} />
      </button>
      <button
        type="button"
        className={'tt-btn' + (active.h3 ? ' on' : '')}
        title="Subtítulo"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 size={15} />
      </button>
      <button
        type="button"
        className={'tt-btn' + (active.blockquote ? ' on' : '')}
        title="Nota / citação"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote size={15} />
      </button>

      <span className="tt-sep" />

      <button
        type="button"
        className={'tt-btn' + (active.bulletList ? ' on' : '')}
        title="Lista"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List size={15} />
      </button>
      <button
        type="button"
        className={'tt-btn' + (active.orderedList ? ' on' : '')}
        title="Lista numerada"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered size={15} />
      </button>
      <button
        type="button"
        className={'tt-btn' + (active.taskList ? ' on' : '')}
        title="Checklist"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
      >
        <ListChecks size={15} />
      </button>
      <button
        type="button"
        className={'tt-btn' + (active.link ? ' on' : '')}
        title="Link"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onLink}
      >
        <LinkIcon size={15} />
      </button>

      <span className="tt-sep" />

      <button
        type="button"
        className="tt-btn"
        title="Desfazer"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo2 size={15} />
      </button>
      <button
        type="button"
        className="tt-btn"
        title="Refazer"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo2 size={15} />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

export function TipTapEditor({
  html,
  editable,
  onChange,
  placeholder = 'Escreva…',
}: TipTapEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        // Add the standalone Link below so we control its options exactly.
        link: false,
      }),
      Underline,
      Highlight,
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: 'noopener', target: '_blank' },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder }),
    ],
    content: html || '<p></p>',
    // Provenance guard: TipTap fires onUpdate once on load (HTML normalization).
    // Persisting unconditionally would flip a doc's author to "Você" on mere read.
    onUpdate: ({ editor }) => {
      if (editor.isEditable) onChange?.(editor.getHTML())
    },
  })

  // Keep editability in sync when the parent toggles read/edit.
  useEffect(() => {
    if (editor && editor.isEditable !== editable) {
      editor.setEditable(editable)
    }
  }, [editor, editable])

  // Sync external HTML changes (e.g. switching docs) without firing onUpdate.
  useEffect(() => {
    if (!editor) return
    const next = html || '<p></p>'
    if (editor.getHTML() !== next) {
      editor.commands.setContent(next, { emitUpdate: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, html])

  if (!editor) {
    // Graceful render before the editor mounts (SSR / empty html).
    return (
      <div className="tt-wrap reading">
        <div
          className="tt-prose ProseMirror"
          dangerouslySetInnerHTML={{ __html: html || '<p></p>' }}
        />
      </div>
    )
  }

  return (
    <div className={'tt-wrap' + (editable ? ' editing' : ' reading')}>
      {editable && <TipTapToolbar editor={editor} />}
      <EditorContent editor={editor} className="tt-prose" />
    </div>
  )
}
