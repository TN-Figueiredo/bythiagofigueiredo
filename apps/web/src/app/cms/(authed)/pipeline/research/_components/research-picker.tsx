'use client'

import { useState, useCallback, useEffect } from 'react'

interface ResearchPickerItem {
  id: string
  title: string
  topic_path: string
  topic_icon: string
  status: string
  word_count: number
}

interface ResearchPickerProps {
  open: boolean
  onClose: () => void
  onSelect: (researchId: string) => void
  excludeIds?: string[]
}

const STATUS_COLORS: Record<string, string> = {
  new: '#fbbf24',
  reviewed: '#34d399',
  starred: '#f472b6',
  archived: '#64748b',
}

export function ResearchPicker({
  open,
  onClose,
  onSelect,
  excludeIds = [],
}: ResearchPickerProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ResearchPickerItem[]>([])
  const [loading, setLoading] = useState(false)

  const search = useCallback(async (q: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '20' })
      if (q.trim()) params.set('search', q)
      const res = await fetch(`/api/pipeline/research?${params}`)
      if (res.ok) {
        const { data } = await res.json()
        setResults(
          data.filter((r: any) => !excludeIds.includes(r.id)).map((r: any) => ({
            id: r.id,
            title: r.title,
            topic_path: r.topic_path ?? '',
            topic_icon: r.topic_icon ?? '📁',
            status: r.status,
            word_count: r.word_count,
          }))
        )
      }
    } finally {
      setLoading(false)
    }
  }, [excludeIds])

  useEffect(() => {
    if (open) search(query)
  }, [open, query, search])

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 480,
          maxHeight: '70vh',
          backgroundColor: 'var(--gem-surface)',
          border: '1px solid var(--gem-border)',
          borderRadius: 12,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gem-border)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gem-text)', marginBottom: 8 }}>
            Vincular Research
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar pesquisa..."
            autoFocus
            style={{
              width: '100%',
              padding: '6px 10px',
              fontSize: 12,
              borderRadius: 6,
              border: '1px solid var(--gem-border)',
              backgroundColor: 'var(--gem-well)',
              color: 'var(--gem-text)',
              outline: 'none',
            }}
          />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
          {loading && (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--gem-muted)', fontSize: 12 }}>
              Buscando...
            </div>
          )}
          {!loading && results.length === 0 && (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--gem-muted)', fontSize: 12 }}>
              Nenhum resultado.
            </div>
          )}
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => { onSelect(r.id); onClose() }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                textAlign: 'left',
                padding: '8px 16px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: 'transparent',
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  backgroundColor: STATUS_COLORS[r.status] ?? '#64748b',
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: 'var(--gem-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.title}
                </div>
                <div style={{ fontSize: 10, color: 'var(--gem-muted)' }}>
                  {r.topic_icon} {r.topic_path} · {r.word_count.toLocaleString()} palavras
                </div>
              </div>
            </button>
          ))}
        </div>

        <div style={{ padding: '8px 16px', borderTop: '1px solid var(--gem-border)', textAlign: 'right' }}>
          <button
            onClick={onClose}
            style={{
              fontSize: 12,
              color: 'var(--gem-muted)',
              backgroundColor: 'transparent',
              border: '1px solid var(--gem-border)',
              borderRadius: 6,
              padding: '4px 12px',
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
