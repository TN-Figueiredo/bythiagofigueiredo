'use client'

import type { RendererProps } from '../section-content'

interface PublishCard {
  timestamp: string
  text: string
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
  return val.filter((c): c is PublishCard => c && typeof c === 'object' && 'timestamp' in c)
}

function parseContent(content: RendererProps['content']): PublishContent {
  if (typeof content === 'string') return { title: { chosen: content } }
  if (Array.isArray(content) || content === null) return {}
  const raw = content as Record<string, unknown>
  return {
    title: raw.title && typeof raw.title === 'object' && 'chosen' in (raw.title as Record<string, unknown>)
      ? raw.title as PublishContent['title']
      : typeof raw.title === 'string' ? { chosen: raw.title } : undefined,
    description: typeof raw.description === 'string' ? raw.description : undefined,
    tags: toArray(raw.tags),
    cards: toCardArray(raw.cards),
    end_screen: typeof raw.end_screen === 'string' ? raw.end_screen : undefined,
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
  const color = count > 100 ? 'var(--gem-warn)' : 'var(--gem-dim)'
  return (
    <span className="text-[9px] ml-1.5" style={{ color }}>
      {count} chars
    </span>
  )
}

export function PublishRenderer({ content, isEditing, onContentChange }: RendererProps) {
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
                className="text-[13px] font-semibold leading-snug flex-1"
                style={{ color: 'var(--gem-text)' }}
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
                    className="text-[11px] pl-2"
                    style={{ color: 'var(--gem-muted)', borderLeft: '2px solid var(--gem-border)' }}
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
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {data.description != null && (
        <div>
          <SectionLabel>Descrição</SectionLabel>
          <div
            className="p-3 rounded-md text-[11px] leading-relaxed whitespace-pre-wrap"
            style={{
              background: 'var(--gem-well)',
              border: '1px solid var(--gem-border)',
              color: 'var(--gem-muted)',
              minHeight: '3rem',
            }}
            contentEditable={isEditing}
            suppressContentEditableWarning
            spellCheck={false}
            onBlur={(e) =>
              isEditing && onContentChange({ ...data, description: e.currentTarget.textContent ?? '' })
            }
          >
            {data.description}
          </div>
        </div>
      )}

      {data.tags && data.tags.length > 0 && (
        <div>
          <SectionLabel>Tags</SectionLabel>
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
          <div className="space-y-1.5">
            {data.cards.map((card, i) => (
              <div
                key={i}
                className="flex gap-3 p-2.5 rounded-md"
                style={{ background: 'var(--gem-well)', border: '1px solid var(--gem-border)' }}
              >
                <span
                  className="font-mono text-[10px] flex-shrink-0 pt-0.5"
                  style={{ color: 'var(--gem-accent)' }}
                >
                  {card.timestamp}
                </span>
                <span
                  className="text-[11px]"
                  style={{ color: 'var(--gem-muted)' }}
                  contentEditable={isEditing}
                  suppressContentEditableWarning
                  spellCheck={false}
                  onBlur={(e) => {
                    if (!isEditing) return
                    const updated = (data.cards ?? []).map((c, j) =>
                      j === i ? { ...c, text: e.currentTarget.textContent ?? '' } : c
                    )
                    onContentChange({ ...data, cards: updated })
                  }}
                >
                  {card.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.end_screen != null && (
        <div>
          <SectionLabel>End Screen</SectionLabel>
          <div
            className="p-3 rounded-md text-[11px]"
            style={{
              background: 'var(--gem-well)',
              border: '1px solid var(--gem-border)',
              color: 'var(--gem-muted)',
            }}
            contentEditable={isEditing}
            suppressContentEditableWarning
            spellCheck={false}
            onBlur={(e) =>
              isEditing && onContentChange({ ...data, end_screen: e.currentTarget.textContent ?? '' })
            }
          >
            {data.end_screen}
          </div>
        </div>
      )}

      {data.strategy && data.strategy.length > 0 && (
        <div>
          <SectionLabel>Estratégia de lançamento</SectionLabel>
          <div
            className="p-3 rounded-md"
            style={{ background: 'var(--gem-well)', border: '1px solid var(--gem-border)' }}
          >
            <ol className="pl-4 m-0 space-y-1">
              {data.strategy.map((step, i) => (
                <li key={i} className="text-[11px]" style={{ color: 'var(--gem-muted)' }}>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      {!data.title && !data.description && !data.tags?.length && !data.cards?.length && !data.end_screen && !data.strategy?.length && (
        <div className="text-[11px] text-center py-4" style={{ color: 'var(--gem-dim)' }}>
          Nenhuma informação de publicação disponível.
        </div>
      )}
    </div>
  )
}
