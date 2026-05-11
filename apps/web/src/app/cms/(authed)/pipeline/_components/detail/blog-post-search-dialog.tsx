'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface SearchResult {
  id: string
  title: string
  locale: string
  status: string
  linked_to_code: string | null
}

interface Props {
  itemId: string
  siteId: string
  open: boolean
  onClose: () => void
  onSearch: (query: string) => Promise<SearchResult[]>
}

export function BlogPostSearchDialog({ itemId, siteId, open, onClose, onSearch }: Props) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isLinking, setIsLinking] = useState(false)
  const [focused, setFocused] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setFocused(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const data = await onSearch(query.trim())
        setResults(data)
        setFocused(0)
      } finally {
        setIsSearching(false)
      }
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [query, siteId, onSearch])

  async function handleSelect(postId: string) {
    setIsLinking(true)
    try {
      const res = await fetch(`/api/pipeline/items/${itemId}/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blog_post_id: postId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error?.message ?? 'Erro ao vincular')
        return
      }
      toast.success('Post vinculado')
      router.refresh()
      onClose()
    } finally {
      setIsLinking(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    const linkable = results.filter(r => !r.linked_to_code)
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocused(f => Math.min(f + 1, linkable.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setFocused(f => Math.max(f - 1, 0)) }
    if (e.key === 'Enter' && linkable[focused]) { e.preventDefault(); handleSelect(linkable[focused].id) }
    if (e.key === 'Escape') onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative w-full max-w-md rounded-lg border shadow-2xl"
        style={{ backgroundColor: 'var(--gem-surface)', borderColor: 'var(--gem-border)' }}
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="p-3 border-b" style={{ borderColor: 'var(--gem-border)' }}>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por título..."
            className="w-full bg-transparent text-sm outline-none"
            style={{ color: 'var(--gem-text)' }}
          />
        </div>
        <div className="max-h-72 overflow-y-auto p-1">
          {isSearching && <p className="text-xs p-3 text-center" style={{ color: 'var(--gem-dim)' }}>Buscando...</p>}
          {!isSearching && query && results.length === 0 && (
            <p className="text-xs p-3 text-center" style={{ color: 'var(--gem-dim)' }}>Nenhum post encontrado</p>
          )}
          {results.map((r, i) => {
            const isDisabled = !!r.linked_to_code
            const linkableIndex = results.filter((x, xi) => xi < i && !x.linked_to_code).length
            return (
              <button
                key={r.id}
                disabled={isDisabled || isLinking}
                onClick={() => handleSelect(r.id)}
                className="w-full text-left px-3 py-2 rounded text-xs transition-colors"
                style={{
                  backgroundColor: !isDisabled && linkableIndex === focused ? 'rgba(99,102,241,0.1)' : 'transparent',
                  opacity: isDisabled ? 0.4 : 1,
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  color: 'var(--gem-text)',
                }}
                title={isDisabled ? `Vinculado a ${r.linked_to_code}` : undefined}
              >
                <span className="font-medium">{r.title}</span>
                <span className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] px-1 py-0.5 rounded bg-slate-700/50 text-slate-300">{r.locale.toUpperCase()}</span>
                  <span
                    className="text-[10px] px-1 py-0.5 rounded font-medium"
                    style={{
                      backgroundColor: r.status === 'published' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                      color: r.status === 'published' ? '#10b981' : '#f59e0b',
                    }}
                  >
                    {r.status}
                  </span>
                  {isDisabled && <span className="text-[10px]" style={{ color: 'var(--gem-dim)' }}>→ {r.linked_to_code}</span>}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
