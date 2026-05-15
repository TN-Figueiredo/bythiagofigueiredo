'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { RESEARCH_STATUS_COLORS } from '@/lib/pipeline/research-types'

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

export function ResearchPicker({
  open,
  onClose,
  onSelect,
  excludeIds = [],
}: ResearchPickerProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ResearchPickerItem[]>([])
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (q: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '20' })
      if (q.trim()) params.set('search', q)
      const res = await fetch(`/api/pipeline/research?${params}`)
      if (res.ok) {
        const { data } = await res.json()
        setResults(
          data.filter((r: ResearchPickerItem) => !excludeIds.includes(r.id)).map((r: Record<string, unknown>) => ({
            id: r.id as string,
            title: r.title as string,
            topic_path: (r.topic_path as string) ?? '',
            topic_icon: (r.topic_icon as string) ?? '📁',
            status: r.status as string,
            word_count: r.word_count as number,
          }))
        )
      }
    } finally {
      setLoading(false)
    }
  }, [excludeIds])

  useEffect(() => {
    if (!open) return
    if (!query.trim()) {
      search(query)
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(query), 250)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
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
                  backgroundColor: RESEARCH_STATUS_COLORS[r.status as keyof typeof RESEARCH_STATUS_COLORS] ?? '#64748b',
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
