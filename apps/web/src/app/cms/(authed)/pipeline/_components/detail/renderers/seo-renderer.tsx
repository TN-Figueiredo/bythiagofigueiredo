'use client'

import { useMemo } from 'react'
import type { RendererProps } from '../section-content'

interface SeoContent {
  meta_title: string
  meta_description: string
  slug?: string
  keywords?: string[]
}

function parseContent(content: RendererProps['content']): SeoContent {
  if (content === null || Array.isArray(content)) return { meta_title: '', meta_description: '' }

  if (typeof content === 'string') {
    const parts = content.split(/\s*\|\s*/)
    let title = ''
    let desc = ''
    for (const part of parts) {
      const titleMatch = part.match(/(?:meta_?title|título?)\s*[:=]\s*(.+)/i)
      const descMatch = part.match(/(?:meta_?desc(?:ription)?|desc(?:rição)?)\s*[:=]\s*(.+)/i)
      if (titleMatch) title = titleMatch[1]!.trim()
      else if (descMatch) desc = descMatch[1]!.trim()
    }
    if (!title && !desc) desc = content
    return { meta_title: title, meta_description: desc }
  }

  const obj = content as Record<string, unknown>
  const seoObj = (typeof obj.seo === 'object' && obj.seo !== null) ? obj.seo as Record<string, unknown> : obj

  return {
    meta_title: String(seoObj.meta_title ?? seoObj.title ?? ''),
    meta_description: String(seoObj.meta_description ?? seoObj.description ?? ''),
    slug: typeof seoObj.slug === 'string' ? seoObj.slug : undefined,
    keywords: Array.isArray(seoObj.keywords) ? seoObj.keywords.map(String) : undefined,
  }
}

function charIndicator(count: number, ideal: number, warn: number): { color: string; label: string } {
  if (count === 0) return { color: 'var(--gem-dim)', label: '' }
  if (count <= ideal) return { color: '#22c55e', label: 'ideal' }
  if (count <= warn) return { color: '#eab308', label: 'pode truncar' }
  return { color: '#ef4444', label: 'truncado' }
}

function SeoField({
  label,
  value,
  maxIdeal,
  maxWarn,
  isEditing,
  onChange,
  multiline,
}: {
  label: string
  value: string
  maxIdeal: number
  maxWarn: number
  isEditing: boolean
  onChange: (v: string) => void
  multiline?: boolean
}) {
  const indicator = charIndicator(value.length, maxIdeal, maxWarn)

  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className="text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: 'var(--gem-dim)' }}
        >
          {label}
        </span>
        {value.length > 0 && (
          <span
            className="text-[9px] px-1.5 py-0.5 rounded-full"
            style={{ color: indicator.color, background: `${indicator.color}15` }}
          >
            {value.length} chars{indicator.label && ` · ${indicator.label}`}
          </span>
        )}
      </div>
      {isEditing ? (
        multiline ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            className="w-full text-[12px] leading-relaxed p-3 rounded-md resize-y font-sans"
            style={{ background: 'var(--gem-well)', border: '1px solid var(--gem-border)', color: 'var(--gem-text)' }}
          />
        ) : (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full text-[12px] p-3 rounded-md font-sans"
            style={{ background: 'var(--gem-well)', border: '1px solid var(--gem-border)', color: 'var(--gem-text)' }}
          />
        )
      ) : (
        <div
          className="p-3 rounded-md text-[12px] leading-relaxed"
          style={{
            background: 'var(--gem-well)',
            border: '1px solid var(--gem-border)',
            color: value ? 'var(--gem-muted)' : 'var(--gem-dim)',
            minHeight: multiline ? '3rem' : undefined,
          }}
        >
          {value || 'Não definido'}
        </div>
      )}
    </div>
  )
}

function SerpPreview({ title, description, slug }: { title: string; description: string; slug?: string }) {
  if (!title && !description) return null

  return (
    <div>
      <div
        className="text-[10px] font-semibold uppercase tracking-wider mb-1.5"
        style={{ color: 'var(--gem-dim)' }}
      >
        Preview SERP
      </div>
      <div
        className="p-3 rounded-md space-y-0.5"
        style={{ background: 'var(--gem-well)', border: '1px solid var(--gem-border)' }}
      >
        <div className="text-[14px] leading-snug" style={{ color: '#8ab4f8' }}>
          {title || 'Sem título'}
        </div>
        {slug && (
          <div className="text-[11px]" style={{ color: '#bdc1c6' }}>
            bythiagofigueiredo.com › {slug}
          </div>
        )}
        <div
          className="text-[11px] leading-relaxed"
          style={{ color: '#9aa0a6' }}
        >
          {description
            ? description.length > 160
              ? description.slice(0, 157) + '...'
              : description
            : 'Sem descrição'}
        </div>
      </div>
    </div>
  )
}

export function SeoRenderer({ content, isEditing, onContentChange }: RendererProps) {
  const data = useMemo(() => parseContent(content), [content])

  function update(field: keyof SeoContent, value: string) {
    const updated = { ...data, [field]: value }
    onContentChange(updated)
  }

  if (!data.meta_title && !data.meta_description && !isEditing) {
    return (
      <div className="p-5 text-[11px] text-center py-8" style={{ color: 'var(--gem-dim)' }}>
        SEO ainda não tem conteúdo.
      </div>
    )
  }

  return (
    <div className="p-5 space-y-4">
      <SeoField
        label="Meta Title"
        value={data.meta_title}
        maxIdeal={60}
        maxWarn={70}
        isEditing={isEditing}
        onChange={(v) => update('meta_title', v)}
      />

      <SeoField
        label="Meta Description"
        value={data.meta_description}
        maxIdeal={155}
        maxWarn={170}
        isEditing={isEditing}
        onChange={(v) => update('meta_description', v)}
        multiline
      />

      {data.slug && (
        <SeoField
          label="Slug"
          value={data.slug}
          maxIdeal={80}
          maxWarn={100}
          isEditing={isEditing}
          onChange={(v) => update('slug', v)}
        />
      )}

      {data.keywords && data.keywords.length > 0 && (
        <div>
          <div
            className="text-[10px] font-semibold uppercase tracking-wider mb-1.5"
            style={{ color: 'var(--gem-dim)' }}
          >
            Keywords
          </div>
          <div className="flex flex-wrap gap-1.5">
            {data.keywords.map((kw, i) => (
              <span
                key={i}
                className="text-[11px] px-2 py-0.5 rounded-full"
                style={{
                  background: 'rgba(167,139,250,0.1)',
                  border: '1px solid rgba(167,139,250,0.25)',
                  color: 'var(--gem-accent)',
                }}
              >
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}

      <SerpPreview title={data.meta_title} description={data.meta_description} slug={data.slug} />
    </div>
  )
}
