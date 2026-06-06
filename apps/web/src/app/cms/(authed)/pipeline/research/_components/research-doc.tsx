'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ChevronLeft,
  Sparkles,
  ArrowRight,
  BookOpen,
  Pen,
  Target,
  Archive,
  FileText,
  Mail,
  Video,
} from 'lucide-react'
import type {
  ResearchItemFull,
  ResearchDecision,
  ThemeId,
} from '@/lib/pipeline/research-types'
import {
  STATUS_META,
  THEME_META,
  SOURCE_META,
} from '@/lib/pipeline/research-types'
import type { ResearchStatus } from '@/lib/pipeline/research-schemas'
import { StatusBadge, SourceTag } from './atoms'
import { TipTapEditor } from './tiptap-editor'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ResearchDocProps {
  item: ResearchItemFull
  onBack: () => void
  onItemUpdated: (updated: Partial<ResearchItemFull> & { id: string }) => void
  onMakeDecision?: (takeaway: string, themeId: ThemeId | null, sourceId: string) => void
  onOpenDecision?: (id: string) => void
  linkedDecisions?: ResearchDecision[]
  /** Initial read/edit mode. Defaults to 'read'; pass 'edit' for "Nova pesquisa". */
  initialMode?: 'read' | 'edit'
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Escape a raw string so it can be safely embedded inside HTML markup.
 * Used for the content_md fallback — markdown is plain text and must never be
 * injected as live HTML (parse breakage / injection).
 */
function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Resolve the HTML to feed the editor: strictly prefer content_html when
 * present; otherwise fall back to an HTML-escaped <pre> wrapping content_md.
 */
function resolveContentHtml(
  contentHtml: string | null,
  contentMd: string | null,
): string {
  if (contentHtml) return contentHtml
  if (contentMd) return `<pre>${escapeHtml(contentMd)}</pre>`
  return ''
}

/**
 * Read the new `version` off a save action's returned row. Save actions resolve
 * to `{ ok: true; data?: Record<string, unknown> }`; the updated row carries the
 * trigger-bumped version. If the row omits `version` (e.g. a future `.select()`
 * narrows the returned columns), fall back to `prev + 1` — the DB trigger always
 * bumps version on every successful UPDATE, so the next save must assume the bump
 * to avoid a latent stale-version chain.
 */
function readReturnedVersion(
  result: { ok: true; data?: Record<string, unknown> } | { ok: false; error: string },
  prev: number,
): number {
  if (result.ok && result.data && typeof result.data.version === 'number') {
    return result.data.version
  }
  return prev + 1
}

function authorshipLabel(source: string): string {
  switch (source) {
    case 'thiago':
      return 'Voce editou'
    case 'cowork':
      return 'Escrito pelo Claude Cowork'
    case 'dupla':
      return 'Cowork + voce'
    default:
      return source
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ResearchDoc({
  item,
  onBack,
  onItemUpdated,
  onMakeDecision,
  onOpenDecision,
  linkedDecisions = [],
  initialMode = 'read',
}: ResearchDocProps) {
  const router = useRouter()
  const titleRef = useRef<HTMLHeadingElement>(null)
  const [mode, setMode] = useState<'read' | 'edit'>(initialMode)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [statusError, setStatusError] = useState(false)
  const [titleError, setTitleError] = useState<string | null>(null)
  const [contentError, setContentError] = useState<string | null>(null)
  // Debounce-coalesce content saves so we don't fire a request per keystroke.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Latest content awaiting a debounced flush (so we can flush on unmount/blur).
  const pendingHtml = useRef<string | null>(null)
  // Track the optimistic-concurrency version across successive saves. The DB
  // trigger bumps `version` on every UPDATE, so we must propagate the returned
  // value or the next save hits a stale version and fails.
  const versionRef = useRef(item.version)
  // Serialize ALL writes (status / content / title) through a single in-flight
  // chain. Each save reads `versionRef.current` only AFTER the previous write
  // resolves, so two concurrent saves can never read the same stale version and
  // race the DB optimistic-concurrency `.eq('version')` guard.
  const inflightRef = useRef<Promise<unknown>>(Promise.resolve())
  // Guard against setState-after-unmount: post-await content writes check this.
  const mountedRef = useRef(true)

  // Keep the version ref in sync if the parent feeds a newer item.
  useEffect(() => {
    versionRef.current = item.version
  }, [item.version])

  // Flip the mounted flag on unmount so post-await callbacks can bail out.
  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  // Enqueue a write behind any in-flight write. The supplied job reads the
  // version, awaits its action, and updates `versionRef` only after the prior
  // write completed. A `.catch` keeps the chain alive after a failed write.
  const enqueueWrite = useCallback(
    <T,>(job: () => Promise<T>): Promise<T> => {
      const run = inflightRef.current.then(job)
      inflightRef.current = run.catch(() => {})
      return run
    },
    [],
  )

  const theme = item.theme_id ? THEME_META[item.theme_id] : null
  const sourceMeta = SOURCE_META[item.source]

  // ---- Status change handler ----
  const handleStatusChange = useCallback(
    async (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newStatus = e.target.value as ResearchStatus
      if (newStatus === item.status) return

      setStatusUpdating(true)
      setStatusError(false)
      try {
        await enqueueWrite(async () => {
          const { updateResearchStatus } = await import('../actions')
          const result = await updateResearchStatus(item.id, newStatus, versionRef.current)
          if (result.ok) {
            const nextVersion = readReturnedVersion(result, versionRef.current)
            versionRef.current = nextVersion
            onItemUpdated({ id: item.id, status: newStatus, version: nextVersion })
            router.refresh()
          } else {
            setStatusError(true)
            setTimeout(() => setStatusError(false), 3000)
          }
        })
      } finally {
        setStatusUpdating(false)
      }
    },
    [item.id, item.status, onItemUpdated, router, enqueueWrite]
  )

  // ---- Edit mode toggle ----
  const handleEditToggle = useCallback(() => {
    setMode((prev) => (prev === 'read' ? 'edit' : 'read'))
  }, [])

  // ---- Content persist (README §248: editing flips source → thiago, updated → now) ----
  // Flush the latest pending content immediately (on unmount / blur / nav).
  const flushContent = useCallback(async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    const html = pendingHtml.current
    if (html == null) return
    pendingHtml.current = null
    await enqueueWrite(async () => {
      try {
        onItemUpdated({ id: item.id, content_html: html, source: 'thiago' })
        const { saveResearchItem } = await import('../actions')
        const result = await saveResearchItem(item.id, versionRef.current, {
          content_html: html,
          source: 'thiago',
        })
        if (result.ok) {
          const nextVersion = readReturnedVersion(result, versionRef.current)
          versionRef.current = nextVersion
          if (mountedRef.current) {
            onItemUpdated({ id: item.id, version: nextVersion })
            setContentError(null)
            router.refresh()
          }
        } else if (mountedRef.current) {
          setContentError('Erro ao salvar conteudo')
        }
      } catch {
        if (mountedRef.current) setContentError('Erro ao salvar conteudo')
      }
    })
  }, [item.id, onItemUpdated, router, enqueueWrite])

  const handleContentChange = useCallback(
    (html: string) => {
      pendingHtml.current = html
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        void flushContent()
      }, 700)
    },
    [flushContent]
  )

  // Flush a pending content save on unmount so edits aren't lost on navigation.
  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current)
        saveTimer.current = null
      }
      if (pendingHtml.current != null) {
        void flushContent()
      }
    }
  }, [flushContent])

  // ---- "Usar em" handler — pushes the doc toward a downstream module ----
  const handleUseIn = useCallback(
    (where: string) => {
      toast.success(`Enviado para ${where}`, { description: item.title })
    },
    [item.title]
  )

  return (
    <div className="doc-view fade-in">
      {/* ---- Top bar ---- */}
      <div className="doc-bar">
        <button
          type="button"
          className="btn ghost sm"
          onClick={() => {
            void flushContent()
            onBack()
          }}
        >
          <ChevronLeft size={15} />
          Pesquisas
        </button>

        {theme && (
          <span className="doc-bar-crumb">
            <span
              className="tdot"
              style={{ background: theme.color }}
            />
            {theme.label}
          </span>
        )}

        <div style={{ flex: 1 }} />

        <SourceTag source={item.source} />

        {/* Read/Edit segmented control */}
        <div className="seg doc-mode">
          <button
            type="button"
            className={mode === 'read' ? 'on' : ''}
            onClick={() => setMode('read')}
          >
            <BookOpen size={13} />
            Ler
          </button>
          <button
            type="button"
            className={mode === 'edit' ? 'on' : ''}
            onClick={handleEditToggle}
          >
            <Pen size={13} />
            Editar
          </button>
        </div>
      </div>

      {/* ---- Main grid: content + inspector ---- */}
      <div className="doc-grid">
        {/* ---- Main column ---- */}
        <div className="doc-main">
          {/* Header */}
          <div className="doc-head">
            {theme && (
              <div className="doc-kicker">
                <span
                  className="tdot"
                  style={{ background: theme.color }}
                />
                {theme.label}
              </div>
            )}
            <div className="doc-eyebrow">
              <StatusBadge status={item.status} />
              <span
                className="rcard-time"
                style={{
                  fontSize: 12,
                  color: 'var(--text-dim)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {item.read_min} min de leitura
                {' · '}
                {formatRelativeDate(item.updated_at)}
              </span>
            </div>

            {/* Title */}
            {mode === 'edit' ? (
              <>
                <h1
                  ref={titleRef}
                  className="doc-title-h1 doc-title-edit"
                  contentEditable
                  suppressContentEditableWarning
                  spellCheck={false}
                  onBlur={async (e) => {
                    const text = (e.currentTarget.textContent ?? '').trim()
                    if (text && text !== item.title) {
                      await enqueueWrite(async () => {
                        try {
                          onItemUpdated({ id: item.id, title: text })
                          const { saveResearchItem } = await import('../actions')
                          const result = await saveResearchItem(
                            item.id,
                            versionRef.current,
                            { title: text },
                          )
                          if (!result.ok) throw new Error(result.error)
                          const nextVersion = readReturnedVersion(result, versionRef.current)
                          versionRef.current = nextVersion
                          onItemUpdated({ id: item.id, version: nextVersion })
                          router.refresh()
                        } catch {
                          // Revert title in the DOM and local state
                          if (titleRef.current) {
                            titleRef.current.textContent = item.title
                          }
                          onItemUpdated({ id: item.id, title: item.title })
                          setTitleError('Erro ao salvar titulo')
                          setTimeout(() => setTitleError(null), 3000)
                        }
                      })
                    }
                  }}
                >
                  {item.title}
                </h1>
                {titleError && (
                  <p style={{ color: 'var(--danger)', fontSize: 12, margin: '4px 0 0' }}>
                    {titleError}
                  </p>
                )}
              </>
            ) : (
              <h1 className="doc-title-h1">{item.title}</h1>
            )}

            {/* Summary */}
            {item.summary && (
              <p className="doc-summary">{item.summary}</p>
            )}
          </div>

          {/* Content area — real TipTap reader / editor */}
          <TipTapEditor
            html={resolveContentHtml(item.content_html, item.content_md)}
            editable={mode === 'edit'}
            onChange={handleContentChange}
            placeholder="Continue a pesquisa…"
          />
          {contentError && (
            <p style={{ color: 'var(--danger)', fontSize: 12, margin: '8px 0 0' }}>
              {contentError}
            </p>
          )}

          {/* End mark */}
          <div className="doc-endmark">
            <span />
            <Sparkles size={13} />
            <span />
          </div>
        </div>

        {/* ---- Inspector sidebar ---- */}
        <aside className="doc-insp">
          {/* Takeaways */}
          <div className="insp-block">
            <div className="insp-h">
              <Sparkles size={13} />
              Takeaways
            </div>
            {item.takeaways.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {item.takeaways.map((tk, i) => (
                  <div key={i} className="takeaway">
                    <span className="tk-mark" />
                    <span className="tk-txt">{tk}</span>
                    {onMakeDecision && (
                      <button
                        type="button"
                        className="tk-act"
                        title="Criar decisao a partir deste takeaway"
                        onClick={() =>
                          onMakeDecision(tk, item.theme_id ?? null, item.id)
                        }
                      >
                        <ArrowRight size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="insp-empty">
                Nenhum takeaway ainda.
              </div>
            )}
          </div>

          {/* Linked decisions */}
          <div className="insp-block">
            <div className="insp-h">
              <Target size={13} />
              Decisoes ligadas
            </div>
            {linkedDecisions.length === 0 ? (
              <div className="insp-empty">
                Nenhuma ainda. Transforme um takeaway em decisao.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {linkedDecisions.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    className="insp-dec"
                    onClick={() => onOpenDecision?.(d.id)}
                  >
                    <Target
                      size={13}
                      style={{
                        color: 'var(--accent-text)',
                        flexShrink: 0,
                      }}
                    />
                    <span className="truncate2">{d.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Status */}
          <div className="insp-block">
            <div className="insp-h">
              <Archive size={13} />
              Status
            </div>
            <select
              className="finput sm insp-select"
              value={item.status}
              disabled={statusUpdating}
              onChange={handleStatusChange}
              style={{
                border: `1px solid ${statusError ? 'var(--danger)' : 'var(--border-soft)'}`,
                cursor: statusUpdating ? 'wait' : 'pointer',
              }}
            >
              {Object.entries(STATUS_META).map(([key, meta]) => (
                <option key={key} value={key}>
                  {meta.label}
                </option>
              ))}
            </select>
          </div>

          {/* Usar em — push the research toward a downstream module */}
          <div className="insp-block">
            <div className="insp-h">
              <ArrowRight size={13} />
              Usar em
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <button
                type="button"
                className="use-btn"
                onClick={() => handleUseIn('Roteiros')}
              >
                <FileText size={14} />
                Roteiros
                <ArrowRight size={13} className="use-arrow" />
              </button>
              <button
                type="button"
                className="use-btn"
                onClick={() => handleUseIn('Newsletter')}
              >
                <Mail size={14} />
                Newsletter
                <ArrowRight size={13} className="use-arrow" />
              </button>
              <button
                type="button"
                className="use-btn"
                onClick={() => handleUseIn('Script de vídeo')}
              >
                <Video size={14} />
                Script de vídeo
                <ArrowRight size={13} className="use-arrow" />
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="insp-foot">
            {sourceMeta && (
              <>
                {item.source === 'cowork' && <Sparkles size={13} />}
                {item.source === 'thiago' && <Pen size={13} />}
                {item.source === 'dupla' && <Sparkles size={13} />}
              </>
            )}
            <span>
              {authorshipLabel(item.source)}
              {' · '}
              {formatRelativeDate(item.updated_at)}
            </span>
          </div>
        </aside>
      </div>
    </div>
  )
}
