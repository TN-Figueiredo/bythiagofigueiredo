'use client'

import { useMemo, useCallback, useState } from 'react'
import type { JSONContent } from '@tiptap/core'
import { toast } from 'sonner'
import { Image, Check, CheckCircle, Info, Sparkles, Layers, ListChecks, RefreshCw, Eye } from 'lucide-react'
import { imageStats, collectBlogImages } from '../helpers'
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
/*  Variant picker — AI generation is a front-end mock (no backend);  */
/*  variants are distinct swatches standing in for generated crops.   */
/* ------------------------------------------------------------------ */

type GenState = 'generating' | 'choosing'

const IMG_VARIANTS = [
  'linear-gradient(135deg, #4a3a2c, #6b4f37)',
  'linear-gradient(135deg, #2c3f44, #3f5d54)',
  'linear-gradient(135deg, #3c2c44, #56415e)',
]

/* AI generation has no backend yet — the mock resolves to a clearly-labelled
   placeholder image so a "done" slot always carries a real src (no publish-gate
   footgun) and the placeholder reads as provisional, not a finished asset. */
const MOCK_COVER = 'https://placehold.co/1200x675/221e1a/9a9ca8?text=Gerado+por+IA+%28preview%29'
const MOCK_INLINE = 'https://placehold.co/800x450/221e1a/9a9ca8?text=Gerado+por+IA'

function VariantPicker({ onPick, onCancel }: { onPick: (n: number) => void; onCancel: () => void }) {
  return (
    <div className="imgvar">
      <div className="imgvar-head">
        <span><Sparkles size={13} /> Escolha uma variação</span>
        <button type="button" className="imgvar-cancel" onClick={onCancel}>Cancelar</button>
      </div>
      <div className="imgvar-grid">
        {IMG_VARIANTS.map((grad, i) => (
          <button
            key={i}
            type="button"
            className="imgvar-opt"
            style={{ background: grad }}
            onClick={() => onPick(i + 1)}
          >
            <span className="imgvar-n">{i + 1}</span>
            <span className="imgvar-pick"><Check size={14} /> Usar esta</span>
          </button>
        ))}
      </div>
    </div>
  )
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

  /* AI-generation mock state, keyed by 'cover' or image id. */
  const [gen, setGen] = useState<Record<string, GenState>>({})

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

  /* ---- AI generation mock: generating → choosing → done ---- */
  const startGen = useCallback((key: string) => {
    setGen((g) => ({ ...g, [key]: 'generating' }))
    setTimeout(() => {
      setGen((g) => (g[key] === 'generating' ? { ...g, [key]: 'choosing' } : g))
    }, 900)
  }, [])

  const cancelGen = useCallback((key: string) => {
    setGen((g) => {
      const next = { ...g }
      delete next[key]
      return next
    })
  }, [])

  const pickCover = useCallback(() => {
    cancelGen('cover')
    dispatch({ type: 'SET_COVER', url: MOCK_COVER, ready: true })
    toast.success('Capa gerada (preview)')
  }, [cancelGen, dispatch])

  const pickInline = useCallback((index: number, id: string) => {
    cancelGen(id)
    dispatch({ type: 'SET_IMAGE_STATUS', index, status: 'done', url: MOCK_INLINE })
    toast.success('Imagem gerada (preview)')
  }, [cancelGen, dispatch])

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

  const totalWithCover = stats.total + 1
  const doneWithCover = stats.done + (coverReady ? 1 : 0)
  const allDone = doneWithCover === totalWithCover

  const pendingCount = totalWithCover - doneWithCover
  const progressPct = totalWithCover > 0 ? Math.round((doneWithCover / totalWithCover) * 100) : 0

  const genAll = useCallback(() => {
    setGen({})
    if (!coverReady) dispatch({ type: 'SET_COVER', url: MOCK_COVER, ready: true })
    images.forEach((img, idx) => {
      if (img.status !== 'done') dispatch({ type: 'SET_IMAGE_STATUS', index: idx, status: 'done', url: MOCK_INLINE })
    })
    toast.success(`${pendingCount} ${pendingCount === 1 ? 'imagem gerada' : 'imagens geradas'}`)
  }, [coverReady, images, pendingCount, dispatch])

  if (!version) return null

  const coverGen = gen.cover

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
        {pendingCount > 0 && (
          <button type="button" className="btn sm primary" onClick={genAll}>
            <Sparkles size={14} />
            Gerar todas ({pendingCount})
          </button>
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
        {coverGen === 'choosing' ? (
          <div className="cover-hero choosing">
            <VariantPicker onPick={pickCover} onCancel={() => cancelGen('cover')} />
          </div>
        ) : coverGen === 'generating' ? (
          <div className="cover-hero loading">
            <span className="hero-shimmer" />
            <span className="hero-loadlabel"><span className="img-spin sm" /> Gerando variações…</span>
          </div>
        ) : coverReady ? (
          <div className="cover-hero done">
            {coverImageUrl ? <img src={coverImageUrl} alt="" /> : <span className="hero-fill" />}
            <span className="hero-tag">
              <Image size={13} />
              capa · 1200×675
            </span>
            <div className="hero-overlay">
              <button
                type="button"
                className="hero-btn"
                onClick={() => coverGallery.openGallery({ folder: 'blog', cropPreset: CROP_PRESETS['blog-cover'] })}
              >
                <RefreshCw size={14} />
                Trocar
              </button>
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
              <div className="hero-empty-actions">
                <button type="button" className="btn primary" onClick={() => startGen('cover')}>
                  <Sparkles size={15} /> Gerar com IA
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => coverGallery.openGallery({ folder: 'blog', cropPreset: CROP_PRESETS['blog-cover'] })}
                >
                  <ListChecks size={15} /> Enviar imagem
                </button>
              </div>
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
              const tileGen = gen[imgId]
              return (
                <article key={imgId} className={`img-tile${isDone ? ' done' : tileGen ? ` ${tileGen}` : ' empty'}`}>
                  <div className="tile-frame">
                    {tileGen === 'choosing' ? (
                      <VariantPicker onPick={() => pickInline(idx, imgId)} onCancel={() => cancelGen(imgId)} />
                    ) : tileGen === 'generating' ? (
                      <>
                        <span className="hero-shimmer" />
                        <span className="tile-loadlabel"><span className="img-spin sm" /> gerando…</span>
                      </>
                    ) : isDone ? (
                      <>
                        {img.src ? <img src={img.src} alt="" /> : <span className="hero-fill" />}
                        <div className="tile-overlay">
                          <button
                            type="button"
                            className="hero-btn sm"
                            onClick={() => dispatch({ type: 'SET_IMAGE_STATUS', index: idx, status: 'empty' })}
                          >
                            <RefreshCw size={13} /> Trocar
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="tile-empty">
                        <span className="tile-empty-ic">
                          <Image size={22} />
                        </span>
                        <div className="tile-empty-actions">
                          <button type="button" className="btn sm primary" onClick={() => startGen(imgId)}>
                            <Sparkles size={13} /> Gerar
                          </button>
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
                    <div
                      className="tile-alt"
                      role="textbox"
                      aria-label={`Texto alternativo de ${imgId}`}
                      contentEditable
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
