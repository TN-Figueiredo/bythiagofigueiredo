'use client'

import * as React from 'react'
import type { CompiledMdx } from '../types/content'
import { EditorToolbar, applyToolbarAction, type ToolbarAction } from './toolbar'
import { EditorPreview } from './preview'

export interface SavePostInput {
  content_mdx: string
  title: string
  slug: string
  excerpt?: string | null
}

export type SaveResult =
  | { ok: true; postId?: string }
  | { ok: false; error: 'validation_failed'; fields: Record<string, string> }
  | { ok: false; error: 'compile_failed'; message: string }
  | { ok: false; error: 'db_error'; message: string }

export interface PostEditorProps {
  initialContent: string
  initialTitle?: string
  initialSlug?: string
  initialExcerpt?: string | null
  locale: string
  componentNames: string[]
  onSave: (input: SavePostInput) => Promise<SaveResult>
  onPreview: (source: string) => Promise<CompiledMdx>
  onUpload?: (file: File) => Promise<{ url: string }>
}

export function PostEditor(props: PostEditorProps) {
  const [source, setSource] = React.useState(props.initialContent)
  const [title, setTitle] = React.useState(props.initialTitle ?? '')
  const [slug, setSlug] = React.useState(props.initialSlug ?? '')
  const [excerpt, setExcerpt] = React.useState(props.initialExcerpt ?? '')
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  function handleToolbarAction(action: ToolbarAction) {
    const ta = textareaRef.current
    if (!ta) return
    const { source: next, selectionStart } = applyToolbarAction(
      source,
      { start: ta.selectionStart, end: ta.selectionEnd },
      action,
    )
    setSource(next)
    window.setTimeout(() => {
      ta.focus()
      ta.setSelectionRange(selectionStart, selectionStart)
    }, 0)
  }

  async function handleSave() {
    setError(null)
    setSaving(true)
    try {
      const result = await props.onSave({
        content_mdx: source,
        title,
        slug,
        excerpt: excerpt || null,
      })
      if (!result.ok) {
        if (result.error === 'validation_failed') {
          setError(`Campos inválidos: ${Object.keys(result.fields).join(', ')}`)
        } else {
          setError(result.message)
        }
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div data-post-editor>
      <div>
        <label>
          Título
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label>
          Slug
          <input type="text" value={slug} onChange={(e) => setSlug(e.target.value)} />
        </label>
        <label>
          Excerpt
          <input type="text" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} />
        </label>
      </div>

      <EditorToolbar onAction={handleToolbarAction} componentNames={props.componentNames} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <textarea
          ref={textareaRef}
          aria-label="content"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          rows={30}
        />
        <EditorPreview source={source} onCompile={props.onPreview} />
      </div>

      {error && <p role="alert">{error}</p>}

      <button type="button" disabled={saving} onClick={handleSave}>
        {saving ? 'Salvando…' : 'Salvar'}
      </button>
    </div>
  )
}
