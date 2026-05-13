'use client'

import { useMemo, useState, useCallback } from 'react'
import type { RendererProps } from '../section-content'

// ─── Types ─────────────────────────────────────────────────────────────────

interface Prompt {
  rank: number
  prompt: string
  rationale: string
  alt_text_pt?: string
  alt_text_en?: string
}

interface CoverData {
  prompts: Prompt[]
  chosen: number | null
  image_url: string | null
  fallback_search?: string
  status?: string
}

interface BodyImage {
  ref_id: string
  placement: string
  intent: string
  description: string
  prompts: Prompt[]
  chosen: number | null
  image_url: string | null
  fallback_search?: string
  status?: string
}

interface ImagesData {
  cover?: CoverData
  body_images?: BodyImage[]
}

interface LegacyImageEntry {
  url?: string
  alt?: string
  caption?: string
  role?: string
}

// ─── Parsers ───────────────────────────────────────────────────────────────

function parseStructured(content: RendererProps['content']): ImagesData | null {
  if (content === null || typeof content === 'string' || Array.isArray(content)) return null
  const obj = content as Record<string, unknown>
  if (obj.cover || obj.body_images) return obj as unknown as ImagesData
  return null
}

function parseLegacy(content: RendererProps['content']): LegacyImageEntry[] {
  if (content === null) return []
  if (typeof content === 'string') {
    if (!content.trim()) return []
    return content.split('\n').filter(Boolean).map(line => ({ caption: line.trim() }))
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
  if (Array.isArray(obj.images)) return parseLegacy(obj.images as RendererProps['content'])
  return []
}

// ─── Shared UI ─────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  prompt_ready: { label: 'Prompt pronto', color: '#818cf8' },
  generating: { label: 'Gerando...', color: '#f59e0b' },
  generated: { label: 'Gerado', color: '#22c55e' },
  uploaded: { label: 'Enviado', color: '#06b6d4' },
}

function StatusBadge({ status }: { status?: string }) {
  if (!status) return null
  const config = STATUS_LABELS[status] ?? { label: status, color: 'var(--gem-dim)' }
  return (
    <span
      className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
      style={{ background: `${config.color}20`, color: config.color }}
    >
      {config.label}
    </span>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [text])
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="text-[9px] px-1.5 py-0.5 rounded transition-colors"
      style={{
        background: copied ? 'rgba(34,197,94,0.15)' : 'var(--gem-well)',
        color: copied ? '#22c55e' : 'var(--gem-dim)',
        border: '1px solid var(--gem-border)',
      }}
    >
      {copied ? 'Copiado!' : 'Copiar'}
    </button>
  )
}

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  cover: { bg: 'rgba(99,102,241,0.1)', text: '#818cf8' },
  thumbnail: { bg: 'rgba(236,72,153,0.1)', text: '#ec4899' },
  og: { bg: 'rgba(34,197,94,0.1)', text: '#22c55e' },
}

// ─── Prompt card (interactive) ─────────────────────────────────────────────

interface PromptCardProps {
  prompt: Prompt
  isChosen: boolean
  lang: string
  onChoose?: () => void
}

function PromptCard({ prompt, isChosen, lang, onChoose }: PromptCardProps) {
  const altText = lang === 'pt' ? prompt.alt_text_pt : prompt.alt_text_en
  return (
    <div
      className={`p-2.5 rounded-md space-y-1.5 ${onChoose ? 'cursor-pointer' : ''}`}
      style={{
        background: isChosen ? 'rgba(99,102,241,0.08)' : 'var(--gem-well)',
        border: isChosen ? '1px solid rgba(99,102,241,0.3)' : '1px solid var(--gem-border)',
      }}
      onClick={onChoose}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span
            className="text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center"
            style={{
              background: isChosen ? 'rgba(99,102,241,0.2)' : 'var(--gem-border)',
              color: isChosen ? '#818cf8' : 'var(--gem-dim)',
            }}
          >
            {prompt.rank}
          </span>
          {isChosen && (
            <span className="text-[9px] font-semibold" style={{ color: '#818cf8' }}>Escolhida</span>
          )}
        </div>
        <CopyButton text={prompt.prompt} />
      </div>
      <div className="text-[11px] font-mono leading-relaxed select-all" style={{ color: 'var(--gem-text)' }}>
        {prompt.prompt}
      </div>
      <div className="text-[10px]" style={{ color: 'var(--gem-dim)' }}>
        {prompt.rationale}
      </div>
      {altText && (
        <div className="text-[9px] italic" style={{ color: 'var(--gem-dim)' }}>
          alt: {altText}
        </div>
      )}
      {onChoose && !isChosen && (
        <div className="text-[9px]" style={{ color: 'var(--gem-dim)', opacity: 0.6 }}>
          Clique para escolher este prompt
        </div>
      )}
    </div>
  )
}

// ─── Section renderers ─────────────────────────────────────────────────────

interface SectionProps {
  lang: string
  onChoosePrompt?: (path: string, rank: number) => void
}

function CoverSection({ cover, lang, onChoosePrompt }: { cover: CoverData } & SectionProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
            style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8' }}
          >
            cover
          </span>
          <span className="text-[10px]" style={{ color: 'var(--gem-dim)' }}>16:9 — 1200×675</span>
        </div>
        <StatusBadge status={cover.status} />
      </div>

      {cover.image_url && (
        <div className="rounded-md overflow-hidden" style={{ border: '1px solid var(--gem-border)' }}>
          <img src={cover.image_url} alt="" className="w-full h-auto" />
        </div>
      )}

      {cover.prompts.length > 0 ? (
        <div className="space-y-1.5">
          {cover.prompts.map((p) => (
            <PromptCard
              key={p.rank}
              prompt={p}
              isChosen={cover.chosen === p.rank}
              lang={lang}
              onChoose={onChoosePrompt ? () => onChoosePrompt('cover.chosen', p.rank) : undefined}
            />
          ))}
        </div>
      ) : (
        <div className="text-[10px] py-2" style={{ color: 'var(--gem-dim)' }}>
          Aguardando prompts do cowork...
        </div>
      )}

      {cover.fallback_search && (
        <div className="text-[9px]" style={{ color: 'var(--gem-dim)' }}>
          Fallback: {cover.fallback_search}
        </div>
      )}
    </div>
  )
}

function BodyImageSection({ image, index, lang, onChoosePrompt }: { image: BodyImage; index: number } & SectionProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
            style={{ background: 'rgba(236,72,153,0.1)', color: '#ec4899' }}
          >
            {image.ref_id}
          </span>
          <span className="text-[10px]" style={{ color: 'var(--gem-dim)' }}>
            {image.intent.replace(/_/g, ' ')}
          </span>
        </div>
        <StatusBadge status={image.status} />
      </div>

      <div className="text-[11px]" style={{ color: 'var(--gem-muted)' }}>{image.description}</div>
      <div className="text-[9px]" style={{ color: 'var(--gem-dim)' }}>{image.placement.replace(/_/g, ' ')}</div>

      {image.image_url && (
        <div className="rounded-md overflow-hidden" style={{ border: '1px solid var(--gem-border)' }}>
          <img src={image.image_url} alt="" className="w-full h-auto" />
        </div>
      )}

      {image.prompts.length > 0 ? (
        <div className="space-y-1.5">
          {image.prompts.map((p) => (
            <PromptCard
              key={p.rank}
              prompt={p}
              isChosen={image.chosen === p.rank}
              lang={lang}
              onChoose={onChoosePrompt ? () => onChoosePrompt(`body_images[${index}].chosen`, p.rank) : undefined}
            />
          ))}
        </div>
      ) : (
        <div className="text-[10px] py-2" style={{ color: 'var(--gem-dim)' }}>
          Aguardando prompts do cowork...
        </div>
      )}

      {image.fallback_search && (
        <div className="text-[9px]" style={{ color: 'var(--gem-dim)' }}>
          Fallback: {image.fallback_search}
        </div>
      )}
    </div>
  )
}

// ─── Legacy view (backward compat) ────────────────────────────────────────

function LegacyView({ images }: { images: LegacyImageEntry[] }) {
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
            <div className="w-16 h-16 rounded flex items-center justify-center flex-shrink-0 text-[10px]" style={{ background: 'var(--gem-border)', color: 'var(--gem-dim)' }}>
              IMG
            </div>
          )}
          <div className="flex-1 min-w-0">
            {img.role && (
              <span
                className="inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded-full mb-1"
                style={{ background: (ROLE_COLORS[img.role] ?? { bg: 'var(--gem-well)' }).bg, color: (ROLE_COLORS[img.role] ?? { text: 'var(--gem-dim)' }).text }}
              >
                {img.role}
              </span>
            )}
            {img.caption && <div className="text-[11px]" style={{ color: 'var(--gem-muted)' }}>{img.caption}</div>}
            {img.alt && <div className="text-[10px] mt-0.5" style={{ color: 'var(--gem-dim)' }}>alt: {img.alt}</div>}
            {img.url && <div className="text-[9px] mt-0.5 truncate" style={{ color: 'var(--gem-dim)' }}>{img.url}</div>}
          </div>
        </div>
      ))}
      <div className="text-[10px] pt-1" style={{ color: 'var(--gem-dim)' }}>
        {images.length} {images.length === 1 ? 'imagem' : 'imagens'}
      </div>
    </div>
  )
}

// ─── Main renderer ─────────────────────────────────────────────────────────

export function ImagesRenderer({ content, isEditing, lang, onContentChange }: RendererProps) {
  const structured = useMemo(() => parseStructured(content), [content])
  const legacy = useMemo(() => structured ? [] : parseLegacy(content), [content, structured])

  const handleChoosePrompt = useCallback((path: string, rank: number) => {
    if (!structured) return
    if (path === 'cover.chosen' && structured.cover) {
      const newChosen = structured.cover.chosen === rank ? null : rank
      const updated: ImagesData = {
        ...structured,
        cover: { ...structured.cover, chosen: newChosen },
      }
      onContentChange(updated as unknown as RendererProps['content'])
    } else {
      const match = path.match(/^body_images\[(\d+)]\.chosen$/)
      if (match && structured.body_images) {
        const idx = Number(match[1])
        if (structured.body_images[idx]) {
          const newChosen = structured.body_images[idx].chosen === rank ? null : rank
          const updated: ImagesData = {
            ...structured,
            body_images: structured.body_images.map((img, i) =>
              i === idx ? { ...img, chosen: newChosen } : img
            ),
          }
          onContentChange(updated as unknown as RendererProps['content'])
        }
      }
    }
  }, [structured, onContentChange])

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

  if (structured) {
    const totalPrompts = (structured.cover?.prompts?.length ?? 0) +
      (structured.body_images?.reduce((sum, img) => sum + (img.prompts?.length ?? 0), 0) ?? 0)
    const totalImages = (structured.cover ? 1 : 0) + (structured.body_images?.length ?? 0)
    const chosenCount = (structured.cover?.chosen != null ? 1 : 0) +
      (structured.body_images?.filter(img => img.chosen != null).length ?? 0)

    return (
      <div className="p-5 space-y-5">
        {structured.cover && (
          <CoverSection cover={structured.cover} lang={lang} onChoosePrompt={handleChoosePrompt} />
        )}

        {structured.body_images && structured.body_images.length > 0 && (
          <>
            {structured.cover && <div className="border-t" style={{ borderColor: 'var(--gem-border)' }} />}
            {structured.body_images.map((img, i) => (
              <BodyImageSection key={img.ref_id} image={img} index={i} lang={lang} onChoosePrompt={handleChoosePrompt} />
            ))}
          </>
        )}

        <div className="text-[10px] pt-1 flex items-center gap-2" style={{ color: 'var(--gem-dim)' }}>
          <span>{totalPrompts} {totalPrompts === 1 ? 'prompt' : 'prompts'} Midjourney</span>
          <span>·</span>
          <span>{totalImages} {totalImages === 1 ? 'imagem' : 'imagens'}</span>
          <span>·</span>
          <span style={{ color: chosenCount === totalImages ? '#22c55e' : 'var(--gem-dim)' }}>
            {chosenCount}/{totalImages} escolhidas
          </span>
        </div>
      </div>
    )
  }

  if (legacy.length > 0) return <LegacyView images={legacy} />

  return (
    <div className="p-5 text-[11px] text-center py-8" style={{ color: 'var(--gem-dim)' }}>
      Nenhuma sugestão de imagem ainda. O cowork preencherá prompts Midjourney ao gerar o draft.
    </div>
  )
}
