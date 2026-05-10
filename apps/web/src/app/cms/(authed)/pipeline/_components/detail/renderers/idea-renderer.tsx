'use client'

import type { RendererProps } from '../section-content'

interface CrossRef {
  code: string
  title: string
  note: string
}

interface IdeaContent {
  premise: string
  body: string
  angle?: string
  vvs?: number
  validated_at?: string
  cross_refs?: CrossRef[]
}

function parseContent(content: RendererProps['content']): IdeaContent {
  if (typeof content === 'string') return { premise: '', body: content }
  if (Array.isArray(content) || content === null) return { premise: '', body: '' }
  return content as unknown as IdeaContent
}

export function IdeaRenderer({ content, isEditing, onContentChange }: RendererProps) {
  const data = parseContent(content)

  return (
    <div className={`p-5 space-y-2 ${isEditing ? 'editing' : ''}`}>
      <div className="p-3 rounded-md" style={{ background: 'var(--gem-well)', borderLeft: '3px solid var(--gem-done)' }}>
        <div
          className="text-xs font-semibold mb-1"
          style={{ color: 'var(--gem-text)' }}
          contentEditable={isEditing}
          suppressContentEditableWarning
          spellCheck={false}
          onBlur={(e) =>
            isEditing && onContentChange({ ...data, premise: e.currentTarget.textContent ?? '' })
          }
        >
          {data.premise || 'Sem título'}
        </div>
        <div
          className="text-[11px]"
          style={{ color: 'var(--gem-muted)' }}
          contentEditable={isEditing}
          suppressContentEditableWarning
          spellCheck={false}
          onBlur={(e) =>
            isEditing && onContentChange({ ...data, body: e.currentTarget.textContent ?? '' })
          }
        >
          {data.body || 'Sem descrição'}
        </div>
        <div className="flex gap-2 flex-wrap mt-1.5 text-[9px]" style={{ color: 'var(--gem-dim)' }}>
          {data.vvs != null && <span>VVS: {data.vvs}/100</span>}
          {data.angle && <span>Ângulo: {data.angle}</span>}
          {data.validated_at && (
            <span>Validado: {new Date(data.validated_at).toLocaleDateString('pt-BR')}</span>
          )}
        </div>
      </div>

      {data.cross_refs && data.cross_refs.length > 0 && (
        <div
          className="p-3 rounded-md"
          style={{ background: 'var(--gem-well)', borderLeft: '3px solid var(--gem-accent)' }}
        >
          <div className="text-xs font-semibold mb-1" style={{ color: 'var(--gem-text)' }}>
            Cross-referências
          </div>
          <ul className="pl-3.5 m-0 text-[11px] space-y-0.5" style={{ color: 'var(--gem-muted)' }}>
            {data.cross_refs.map((ref, i) => (
              <li key={i}>
                <strong style={{ color: 'var(--gem-accent)' }}>{ref.code}</strong> {ref.title} —{' '}
                {ref.note}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
