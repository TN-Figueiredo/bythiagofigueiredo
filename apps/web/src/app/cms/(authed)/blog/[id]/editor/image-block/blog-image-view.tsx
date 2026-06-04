'use client'

import { useState, useCallback } from 'react'
import { NodeViewWrapper } from '@tiptap/react'
import { ImageIcon, Upload, Loader2, AlertTriangle } from 'lucide-react'
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
/*  Empty state                                                       */
/* ------------------------------------------------------------------ */

function EmptyState({
  id,
  alt,
  updateAttributes,
}: {
  id: string | null
  alt: string
  updateAttributes: (attrs: Record<string, unknown>) => void
}) {
  const [dragOver, setDragOver] = useState(false)

  return (
    <div
      data-testid="img-empty-state"
      className="relative flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 transition-colors"
      style={{
        borderColor: dragOver ? '#6366f1' : '#d1d5db',
        background: dragOver ? 'rgba(99,102,241,0.04)' : 'transparent',
      }}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={() => setDragOver(false)}
    >
      {/* Badge */}
      {id && (
        <span
          className="absolute top-2 left-2 rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}
        >
          {id}
        </span>
      )}

      <ImageIcon size={32} className="text-gray-400" />
      <span className="text-sm text-gray-500">Clique para adicionar imagem</span>

      {/* Alt text warning */}
      {!alt && (
        <span
          data-testid="img-alt-warning"
          className="text-xs"
          style={{ color: '#d97706' }}
        >
          Texto alternativo ausente
        </span>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          data-testid="img-gallery-btn"
          onClick={() => updateAttributes({})}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
          style={{
            background: 'rgba(99,102,241,0.1)',
            color: '#6366f1',
            border: '1px solid rgba(99,102,241,0.2)',
          }}
        >
          <ImageIcon size={12} />
          Galeria
        </button>
        <button
          type="button"
          data-testid="img-upload-btn"
          onClick={() => updateAttributes({})}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
          style={{
            background: '#f3f4f6',
            color: '#374151',
            border: '1px solid #e5e7eb',
          }}
        >
          <Upload size={12} />
          Upload
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Uploading state                                                   */
/* ------------------------------------------------------------------ */

function UploadingState({ filename }: { filename: string | null }) {
  return (
    <div
      data-testid="img-uploading-state"
      className="flex items-center gap-3 rounded-xl border p-6"
      style={{ borderColor: '#d1d5db' }}
    >
      <Loader2 size={20} className="animate-spin text-indigo-500" />
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-gray-700">Enviando...</span>
        {filename && (
          <span className="text-xs text-gray-400">{filename}</span>
        )}
      </div>
      <button
        type="button"
        data-testid="img-cancel-btn"
        className="ml-auto text-xs text-gray-400 hover:text-gray-600"
      >
        Cancelar
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Processing state                                                  */
/* ------------------------------------------------------------------ */

function ProcessingState() {
  return (
    <div
      data-testid="img-processing-state"
      className="flex items-center gap-3 rounded-xl border p-6"
      style={{ borderColor: '#93c5fd' }}
    >
      <Loader2 size={20} className="animate-spin text-blue-500" />
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-gray-700">Processando...</span>
        <span className="text-xs text-gray-400">Otimizando imagem</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Error state                                                       */
/* ------------------------------------------------------------------ */

function ErrorState({
  updateAttributes,
}: {
  updateAttributes: (attrs: Record<string, unknown>) => void
}) {
  return (
    <div
      data-testid="img-error-state"
      className="flex flex-col items-center gap-3 rounded-xl border-2 p-8"
      style={{ borderColor: '#ef4444' }}
    >
      <AlertTriangle size={28} className="text-red-500" />
      <span className="text-sm font-medium text-red-600">Imagem indisponível</span>
      <div className="flex gap-2">
        <button
          type="button"
          data-testid="img-replace-error-btn"
          onClick={() => updateAttributes({ status: 'empty', src: null })}
          className="rounded-lg px-3 py-1.5 text-xs font-medium"
          style={{
            background: 'rgba(239,68,68,0.1)',
            color: '#ef4444',
            border: '1px solid rgba(239,68,68,0.2)',
          }}
        >
          Substituir
        </button>
        <button
          type="button"
          data-testid="img-reupload-btn"
          onClick={() => updateAttributes({ status: 'uploading' })}
          className="rounded-lg px-3 py-1.5 text-xs font-medium"
          style={{
            background: '#f3f4f6',
            color: '#374151',
            border: '1px solid #e5e7eb',
          }}
        >
          Re-upload
        </button>
      </div>
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
    return <ErrorState updateAttributes={updateAttributes} />
  }

  return (
    <div data-testid="img-done-state">
      {/* Image container */}
      <div className="group relative overflow-hidden rounded-xl" style={{
        outline: selected ? '2px solid #6366f1' : 'none',
      }}>
        {/* Badge overlay */}
        {id && (
          <span
            data-testid="img-badge"
            className="absolute top-2 left-2 z-10 rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: 'rgba(0,0,0,0.6)', color: '#e2e8f0' }}
          >
            {id}
          </span>
        )}

        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="w-full h-auto"
          onError={() => setImgError(true)}
          onLoad={handleLoad}
        />

        {/* Hover toolbar */}
        <BlogImageToolbar
          alignment={alignment}
          naturalWidth={naturalWidth}
          onAlignmentChange={(a) => updateAttributes({ alignment: a })}
          onReplace={() => updateAttributes({ status: 'empty', src: null })}
          onDelete={deleteNode}
        />
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
              background: captionMode === 'caption' ? '#e5e7eb' : 'transparent',
              color: captionMode === 'caption' ? '#111827' : '#9ca3af',
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
              background: captionMode === 'alt' ? '#e5e7eb' : 'transparent',
              color: captionMode === 'alt' ? '#111827' : '#9ca3af',
            }}
          >
            Alt
            {/* Amber dot when alt is empty */}
            {!alt && (
              <span
                data-testid="img-alt-dot"
                className="absolute -top-0.5 -right-1 h-2 w-2 rounded-full"
                style={{ background: '#f59e0b' }}
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
            borderColor: '#e5e7eb',
            background: captionMode === 'alt' ? 'rgba(99,102,241,0.04)' : 'transparent',
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
      className="my-4"
      data-alignment={alignment}
      data-status={status}
    >
      {status === 'empty' && (
        <EmptyState id={id} alt={alt} updateAttributes={updateAttributes} />
      )}

      {status === 'uploading' && <UploadingState filename={filename} />}

      {status === 'processing' && <ProcessingState />}

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

      {/* Fallback: done without src → treat as empty */}
      {status === 'done' && !src && (
        <EmptyState id={id} alt={alt} updateAttributes={updateAttributes} />
      )}
    </NodeViewWrapper>
  )
}
