'use client'

import type { RendererProps } from '../section-content'

interface BRollItem {
  description: string
  clip_name?: string
  beat?: string
  type?: string
  captured: boolean
}

interface ThumbnailConcept {
  label: string
  layout: string
}

interface BRollContent {
  items?: BRollItem[]
  thumbnail_concepts?: ThumbnailConcept[]
}

function parseContent(content: RendererProps['content']): BRollContent {
  if (typeof content === 'string') return { items: [{ description: content, captured: false }] }
  if (Array.isArray(content)) return { items: content as BRollItem[] }
  if (content === null) return {}
  return content as BRollContent
}

export function BRollRenderer({ content, isEditing, onContentChange }: RendererProps) {
  const data = parseContent(content)
  const items = data.items ?? []
  const concepts = data.thumbnail_concepts ?? []

  const captured = items.filter(i => i.captured).length
  const pending = items.length - captured

  function toggleCapture(idx: number) {
    const updated = items.map((item, i) =>
      i === idx ? { ...item, captured: !item.captured } : item
    )
    onContentChange({ ...data, items: updated })
  }

  return (
    <div className="p-5 space-y-3">
      {items.length > 0 && (
        <div
          className="text-[10px] px-2 py-1 rounded"
          style={{ background: 'var(--gem-well)', color: 'var(--gem-muted)', display: 'inline-block' }}
        >
          <span style={{ color: 'var(--gem-done)' }}>{captured}/{items.length} capturados</span>
          {pending > 0 && <span style={{ color: 'var(--gem-dim)' }}> · {pending} pendentes</span>}
        </div>
      )}

      <div className="space-y-1.5">
        {items.map((item, idx) => (
          <div
            key={idx}
            className="flex items-start gap-2.5 p-2.5 rounded-md"
            style={{
              background: 'var(--gem-well)',
              border: '1px solid var(--gem-border)',
              opacity: item.captured ? 0.6 : 1,
            }}
          >
            <button
              onClick={() => toggleCapture(idx)}
              className="mt-0.5 flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors"
              style={{
                background: item.captured ? 'var(--gem-done)' : 'transparent',
                borderColor: item.captured ? 'var(--gem-done)' : 'var(--gem-border)',
                color: '#fff',
              }}
              aria-label={item.captured ? 'Marcar como não capturado' : 'Marcar como capturado'}
            >
              {item.captured && (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>

            <div className="flex-1 min-w-0 space-y-1">
              <div
                className="text-[11px]"
                style={{
                  color: 'var(--gem-text)',
                  textDecoration: item.captured ? 'line-through' : 'none',
                }}
                contentEditable={isEditing}
                suppressContentEditableWarning
                spellCheck={false}
                onBlur={(e) => {
                  if (!isEditing) return
                  const updated = items.map((b, i) =>
                    i === idx ? { ...b, description: e.currentTarget.textContent ?? '' } : b
                  )
                  onContentChange({ ...data, items: updated })
                }}
              >
                {item.description}
              </div>

              <div className="flex gap-2 flex-wrap items-center">
                {item.clip_name && (
                  <span
                    className="font-mono text-[10px] px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(167,139,250,0.1)', color: 'var(--gem-accent)' }}
                  >
                    {item.clip_name}
                  </span>
                )}
                {item.beat && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}
                  >
                    Beat {item.beat}
                  </span>
                )}
                {item.type && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded"
                    style={{ background: 'var(--gem-well)', color: 'var(--gem-dim)', border: '1px solid var(--gem-border)' }}
                  >
                    {item.type}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {items.length === 0 && (
        <div className="text-[11px] text-center py-4" style={{ color: 'var(--gem-dim)' }}>
          Nenhum B-Roll cadastrado.
        </div>
      )}

      {concepts.length > 0 && (
        <div className="pt-2">
          <div className="text-[10px] font-semibold mb-2" style={{ color: 'var(--gem-dim)' }}>
            CONCEITOS DE THUMBNAIL
          </div>
          <div className="grid grid-cols-2 gap-2">
            {concepts.map((concept, i) => (
              <div
                key={i}
                className="p-2.5 rounded-md"
                style={{ background: 'var(--gem-well)', border: '1px solid var(--gem-border)' }}
              >
                <div className="text-[11px] font-medium mb-0.5" style={{ color: 'var(--gem-text)' }}>
                  {concept.label}
                </div>
                <div className="text-[10px]" style={{ color: 'var(--gem-muted)' }}>
                  {concept.layout}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
