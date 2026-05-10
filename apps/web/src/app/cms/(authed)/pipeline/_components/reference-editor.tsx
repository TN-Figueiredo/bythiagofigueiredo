'use client'

import { useState } from 'react'
import { upsertReference } from '../actions'

interface ReferenceDoc { key: string; title: string; content_md: string | null; content_compact: Record<string, unknown> | null; updated_at: string }

export function ReferenceEditor({ docs }: { docs: ReferenceDoc[] }) {
  const [selected, setSelected] = useState<string | null>(docs[0]?.key ?? null)
  const [title, setTitle] = useState(docs[0]?.title ?? '')
  const [content, setContent] = useState(docs[0]?.content_md ?? '')
  const [saving, setSaving] = useState(false)

  function selectDoc(key: string) {
    const doc = docs.find((d) => d.key === key)
    setSelected(key)
    setTitle(doc?.title ?? '')
    setContent(doc?.content_md ?? '')
  }

  async function handleSave() {
    if (!selected) return
    setSaving(true)
    await upsertReference(selected, { title, content_md: content })
    setSaving(false)
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-10rem)]">
      <div className="w-48 pr-4 overflow-y-auto" style={{ borderRight: '1px solid var(--gem-border)' }}>
        <ul className="space-y-1">
          {docs.map((d) => (
            <li key={d.key}>
              <button
                onClick={() => selectDoc(d.key)}
                className="w-full text-left px-2 py-1.5 rounded text-xs transition-colors"
                style={{
                  backgroundColor: selected === d.key ? 'rgba(99,102,241,0.15)' : 'transparent',
                  color: selected === d.key ? 'var(--gem-text)' : 'var(--gem-muted)',
                }}
              >
                {d.title || d.key}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex-1 flex flex-col gap-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className="px-3 py-2 rounded-lg text-sm"
          style={{ backgroundColor: 'var(--gem-well)', border: '1px solid var(--gem-border)', color: 'var(--gem-text)' }}
        />
        <textarea
          value={content ?? ''}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Markdown content..."
          className="flex-1 px-3 py-2 rounded-lg text-sm font-mono resize-none"
          style={{ backgroundColor: 'var(--gem-well)', border: '1px solid var(--gem-border)', color: 'var(--gem-muted)' }}
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="self-start px-4 py-2 rounded-lg text-sm text-white disabled:opacity-50"
          style={{ backgroundColor: 'var(--gem-accent)' }}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  )
}
