'use client'

import type { Editor } from '@tiptap/react'
import {
  Bold,
  Italic,
  Underline,
  List,
  Quote,
  Mic,
  Camera,
  Navigation,
  Timer,
} from 'lucide-react'
import { TAG_OPTIONS, type ScriptTagName } from './script-tag-extension'

interface ScriptBeatToolbarProps {
  editor: Editor
}

const TAG_ICONS: Record<ScriptTagName, React.ReactNode> = {
  VISUAL: <Camera size={13} />,
  DIRECTION: <Navigation size={13} />,
  NARRACAO: <Mic size={13} />,
}

const TAG_TITLES: Record<ScriptTagName, string> = {
  VISUAL: 'Visual note (Cmd+Shift+V)',
  DIRECTION: 'Direction note (Cmd+Shift+D)',
  NARRACAO: 'Narration note (Cmd+Shift+N)',
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
  return <div className="w-px h-3.5 mx-0.5" style={{ background: 'var(--gem-border)' }} />
}

export function ScriptBeatToolbar({ editor }: ScriptBeatToolbarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Beat text formatting"
      className="flex items-center gap-0.5 px-2 py-1 flex-wrap"
      style={{
        borderBottom: '1px solid var(--gem-border)',
        background: 'var(--gem-surface)',
      }}
    >
      <Btn
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Bold (Ctrl+B)"
      >
        <Bold size={13} />
      </Btn>
      <Btn
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italic (Ctrl+I)"
      >
        <Italic size={13} />
      </Btn>
      <Btn
        active={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        title="Underline (Ctrl+U)"
      >
        <Underline size={13} />
      </Btn>
      <Sep />
      <Btn
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title="Bullet list"
      >
        <List size={13} />
      </Btn>
      <Btn
        active={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        title="Reference block"
      >
        <Quote size={13} />
      </Btn>
      <Sep />
      {TAG_OPTIONS.map((tag) => (
        <Btn
          key={tag}
          onClick={() => {
            editor
              .chain()
              .focus()
              .insertContent({ type: 'scriptTag', attrs: { tag }, content: [{ type: 'text', text: ' ' }] })
              .run()
          }}
          title={TAG_TITLES[tag]}
        >
          {TAG_ICONS[tag]}
        </Btn>
      ))}
      <Btn
        onClick={() => {
          editor
            .chain()
            .focus()
            .insertContent({ type: 'scriptPause', attrs: { duration: 0.5 } })
            .run()
        }}
        title="Pause marker (Cmd+Shift+P)"
      >
        <Timer size={13} />
      </Btn>
    </div>
  )
}
