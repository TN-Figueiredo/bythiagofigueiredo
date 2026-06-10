'use client'

import { useMemo, useCallback, useState } from 'react'
import type { JSONContent } from '@tiptap/core'
import { toast } from 'sonner'
import { Image, CheckCircle, Info, Layers, ListChecks, RefreshCw, Eye, Copy } from 'lucide-react'
import { imageStats, collectBlogImages } from '../helpers'
import { BlogCoworkButton } from '../blog-cowork-button'
import type { ImageBlockStatus } from '../types'
import {
  useEditorState,
  useEditorDispatch,
  useEditorVersion,
} from '../context'
import { useMediaGallery } from '@/app/cms/(authed)/_shared/media/use-media-gallery'
import { MediaGalleryModal } from '@/app/cms/(authed)/_shared/media/media-gallery-modal'
import { CROP_PRESETS } from '@/app/cms/(authed)/_shared/media/types'
import type { MediaAssetResult } from '@/app/cms/(authed)/_shared/media/types'

/* ------------------------------------------------------------------ */
/*  Internal: map raw JSONContent nodes to typed ImageNode             */
/* ------------------------------------------------------------------ */

interface ImageNode {
  id: string
  status: ImageBlockStatus
  alt: string
  src: string | null
}

const VALID_IMG_STATUSES = new Set<ImageBlockStatus>(['empty', 'uploading', 'processing', 'done'])

function toImageNode(node: JSONContent): ImageNode {
  const raw = (node.attrs?.status as string) ?? 'empty'
  return {
    id: (node.attrs?.id as string) ?? '',
    status: VALID_IMG_STATUSES.has(raw as ImageBlockStatus) ? raw as ImageBlockStatus : 'empty',
    alt: (node.attrs?.alt as string) ?? '',
    src: (node.attrs?.src as string) ?? null,
  }
}

/* ------------------------------------------------------------------ */
/*  StageImagens                                                       */
/* ------------------------------------------------------------------ */

export function StageImagens() {
  const state = useEditorState()
  const dispatch = useEditorDispatch()
  const version = useEditorVersion()

  const coverGallery = useMediaGallery()
  const inlineGallery = useMediaGallery()
  const [inlineTargetIndex, setInlineTargetIndex] = useState<number | null>(null)

  const copyPrompt = useCallback(async (prompt: string) => {
    try {
      await navigator.clipboard.writeText(prompt)
      toast.success('Prompt copiado — cole no Midjourney')
    } catch {
      toast.error('Não consegui copiar — selecione o texto manualmente')
    }
  }, [])

  const handleCoverSelect = useCallback(
    (asset: MediaAssetResult) => {
      dispatch({ type: 'SET_COVER', url: asset.url, ready: true })
      coverGallery.closeGallery()
    },
    [dispatch, coverGallery],
  )

  const handleInlineSelect = useCallback(
    (asset: MediaAssetResult) => {
      if (inlineTargetIndex !== null) {
        dispatch({ type: 'SET_IMAGE_STATUS', index: inlineTargetIndex, status: 'done', url: asset.url })
      }
      inlineGallery.closeGallery()
      setInlineTargetIndex(null)
    },
    [dispatch, inlineGallery, inlineTargetIndex],
  )

  const lang = state.activeLang

  const images = useMemo(
    () => collectBlogImages(version?.body ?? null).map(toImageNode),
    [version?.body],
  )

  const stats = useMemo(
    () => imageStats(version?.body ?? { type: 'doc' }),
    [version?.body],
  )

  const coverReady = version?.coverReady ?? false
  const coverImageUrl = version?.coverImageUrl ?? null
  const canEdit = state.editMode !== 'view'

  const totalWithCover = stats.total + 1
  const doneWithCover = stats.done + (coverReady ? 1 : 0)
  const allDone = doneWithCover === totalWithCover

  const pendingCount = totalWithCover - doneWithCover
  const progressPct = totalWithCover > 0 ? Math.round((doneWithCover / totalWithCover) * 100) : 0

  if (!version) return null

  return (
    <div className="imgmgr">
      {/* ---- Image manager header ---- */}
      <div className="imgmgr-head" data-testid="img-summary">
        <div className="imgmgr-prog">
          <div className="imgmgr-count">
            <b>{doneWithCover}</b><span>/{totalWithCover}</span>
          </div>
          <div className="imgmgr-bar" role="progressbar" aria-valuenow={doneWithCover} aria-valuemin={0} aria-valuemax={totalWithCover} aria-label="Progresso das imagens">
            <span style={{ width: `${progressPct}%` }} className={allDone ? 'full' : ''} />
          </div>
          <div className="imgmgr-sub">
            imagens prontas · {coverReady ? 1 : 0} capa · {stats.total} no conteúdo
          </div>
        </div>
        {pendingCount > 0 && state.pipelineItemId && canEdit && (
          <BlogCoworkButton stage="imagens" label={`Gerar prompts (${pendingCount})`} />
        )}
        {allDone && (
          <span className="img-alldone"><CheckCircle size={15} /> Tudo pronto</span>
        )}
      </div>

      {/* ---- Cover section ---- */}
      <section className="imgmgr-section" data-testid="img-cover">
        <div className="imgmgr-label">
          <Image size={13} />
          Capa &amp; thumbnail
        </div>
        {coverReady ? (
          <div className="cover-hero done">
            {coverImageUrl ? <img src={coverImageUrl} alt="" /> : <span className="hero-fill" />}
            <span className="hero-tag">
              <Image size={13} />
              capa · 1200×675
            </span>
            <div className="hero-overlay">
              {canEdit && (
                <button
                  type="button"
                  className="hero-btn"
                  onClick={() => coverGallery.openGallery({ folder: 'blog', cropPreset: CROP_PRESETS['blog-cover'] })}
                >
                  <RefreshCw size={14} />
                  Trocar
                </button>
              )}
              <button type="button" className="hero-btn" onClick={() => toast.info('Pré-visualizar capa')}>
                <Eye size={14} />
                Ver
              </button>
            </div>
          </div>
        ) : (
          <div className="cover-hero empty">
            <div className="hero-empty-in">
              <span className="hero-empty-ic">
                <Image size={30} />
              </span>
              <div className="hero-empty-tx">Sem capa <span>· 1200×675 · social card &amp; topo do artigo</span></div>
              {canEdit && (
                <div className="hero-empty-actions">
                  {state.pipelineItemId && <BlogCoworkButton stage="imagens" label="Gerar prompt" compact />}
                  <button
                    type="button"
                    className="btn"
                    onClick={() => coverGallery.openGallery({ folder: 'blog', cropPreset: CROP_PRESETS['blog-cover'] })}
                  >
                    <ListChecks size={15} /> Enviar imagem
                  </button>
                </div>
              )}
              {state.shared.coverPrompt && (
                <div className="prompt-card" data-testid="cover-prompt">
                  <div className="pc-head">
                    <span>prompt · Midjourney</span>
                    <button type="button" className="pc-copy" onClick={() => copyPrompt(state.shared.coverPrompt)}>
                      <Copy size={12} /> Copiar
                    </button>
                  </div>
                  <div className="pc-text">{state.shared.coverPrompt}</div>
                  <div className="pc-hint">rode no Midjourney · 1200×675 · depois envie o resultado aqui</div>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ---- Content images section ---- */}
      <section className="imgmgr-section" data-testid="img-content">
        <div className="imgmgr-label">
          <Layers size={13} />
          No conteúdo · {images.length}
        </div>

        {images.length === 0 ? (
          <div style={{
            padding: '26px 14px', textAlign: 'center', color: 'var(--text-faint)',
            fontSize: 12, border: '1.5px dashed var(--border-soft)', borderRadius: 11,
          }}>
            Nenhuma imagem no conteúdo
          </div>
        ) : (
          <div className="img-grid">
            {images.map((img, idx) => {
              const isDone = img.status === 'done'
              const imgId = img.id || `img-${idx + 1}`
              return (
                <article key={imgId} className={`img-tile${isDone ? ' done' : ' empty'}`}>
                  <div className="tile-frame">
                    {isDone ? (
                      <>
                        {img.src ? <img src={img.src} alt="" /> : <span className="hero-fill" />}
                        {canEdit && (
                          <div className="tile-overlay">
                            <button
                              type="button"
                              className="hero-btn sm"
                              onClick={() => dispatch({ type: 'SET_IMAGE_STATUS', index: idx, status: 'empty' })}
                            >
                              <RefreshCw size={13} /> Trocar
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="tile-empty">
                        <span className="tile-empty-ic"><Image size={22} /></span>
                        {canEdit && (
                          <div className="tile-empty-actions">
                            <button
                              type="button"
                              className="btn sm"
                              data-testid={`img-gallery-${imgId}`}
                              onClick={() => {
                                setInlineTargetIndex(idx)
                                inlineGallery.openGallery({ folder: 'blog', cropPreset: CROP_PRESETS.free })
                              }}
                            >
                              <ListChecks size={13} /> Enviar
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="tile-meta">
                    <div className="tile-head">
                      <span className="tile-id">{imgId}</span>
                      <span className={`tile-state ${isDone ? 'ok' : 'wait'}`}>
                        {isDone ? 'no ar' : 'sem imagem'}
                      </span>
                    </div>
                    {state.shared.imagePrompts[imgId] && (
                      <div className="pc-mini">
                        <button type="button" className="pc-copy" onClick={() => copyPrompt(state.shared.imagePrompts[imgId]!)}>
                          <Copy size={11} /> prompt
                        </button>
                        <span className="pc-mini-text">{state.shared.imagePrompts[imgId]}</span>
                      </div>
                    )}
                    <div
                      className="tile-alt"
                      role="textbox"
                      aria-label={`Texto alternativo de ${imgId}`}
                      contentEditable={canEdit}
                      aria-readonly={!canEdit}
                      spellCheck={false}
                      data-empty={!img.alt ? 'true' : 'false'}
                      data-ph="Descreva (alt / prompt)…"
                      suppressContentEditableWarning
                    >
                      {img.alt}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        <div className="img-hint">
          <Info size={13} />
          Vêm dos blocos <span className="mono">{images.map((i, idx) => i.id || `img-${idx + 1}`).join(', ')}</span> do rascunho — adicione ou remova no Conteúdo.
        </div>
      </section>

      {/* ---- Media Gallery Modals ---- */}
      <MediaGalleryModal
        {...coverGallery.galleryProps}
        onSelect={handleCoverSelect}
        locale={lang === 'pt' ? 'pt-BR' : 'en'}
        siteId={state.siteId}
      />
      <MediaGalleryModal
        {...inlineGallery.galleryProps}
        onSelect={handleInlineSelect}
        locale={lang === 'pt' ? 'pt-BR' : 'en'}
        siteId={state.siteId}
      />
    </div>
  )
}
