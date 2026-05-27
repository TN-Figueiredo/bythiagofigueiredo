'use client'

import Image from '@tiptap/extension-image'
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react'
import { useState, useCallback } from 'react'
import { ImageIcon, Upload, Search } from 'lucide-react'
import { usePipelineMedia } from './pipeline-media-context'

const PLACEHOLDER_RE = /placehold\.co/
const REF_ID_RE = /^(img-[\w-]+):\s*/i

function isPlaceholderSrc(src: string | undefined): boolean {
  if (!src || !src.trim()) return true
  if (PLACEHOLDER_RE.test(src)) return true
  return false
}

function parseAlt(alt: string): { refId: string | null; description: string } {
  const match = alt.match(REF_ID_RE)
  if (match) {
    return { refId: match[1] ?? null, description: alt.slice(match[0].length).trim() }
  }
  return { refId: null, description: alt }
}

function PipelineImageNodeView({ node, updateAttributes, editor }: ReactNodeViewProps) {
  const src = node.attrs.src as string | undefined
  const alt = (node.attrs.alt as string) ?? ''
  const requestImage = usePipelineMedia()
  const [broken, setBroken] = useState(false)
  const isEditable = editor.isEditable

  const isPlaceholder = isPlaceholderSrc(src) || broken
  const { refId, description } = parseAlt(alt)
  const showUploadPrompt = isPlaceholder

  const handleSelectImage = useCallback(() => {
    if (!requestImage) return
    requestImage((result) => {
      updateAttributes({ src: result.url })
      setBroken(false)
    })
  }, [requestImage, updateAttributes])

  if (showUploadPrompt) {
    return (
      <NodeViewWrapper className="my-3">
        <div
          className="flex items-center gap-3 p-4 rounded-lg border border-dashed transition-colors"
          style={{
            borderColor: 'var(--gem-border)',
            background: 'var(--gem-well)',
          }}
        >
          <div
            className="w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}
          >
            <ImageIcon size={22} style={{ color: '#818cf8' }} />
          </div>

          <div className="flex-1 min-w-0">
            {refId && (
              <span
                className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full mb-1"
                style={{ background: 'rgba(236,72,153,0.1)', color: '#ec4899' }}
              >
                {refId}
              </span>
            )}
            <div className="text-xs leading-relaxed" style={{ color: 'var(--gem-muted)' }}>
              {description || 'Imagem pendente'}
            </div>
          </div>

          {requestImage && isEditable && (
            <div className="flex gap-1.5 flex-shrink-0">
              <button
                type="button"
                onClick={handleSelectImage}
                className="flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1.5 rounded-md transition-colors"
                style={{
                  background: 'rgba(99,102,241,0.1)',
                  color: '#818cf8',
                  border: '1px solid rgba(99,102,241,0.2)',
                }}
              >
                <Upload size={11} />
                Upload
              </button>
              <button
                type="button"
                onClick={handleSelectImage}
                className="flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1.5 rounded-md transition-colors"
                style={{
                  background: 'var(--gem-surface-hi)',
                  color: 'var(--gem-muted)',
                  border: '1px solid var(--gem-border)',
                }}
              >
                <Search size={11} />
                Buscar
              </button>
            </div>
          )}

          {!requestImage && !isEditable && (
            <span className="text-[10px]" style={{ color: 'var(--gem-dim)' }}>
              Aguardando imagem
            </span>
          )}
        </div>
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper className="my-3">
      <div className="relative group rounded-lg overflow-hidden">
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="w-full h-auto rounded-lg"
          style={{ maxHeight: 400, objectFit: 'cover' }}
          onError={() => setBroken(true)}
        />
        {requestImage && isEditable && (
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <button
              type="button"
              onClick={handleSelectImage}
              className="text-xs text-white bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-md transition-colors"
            >
              Trocar imagem
            </button>
          </div>
        )}
        {refId && (
          <span
            className="absolute top-2 left-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
            style={{ background: 'rgba(0,0,0,0.6)', color: '#e2e8f0' }}
          >
            {refId}
          </span>
        )}
      </div>
    </NodeViewWrapper>
  )
}

export const PipelineImageExtension = Image.extend({
  addNodeView() {
    return ReactNodeViewRenderer(PipelineImageNodeView)
  },
})
