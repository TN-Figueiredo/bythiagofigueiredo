'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import type { RendererProps } from '../section-content'

interface PublishCard {
  timestamp: string
  text: string
  type?: string
}

interface PublishContent {
  title?: {
    chosen: string
    alternatives?: string[]
  }
  description?: string
  tags?: string[]
  cards?: PublishCard[]
  end_screen?: string
  strategy?: string[]
}

function toArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(String)
  if (typeof val === 'string') return val.split('\n').filter(Boolean)
  return []
}

function toCardArray(val: unknown): PublishCard[] {
  if (!Array.isArray(val)) return []
  return val
    .filter((c): c is Record<string, unknown> => c && typeof c === 'object')
    .map(c => ({
      timestamp: String(c.timestamp ?? c.time ?? ''),
      text: String(c.text ?? ''),
      type: typeof c.type === 'string' ? c.type : undefined,
    }))
}

function parseTitle(raw: unknown): PublishContent['title'] | undefined {
  if (typeof raw === 'string') return { chosen: raw }
  if (!raw || typeof raw !== 'object') return undefined
  const t = raw as Record<string, unknown>
  const chosen = typeof t.chosen === 'string' ? t.chosen : typeof t.main === 'string' ? t.main : undefined
  if (!chosen) return undefined
  return {
    chosen,
    alternatives: Array.isArray(t.alternatives) ? t.alternatives.map(String) : undefined,
  }
}

function parseEndScreen(raw: unknown): string | undefined {
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object') {
    const es = raw as Record<string, unknown>
    const parts: string[] = []
    if (es.type) parts.push(String(es.type))
    if (es.video_suggestion) parts.push(String(es.video_suggestion))
    return parts.join(' — ') || undefined
  }
  return undefined
}

function parseContent(content: RendererProps['content']): PublishContent {
  if (typeof content === 'string') return { title: { chosen: content } }
  if (Array.isArray(content) || content === null) return {}
  const raw = content as Record<string, unknown>
  return {
    title: parseTitle(raw.title),
    description: typeof raw.description === 'string' ? raw.description : undefined,
    tags: toArray(raw.tags),
    cards: toCardArray(raw.cards),
    end_screen: parseEndScreen(raw.end_screen),
    strategy: toArray(raw.strategy),
  }
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--gem-dim)' }}>
      {children}
    </div>
  )
}

function charCount(text: string): React.ReactNode {
  const count = text.length
  let color: string
  let label: string
  if (count <= 70) {
    color = '#22c55e'
    label = 'ideal'
  } else if (count <= 100) {
    color = '#eab308'
    label = 'pode truncar'
  } else {
    color = '#ef4444'
    label = 'truncado'
  }
  return (
    <span className="text-[9px] ml-1.5 px-1.5 py-0.5 rounded-full" style={{ color, background: `${color}15` }}>
      {count} chars · {label}
    </span>
  )
}

const DESC_URL_RE = /https?:\/\/\S+/g
const DESC_HASH_RE = /#\w[\w]*/g
const DESC_HANDLE_RE = /@\w+/g
const DESC_TS_RE = /\d{2}:\d{2}/g

function tokenizeDescription(text: string): React.ReactNode[] {
  interface TMatch { start: number; end: number; node: React.ReactNode }
  const matches: TMatch[] = []

  let m: RegExpExecArray | null

  DESC_URL_RE.lastIndex = 0
  while ((m = DESC_URL_RE.exec(text)) !== null) {
    matches.push({
      start: m.index,
      end: m.index + m[0].length,
      node: <span key={`u${m.index}`} className="underline opacity-60" style={{ color: 'var(--gem-dim)' }}>{m[0]}</span>,
    })
  }

  DESC_HASH_RE.lastIndex = 0
  while ((m = DESC_HASH_RE.exec(text)) !== null) {
    if (matches.some(prev => m!.index >= prev.start && m!.index < prev.end)) continue
    matches.push({
      start: m.index,
      end: m.index + m[0].length,
      node: (
        <span key={`h${m.index}`} className="text-[10px] px-1.5 py-0.5 rounded-full"
          style={{ background: 'rgba(167,139,250,0.1)', color: 'var(--gem-accent)' }}>
          {m[0]}
        </span>
      ),
    })
  }

  DESC_HANDLE_RE.lastIndex = 0
  while ((m = DESC_HANDLE_RE.exec(text)) !== null) {
    if (matches.some(prev => m!.index >= prev.start && m!.index < prev.end)) continue
    matches.push({
      start: m.index,
      end: m.index + m[0].length,
      node: <span key={`a${m.index}`} style={{ color: '#22d3ee' }}>{m[0]}</span>,
    })
  }

  DESC_TS_RE.lastIndex = 0
  while ((m = DESC_TS_RE.exec(text)) !== null) {
    if (matches.some(prev => m!.index >= prev.start && m!.index < prev.end)) continue
    matches.push({
      start: m.index,
      end: m.index + m[0].length,
      node: (
        <span key={`t${m.index}`} className="font-mono text-[10px] font-semibold px-1 py-px rounded"
          style={{ color: '#818cf8', background: '#818cf810' }}>
          {m[0]}
        </span>
      ),
    })
  }

  if (matches.length === 0) return [text]

  matches.sort((a, b) => a.start - b.start)
  const result: React.ReactNode[] = []
  let cursor = 0
  for (const match of matches) {
    if (match.start > cursor) result.push(text.slice(cursor, match.start))
    result.push(match.node)
    cursor = match.end
  }
  if (cursor < text.length) result.push(text.slice(cursor))
  return result
}

function getCardTypeStyle(type: string): { background: string; color: string } {
  const t = type.toLowerCase()
  if (t === 'question' || t === 'poll') return { background: 'rgba(96,165,250,0.1)', color: '#60a5fa' }
  if (t === 'video' || t === 'clip') return { background: 'rgba(74,222,128,0.1)', color: '#4ade80' }
  return { background: 'rgba(6,182,212,0.1)', color: '#22d3ee' }
}

const PHASE_RE = /^(D\+\d+|Semana \d+|Hora \d+|Fase \d+):\s*/i

function parsePhase(step: string): { phase: string | null; text: string } {
  const m = step.match(PHASE_RE)
  if (m) return { phase: m[1]!, text: step.slice(m[0].length) }
  return { phase: null, text: step }
}

function EndScreenContent({ rawContent, text, isEditing, onTextChange }: {
  rawContent: RendererProps['content']
  text: string
  isEditing?: boolean
  onTextChange: (text: string) => void
}) {
  const raw = typeof rawContent === 'object' && rawContent !== null && !Array.isArray(rawContent)
    ? (rawContent as Record<string, unknown>).end_screen
    : undefined
  const obj = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : null

  if (obj) {
    return (
      <div className="p-3 rounded-md" style={{ background: 'var(--gem-well)', border: '1px solid var(--gem-border)' }}>
        {typeof obj.type === 'string' && (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{ background: 'rgba(167,139,250,0.15)', color: 'var(--gem-accent)' }}>
              {obj.type}
            </span>
          </div>
        )}
        {typeof obj.video_suggestion === 'string' && (
          <div className="text-[11px]" style={{ color: 'var(--gem-muted)' }}>
            <span style={{ color: 'var(--gem-dim)' }}>Sugestão: </span>
            <span className="font-medium" style={{ color: 'var(--gem-text)' }}>{obj.video_suggestion}</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="p-3 rounded-md text-[11px]"
      style={{ background: 'var(--gem-well)', border: '1px solid var(--gem-border)', color: 'var(--gem-muted)' }}
      role={isEditing ? 'textbox' : undefined}
      aria-label="End screen"
      contentEditable={isEditing}
      suppressContentEditableWarning
      spellCheck={false}
      onBlur={(e) => isEditing && onTextChange(e.currentTarget.textContent ?? '')}>
      {text}
    </div>
  )
}

interface BlogPublishPanelProps {
  pipelineItemId: string
  vvsScore: number
  stage?: string
  blogSlug?: string | null
  socialPostId?: string | null
}

function BlogPublishedPanel({ blogSlug, socialPostId }: { blogSlug?: string | null; socialPostId?: string | null }) {
  return (
    <div className="mt-4 p-4 rounded-lg" style={{ background: 'var(--gem-well)', border: '1px solid var(--gem-border)' }}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#22c55e' }} />
        <span className="text-[11px] font-medium" style={{ color: 'var(--gem-text)' }}>
          Publicado
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {blogSlug && (
          <a
            href={`/blog/${blogSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 text-[11px] font-medium py-2 px-3 rounded-md transition-opacity hover:opacity-90"
            style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}
          >
            Ver post no site
          </a>
        )}

        {socialPostId ? (
          <Link
            href={`/cms/social/${socialPostId}`}
            className="flex items-center justify-center gap-2 text-[11px] font-medium py-2 px-3 rounded-md transition-opacity hover:opacity-90"
            style={{ background: 'rgba(139,92,246,0.15)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.3)' }}
          >
            Ver post social
          </Link>
        ) : (
          <Link
            href="/cms/social"
            className="flex items-center justify-center gap-2 text-[11px] font-medium py-2 px-3 rounded-md transition-opacity hover:opacity-90"
            style={{ background: 'var(--gem-accent)', color: '#fff' }}
          >
            Compartilhar nas Redes
          </Link>
        )}
      </div>
    </div>
  )
}

function BlogScheduledPanel() {
  return (
    <div className="mt-4 p-4 rounded-lg" style={{ background: 'var(--gem-well)', border: '1px solid var(--gem-border)' }}>
      <div className="flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#8b5cf6' }} />
        <span className="text-[11px] font-medium" style={{ color: 'var(--gem-text)' }}>
          Agendado — aguardando publicação
        </span>
      </div>
    </div>
  )
}

function BlogDraftPublishPanel({ pipelineItemId, vvsScore }: { pipelineItemId: string; vvsScore: number }) {
  const router = useRouter()
  const [showSchedule, setShowSchedule] = useState(false)
  const [scheduledFor, setScheduledFor] = useState('')
  const [isPublishing, setIsPublishing] = useState(false)

  const minDateTime = useMemo(() => {
    if (!showSchedule) return ''
    const now = new Date()
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
    return now.toISOString().slice(0, 16)
  }, [showSchedule])

  async function handleScheduleConfirm() {
    if (isPublishing) return
    setShowSchedule(false)
    setIsPublishing(true)
    try {
      const { materializeBlogPost } = await import('@/lib/pipeline/materialize-blog-client')
      const result = await materializeBlogPost({
        pipelineItemId,
        targetStage: 'scheduled',
        scheduledFor,
        vvsScore,
      })
      if (result.ok) {
        toast.success('Post agendado com sucesso')
        router.refresh()
      } else {
        toast.error(result.message)
      }
    } finally {
      setIsPublishing(false)
    }
  }

  async function handlePublishNow() {
    if (isPublishing) return
    setIsPublishing(true)
    try {
      const { materializeBlogPost } = await import('@/lib/pipeline/materialize-blog-client')
      const result = await materializeBlogPost({
        pipelineItemId,
        targetStage: 'published',
        scheduledFor: null,
        vvsScore,
      })
      if (result.ok) {
        toast.success('Post publicado com sucesso')
        router.refresh()
      } else {
        toast.error(result.message)
      }
    } finally {
      setIsPublishing(false)
    }
  }

  const ready = vvsScore >= 80

  return (
    <div className="mt-4 p-4 rounded-lg" style={{ background: 'var(--gem-well)', border: '1px solid var(--gem-border)' }}>
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-2.5 h-2.5 rounded-full"
          style={{ background: ready ? '#22c55e' : '#ef4444' }}
        />
        <span className="text-[11px] font-medium" style={{ color: 'var(--gem-text)' }}>
          {ready ? 'Pronto para publicar' : `Precisa de ${80 - vvsScore} pontos mais`}
        </span>
        <span className="text-[10px] ml-auto" style={{ color: 'var(--gem-dim)' }}>
          VVS {vvsScore}/110
        </span>
      </div>

      <div className="flex gap-2">
        <button
          disabled={!ready || isPublishing}
          onClick={() => setShowSchedule(true)}
          className="flex-1 text-[11px] font-medium py-2 px-3 rounded-md transition-opacity disabled:opacity-40"
          style={{ background: 'rgba(139,92,246,0.15)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.3)' }}
        >
          Agendar
        </button>
        <button
          disabled={!ready || isPublishing}
          onClick={handlePublishNow}
          className="flex-1 text-[11px] font-medium py-2 px-3 rounded-md transition-opacity disabled:opacity-40"
          style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}
        >
          {isPublishing ? 'Publicando...' : 'Publicar Agora'}
        </button>
      </div>

      {showSchedule && (
        <div className="mt-3 p-3 rounded-md" style={{ background: 'var(--gem-surface)', border: '1px solid var(--gem-border)' }}>
          <label className="block text-[10px] mb-1.5" style={{ color: 'var(--gem-dim)' }}>
            Data e hora de publicação
          </label>
          <input
            type="datetime-local"
            value={scheduledFor}
            min={minDateTime}
            onChange={(e) => setScheduledFor(e.target.value)}
            className="w-full text-[11px] p-2 rounded-md mb-2"
            style={{ background: 'var(--gem-well)', border: '1px solid var(--gem-border)', color: 'var(--gem-text)' }}
          />
          <div className="flex gap-2">
            <button
              onClick={() => setShowSchedule(false)}
              className="flex-1 text-[10px] py-1.5 rounded-md"
              style={{ color: 'var(--gem-muted)', border: '1px solid var(--gem-border)' }}
            >
              Cancelar
            </button>
            <button
              disabled={!scheduledFor || isPublishing}
              onClick={handleScheduleConfirm}
              className="flex-1 text-[10px] py-1.5 rounded-md font-medium disabled:opacity-40"
              style={{ background: 'rgba(139,92,246,0.15)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.3)' }}
            >
              {isPublishing ? 'Agendando...' : 'Confirmar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function BlogPublishPanel({ pipelineItemId, vvsScore, stage, blogSlug, socialPostId }: BlogPublishPanelProps) {
  if (stage === 'published') return <BlogPublishedPanel blogSlug={blogSlug} socialPostId={socialPostId} />
  if (stage === 'scheduled') return <BlogScheduledPanel />
  return <BlogDraftPublishPanel pipelineItemId={pipelineItemId} vvsScore={vvsScore} />
}

export function PublishRenderer({ content, isEditing, onContentChange, pipelineItemId, vvsScore, format, stage, blogSlug, socialPostId }: RendererProps) {
  const isBlogPost = format === 'blog_post'
  const data = parseContent(content)

  return (
    <div className="p-5 space-y-4">
      {data.title && (
        <div>
          <SectionLabel>Título</SectionLabel>
          <div
            className="p-3 rounded-md"
            style={{ background: 'var(--gem-well)', border: '1px solid var(--gem-border)' }}
          >
            <div className="flex items-start gap-2 mb-1">
              <div
                className="text-[14px] font-semibold leading-snug flex-1"
                style={{ color: 'var(--gem-text)' }}
                role={isEditing ? 'textbox' : undefined}
                aria-label="Título principal"
                contentEditable={isEditing}
                suppressContentEditableWarning
                spellCheck={false}
                onBlur={(e) =>
                  isEditing &&
                  onContentChange({
                    ...data,
                    title: { ...data.title!, chosen: e.currentTarget.textContent ?? '' },
                  })
                }
              >
                {data.title.chosen}
              </div>
              {charCount(data.title.chosen)}
            </div>

            {data.title.alternatives && data.title.alternatives.length > 0 && (
              <div className="mt-2 space-y-1">
                <div className="text-[9px]" style={{ color: 'var(--gem-dim)' }}>Alternativas:</div>
                {data.title.alternatives.map((alt, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 text-[11px] pl-2"
                    style={{ color: 'var(--gem-muted)', borderLeft: '2px solid var(--gem-border)' }}
                  >
                    <span className="text-[9px] font-bold flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center"
                      style={{ background: 'var(--gem-accent)', color: 'white', opacity: 0.7 }}>
                      {i + 1}
                    </span>
                    <span
                      className="flex-1"
                      role={isEditing ? 'textbox' : undefined}
                      aria-label={`Alternativa de título ${i + 1}`}
                      contentEditable={isEditing}
                      suppressContentEditableWarning
                      spellCheck={false}
                      onBlur={(e) => {
                        if (!isEditing) return
                        const updated = [...(data.title!.alternatives ?? [])]
                        updated[i] = e.currentTarget.textContent ?? ''
                        onContentChange({ ...data, title: { ...data.title!, alternatives: updated } })
                      }}
                    >
                      {alt}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {data.description != null && (
        <div>
          <SectionLabel>
            Descrição
            {data.description && (
              <span className="text-[9px] font-normal ml-2" style={{ color: data.description.length > 200 ? '#eab308' : 'var(--gem-dim)' }}>
                {data.description.length} chars
                {data.description.length > 200 && ' · acima do fold'}
              </span>
            )}
          </SectionLabel>
          {isEditing ? (
            <div
              className="p-3 rounded-md text-[11px] leading-relaxed whitespace-pre-wrap"
              style={{
                background: 'var(--gem-well)',
                border: '1px solid var(--gem-border)',
                color: 'var(--gem-muted)',
                minHeight: '3rem',
              }}
              role="textbox"
              aria-label="Descrição"
              contentEditable
              suppressContentEditableWarning
              spellCheck={false}
              onBlur={(e) => onContentChange({ ...data, description: e.currentTarget.textContent ?? '' })}
            >
              {data.description}
            </div>
          ) : (
            <div
              className="p-3 rounded-md text-[11px] leading-relaxed whitespace-pre-wrap"
              style={{
                background: 'var(--gem-well)',
                border: '1px solid var(--gem-border)',
                color: 'var(--gem-muted)',
                minHeight: '3rem',
              }}
            >
              {tokenizeDescription(data.description)}
            </div>
          )}
        </div>
      )}

      {data.tags && data.tags.length > 0 && (
        <div>
          <SectionLabel>Tags <span className="text-[9px] font-normal ml-1" style={{ color: 'var(--gem-dim)' }}>{data.tags.length}</span></SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {data.tags.map((tag, i) => (
              <span
                key={i}
                className="text-[11px] px-2 py-0.5 rounded-full"
                style={{
                  background: 'rgba(167,139,250,0.1)',
                  border: '1px solid rgba(167,139,250,0.25)',
                  color: 'var(--gem-accent)',
                }}
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {data.cards && data.cards.length > 0 && (
        <div>
          <SectionLabel>Cards</SectionLabel>
          <div className="relative pl-4">
            <div className="absolute left-[5px] top-3 bottom-3 w-px" style={{ background: 'var(--gem-border)' }} />
            <div className="space-y-1.5">
              {data.cards.map((card, i) => (
                <div key={i} className="relative flex items-center gap-3 p-2.5 rounded-md"
                  style={{ background: 'var(--gem-well)', border: '1px solid var(--gem-border)' }}>
                  <div className="absolute w-[7px] h-[7px] rounded-full"
                    style={{ left: -15, background: 'var(--gem-accent)', border: '2px solid var(--gem-border)' }} />
                  <span className="font-mono text-[10px] flex-shrink-0" style={{ color: 'var(--gem-accent)' }}>
                    {card.timestamp}
                  </span>
                  <span className="text-[11px] flex-1" style={{ color: 'var(--gem-muted)' }}
                    role={isEditing ? 'textbox' : undefined}
                    aria-label={`Texto do card ${card.timestamp}`}
                    contentEditable={isEditing}
                    suppressContentEditableWarning
                    spellCheck={false}
                    onBlur={(e) => {
                      if (!isEditing) return
                      const updated = (data.cards ?? []).map((c, j) =>
                        j === i ? { ...c, text: e.currentTarget.textContent ?? '' } : c
                      )
                      onContentChange({ ...data, cards: updated })
                    }}>
                    {card.text}
                  </span>
                  {card.type && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded flex-shrink-0" style={getCardTypeStyle(card.type)}>
                      {card.type}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {data.end_screen != null && (
        <div>
          <SectionLabel>End Screen</SectionLabel>
          <EndScreenContent
            rawContent={content}
            text={data.end_screen}
            isEditing={isEditing}
            onTextChange={(text) => onContentChange({ ...data, end_screen: text })}
          />
        </div>
      )}

      {data.strategy && data.strategy.length > 0 && (
        <div>
          <SectionLabel>Estratégia de lançamento</SectionLabel>
          <div className="relative pl-6">
            <div className="absolute left-[7px] top-2 bottom-2 w-px" style={{ background: 'var(--gem-border)' }} />
            <div className="space-y-2">
              {data.strategy.map((step, i) => {
                const { phase, text } = parsePhase(step)
                return (
                  <div key={i} className="relative flex items-start gap-2.5">
                    <div className="absolute w-[15px] h-[15px] rounded-full flex items-center justify-center text-[8px] font-bold"
                      style={{ left: -21, top: 1, background: 'var(--gem-accent)', color: 'white' }}>
                      {i + 1}
                    </div>
                    <div className="text-[11px]" style={{ color: 'var(--gem-muted)' }}>
                      {phase && (
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded mr-1.5"
                          style={{ background: 'rgba(167,139,250,0.1)', color: 'var(--gem-accent)' }}>
                          {phase}
                        </span>
                      )}
                      {text}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {!data.title && !data.description && !data.tags?.length && !data.cards?.length && !data.end_screen && !data.strategy?.length && !isBlogPost && (
        <div className="text-[11px] text-center py-4" style={{ color: 'var(--gem-dim)' }}>
          Nenhuma informação de publicação disponível.
        </div>
      )}

      {isBlogPost && pipelineItemId && (
        <BlogPublishPanel
          pipelineItemId={pipelineItemId}
          vvsScore={vvsScore ?? 0}
          stage={stage}
          blogSlug={blogSlug}
          socialPostId={socialPostId}
        />
      )}
    </div>
  )
}
