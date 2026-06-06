'use client'

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { AlertTriangle, ArrowRight, Calendar, Check, CheckCircle, ExternalLink, RefreshCw, Rss, Share2, X } from 'lucide-react'
import {
  useEditorState,
  useEditorDispatch,
  useEditorVersion,
} from '../context'
import { publishPost } from '../actions'
import { createHashtag } from '../hashtag-actions'
import { movePost } from '@/app/cms/(authed)/blog/actions'
import { publishGate, LANG_LABEL } from '../helpers'
import { ScheduleModal } from '@/app/cms/(authed)/blog/_tabs/editorial/schedule-modal'
import { DistributionPlanner, DIST_PLATFORMS } from './distribution-planner'

const CHECK_LABELS: Record<string, string> = {
  title: 'Título',
  content: 'Conteúdo',
  images: 'Imagens',
}

/* ------------------------------------------------------------------ */
/*  HashtagPicker — token input (space/comma/Enter = new tag)          */
/* ------------------------------------------------------------------ */

interface Hashtag { id: string; name: string; slug: string }

function HashtagPicker({
  siteId,
  hashtags,
  onChange,
}: {
  siteId: string
  hashtags: Hashtag[]
  onChange: (next: Hashtag[]) => void
}) {
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const commitTags = useCallback(async (raw: string) => {
    const names = raw
      .split(/[,\s]+/)
      .map(s => s.replace(/^#+/, '').trim())
      .filter(Boolean)

    if (names.length === 0) return

    const existingSlugs = new Set(hashtags.map(h => h.slug))
    const toAdd: Hashtag[] = []

    setBusy(true)
    for (const name of names) {
      const res = await createHashtag(siteId, name)
      if (res.ok && !existingSlugs.has(res.hashtag.slug)) {
        toAdd.push(res.hashtag)
        existingSlugs.add(res.hashtag.slug)
      }
    }
    setBusy(false)

    if (toAdd.length > 0) {
      onChange([...hashtags, ...toAdd])
    }
    setInput('')
  }, [siteId, hashtags, onChange])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      e.preventDefault()
      const val = input.trim().replace(/,$/g, '')
      if (val) commitTags(val)
    }
    if (e.key === 'Backspace' && input === '' && hashtags.length > 0) {
      onChange(hashtags.slice(0, -1))
    }
  }, [input, hashtags, commitTags, onChange])

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text')
    if (/[,\s]/.test(text)) {
      e.preventDefault()
      commitTags(text)
    }
  }, [commitTags])

  const removeHashtag = useCallback((id: string) => {
    onChange(hashtags.filter(h => h.id !== id))
  }, [hashtags, onChange])

  return (
    <div className="fgroup">
      <span className="flabel">Tags · {hashtags.length}</span>
      <div
        data-testid="pub-tags"
        className="tag-chips"
        onClick={() => inputRef.current?.focus()}
      >
        {hashtags.map((h) => (
          <span key={h.id} className="tag-chip">
            #{h.slug}
            <button
              type="button"
              className="tag-rm"
              disabled={busy}
              onClick={(e) => { e.stopPropagation(); removeHashtag(h.id) }}
              aria-label={`Remover ${h.name}`}
            >
              <X size={11} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          className="tag-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={() => { if (input.trim()) commitTags(input) }}
          placeholder={hashtags.length === 0 ? 'Hashtags para redes — separadas por espaço ou vírgula' : ''}
          disabled={busy}
        />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function fmtDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
}

function titleCharStatus(count: number): { label: string; cls: string } {
  if (count === 0) return { label: 'vazio', cls: '' }
  if (count < 30) return { label: 'curto', cls: 'warn' }
  if (count <= 80) return { label: 'ideal', cls: 'ok' }
  return { label: 'longo', cls: 'warn' }
}

export function StagePublicacao() {
  const state = useEditorState()
  const dispatch = useEditorDispatch()
  const version = useEditorVersion()
  const [showSchedule, setShowSchedule] = useState(false)
  const [pending, setPending] = useState(false)

  if (!version) return null

  const lang = state.activeLang
  const gate = publishGate(state, lang)
  const isPublished = version.published
  const isDirty = version.dirty
  const tStatus = titleCharStatus(version.title.length)
  const dist = version.distribution ?? {}
  const distCount = Object.keys(dist).length
  const distLive = DIST_PLATFORMS.filter((p) => dist[p.id])

  return (
    <div>
      <div className="doc-kicker">Publicação · {LANG_LABEL[lang] ?? lang.toUpperCase()}</div>
      {version.title && <h2 className="doc-title-sm">{version.title}</h2>}

      <div style={{ marginTop: 18 }}>
        <div className="col gap-16">
          {/* ---- Title (readonly summary) ---- */}
          <div className="fgroup">
            <div className="seo-field-head">
              <span className="flabel">Título</span>
              <span data-testid="pub-title-counter" className={`charcount ${tStatus.cls}`}>
                {version.title.length} chars · {tStatus.label}
              </span>
            </div>
            <input
              type="text"
              readOnly
              value={version.title}
              className="finput"
              onClick={() => dispatch({ type: 'SET_STAGE', stage: 'rascunho' })}
            />
            {version.titleAlts.length > 0 && (
              <div className="title-alts" data-testid="pub-title-alts">
                <span className="flabel" style={{ padding: '2px 2px 4px' }}>Alternativas testáveis</span>
                {version.titleAlts.map((t, i) => (
                  <button
                    key={i}
                    type="button"
                    className="title-alt"
                    onClick={() => {
                      dispatch({ type: 'SET_TITLE', title: t })
                      toast.info('Título trocado')
                    }}
                  >
                    <span className="ta-n">{i + 1}</span>
                    <span className="ta-t">{t}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ---- Description ---- */}
          <div className="fgroup">
            <span className="flabel">Descrição</span>
            <textarea
              data-testid="pub-excerpt"
              className="finput"
              value={version.excerpt}
              onChange={(e) => dispatch({ type: 'SET_EXCERPT', excerpt: e.target.value })}
              placeholder="Descrição curta do post"
              rows={3}
              style={{ minHeight: 72, padding: '10px 12px', lineHeight: 1.5, resize: 'vertical' as const, overflowY: 'auto' as const }}
            />
          </div>

          {/* ---- Tags (hashtags) ---- */}
          <HashtagPicker
            siteId={state.siteId}
            hashtags={state.shared.hashtags}
            onChange={(next) => dispatch({ type: 'SET_SHARED', field: 'hashtags', value: next })}
          />

          {/* ---- Publish gate ---- */}
          <div data-testid="pub-gate">
            {gate.passed ? (
              <div className="gate-box ok">
                <div className="gate-title">
                  <Check size={14} /> Pronto para publicar
                </div>
                <div className="gate-missing">
                  {gate.checks.map((check) => (
                    <span key={check.key} className="gate-chip">
                      <Check size={13} />
                      {CHECK_LABELS[check.key] ?? check.key}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="gate-box">
                <div className="gate-title">
                  <AlertTriangle size={14} /> Falta para publicar
                </div>
                <div className="gate-missing">
                  {gate.checks.map((check) =>
                    check.ok ? (
                      <span key={check.key} className="gate-chip">
                        <Check size={13} style={{ color: 'var(--ok)' }} />
                        {CHECK_LABELS[check.key] ?? check.key}
                      </span>
                    ) : (
                      <button
                        key={check.key}
                        type="button"
                        className="gate-chip"
                        onClick={() =>
                          dispatch({ type: 'SET_STAGE', stage: check.stage })
                        }
                      >
                        <span className="gc-dot" />
                        {CHECK_LABELS[check.key] ?? check.key}
                        <ArrowRight size={12} />
                      </button>
                    ),
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ---- Distribution planner (part of publishing) ---- */}
          {!isPublished && <DistributionPlanner />}

          {/* ---- Publish actions ---- */}
          <div data-testid="pub-actions" className="pub-actions">
            {isPublished && (fmtDate(version.publishedAt) || fmtDate(version.updatedAt)) && (
              <div className="pub-dates" data-testid="pub-dates">
                {fmtDate(version.publishedAt) && (
                  <span><Rss size={12} /> Publicado em {fmtDate(version.publishedAt)}</span>
                )}
                {fmtDate(version.updatedAt) && (
                  <span className="pd-upd"><RefreshCw size={12} /> Atualizado em {fmtDate(version.updatedAt)}</span>
                )}
              </div>
            )}
            {!isPublished && (
              <div className="row gap-8">
                <button
                  type="button"
                  disabled={!gate.passed || pending}
                  onClick={() => setShowSchedule(true)}
                  className="btn grow"
                >
                  <Calendar size={15} /> Agendar
                </button>
                <button
                  type="button"
                  disabled={!gate.passed || pending}
                  onClick={async () => {
                    const postId = state.postId
                    if (!postId) return
                    setPending(true)
                    try {
                      await publishPost(postId)
                      dispatch({ type: 'PUBLISH' })
                      toast.success('Post publicado')
                    } catch {
                      toast.error('Erro ao publicar post')
                    } finally {
                      setPending(false)
                    }
                  }}
                  className="btn primary grow"
                >
                  {pending ? <span className="img-spin sm" /> : <Rss size={15} />} {pending ? 'Publicando…' : distCount ? `Publicar + ${distCount} redes` : 'Publicar'}
                </button>
              </div>
            )}

            {isPublished && !isDirty && (
              <>
                {distLive.length > 0 && (
                  <div className="dist-live" data-testid="dist-live">
                    <div className="dl-head"><Rss size={13} className="lucide" /> Distribuição</div>
                    <div className="dl-rows">
                      {distLive.map((p) => (
                        <span key={p.id} className="dl-chip">
                          <span className="dl-dot" style={{ background: p.color }} />
                          {p.label}
                          <CheckCircle size={12} style={{ color: 'var(--c-links)' }} />
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="row gap-8">
                  <a
                    href={`/blog/${lang}/${version.slug}`}
                    target="_blank"
                    rel="noopener"
                    className="btn grow"
                  >
                    <ExternalLink size={14} /> Ver no site
                  </a>
                  <Link href={state.postId ? `/cms/social?post=${state.postId}` : '/cms/social'} className="btn grow">
                    <Share2 size={14} /> Abrir Painel Social
                  </Link>
                </div>
              </>
            )}

            {isPublished && isDirty && (
              <div className="update-box">
                <div className="gate-title" style={{ color: 'var(--warn)' }}>
                  <AlertTriangle size={14} /> Alterações não publicadas
                </div>
                <div className="upd-tx">
                  Você fez alterações desde a última publicação.
                </div>
                <button
                  type="button"
                  disabled={pending}
                  className="btn primary grow"
                  style={{ width: '100%', marginTop: 10 }}
                  onClick={async () => {
                    const postId = state.postId
                    if (!postId) return
                    setPending(true)
                    try {
                      await publishPost(postId)
                      dispatch({
                        type: 'UPDATE_PUBLISHED',
                        publishedAt: new Date().toISOString(),
                      })
                      toast.success('Post atualizado no site')
                    } catch {
                      toast.error('Erro ao atualizar post')
                    } finally {
                      setPending(false)
                    }
                  }}
                >
                  {pending ? <span className="img-spin sm" /> : <RefreshCw size={15} />} {pending ? 'Atualizando…' : 'Atualizar no site'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ---- Schedule Modal ---- */}
      <ScheduleModal
        isOpen={showSchedule}
        postTitle={version.title || 'Sem título'}
        siteTimezone={state.siteTimezone}
        onConfirm={async (scheduledFor) => {
          const postId = state.postId
          if (!postId) return
          setPending(true)
          try {
            const result = await movePost(postId, 'scheduled', scheduledFor)
            if (result.ok) {
              dispatch({ type: 'SET_SHARED', field: 'status', value: 'scheduled' })
              dispatch({ type: 'SET_FIELD', field: 'publishedAt', value: scheduledFor })
              setShowSchedule(false)
              toast.success('Post agendado')
            } else {
              toast.error(result.error === 'date_in_past' ? 'Data no passado' : `Erro: ${result.error}`)
            }
          } catch {
            toast.error('Erro ao agendar post')
          } finally {
            setPending(false)
          }
        }}
        onCancel={() => setShowSchedule(false)}
      />
    </div>
  )
}
