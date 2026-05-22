'use client'

import type { Editor } from '@tiptap/react'
import {
  Undo2,
  Redo2,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
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
  TableIcon,
  Columns2,
  Image as ImageIcon,
  Youtube,
  Twitter,
  Instagram,
  Github,
  Braces,
} from 'lucide-react'
import { PROVIDER_META, type EmbedProvider } from '@/app/cms/(authed)/_shared/editor/social-embed-node'

interface PipelineToolbarProps {
  editor: Editor
  preset: 'full' | 'compact' | 'blog'
}

function promptLink(editor: Editor) {
  if (editor.isActive('link')) {
    editor.chain().focus().unsetLink().run()
    return
  }
  const url = window.prompt('URL:')
  if (!url) return
  try {
    const parsed = new URL(url, 'https://placeholder.invalid')
    if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) return
  } catch {
    return
  }
  editor.chain().focus().setLink({ href: url }).run()
}

function promptImage(editor: Editor) {
  const url = window.prompt('URL da imagem:')
  if (!url) return
  try {
    const parsed = new URL(url, 'https://placeholder.invalid')
    if (!['http:', 'https:'].includes(parsed.protocol)) return
  } catch {
    return
  }
  editor.chain().focus().setImage({ src: url }).run()
}

const EMBED_ICONS: Partial<Record<EmbedProvider, React.ReactNode>> = {
  youtube: <Youtube size={14} />,
  twitter: <Twitter size={14} />,
  instagram: <Instagram size={14} />,
  codesandbox: <Code2 size={14} />,
  codepen: <Braces size={14} />,
  github: <Github size={14} />,
}

const EMBED_ORDER: EmbedProvider[] = ['youtube', 'twitter', 'instagram', 'codesandbox', 'codepen', 'github']

function insertEmbed(editor: Editor, provider: EmbedProvider) {
  editor.chain().focus().insertContent({ type: 'socialEmbed', attrs: { provider, url: '' } }).run()
}

function insertTable(editor: Editor) {
  editor.chain().focus().insertContentAt(editor.state.selection.anchor, {
    type: 'table',
    content: Array.from({ length: 3 }, (_, i) => ({
      type: 'tableRow',
      content: Array.from({ length: 3 }, () => ({
        type: i === 0 ? 'tableHeader' : 'tableCell',
        content: [{ type: 'paragraph' }],
      })),
    })),
  })
}

function insertColumns(editor: Editor) {
  editor.chain().focus().insertContent({
    type: 'columns',
    attrs: { ratio: '1:1' },
    content: [
      { type: 'column', content: [{ type: 'paragraph' }] },
      { type: 'column', content: [{ type: 'paragraph' }] },
    ],
  }).run()
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
        role="toolbar"
        aria-label="Formatação de texto"
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
          onClick={() => promptLink(editor)}
          title="Link (Ctrl+K)"
        >
          <Link2 size={s} />
        </Btn>
      </div>
    )
  }

  return (
    <div
      role="toolbar"
      aria-label="Formatação de texto"
      className="flex items-center gap-0.5 px-2 py-1.5 flex-wrap"
      style={{ borderBottom: '1px solid var(--gem-border)', background: 'var(--gem-surface)' }}
    >
      {/* Row 1: undo/redo, headings, inline formatting */}
      <Btn disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()} title="Desfazer">
        <Undo2 size={s} />
      </Btn>
      <Btn disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()} title="Refazer">
        <Redo2 size={s} />
      </Btn>
      <Sep />
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
      <Btn active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()} title="Alinhar esquerda">
        <AlignLeft size={s} />
      </Btn>
      <Btn active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()} title="Centralizar">
        <AlignCenter size={s} />
      </Btn>
      <Btn active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()} title="Alinhar direita">
        <AlignRight size={s} />
      </Btn>
      <Sep />
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
      <Btn active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Citação">
        <Quote size={s} />
      </Btn>
      <Btn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Divisor">
        <Minus size={s} />
      </Btn>
      <Sep />
      <Btn
        active={editor.isActive('link')}
        onClick={() => promptLink(editor)}
        title="Link (Ctrl+K)"
      >
        <Link2 size={s} />
      </Btn>
      <Btn onClick={() => promptImage(editor)} title="Imagem (URL)">
        <ImageIcon size={s} />
      </Btn>
      <Sep />
      <Btn
        active={editor.isActive('callout')}
        onClick={() => editor.chain().focus().insertContent({ type: 'callout', attrs: { variant: 'info' }, content: [{ type: 'text', text: ' ' }] }).run()}
        title="Callout"
      >
        <MessageSquare size={s} />
      </Btn>
      <Btn active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="Bloco de código">
        <Code2 size={s} />
      </Btn>
      <Btn onClick={() => insertTable(editor)} title="Tabela">
        <TableIcon size={s} />
      </Btn>
      <Btn onClick={() => insertColumns(editor)} title="Colunas">
        <Columns2 size={s} />
      </Btn>
      {EMBED_ORDER.map((provider) => (
        <Btn key={provider} onClick={() => insertEmbed(editor, provider)} title={`Embed ${PROVIDER_META[provider].label}`}>
          {EMBED_ICONS[provider]}
        </Btn>
      ))}
    </div>
  )
}
