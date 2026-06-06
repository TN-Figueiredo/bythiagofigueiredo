'use client'

import { useState, useCallback } from 'react'
import { NodeViewWrapper } from '@tiptap/react'
import { ImageIcon, ArrowRight, Loader2, AlertTriangle } from 'lucide-react'
import { BlogImageToolbar } from './blog-image-toolbar'
import type { ImageBlockStatus, ImageAlignment } from '../types'

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface BlogImageViewProps {
  node: { attrs: Record<string, unknown> }
  updateAttributes: (attrs: Record<string, unknown>) => void
  deleteNode: () => void
  selected: boolean
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function getAttr<T>(attrs: Record<string, unknown>, key: string, fallback: T): T {
  return (attrs[key] as T) ?? fallback
}

/* ------------------------------------------------------------------ */
/*  Empty state — matches .doc-img.pending handoff design             */
/* ------------------------------------------------------------------ */

function EmptyState({
  id,
  alt,
  caption,
}: {
  id: string | null
  alt: string
  caption: string
}) {
  return (
    <div className="doc-img pending" contentEditable={false}>
      <div className="di-thumb">
        <ImageIcon size={20} />
      </div>
      <div className="di-info">
        <span className="di-id">
          {id || 'img'}
          <span className="di-wait">sem imagem</span>
        </span>
        {(caption || alt) && (
          <span className="di-alt">{caption || alt}</span>
        )}
      </div>
      <button
        className="di-go"
        title="Abrir em Imagens"
        type="button"
        onClick={(e) => e.stopPropagation()}
      >
        <ArrowRight size={14} />
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Uploading state                                                   */
/* ------------------------------------------------------------------ */

function UploadingState({ id, filename }: { id: string | null; filename: string | null }) {
  return (
    <div className="doc-img" contentEditable={false}>
      <div className="di-thumb">
        <Loader2 size={20} className="animate-spin" />
      </div>
      <div className="di-info">
        <span className="di-id">
          {id || 'img'}
          <span className="di-wait">enviando…</span>
        </span>
        {filename && <span className="di-alt">{filename}</span>}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Processing state                                                  */
/* ------------------------------------------------------------------ */

function ProcessingState({ id }: { id: string | null }) {
  return (
    <div className="doc-img" contentEditable={false}>
      <div className="di-thumb">
        <Loader2 size={20} className="animate-spin" />
      </div>
      <div className="di-info">
        <span className="di-id">
          {id || 'img'}
          <span className="di-wait">processando…</span>
        </span>
        <span className="di-alt">Otimizando imagem</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Error state                                                       */
/* ------------------------------------------------------------------ */

function ErrorState({
  id,
  updateAttributes,
}: {
  id: string | null
  updateAttributes: (attrs: Record<string, unknown>) => void
}) {
  return (
    <div className="doc-img" contentEditable={false} style={{ borderColor: 'var(--danger)' }}>
      <div className="di-thumb">
        <AlertTriangle size={20} />
      </div>
      <div className="di-info">
        <span className="di-id">
          {id || 'img'}
          <span className="di-wait" style={{ color: 'var(--danger)' }}>erro</span>
        </span>
        <span className="di-alt">Imagem indisponível</span>
      </div>
      <button
        className="di-go"
        title="Substituir"
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          updateAttributes({ status: 'empty', src: null })
        }}
      >
        <ArrowRight size={14} />
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Done state — image + toolbar + caption/alt                        */
/* ------------------------------------------------------------------ */

function DoneState({
  src,
  alt,
  id,
  alignment,
  caption,
  selected,
  updateAttributes,
  deleteNode,
}: {
  src: string
  alt: string
  id: string | null
  alignment: ImageAlignment
  caption: string
  selected: boolean
  updateAttributes: (attrs: Record<string, unknown>) => void
  deleteNode: () => void
}) {
  const [imgError, setImgError] = useState(false)
  const [naturalWidth, setNaturalWidth] = useState<number | null>(null)
  const [captionMode, setCaptionMode] = useState<'caption' | 'alt'>('caption')

  const handleLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    setNaturalWidth(e.currentTarget.naturalWidth)
  }, [])

  if (imgError) {
    return <ErrorState id={id} updateAttributes={updateAttributes} />
  }

  return (
    <div className="doc-img done" contentEditable={false}>
      <div className="di-thumb">
        <div className="group relative overflow-hidden rounded-xl" style={{
          outline: selected ? '2px solid var(--accent)' : 'none',
        }}>
          {id && (
            <span className="di-ok" style={{
              position: 'absolute', top: 8, left: 8, zIndex: 10,
            }}>
              {id}
            </span>
          )}
          <img
            src={src}
            alt={alt}
            loading="lazy"
            className="w-full h-auto"
            style={{ borderRadius: '9px' }}
            onError={() => setImgError(true)}
            onLoad={handleLoad}
          />
          <BlogImageToolbar
            alignment={alignment}
            naturalWidth={naturalWidth}
            onAlignmentChange={(a) => updateAttributes({ alignment: a })}
            onReplace={() => updateAttributes({ status: 'empty', src: null })}
            onDelete={deleteNode}
          />
        </div>
      </div>

      {/* Caption / Alt toggle area */}
      <div className="mt-2" data-testid="img-caption-area">
        <div className="flex items-center gap-1 mb-1">
          <button
            type="button"
            data-testid="img-caption-tab"
            onClick={() => setCaptionMode('caption')}
            className="rounded px-2 py-0.5 text-[11px] font-medium transition-colors"
            style={{
              background: captionMode === 'caption' ? 'var(--surface)' : 'transparent',
              color: captionMode === 'caption' ? 'var(--text)' : 'var(--text-dim)',
            }}
          >
            Legenda
          </button>
          <button
            type="button"
            data-testid="img-alt-tab"
            onClick={() => setCaptionMode('alt')}
            className="relative rounded px-2 py-0.5 text-[11px] font-medium transition-colors"
            style={{
              background: captionMode === 'alt' ? 'var(--surface)' : 'transparent',
              color: captionMode === 'alt' ? 'var(--text)' : 'var(--text-dim)',
            }}
          >
            Alt
            {!alt && (
              <span
                data-testid="img-alt-dot"
                className="absolute -top-0.5 -right-1 h-2 w-2 rounded-full"
                style={{ background: 'var(--warn)' }}
              />
            )}
          </button>
        </div>
        <textarea
          data-testid={captionMode === 'caption' ? 'img-caption-input' : 'img-alt-input'}
          value={captionMode === 'caption' ? caption : alt}
          onChange={(e) =>
            updateAttributes(
              captionMode === 'caption'
                ? { caption: e.target.value }
                : { alt: e.target.value },
            )
          }
          placeholder={
            captionMode === 'caption'
              ? 'Adicionar legenda...'
              : 'Descreva a imagem para acessibilidade...'
          }
          rows={2}
          className="w-full resize-none rounded-lg border px-3 py-2 text-xs transition-colors"
          style={{
            borderColor: 'var(--border)',
            background: captionMode === 'alt' ? 'var(--surface-2)' : 'transparent',
            color: 'var(--text)',
          }}
        />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  BlogImageView — main NodeView component                           */
/* ------------------------------------------------------------------ */

export function BlogImageView({
  node,
  updateAttributes,
  deleteNode,
  selected,
}: BlogImageViewProps) {
  const attrs = node.attrs
  const status = getAttr<ImageBlockStatus>(attrs, 'status', 'empty')
  const src = getAttr<string | null>(attrs, 'src', null)
  const alt = getAttr<string>(attrs, 'alt', '')
  const id = getAttr<string | null>(attrs, 'id', null)
  const alignment = getAttr<ImageAlignment>(attrs, 'alignment', 'column')
  const caption = getAttr<string>(attrs, 'caption', '')
  const filename = getAttr<string | null>(attrs, 'filename', null)

  return (
    <NodeViewWrapper
      data-image-id={id}
      data-alignment={alignment}
      data-status={status}
    >
      {status === 'empty' && (
        <EmptyState id={id} alt={alt} caption={caption} />
      )}

      {status === 'uploading' && <UploadingState id={id} filename={filename} />}

      {status === 'processing' && <ProcessingState id={id} />}

      {status === 'done' && src && (
        <DoneState
          src={src}
          alt={alt}
          id={id}
          alignment={alignment}
          caption={caption}
          selected={selected}
          updateAttributes={updateAttributes}
          deleteNode={deleteNode}
        />
      )}

      {status === 'done' && !src && (
        <EmptyState id={id} alt={alt} caption={caption} />
      )}
    </NodeViewWrapper>
  )
}
