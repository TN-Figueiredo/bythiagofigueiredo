'use client'

import * as React from 'react'
import type { CompiledMdx } from '../types/content'
import { EditorToolbar, applyToolbarAction, type ToolbarAction } from './toolbar'
import { EditorPreview } from './preview'
import { AssetPicker } from './asset-picker'
import { getEditorStrings } from './strings'
import { useAutosave } from '../hooks/use-autosave'
import { getNewDraftId, clearNewDraftId } from '../hooks/new-draft-id'

export interface SavePostInput {
  content_mdx: string
  title: string
  slug: string
  excerpt?: string | null
  meta_title?: string | null
  meta_description?: string | null
  og_image_url?: string | null
  cover_image_url?: string | null
}

export type SaveResult =
  | { ok: true; postId?: string }
  | { ok: false; error: 'validation_failed'; fields: Record<string, string> }
  | { ok: false; error: 'compile_failed'; message: string }
  | { ok: false; error: 'db_error'; message: string }

export interface PostEditorProps {
  /** Pass when editing an existing post — used to key autosave storage. */
  postId?: string
  initialContent: string
  initialTitle?: string
  initialSlug?: string
  initialExcerpt?: string | null
  initialMetaTitle?: string | null
  initialMetaDescription?: string | null
  initialOgImageUrl?: string | null
  initialCoverImageUrl?: string | null
  locale: string
  componentNames: string[]
  onSave: (input: SavePostInput) => Promise<SaveResult>
  onPreview: (source: string) => Promise<CompiledMdx>
  onUpload?: (file: File) => Promise<{ url: string }>
  /** Disable autosave (default: enabled). */
  autosaveDisabled?: boolean
}

interface DraftSnapshot {
  source: string
  title: string
  slug: string
  excerpt: string
  metaTitle: string
  metaDescription: string
  ogImageUrl: string
  coverImageUrl: string
}

export function PostEditor(props: PostEditorProps) {
  const s = getEditorStrings(props.locale)
  const [source, setSource] = React.useState(props.initialContent)
  const [title, setTitle] = React.useState(props.initialTitle ?? '')
  const [slug, setSlug] = React.useState(props.initialSlug ?? '')
  const [excerpt, setExcerpt] = React.useState(props.initialExcerpt ?? '')
  const [metaTitle, setMetaTitle] = React.useState(props.initialMetaTitle ?? '')
  const [metaDescription, setMetaDescription] = React.useState(
    props.initialMetaDescription ?? '',
  )
  const [ogImageUrl, setOgImageUrl] = React.useState(props.initialOgImageUrl ?? '')
  const [coverImageUrl, setCoverImageUrl] = React.useState(
    props.initialCoverImageUrl ?? '',
  )
  const [seoOpen, setSeoOpen] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  // For drafts without a real postId, mint a per-tab session id so two tabs
  // editing "new post" don't clobber each other in localStorage.
  const newDraftIdRef = React.useRef<string | null>(null)
  if (!props.postId && newDraftIdRef.current == null) {
    newDraftIdRef.current = getNewDraftId('post')
  }
  const draftKeyId = props.postId ?? newDraftIdRef.current ?? 'new'
  const autosaveKey = `post-draft:${draftKeyId}`
  const autosaveValue = React.useMemo<DraftSnapshot>(
    () => ({
      source,
      title,
      slug,
      excerpt,
      metaTitle,
      metaDescription,
      ogImageUrl,
      coverImageUrl,
    }),
    [source, title, slug, excerpt, metaTitle, metaDescription, ogImageUrl, coverImageUrl],
  )
  const autosave = useAutosave<DraftSnapshot>(autosaveKey, autosaveValue, {
    enabled: !props.autosaveDisabled,
  })

  function applyDraft(snap: DraftSnapshot) {
    setSource(snap.source)
    setTitle(snap.title)
    setSlug(snap.slug)
    setExcerpt(snap.excerpt)
    setMetaTitle(snap.metaTitle ?? '')
    setMetaDescription(snap.metaDescription ?? '')
    setOgImageUrl(snap.ogImageUrl ?? '')
    setCoverImageUrl(snap.coverImageUrl ?? '')
  }

  function handleRestore() {
    const snap = autosave.restore()
    if (snap) applyDraft(snap)
  }

  function handleToolbarAction(action: ToolbarAction) {
    const ta = textareaRef.current
    if (!ta) return
    const { source: next, selectionStart } = applyToolbarAction(
      source,
      { start: ta.selectionStart, end: ta.selectionEnd },
      action,
      s.toolbarPlaceholders,
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
        meta_title: metaTitle || null,
        meta_description: metaDescription || null,
        og_image_url: ogImageUrl || null,
        cover_image_url: coverImageUrl || null,
      })
      if (!result.ok) {
        if (result.error === 'validation_failed') {
          setError(s.validationFailed(Object.keys(result.fields)))
        } else {
          setError(result.message)
        }
      } else {
        // Successful save — clear any residual draft.
        autosave.discard()
        if (!props.postId) {
          // New draft got a real id on the server; release the session id so
          // the next "new" draft mints a fresh one.
          clearNewDraftId('post')
        }
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div data-post-editor>
      {autosave.hasDraft && (
        <div role="status" data-testid="autosave-banner">
          <span>{s.autosaveRestoreBanner}</span>{' '}
          <button type="button" onClick={handleRestore}>
            {s.autosaveRestore}
          </button>{' '}
          <button type="button" onClick={() => autosave.discard()}>
            {s.autosaveDiscard}
          </button>
        </div>
      )}

      <div>
        <label>
          {s.titleLabel}
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label>
          {s.slugLabel}
          <input type="text" value={slug} onChange={(e) => setSlug(e.target.value)} />
        </label>
        <label>
          {s.excerptLabel}
          <input type="text" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} />
        </label>
      </div>

      <div data-testid="cover-image-field">
        <label>
          {s.coverImageLabel}
          <input
            type="text"
            aria-label={s.coverImageLabel}
            value={coverImageUrl}
            onChange={(e) => setCoverImageUrl(e.target.value)}
          />
        </label>
        {props.onUpload && (
          <AssetPicker
            locale={props.locale}
            onUpload={async (file) => {
              const result = await props.onUpload!(file)
              setCoverImageUrl(result.url)
              return result
            }}
          />
        )}
        {coverImageUrl && (
          <button type="button" onClick={() => setCoverImageUrl('')}>
            {s.coverImageClear}
          </button>
        )}
      </div>

      <details open={seoOpen} onToggle={(e) => setSeoOpen((e.target as HTMLDetailsElement).open)}>
        <summary>{s.seoSectionLabel}</summary>
        <label>
          {s.seoTitleLabel}
          <input
            type="text"
            value={metaTitle}
            onChange={(e) => setMetaTitle(e.target.value)}
          />
        </label>
        <label>
          {s.seoDescriptionLabel}
          <textarea
            value={metaDescription}
            onChange={(e) => setMetaDescription(e.target.value)}
            rows={3}
          />
        </label>
        <label>
          {s.ogImageUrlLabel}
          <input
            type="text"
            value={ogImageUrl}
            onChange={(e) => setOgImageUrl(e.target.value)}
          />
        </label>
      </details>

      <EditorToolbar onAction={handleToolbarAction} componentNames={props.componentNames} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <textarea
          ref={textareaRef}
          aria-label="content"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          rows={30}
        />
        <EditorPreview source={source} locale={props.locale} onCompile={props.onPreview} />
      </div>

      {error && <p role="alert">{error}</p>}

      <button type="button" disabled={saving} onClick={handleSave}>
        {saving ? s.savingButton : s.saveButton}
      </button>
    </div>
  )
}
