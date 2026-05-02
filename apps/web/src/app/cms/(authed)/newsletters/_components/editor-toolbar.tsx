'use client'

import { useRef, useState, useEffect } from 'react'
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
  Quote,
  Minus,
  Link2,
  Image,
  RectangleHorizontal,
  Maximize2,
  Minimize2,
  Heading1,
  Heading2,
  Heading3,
  Pilcrow,
  Tags,
} from 'lucide-react'
import { MERGE_TAGS } from './merge-tag-node'

interface EditorToolbarProps {
  editor: Editor | null
  onInsertMergeTag: (tag: string) => void
  onInsertCTAButton: () => void
  onImageUpload: (file: File) => Promise<string | null>
  onImageInserted?: () => void
  isFullscreen?: boolean
  onToggleFullscreen?: () => void
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded-md transition-colors ${
        active
          ? 'bg-indigo-500/15 text-[#818cf8]'
          : 'text-[#6b7280] hover:bg-[#1f2937] hover:text-[#d1d5db]'
      } disabled:opacity-30 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  )
}

function ToolbarDivider() {
  return <div className="w-px h-5 bg-[#1f2937] mx-0.5" />
}

function LinkPopover({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const [url, setUrl] = useState(editor.getAttributes('link').href ?? '')
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) onClose()
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

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
    <div ref={popoverRef} className="absolute top-full left-0 mt-1 z-50 bg-[#111827] border border-[#374151] rounded-lg shadow-lg p-2 flex items-center gap-2">
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
          className="w-64 border border-[#374151] bg-[#0a0f1a] text-[#d1d5db] rounded-md px-2.5 py-1.5 text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none"
          autoFocus
        />
        <button
          type="submit"
          className="px-2.5 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-md hover:bg-indigo-700"
        >
          Apply
        </button>
        {editor.isActive('link') && (
          <button
            type="button"
            onClick={() => { editor.chain().focus().unsetLink().run(); onClose() }}
            className="px-2.5 py-1.5 text-red-400 text-xs font-medium rounded-md hover:bg-red-500/10"
          >
            Remove
          </button>
        )}
      </form>
    </div>
  )
}

function MergeTagDropdown({ onSelect }: { onSelect: (tag: string) => void }) {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div className="relative" ref={dropdownRef}>
      <ToolbarButton
        onClick={() => setOpen(!open)}
        title="Insert merge tag"
        active={open}
      >
        <Tags size={16} />
      </ToolbarButton>
      {open && (
        <div className="absolute top-full right-0 mt-1 z-50 bg-[#111827] border border-[#374151] rounded-lg shadow-lg py-1 min-w-56">
          <div className="px-3 py-1.5 text-xs font-medium text-[#6b7280] uppercase tracking-wide">Merge Tags</div>
          {MERGE_TAGS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => { onSelect(t.value); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-sm text-[#d1d5db] hover:bg-indigo-500/10 hover:text-[#818cf8] flex items-center gap-2"
            >
              <span className="font-mono text-xs text-[#a78bfa] bg-purple-500/10 px-1.5 py-0.5 rounded">{`{{${t.value}}}`}</span>
              <span className="text-[#6b7280] text-xs">{t.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function EditorToolbar({
  editor,
  onInsertMergeTag,
  onInsertCTAButton,
  onImageUpload,
  onImageInserted,
  isFullscreen,
  onToggleFullscreen,
}: EditorToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showLinkPopover, setShowLinkPopover] = useState(false)

  if (!editor) return null

  return (
    <div className="flex flex-wrap items-center gap-0.5 border border-[#1f2937] rounded-lg bg-[#0a0f1a] px-3 py-2 mx-16 mt-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0]
          if (!file) return
          const url = await onImageUpload(file)
          if (url) {
            editor.chain().focus().setImage({ src: url }).run()
            onImageInserted?.()
          }
          e.target.value = ''
        }}
      />

      {/* Undo / Redo */}
      <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo (⌘Z)">
        <Undo2 size={16} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo (⌘⇧Z)">
        <Redo2 size={16} />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Block type */}
      <ToolbarButton onClick={() => editor.chain().focus().setParagraph().run()} active={editor.isActive('paragraph')} title="Paragraph">
        <Pilcrow size={16} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Heading 1">
        <Heading1 size={16} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2">
        <Heading2 size={16} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Heading 3">
        <Heading3 size={16} />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Inline formatting */}
      <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold (⌘B)">
        <Bold size={16} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic (⌘I)">
        <Italic size={16} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline (⌘U)">
        <Underline size={16} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough">
        <Strikethrough size={16} />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Alignment */}
      <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Align left">
        <AlignLeft size={16} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Align center">
        <AlignCenter size={16} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Align right">
        <AlignRight size={16} />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Lists & blocks */}
      <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list">
        <List size={16} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered list">
        <ListOrdered size={16} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Blockquote">
        <Quote size={16} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Divider">
        <Minus size={16} />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Link */}
      <div className="relative">
        <ToolbarButton
          onClick={() => setShowLinkPopover(!showLinkPopover)}
          active={editor.isActive('link')}
          title="Insert link (⌘K)"
        >
          <Link2 size={16} />
        </ToolbarButton>
        {showLinkPopover && (
          <LinkPopover editor={editor} onClose={() => setShowLinkPopover(false)} />
        )}
      </div>

      {/* Image */}
      <ToolbarButton onClick={() => fileInputRef.current?.click()} title="Insert image">
        <Image size={16} />
      </ToolbarButton>

      {/* CTA Button */}
      <ToolbarButton onClick={onInsertCTAButton} title="Insert CTA button">
        <RectangleHorizontal size={16} />
      </ToolbarButton>

      {/* Merge Tags */}
      <MergeTagDropdown onSelect={onInsertMergeTag} />

      {/* Spacer + Word Count + Fullscreen */}
      <div className="flex-1" />
      <span className="text-[10px] text-[#6b7280] tabular-nums mr-2">
        {editor.storage.characterCount?.words() ?? 0} words
      </span>
      {onToggleFullscreen && (
        <ToolbarButton onClick={onToggleFullscreen} title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}>
          {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </ToolbarButton>
      )}
    </div>
  )
}
