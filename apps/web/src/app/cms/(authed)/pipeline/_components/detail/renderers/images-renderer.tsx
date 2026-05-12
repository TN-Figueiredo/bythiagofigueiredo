'use client'

import { useMemo } from 'react'
import type { RendererProps } from '../section-content'

interface ImageEntry {
  url?: string
  alt?: string
  caption?: string
  role?: string
}

function parseContent(content: RendererProps['content']): ImageEntry[] {
  if (content === null) return []
  if (typeof content === 'string') {
    if (!content.trim()) return []
    const lines = content.split('\n').filter(Boolean)
    return lines.map(line => ({ caption: line.trim() }))
  }
  if (Array.isArray(content)) {
    return content
      .filter((item): item is Record<string, unknown> => item != null && typeof item === 'object')
      .map(item => ({
        url: typeof item.url === 'string' ? item.url : undefined,
        alt: typeof item.alt === 'string' ? item.alt : undefined,
        caption: typeof item.caption === 'string' ? item.caption : undefined,
        role: typeof item.role === 'string' ? item.role : undefined,
      }))
  }
  const obj = content as Record<string, unknown>
  if (Array.isArray(obj.images)) return parseContent(obj.images as RendererProps['content'])
  return []
}

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  cover: { bg: 'rgba(99,102,241,0.1)', text: '#818cf8' },
  thumbnail: { bg: 'rgba(236,72,153,0.1)', text: '#ec4899' },
  og: { bg: 'rgba(34,197,94,0.1)', text: '#22c55e' },
}

const DEFAULT_ROLE_COLORS = { bg: 'var(--gem-well)', text: 'var(--gem-dim)' }

function RoleBadge({ role }: { role: string }) {
  const colors = ROLE_COLORS[role] ?? DEFAULT_ROLE_COLORS
  return (
    <span
      className="inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded-full mb-1"
      style={{ background: colors.bg, color: colors.text }}
    >
      {role}
    </span>
  )
}

export function ImagesRenderer({ content, isEditing, onContentChange }: RendererProps) {
  const images = useMemo(() => parseContent(content), [content])

  if (images.length === 0 && !isEditing) {
    return (
      <div className="p-5 text-[11px] text-center py-8" style={{ color: 'var(--gem-dim)' }}>
        Nenhuma imagem definida.
      </div>
    )
  }

  if (isEditing) {
    const formatted = typeof content === 'string' ? content : JSON.stringify(content, null, 2)
    return (
      <div className="p-5">
        <textarea
          value={formatted}
          onChange={(e) => {
            try { onContentChange(JSON.parse(e.target.value) as RendererProps['content']) }
            catch { onContentChange(e.target.value) }
          }}
          className="w-full min-h-[150px] text-[11px] p-3 rounded-md resize-y font-mono"
          style={{ background: 'var(--gem-well)', border: '1px solid var(--gem-border)', color: 'var(--gem-text)' }}
          spellCheck={false}
        />
      </div>
    )
  }

  return (
    <div className="p-5 space-y-2">
      {images.map((img, i) => (
        <div
          key={i}
          className="flex items-start gap-3 p-3 rounded-md"
          style={{ background: 'var(--gem-well)', border: '1px solid var(--gem-border)' }}
        >
          {img.url ? (
            <div className="w-16 h-16 rounded overflow-hidden flex-shrink-0" style={{ background: 'var(--gem-border)' }}>
              <img src={img.url} alt={img.alt ?? ''} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div
              className="w-16 h-16 rounded flex items-center justify-center flex-shrink-0 text-[10px]"
              style={{ background: 'var(--gem-border)', color: 'var(--gem-dim)' }}
            >
              IMG
            </div>
          )}
          <div className="flex-1 min-w-0">
            {img.role && <RoleBadge role={img.role} />}
            {img.caption && (
              <div className="text-[11px]" style={{ color: 'var(--gem-muted)' }}>{img.caption}</div>
            )}
            {img.alt && (
              <div className="text-[10px] mt-0.5" style={{ color: 'var(--gem-dim)' }}>
                alt: {img.alt}
              </div>
            )}
            {img.url && (
              <div className="text-[9px] mt-0.5 truncate" style={{ color: 'var(--gem-dim)' }}>
                {img.url}
              </div>
            )}
          </div>
        </div>
      ))}
      <div className="text-[10px] pt-1" style={{ color: 'var(--gem-dim)' }}>
        {images.length} {images.length === 1 ? 'imagem' : 'imagens'}
      </div>
    </div>
  )
}
