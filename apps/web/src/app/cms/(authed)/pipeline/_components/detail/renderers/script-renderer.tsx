'use client'

import type { RendererProps } from '../section-content'
import { StatusBadge } from './status-badge'

interface ScriptMeta {
  canal?: string
  formato?: string
  angulos?: string
  duracao?: string
  framework?: string
  fonte_vvs?: string
}

interface Beat {
  number: number
  label: string
  text: string
  status?: string
  divergence_note?: string
}

interface ScriptContent {
  meta?: ScriptMeta
  beats?: Beat[]
}

function parseContent(content: RendererProps['content']): ScriptContent {
  if (typeof content === 'string') return { beats: [{ number: 1, label: 'Beat 1', text: content, status: undefined }] }
  if (Array.isArray(content) || content === null) return {}
  return content as ScriptContent
}

export function ScriptRenderer({ content, isEditing, onContentChange }: RendererProps) {
  const data = parseContent(content)
  const meta = data.meta ?? {}
  const beats = data.beats ?? []

  const metaEntries = [
    ['Canal', meta.canal],
    ['Formato', meta.formato],
    ['Ângulos', meta.angulos],
    ['Duração', meta.duracao],
    ['Framework', meta.framework],
    ['Fonte VVS', meta.fonte_vvs],
  ].filter(([, v]) => v) as [string, string][]

  return (
    <div className="p-5 space-y-3">
      {metaEntries.length > 0 && (
        <div
          className="grid grid-cols-2 gap-x-4 gap-y-1.5 p-3 rounded-md text-[11px]"
          style={{ background: 'var(--gem-well)', border: '1px solid var(--gem-border)' }}
        >
          {metaEntries.map(([label, value]) => (
            <div key={label} className="flex gap-1.5">
              <span style={{ color: 'var(--gem-dim)' }}>{label}:</span>
              <span style={{ color: 'var(--gem-muted)' }}>{value}</span>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {beats.map((beat, idx) => (
          <div
            key={idx}
            className="rounded-md overflow-hidden"
            style={{
              border: '1px solid var(--gem-border)',
              background: beat.divergence_note ? 'rgba(249,115,22,0.05)' : 'transparent',
              borderColor: beat.divergence_note ? 'rgba(249,115,22,0.3)' : 'var(--gem-border)',
            }}
          >
            <div
              className="flex items-center gap-2 px-3 py-1.5"
              style={{ background: 'var(--gem-well)', borderBottom: '1px solid var(--gem-border)' }}
            >
              <span
                className="text-[10px] font-bold tabular-nums"
                style={{ color: 'var(--gem-accent)', minWidth: '1.5rem' }}
              >
                #{beat.number}
              </span>
              <span className="text-[11px] font-medium flex-1" style={{ color: 'var(--gem-text)' }}>
                {beat.label}
              </span>
              {beat.status && <StatusBadge status={beat.status} />}
            </div>

            <div
              className="px-3 py-2 font-mono text-[11px] leading-relaxed"
              style={{ color: 'var(--gem-muted)' }}
              contentEditable={isEditing}
              suppressContentEditableWarning
              spellCheck={false}
              onBlur={(e) => {
                if (!isEditing) return
                const updated = beats.map((b, i) =>
                  i === idx ? { ...b, text: e.currentTarget.textContent ?? '' } : b
                )
                onContentChange({ ...data, beats: updated })
              }}
            >
              {beat.text}
            </div>

            {beat.divergence_note && (
              <div
                className="px-3 py-1.5 text-[10px]"
                style={{ background: 'rgba(249,115,22,0.1)', color: '#f97316', borderTop: '1px solid rgba(249,115,22,0.2)' }}
              >
                ⚠ {beat.divergence_note}
              </div>
            )}
          </div>
        ))}
      </div>

      {beats.length === 0 && (
        <div className="text-[11px] text-center py-4" style={{ color: 'var(--gem-dim)' }}>
          Nenhum beat encontrado no roteiro.
        </div>
      )}
    </div>
  )
}
