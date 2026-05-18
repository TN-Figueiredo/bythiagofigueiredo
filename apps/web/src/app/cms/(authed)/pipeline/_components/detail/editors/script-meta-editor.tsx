'use client'

import { useCallback } from 'react'
import type { RoteiroMeta } from '@/lib/pipeline/roteiro-schemas'

interface ScriptMetaEditorProps {
  meta: RoteiroMeta
  isEditing: boolean
  onChange: (meta: RoteiroMeta) => void
}

const META_FIELDS: { key: keyof RoteiroMeta; label: string }[] = [
  { key: 'canal', label: 'Canal' },
  { key: 'formato', label: 'Formato' },
  { key: 'angulos', label: 'Angulos' },
  { key: 'duracao', label: 'Duracao' },
  { key: 'framework', label: 'Framework' },
  { key: 'fonte_vvs', label: 'Fonte VVS' },
]

export function ScriptMetaEditor({ meta, isEditing, onChange }: ScriptMetaEditorProps) {
  const handleChange = useCallback(
    (key: keyof RoteiroMeta, value: string) => {
      onChange({ ...meta, [key]: value || undefined })
    },
    [meta, onChange],
  )

  const entries = META_FIELDS.filter(({ key }) => isEditing || meta[key])

  if (entries.length === 0 && !isEditing) return null

  return (
    <div
      className="grid grid-cols-3 gap-x-5 gap-y-2 p-3 rounded-md text-[11px]"
      style={{ background: 'var(--gem-well)', border: '1px solid var(--gem-border)' }}
    >
      {(isEditing ? META_FIELDS : entries).map(({ key, label }) => (
        <div key={key} className="flex flex-col gap-0.5">
          <label
            className="text-[8px] font-bold uppercase tracking-wide"
            style={{ color: 'var(--gem-dim)' }}
            htmlFor={`meta-${key}`}
          >
            {label}
          </label>
          {isEditing ? (
            <input
              id={`meta-${key}`}
              type="text"
              className="w-full bg-transparent border-b px-0 py-0.5 text-[11px] outline-none transition-colors focus:border-[var(--gem-accent)]"
              style={{
                color: 'var(--gem-muted)',
                borderColor: 'var(--gem-border)',
              }}
              value={meta[key] ?? ''}
              onChange={(e) => handleChange(key, e.target.value)}
              placeholder="—"
            />
          ) : (
            <span style={{ color: 'var(--gem-muted)' }}>{meta[key] ?? '—'}</span>
          )}
        </div>
      ))}
    </div>
  )
}
