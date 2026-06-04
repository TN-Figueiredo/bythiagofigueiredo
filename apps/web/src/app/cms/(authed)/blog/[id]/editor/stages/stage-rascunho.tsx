'use client'

import { useCallback, useRef, useEffect, useMemo, type ChangeEvent } from 'react'
import dynamic from 'next/dynamic'
import type { Editor } from '@tiptap/react'
import type { JSONContent } from '@tiptap/core'
import { useEditorState, useEditorDispatch, useEditorVersion } from '../context'
import { BlogImageExtension } from '../image-block/blog-image-extension'

const TipTapEditor = dynamic(
  () =>
    import('@/app/cms/(authed)/_shared/editor/tiptap-editor').then((m) => ({
      default: m.TipTapEditor,
    })),
  {
    ssr: false,
    loading: () => (
      <div data-testid="tiptap-slot" className="min-h-[200px]" />
    ),
  },
)

/* ------------------------------------------------------------------ */
/*  Toolbar button config                                             */
/* ------------------------------------------------------------------ */

const TOOLBAR_BUTTONS = [
  { label: 'Bold', icon: 'B', className: 'font-bold' },
  { label: 'Italic', icon: 'I', className: 'italic' },
  { label: 'H2', icon: 'H2', className: 'font-semibold text-xs' },
  { label: 'Quote', icon: '“', className: 'text-lg leading-none' },
  { label: 'List', icon: '•', className: 'text-lg leading-none' },
  { label: 'Link', icon: '🔗', className: '' },
  { label: 'Image', icon: '🖼', className: '' },
] as const

/* ------------------------------------------------------------------ */
/*  Category color dot                                                */
/* ------------------------------------------------------------------ */

const CATEGORY_COLORS: Record<string, string> = {
  Tecnologia: 'bg-blue-500',
  Carreira: 'bg-emerald-500',
  Opiniao: 'bg-amber-500',
  Tutorial: 'bg-violet-500',
}

function categoryDotColor(category: string): string {
  return CATEGORY_COLORS[category] ?? 'bg-zinc-500'
}

/* ------------------------------------------------------------------ */
/*  StageRascunho                                                     */
/* ------------------------------------------------------------------ */

export function StageRascunho() {
  const state = useEditorState()
  const dispatch = useEditorDispatch()
  const version = useEditorVersion()

  const { shared, activeLang } = state
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const editorRef = useRef<Editor | null>(null)

  const blogExtensions = useMemo(() => [BlogImageExtension], [])

  const handleEditorChange = useCallback(
    (json: JSONContent, html: string) => {
      const wordCount =
        editorRef.current?.storage?.characterCount?.words?.() ?? 0
      const readTime = wordCount > 0 ? Math.ceil(wordCount / 200) : 0
      dispatch({ type: 'SET_BODY', body: json, html, words: wordCount, readTime })
    },
    [dispatch],
  )

  const handleImageUpload = useCallback(
    async (_file: File): Promise<string | null> => {
      // Real upload wiring happens with MediaGallery integration
      return null
    },
    [],
  )

  /* ---- Auto-grow title textarea ---- */

  useEffect(() => {
    const el = titleRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [version?.title])

  /* ---- Title handler ---- */

  const handleTitleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      dispatch({ type: 'SET_TITLE', title: e.target.value })
    },
    [dispatch],
  )

  /* ---- Derived values ---- */

  const langFlag = activeLang === 'pt' ? '\u{1F1E7}\u{1F1F7}' : '\u{1F1EC}\u{1F1E7}'
  const category = shared.category || '—'
  const readTime =
    version && version.readTime > 0
      ? `${version.readTime} min`
      : '—'
  const wordCount = (version?.words ?? 0).toLocaleString('pt-BR')

  /* ---- Render ---- */

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-8">
      {/* Editable title */}
      <textarea
        ref={titleRef}
        data-testid="doc-title"
        value={version?.title ?? ''}
        onChange={handleTitleChange}
        placeholder="Titulo do post"
        rows={1}
        className="w-full resize-none border-0 bg-transparent text-[38px] leading-tight text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-0"
        style={{ fontWeight: 600 }}
      />

      {/* Meta line */}
      <div
        data-testid="doc-meta"
        className="flex flex-wrap items-center gap-3 text-sm text-zinc-400"
      >
        <span>{langFlag}</span>
        <span className="text-zinc-600">&middot;</span>
        <span className="flex items-center gap-1.5">
          <span
            className={`inline-block h-2 w-2 rounded-full ${categoryDotColor(category)}`}
            aria-hidden="true"
          />
          {category}
        </span>
        <span className="text-zinc-600">&middot;</span>
        <span>{readTime}</span>
        <span className="text-zinc-600">&middot;</span>
        <span>{wordCount} palavras</span>
      </div>

      {/* Writing toolbar */}
      <div
        data-testid="doc-toolbar"
        className="flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900/60 px-2 py-1.5"
      >
        {TOOLBAR_BUTTONS.map((btn) => (
          <button
            key={btn.label}
            type="button"
            aria-label={btn.label}
            className={`rounded px-2 py-1 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200 ${btn.className}`}
          >
            {btn.icon}
          </button>
        ))}
      </div>

      {/* TipTap editor */}
      <TipTapEditor
        content={version?.body ?? null}
        onChange={handleEditorChange}
        onImageUpload={handleImageUpload}
        editable={true}
        placeholder="Comece a escrever..."
        editorInstanceRef={editorRef}
        extraExtensions={blogExtensions}
      />
    </div>
  )
}
