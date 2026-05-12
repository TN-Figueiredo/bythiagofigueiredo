'use client'

import { useMemo, useCallback } from 'react'
import type { RendererProps } from '../section-content'
import { PipelineEditor, isJSONContent, extractHeadings, type JSONContent } from '../editors/pipeline-editor'

function extractDraftContent(content: RendererProps['content']): {
  body: string | JSONContent
  seo: Record<string, unknown> | null
  hasMisplacedSeo: boolean
} {
  if (typeof content === 'string') return { body: content, seo: null, hasMisplacedSeo: false }
  if (isJSONContent(content)) return { body: content, seo: null, hasMisplacedSeo: false }
  if (content && typeof content === 'object' && !Array.isArray(content)) {
    const obj = content as Record<string, unknown>
    const body = (obj.body ?? '') as string | JSONContent
    const seo = obj.seo && typeof obj.seo === 'object' ? (obj.seo as Record<string, unknown>) : null
    return { body, seo, hasMisplacedSeo: seo !== null }
  }
  return { body: '', seo: null, hasMisplacedSeo: false }
}

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

export function DraftRenderer({ content, isEditing, onContentChange }: RendererProps) {
  const { body, seo, hasMisplacedSeo } = useMemo(() => extractDraftContent(content), [content])

  const headings = useMemo(() => {
    if (isJSONContent(body)) return extractHeadings(body)
    return []
  }, [body])

  const handleChange = useCallback(
    (json: JSONContent) => {
      if (seo) {
        onContentChange({ body: json, seo })
      } else {
        onContentChange(json)
      }
    },
    [seo, onContentChange],
  )

  const isEmpty =
    !body || (typeof body === 'string' && !body.trim()) || (isJSONContent(body) && !body.content?.length)

  if (!isEditing && isEmpty) {
    return (
      <div className="p-5 text-[11px] text-center py-8" style={{ color: 'var(--gem-dim)' }}>
        Nenhum rascunho ainda.
      </div>
    )
  }

  return (
    <div className="p-5">
      {hasMisplacedSeo && (
        <SeoWarning
          message={isEditing ? 'Dados SEO detectados nesta seção. Mova-os para a aba SEO.' : 'Dados SEO detectados nesta seção — verifique a aba SEO.'}
        />
      )}
      {!isEditing && <SectionOutline headings={headings} />}
      <PipelineEditor
        content={body}
        isEditing={isEditing}
        onContentChange={handleChange}
        preset="full"
        placeholder="Escreva o conteúdo do seu rascunho..."
      />
    </div>
  )
}
