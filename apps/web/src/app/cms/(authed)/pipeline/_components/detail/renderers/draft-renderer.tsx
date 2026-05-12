'use client'

import { useMemo } from 'react'
import type { RendererProps } from '../section-content'

// ---------------------------------------------------------------------------
// Content parsing
// ---------------------------------------------------------------------------

function parseContent(content: RendererProps['content']): { text: string; hasMisplacedSeo: boolean } {
  if (typeof content === 'string') return { text: content, hasMisplacedSeo: false }
  if (content === null || Array.isArray(content)) return { text: '', hasMisplacedSeo: false }

  const obj = content as Record<string, unknown>

  if (typeof obj.body === 'string' && obj.seo && typeof obj.seo === 'object') {
    return { text: obj.body, hasMisplacedSeo: true }
  }

  if (typeof obj.body === 'string') {
    return { text: obj.body, hasMisplacedSeo: false }
  }

  if (typeof obj.text === 'string') {
    return { text: obj.text, hasMisplacedSeo: false }
  }

  return { text: JSON.stringify(content, null, 2), hasMisplacedSeo: false }
}

// ---------------------------------------------------------------------------
// Inline formatting: **bold**, *italic*
// ---------------------------------------------------------------------------

const INLINE_RE = /\*\*(.+?)\*\*|(?<!\*)\*([^*]+)\*(?!\*)/g

function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  INLINE_RE.lastIndex = 0
  while ((match = INLINE_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index))
    }
    if (match[1]) {
      nodes.push(
        <strong key={match.index} style={{ color: 'var(--gem-text)', fontWeight: 600 }}>
          {match[1]}
        </strong>,
      )
    } else if (match[2]) {
      nodes.push(
        <em key={match.index} style={{ color: 'var(--gem-text)', fontStyle: 'italic' }}>
          {match[2]}
        </em>,
      )
    }
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }

  return nodes.length > 0 ? nodes : [text]
}

// ---------------------------------------------------------------------------
// Block parsing
// ---------------------------------------------------------------------------

interface Block {
  type: 'heading' | 'paragraph' | 'list' | 'ordered-list' | 'blockquote' | 'divider'
  level?: number
  text: string
  items?: string[]
  isLead?: boolean
}

const HEADING_RE = /^(#{1,3})\s+(.+)$/
const DIVIDER_RE = /^-{3,}$|^\*{3,}$|^_{3,}$/
const HEADING_SIZES: Record<number, string> = {
  1: 'text-[15px] font-semibold',
  2: 'text-[14px] font-semibold',
  3: 'text-[13px] font-semibold',
}

function parseBlocks(text: string): Block[] {
  const paragraphs = text.split(/\n{2,}/)
  const blocks: Block[] = []
  let foundFirstParagraph = false

  for (const p of paragraphs) {
    const trimmed = p.trim()
    if (!trimmed) continue

    if (DIVIDER_RE.test(trimmed)) {
      blocks.push({ type: 'divider', text: '' })
      continue
    }

    const headingMatch = trimmed.match(HEADING_RE)
    if (headingMatch) {
      blocks.push({ type: 'heading', level: headingMatch[1]!.length, text: headingMatch[2]! })
      continue
    }

    const lines = trimmed.split('\n')

    // Blockquote: every line starts with >
    const isBlockquote = lines.every(l => /^>\s?/.test(l.trim()))
    if (isBlockquote) {
      const content = lines.map(l => l.trim().replace(/^>\s?/, '')).join('\n')
      blocks.push({ type: 'blockquote', text: content })
      continue
    }

    const isBulletList = lines.every(l => /^[-•*]\s/.test(l.trim()))
    if (isBulletList) {
      blocks.push({
        type: 'list',
        text: '',
        items: lines.map(l => l.trim().replace(/^[-•*]\s/, '')),
      })
      continue
    }

    const isNumberedList = lines.every(l => /^\d+[.)]\s/.test(l.trim()))
    if (isNumberedList) {
      blocks.push({
        type: 'ordered-list',
        text: '',
        items: lines.map(l => l.trim().replace(/^\d+[.)]\s/, '')),
      })
      continue
    }

    blocks.push({
      type: 'paragraph',
      text: trimmed,
      isLead: !foundFirstParagraph,
    })
    foundFirstParagraph = true
  }

  return blocks
}

// ---------------------------------------------------------------------------
// Section outline (TOC)
// ---------------------------------------------------------------------------

function SectionOutline({ blocks }: { blocks: Block[] }) {
  const headings = blocks.filter(b => b.type === 'heading')
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
          {i > 0 && (
            <span style={{ color: 'var(--gem-border)' }}>·</span>
          )}
          <span
            className="text-[11px]"
            style={{ color: i === 0 ? 'var(--gem-accent)' : 'var(--gem-muted)' }}
          >
            {h.text}
          </span>
        </span>
      ))}
    </div>
  )
}

function SeoWarning({ message }: { message: string }) {
  return (
    <div
      className="mb-3 flex items-center gap-2 rounded-md px-3 py-2 text-[11px]"
      style={{ background: 'color-mix(in srgb, var(--gem-warn) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--gem-warn) 25%, transparent)', color: 'var(--gem-warn)' }}
    >
      {message}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Block renderers
// ---------------------------------------------------------------------------

function BlockRenderer({ block }: { block: Block }) {
  switch (block.type) {
    case 'divider':
      return (
        <div className="flex items-center gap-2 my-6" role="separator">
          <div className="flex-1 h-px" style={{ background: 'var(--gem-border)' }} />
          <div
            className="w-1 h-1 rounded-full"
            style={{ background: 'var(--gem-dim)' }}
          />
          <div className="flex-1 h-px" style={{ background: 'var(--gem-border)' }} />
        </div>
      )

    case 'heading':
      return (
        <div
          className={`${HEADING_SIZES[block.level!] ?? HEADING_SIZES[3]} mt-6 mb-3 py-2 px-3.5 rounded-r-md`}
          style={{
            color: 'var(--gem-text)',
            borderLeft: '3px solid var(--gem-accent)',
            background: 'linear-gradient(90deg, color-mix(in srgb, var(--gem-accent) 5%, transparent), transparent 60%)',
          }}
        >
          {renderInline(block.text)}
        </div>
      )

    case 'blockquote':
      return (
        <div
          className="my-4 py-3 px-4 rounded-r-md text-[13px] leading-[1.85] italic"
          style={{
            borderLeft: '3px solid var(--gem-accent)',
            background: 'linear-gradient(90deg, color-mix(in srgb, var(--gem-accent) 6%, transparent), transparent 70%)',
            color: 'var(--gem-muted)',
          }}
        >
          {block.text.split('\n').map((line, i) => (
            <span key={i}>
              {i > 0 && <br />}
              {renderInline(line)}
            </span>
          ))}
        </div>
      )

    case 'list':
      return (
        <ul className="pl-5 my-3 space-y-1.5">
          {block.items!.map((item, i) => (
            <li key={i} className="text-[13px] leading-[1.75] list-disc" style={{ color: 'var(--gem-muted)' }}>
              {renderInline(item)}
            </li>
          ))}
        </ul>
      )

    case 'ordered-list':
      return (
        <ol className="pl-5 my-3 space-y-1.5 list-decimal">
          {block.items!.map((item, i) => (
            <li key={i} className="text-[13px] leading-[1.75]" style={{ color: 'var(--gem-muted)' }}>
              {renderInline(item)}
            </li>
          ))}
        </ol>
      )

    case 'paragraph': {
      const lines = block.text.split('\n')
      if (block.isLead) {
        return (
          <p
            className="text-[14px] leading-[1.85] my-3"
            style={{ color: 'var(--gem-text)' }}
          >
            {lines.map((line, i) => (
              <span key={i}>
                {i > 0 && <br />}
                {renderInline(line)}
              </span>
            ))}
          </p>
        )
      }
      return (
        <p
          className="text-[13px] leading-[1.85] my-3"
          style={{ color: 'var(--gem-muted)' }}
        >
          {lines.map((line, i) => (
            <span key={i}>
              {i > 0 && <br />}
              {renderInline(line)}
            </span>
          ))}
        </p>
      )
    }
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DraftRenderer({ content, isEditing, onContentChange }: RendererProps) {
  const { text, hasMisplacedSeo } = useMemo(() => parseContent(content), [content])
  const blocks = useMemo(() => parseBlocks(text), [text])
  const wordCount = useMemo(() => text.split(/\s+/).filter(Boolean).length, [text])
  const readingMin = Math.max(1, Math.round(wordCount / 200))
  const sectionCount = blocks.filter(b => b.type === 'heading').length
  const paragraphCount = blocks.filter(b => b.type === 'paragraph').length

  if (isEditing) {
    return (
      <div className="p-5">
        {hasMisplacedSeo && <SeoWarning message="Dados SEO detectados nesta seção. Mova-os para a aba SEO." />}
        <textarea
          value={text}
          onChange={(e) => {
            if (hasMisplacedSeo && typeof content === 'object' && content !== null && !Array.isArray(content)) {
              onContentChange({ ...(content as Record<string, unknown>), body: e.target.value })
            } else {
              onContentChange(e.target.value)
            }
          }}
          className="w-full min-h-[300px] text-[13px] leading-[1.8] p-4 rounded-md resize-y font-sans"
          style={{ background: 'var(--gem-well)', border: '1px solid var(--gem-border)', color: 'var(--gem-text)' }}
          spellCheck={false}
        />
        <div className="mt-1.5 text-right text-[10px]" style={{ color: 'var(--gem-dim)' }}>
          {wordCount} palavras · ~{readingMin} min leitura
        </div>
      </div>
    )
  }

  if (!text.trim()) {
    return (
      <div className="p-5 text-[11px] text-center py-8" style={{ color: 'var(--gem-dim)' }}>
        Nenhum rascunho ainda.
      </div>
    )
  }

  return (
    <div className="p-5">
      {hasMisplacedSeo && <SeoWarning message="Dados SEO detectados nesta seção — verifique a aba SEO." />}

      <SectionOutline blocks={blocks} />

      <article className="max-w-prose" aria-label="Conteúdo do rascunho">
        {blocks.map((block, i) => (
          <BlockRenderer key={i} block={block} />
        ))}
      </article>

      <div
        className="mt-6 pt-3 flex items-center justify-between text-[10px]"
        style={{ borderTop: '1px solid var(--gem-border)', color: 'var(--gem-dim)' }}
      >
        <span>{wordCount} palavras · ~{readingMin} min leitura</span>
        <span>
          {sectionCount > 0 && `${sectionCount} seções · `}
          {paragraphCount} parágrafos
        </span>
      </div>
    </div>
  )
}
