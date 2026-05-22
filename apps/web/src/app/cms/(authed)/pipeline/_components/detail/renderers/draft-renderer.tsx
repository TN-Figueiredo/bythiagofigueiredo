'use client'

import { useMemo, useCallback, useState, useEffect } from 'react'
import type { RendererProps } from '../section-content'
import { PipelineEditor, isJSONContent, extractHeadings, type JSONContent } from '../editors/pipeline-editor'

// ── Helpers ────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// ── Types ──────────────────────────────────────────────────────────────────

interface BlogDraftContent {
  body: string | JSONContent
  title: string
  slug: string
  excerpt: string
  key_points: string[]
  pull_quote: string
  notes: string[]
  colophon: string
  tag_id: string | null
  hashtag_ids: string[]
  cover_image_url: string | null
  seo: Record<string, unknown> | null
}

// ── extractDraftContent ────────────────────────────────────────────────────

function extractDraftContent(content: RendererProps['content']): BlogDraftContent & { hasMisplacedSeo: boolean } {
  const empty: BlogDraftContent = {
    body: '',
    title: '',
    slug: '',
    excerpt: '',
    key_points: [],
    pull_quote: '',
    notes: [],
    colophon: '',
    tag_id: null,
    hashtag_ids: [],
    cover_image_url: null,
    seo: null,
  }

  if (typeof content === 'string') {
    return { ...empty, body: content, hasMisplacedSeo: false }
  }
  if (isJSONContent(content)) {
    return { ...empty, body: content, hasMisplacedSeo: false }
  }
  if (content && typeof content === 'object' && !Array.isArray(content)) {
    const obj = content as Record<string, unknown>
    const body = (obj.body ?? '') as string | JSONContent
    const seo = obj.seo && typeof obj.seo === 'object' ? (obj.seo as Record<string, unknown>) : null

    return {
      body,
      title: typeof obj.title === 'string' ? obj.title : '',
      slug: typeof obj.slug === 'string' ? obj.slug : '',
      excerpt: typeof obj.excerpt === 'string' ? obj.excerpt : '',
      key_points: Array.isArray(obj.key_points) ? obj.key_points.map(String) : [],
      pull_quote: typeof obj.pull_quote === 'string' ? obj.pull_quote : '',
      notes: Array.isArray(obj.notes) ? obj.notes.map(String) : [],
      colophon: typeof obj.colophon === 'string' ? obj.colophon : '',
      tag_id: typeof obj.tag_id === 'string' ? obj.tag_id : null,
      hashtag_ids: Array.isArray(obj.hashtag_ids) ? obj.hashtag_ids.map(String) : [],
      cover_image_url: typeof obj.cover_image_url === 'string' ? obj.cover_image_url : null,
      seo,
      hasMisplacedSeo: seo !== null,
    }
  }
  return { ...empty, hasMisplacedSeo: false }
}

// ── useSlugValidation ──────────────────────────────────────────────────────

function useSlugValidation(slug: string, blogPostId: string | null) {
  const [conflict, setConflict] = useState(false)

  useEffect(() => {
    if (!slug.trim()) {
      setConflict(false)
      return
    }
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ slug })
        if (blogPostId) params.set('exclude_post_id', blogPostId)
        const res = await fetch(`/api/blog/check-slug?${params.toString()}`)
        const { exists } = await res.json() as { exists: boolean }
        setConflict(exists)
      } catch {
        setConflict(false)
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [slug, blogPostId])

  return conflict
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SeoWarning({ message }: { message: string }) {
  return (
    <div
      className="mb-3 flex items-center gap-2 rounded-md px-3 py-2 text-[11px]"
      style={{
        background: 'color-mix(in srgb, var(--gem-warn) 8%, transparent)',
        border: '1px solid color-mix(in srgb, var(--gem-warn) 25%, transparent)',
        color: 'var(--gem-warn)',
      }}
    >
      {message}
    </div>
  )
}

function SectionOutline({ headings }: { headings: string[] }) {
  if (headings.length < 2) return null

  return (
    <div
      className="flex items-center gap-2 flex-wrap rounded-md px-3 py-2.5 mb-4"
      style={{ background: 'var(--gem-well)', border: '1px solid var(--gem-border)' }}
    >
      <span
        className="text-[9px] font-bold uppercase tracking-widest mr-1"
        style={{ color: 'var(--gem-dim)' }}
      >
        Seções
      </span>
      {headings.map((h, i) => (
        <span key={i} className="contents">
          {i > 0 && <span style={{ color: 'var(--gem-border)' }}>·</span>}
          <span
            className="text-[11px]"
            style={{ color: i === 0 ? 'var(--gem-accent)' : 'var(--gem-muted)' }}
          >
            {h}
          </span>
        </span>
      ))}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export function DraftRenderer({ content, isEditing, lang, format, onContentChange }: RendererProps) {
  const draft = useMemo(() => extractDraftContent(content), [content])

  const headings = useMemo(() => {
    if (isJSONContent(draft.body)) return extractHeadings(draft.body)
    return []
  }, [draft.body])

  // blog_post_id may be stored inside the content object itself (linked after graduation)
  const blogPostId = useMemo(() => {
    if (content && typeof content === 'object' && !Array.isArray(content)) {
      const obj = content as Record<string, unknown>
      return typeof obj.blog_post_id === 'string' ? obj.blog_post_id : null
    }
    return null
  }, [content])

  const slugConflict = useSlugValidation(draft.slug, blogPostId)

  function updateField(field: string, value: unknown) {
    const updated = { ...(content as Record<string, unknown>), [field]: value }
    onContentChange(updated)
  }

  const handleBodyChange = useCallback(
    (json: JSONContent) => {
      if (draft.seo) {
        onContentChange({ body: json, seo: draft.seo })
      } else {
        onContentChange({ ...(content as Record<string, unknown>), body: json })
      }
    },
    [draft.seo, content, onContentChange],
  )

  const isBlogPost = format === 'blog_post'

  const isEmpty =
    !draft.body ||
    (typeof draft.body === 'string' && !draft.body.trim()) ||
    (isJSONContent(draft.body) && !draft.body.content?.length)

  if (!isEditing && isEmpty && !isBlogPost) {
    return (
      <div className="p-5 text-[11px] text-center py-8" style={{ color: 'var(--gem-dim)' }}>
        Nenhum rascunho ainda.
      </div>
    )
  }

  return (
    <div className="p-5">
      {draft.hasMisplacedSeo && (
        <SeoWarning
          message={
            isEditing
              ? 'Dados SEO detectados nesta seção. Mova-os para a aba SEO.'
              : 'Dados SEO detectados nesta seção — verifique a aba SEO.'
          }
        />
      )}

      {/* Blog post: title, slug, excerpt above the editor */}
      {isBlogPost && (
        <div className="space-y-3 mb-4">
          <input
            className="w-full text-2xl font-bold bg-transparent border-none outline-none text-[var(--foreground)] placeholder:text-[var(--muted)]"
            placeholder="Título do post..."
            value={draft.title}
            onChange={e => updateField('title', e.target.value)}
            readOnly={!isEditing}
          />
          <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
            <span>/blog/{lang}/</span>
            <input
              className="bg-transparent border-b border-[var(--border)] outline-none text-[var(--muted)] flex-1"
              placeholder="slug-do-post"
              value={draft.slug}
              onChange={e => updateField('slug', slugify(e.target.value))}
              onBlur={() => {
                if (!draft.slug && draft.title) updateField('slug', slugify(draft.title))
              }}
              readOnly={!isEditing}
            />
            {slugConflict && <span className="text-red-400">Slug já existe</span>}
          </div>
          <textarea
            className="w-full text-sm italic text-[var(--muted)] bg-transparent border-l-2 border-amber-500/20 pl-3 resize-none outline-none"
            placeholder="Resumo do post (excerpt)..."
            rows={2}
            value={draft.excerpt}
            onChange={e => updateField('excerpt', e.target.value)}
            readOnly={!isEditing}
          />
        </div>
      )}

      {!isEditing && <SectionOutline headings={headings} />}

      <PipelineEditor
        content={draft.body}
        isEditing={isEditing}
        onContentChange={handleBodyChange}
        preset={isBlogPost ? 'blog' : 'full'}
        placeholder="Escreva o conteúdo do seu rascunho..."
      />

      {/* Blog post: structured fields below the editor */}
      {isBlogPost && (
        <details className="mt-4 border border-[var(--border)] rounded-lg">
          <summary className="px-3 py-2 text-xs font-semibold cursor-pointer text-[var(--muted)] hover:text-[var(--foreground)]">
            Campos Estruturados
          </summary>
          <div className="p-3 space-y-3">
            <div>
              <label className="text-xs text-[var(--muted)] mb-1 block">Key Points</label>
              {(draft.key_points || []).map((kp: string, i: number) => (
                <input
                  key={i}
                  className="w-full text-xs bg-[var(--gem-well)] rounded px-2 py-1 mb-1 outline-none"
                  value={kp}
                  readOnly={!isEditing}
                  onChange={e => {
                    const u = [...(draft.key_points || [])]
                    u[i] = e.target.value
                    updateField('key_points', u)
                  }}
                />
              ))}
              {isEditing && (
                <button
                  onClick={() => updateField('key_points', [...(draft.key_points || []), ''])}
                  className="text-xs text-indigo-400"
                >
                  + Add
                </button>
              )}
            </div>
            <div>
              <label className="text-xs text-[var(--muted)] mb-1 block">Pull Quote</label>
              <textarea
                className="w-full text-xs bg-[var(--gem-well)] rounded px-2 py-1 resize-none outline-none"
                rows={2}
                value={draft.pull_quote || ''}
                readOnly={!isEditing}
                onChange={e => updateField('pull_quote', e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-[var(--muted)] mb-1 block">Colophon</label>
              <input
                className="w-full text-xs bg-[var(--gem-well)] rounded px-2 py-1 outline-none"
                value={draft.colophon || ''}
                readOnly={!isEditing}
                onChange={e => updateField('colophon', e.target.value)}
              />
            </div>
          </div>
        </details>
      )}
    </div>
  )
}
