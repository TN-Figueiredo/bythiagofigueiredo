'use client'

import type { Editor } from '@tiptap/react'
import { BubbleMenu as TipTapBubbleMenu } from '@tiptap/react/menus'
import { Bold, Italic, Underline, Strikethrough, Link2, Code } from 'lucide-react'
import { useState } from 'react'

interface BubbleMenuProps {
  editor: Editor
}

function BubbleButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void
  active?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        active ? 'bg-white/20 text-white' : 'text-gray-300 hover:text-white hover:bg-white/10'
      }`}
    >
      {children}
    </button>
  )
}

function BubbleLinkEditor({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const [url, setUrl] = useState(editor.getAttributes('link').href ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (url.trim()) {
      editor.chain().focus().setLink({ href: url.trim() }).run()
    } else {
      editor.chain().focus().unsetLink().run()
    }
    onClose()
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-1.5 ml-1.5 pl-1.5 border-l border-gray-600">
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://..."
        className="w-44 bg-gray-700 border-0 rounded px-2 py-1 text-xs text-white placeholder-gray-400 outline-none focus:ring-1 focus:ring-purple-400"
        autoFocus
      />
      <button type="submit" className="text-xs text-purple-400 hover:text-purple-300 font-medium px-1">
        OK
      </button>
    </form>
  )
}

export function EditorBubbleMenu({ editor }: BubbleMenuProps) {
  const [showLink, setShowLink] = useState(false)

  return (
    <TipTapBubbleMenu
      editor={editor}
      updateDelay={150}
      shouldShow={({ editor: e, from, to }: { editor: Editor; from: number; to: number }) => {
        if (from === to) return false
        if (e.isActive('image')) return false
        if (e.isActive('ctaButton')) return false
        return true
      }}
    >
      <div className="flex items-center bg-gray-900 rounded-lg shadow-xl px-1 py-0.5 gap-0.5">
        <BubbleButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold">
          <Bold size={14} />
        </BubbleButton>
        <BubbleButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic">
          <Italic size={14} />
        </BubbleButton>
        <BubbleButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline">
          <Underline size={14} />
        </BubbleButton>
        <BubbleButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough">
          <Strikethrough size={14} />
        </BubbleButton>
        <BubbleButton onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="Code">
          <Code size={14} />
        </BubbleButton>
        <BubbleButton
          onClick={() => setShowLink(!showLink)}
          active={editor.isActive('link')}
          title="Link"
        >
          <Link2 size={14} />
        </BubbleButton>
        {showLink && <BubbleLinkEditor editor={editor} onClose={() => setShowLink(false)} />}
      </div>
    </TipTapBubbleMenu>
  )
}
