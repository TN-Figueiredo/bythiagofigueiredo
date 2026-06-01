'use client'

import { useMemo, useCallback, useState, useEffect, useRef } from 'react'
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
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ slug })
        if (blogPostId) params.set('exclude_post_id', blogPostId)
        const res = await fetch(`/api/blog/check-slug?${params.toString()}`, {
          signal: controller.signal,
        })
        if (!res.ok) return
        const { exists } = await res.json() as { exists: boolean }
        setConflict(exists)
      } catch {
        // Aborted or network error — ignore
      }
    }, 500)
    return () => { clearTimeout(timer); controller.abort() }
  }, [slug, blogPostId])

  return conflict
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SeoWarning({ message }: { message: string }) {
  return (
    <div
      className="mb-3 flex items-center gap-2 rounded-md px-3 py-2 text-xs"
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
        className="text-[10px] font-bold uppercase tracking-widest mr-1"
        style={{ color: 'var(--gem-dim)' }}
      >
        Seções
      </span>
      {headings.map((h, i) => (
        <span key={i} className="contents">
          {i > 0 && <span style={{ color: 'var(--gem-border)' }}>·</span>}
          <span
            className="text-xs"
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

export function DraftRenderer({ content, isEditing, lang, format, onContentChange, blogPostId: propBlogPostId }: RendererProps) {
  const draft = useMemo(() => extractDraftContent(content), [content])

  const headings = useMemo(() => {
    if (isJSONContent(draft.body)) return extractHeadings(draft.body)
    return []
  }, [draft.body])

  const blogPostId = useMemo(() => {
    if (propBlogPostId) return propBlogPostId
    if (content && typeof content === 'object' && !Array.isArray(content)) {
      const obj = content as Record<string, unknown>
      return typeof obj.blog_post_id === 'string' ? obj.blog_post_id : null
    }
    return null
  }, [propBlogPostId, content])

  const slugConflict = useSlugValidation(draft.slug, blogPostId)

  const contentRef = useRef(content)
  contentRef.current = content

  // Track whether user has manually edited the slug
  const slugTouched = useRef(false)

  const updateField = useCallback((field: string, value: unknown) => {
    const base = typeof contentRef.current === 'object' && !Array.isArray(contentRef.current)
      ? contentRef.current as Record<string, unknown>
      : {}
    onContentChange({ ...base, [field]: value })
  }, [onContentChange])

  // Auto-derive slug from title when slug hasn't been manually touched
  useEffect(() => {
    if (isEditing && draft.title && !slugTouched.current) {
      updateField('slug', slugify(draft.title))
    }
  }, [draft.title, isEditing, updateField])

  const handleBodyChange = useCallback((json: JSONContent) => {
    const base = typeof contentRef.current === 'object' && !Array.isArray(contentRef.current)
      ? contentRef.current as Record<string, unknown>
      : {}
    onContentChange({ ...base, body: json })
  }, [onContentChange])

  const isBlogPost = format === 'blog_post'

  const isEmpty =
    !draft.body ||
    (typeof draft.body === 'string' && !draft.body.trim()) ||
    (isJSONContent(draft.body) && !draft.body.content?.length)

  if (!isEditing && isEmpty && !isBlogPost) {
    return (
      <div className="p-5 text-xs text-center py-8" style={{ color: 'var(--gem-dim)' }}>
        Nenhum rascunho ainda.
      </div>
    )
  }

  // Character count color for excerpt
  const excerptLen = draft.excerpt?.length ?? 0
  const excerptCountColor =
    excerptLen >= 290 ? '#ef4444' :
    excerptLen >= 250 ? 'var(--gem-warn)' :
    'var(--gem-dim)'

  // Auto-open structured fields in read mode when they have content
  const hasStructuredContent = draft.key_points.length > 0 || !!draft.pull_quote || !!draft.colophon

  const fullSlugUrl = `bythiagofigueiredo.com/blog/${lang}/`

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
          {/* Title */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--gem-dim)' }}>Titulo do Post</div>
            {isEditing ? (
              <input
                className="w-full text-2xl font-bold bg-transparent border-none outline-none focus-visible:ring-2 focus-visible:ring-[var(--gem-accent)]/30 focus-visible:ring-offset-1 text-[var(--foreground)] placeholder:text-[var(--muted)]"
                placeholder="Titulo do post..."
                aria-label="Post title"
                value={draft.title}
                onChange={e => updateField('title', e.target.value)}
              />
            ) : (
              <div className="text-2xl font-bold text-[var(--foreground)]">
                {draft.title || <span style={{ color: 'var(--gem-dim)' }}>Sem titulo</span>}
              </div>
            )}
          </div>

          {/* Slug */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--gem-dim)' }}>URL do Post</div>
            {isEditing ? (
              <div className="flex items-center gap-1 text-xs text-[var(--muted)]">
                <span className="shrink-0 opacity-60">{fullSlugUrl}</span>
                <input
                  className="bg-transparent border-b border-[var(--border)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--gem-accent)]/30 focus-visible:ring-offset-1 text-[var(--muted)] flex-1"
                  placeholder="slug-do-post"
                  aria-label="URL slug"
                  value={draft.slug}
                  onChange={e => {
                    slugTouched.current = true
                    updateField('slug', slugify(e.target.value))
                  }}
                  onBlur={() => {
                    if (!draft.slug && draft.title) updateField('slug', slugify(draft.title))
                  }}
                />
                {slugConflict && <span className="text-red-400">Slug ja existe</span>}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-[var(--muted)]">
                  {fullSlugUrl}{draft.slug || '---'}
                </span>
                {draft.slug && (
                  <button
                    onClick={() => navigator.clipboard.writeText(`https://${fullSlugUrl}${draft.slug}`)}
                    className="text-xs text-[var(--gem-dim)] hover:text-[var(--foreground)] transition-colors"
                    aria-label="Copy URL"
                    title="Copiar URL"
                  >
                    &#x1F4CB;
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Excerpt */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--gem-dim)' }}>Resumo (Excerpt)</div>
            {isEditing ? (
              <>
                <textarea
                  className="w-full text-sm italic text-[var(--muted)] bg-transparent border-l-2 border-amber-500/20 pl-3 resize-none outline-none focus-visible:ring-2 focus-visible:ring-[var(--gem-accent)]/30 focus-visible:ring-offset-1"
                  placeholder="Resumo do post (excerpt)..."
                  aria-label="Post excerpt"
                  rows={2}
                  maxLength={300}
                  value={draft.excerpt}
                  onChange={e => updateField('excerpt', e.target.value)}
                />
                <p className="text-right text-[10px] mt-0.5" style={{ color: excerptCountColor }}>
                  {excerptLen}/300
                </p>
              </>
            ) : (
              <p className="text-sm italic text-[var(--muted)] border-l-2 border-amber-500/20 pl-3">
                {draft.excerpt || <span style={{ color: 'var(--gem-dim)' }}>Sem resumo</span>}
              </p>
            )}
          </div>
        </div>
      )}

      {!isEditing && <SectionOutline headings={headings} />}

      <PipelineEditor
        content={draft.body}
        isEditing={isEditing}
        onContentChange={handleBodyChange}
        preset={isBlogPost ? 'blog' : 'full'}
        placeholder="Escreva o conteudo do seu rascunho..."
      />

      {/* Blog post: structured fields below the editor */}
      {isBlogPost && (
        <details
          className="mt-4 border border-[var(--border)] rounded-lg"
          open={!isEditing && hasStructuredContent ? true : undefined}
        >
          <summary className="px-3 py-2 text-xs font-semibold cursor-pointer text-[var(--muted)] hover:text-[var(--foreground)]">
            Destaques e Extras
          </summary>
          <div className="p-3 space-y-3">
            <div>
              <label className="text-xs text-[var(--muted)] mb-1 block">Key Points</label>
              {(draft.key_points || []).map((kp: string, i: number) => (
                <div key={i} className="flex items-center gap-1 mb-1">
                  <input
                    className="flex-1 text-xs bg-[var(--gem-well)] rounded px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-[var(--gem-accent)]/30 focus-visible:ring-offset-1"
                    aria-label={`Key point ${i + 1}`}
                    value={kp}
                    readOnly={!isEditing}
                    onChange={e => {
                      const u = [...(draft.key_points || [])]
                      u[i] = e.target.value
                      updateField('key_points', u)
                    }}
                  />
                  {isEditing && (
                    <button
                      onClick={() => {
                        const u = draft.key_points.filter((_, j) => j !== i)
                        updateField('key_points', u)
                      }}
                      className="text-xs text-red-400 hover:text-red-300 ml-1"
                      aria-label={`Remove key point ${i + 1}`}
                    >
                      &times;
                    </button>
                  )}
                </div>
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
                className="w-full text-xs bg-[var(--gem-well)] rounded px-2 py-1 resize-none outline-none focus-visible:ring-2 focus-visible:ring-[var(--gem-accent)]/30 focus-visible:ring-offset-1"
                rows={2}
                value={draft.pull_quote || ''}
                readOnly={!isEditing}
                onChange={e => updateField('pull_quote', e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-[var(--muted)] mb-1 block">Colophon</label>
              <input
                className="w-full text-xs bg-[var(--gem-well)] rounded px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-[var(--gem-accent)]/30 focus-visible:ring-offset-1"
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
