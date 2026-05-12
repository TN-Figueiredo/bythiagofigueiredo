'use client'

import type { Editor } from '@tiptap/react'
import {
  Undo2,
  Redo2,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  Minus,
  Link2,
  Heading2,
  Heading3,
  Heading4,
  Pilcrow,
  Code2,
  MessageSquare,
} from 'lucide-react'

interface PipelineToolbarProps {
  editor: Editor
  preset: 'full' | 'compact'
}

function Btn({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active?: boolean
  disabled?: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1 rounded transition-colors ${disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer hover:bg-white/5'}`}
      style={{
        color: active ? 'var(--gem-accent)' : 'var(--gem-muted)',
        background: active ? 'color-mix(in srgb, var(--gem-accent) 15%, transparent)' : undefined,
      }}
    >
      {children}
    </button>
  )
}

function Sep() {
  return <div className="w-px h-4 mx-0.5" style={{ background: 'var(--gem-border)' }} />
}

export function PipelineToolbar({ editor, preset }: PipelineToolbarProps) {
  const s = 14

  if (preset === 'compact') {
    return (
      <div
        className="flex items-center gap-0.5 px-2 py-1.5 flex-wrap"
        style={{ borderBottom: '1px solid var(--gem-border)', background: 'var(--gem-surface)' }}
      >
        <Btn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Negrito (Ctrl+B)">
          <Bold size={s} />
        </Btn>
        <Btn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Itálico (Ctrl+I)">
          <Italic size={s} />
        </Btn>
        <Sep />
        <Btn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Lista">
          <List size={s} />
        </Btn>
        <Btn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Lista numerada">
          <ListOrdered size={s} />
        </Btn>
        <Sep />
        <Btn
          active={editor.isActive('link')}
          onClick={() => {
            if (editor.isActive('link')) {
              editor.chain().focus().unsetLink().run()
              return
            }
            const url = window.prompt('URL:')
            if (url) editor.chain().focus().setLink({ href: url }).run()
          }}
          title="Link (Ctrl+K)"
        >
          <Link2 size={s} />
        </Btn>
      </div>
    )
  }

  return (
    <div
      className="flex items-center gap-0.5 px-2 py-1.5 flex-wrap"
      style={{ borderBottom: '1px solid var(--gem-border)', background: 'var(--gem-surface)' }}
    >
      {/* Undo / Redo */}
      <Btn disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()} title="Desfazer">
        <Undo2 size={s} />
      </Btn>
      <Btn disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()} title="Refazer">
        <Redo2 size={s} />
      </Btn>
      <Sep />

      {/* Block type */}
      <Btn active={editor.isActive('paragraph')} onClick={() => editor.chain().focus().setParagraph().run()} title="Parágrafo">
        <Pilcrow size={s} />
      </Btn>
      <Btn active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Título H2">
        <Heading2 size={s} />
      </Btn>
      <Btn active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Título H3">
        <Heading3 size={s} />
      </Btn>
      <Btn active={editor.isActive('heading', { level: 4 })} onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()} title="Título H4">
        <Heading4 size={s} />
      </Btn>
      <Sep />

      {/* Inline formatting */}
      <Btn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Negrito (Ctrl+B)">
        <Bold size={s} />
      </Btn>
      <Btn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Itálico (Ctrl+I)">
        <Italic size={s} />
      </Btn>
      <Btn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Sublinhado (Ctrl+U)">
        <Underline size={s} />
      </Btn>
      <Btn active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="Tachado">
        <Strikethrough size={s} />
      </Btn>
      <Sep />

      {/* Lists */}
      <Btn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Lista">
        <List size={s} />
      </Btn>
      <Btn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Lista numerada">
        <ListOrdered size={s} />
      </Btn>
      <Btn active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()} title="Checklist">
        <ListTodo size={s} />
      </Btn>
      <Sep />

      {/* Link */}
      <Btn
        active={editor.isActive('link')}
        onClick={() => {
          if (editor.isActive('link')) {
            editor.chain().focus().unsetLink().run()
            return
          }
          const url = window.prompt('URL:')
          if (url) editor.chain().focus().setLink({ href: url }).run()
        }}
        title="Link (Ctrl+K)"
      >
        <Link2 size={s} />
      </Btn>
      <Sep />

      {/* Block elements */}
      <Btn active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Citação">
        <Quote size={s} />
      </Btn>
      <Btn active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="Bloco de código">
        <Code2 size={s} />
      </Btn>
      <Btn
        active={editor.isActive('callout')}
        onClick={() => editor.chain().focus().insertContent({ type: 'callout', attrs: { variant: 'info' }, content: [{ type: 'text', text: ' ' }] }).run()}
        title="Callout"
      >
        <MessageSquare size={s} />
      </Btn>
      <Btn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Divisor">
        <Minus size={s} />
      </Btn>
    </div>
  )
}
