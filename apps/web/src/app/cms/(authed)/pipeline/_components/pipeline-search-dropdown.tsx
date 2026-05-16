'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { getFormatIcon } from '@/lib/pipeline/gem-design'

interface SearchResult {
  pipeline: Array<{ id: string; code: string; title_pt: string | null; title_en: string | null; format: string; stage: string }>
  blog_posts: Array<{ id: string; title: string; slug: string; status: string }>
  newsletters: Array<{ id: string; subject: string; status: string }>
}

export function PipelineSearchDropdown() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults(null); setOpen(false); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/pipeline/search?q=${encodeURIComponent(q)}`)
      const json = await res.json()
      setResults(json.data ?? null)
      setOpen(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => search(query), 300)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [query, search])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { setOpen(false); setResults(null) }
  }

  const hasResults = results && (results.pipeline.length > 0 || results.blog_posts.length > 0 || results.newsletters.length > 0)

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => { if (results) setOpen(true) }}
        placeholder="Buscar pipeline..."
        aria-label="Search pipeline items"
        aria-expanded={open}
        aria-controls="pipeline-search-results"
        role="combobox"
        aria-autocomplete="list"
        className="w-full px-3 py-2 rounded-lg text-sm"
        style={{ backgroundColor: 'var(--gem-well)', border: '1px solid var(--gem-border)', color: 'var(--gem-text)' }}
      />
      {loading && <span className="absolute right-3 top-2.5 text-xs animate-pulse" style={{ color: 'var(--gem-dim)' }}>...</span>}

      {open && results && (
        <div
          id="pipeline-search-results"
          role="listbox"
          aria-label="Search results"
          className="absolute top-full mt-1 left-0 right-0 rounded-lg border overflow-hidden z-50 max-h-80 overflow-y-auto shadow-xl"
          style={{ backgroundColor: 'var(--gem-surface)', borderColor: 'var(--gem-border)', boxShadow: '0 12px 32px rgba(0,0,0,0.5)' }}
        >
          {!hasResults && (
            <p className="px-3 py-4 text-xs" style={{ color: 'var(--gem-dim)' }}>
              Nenhum resultado para &apos;{query}&apos;
            </p>
          )}

          {results.pipeline.length > 0 && (
            <div className="p-2">
              <p className="text-[10px] uppercase tracking-wider px-1 mb-1" style={{ color: 'var(--gem-dim)' }}>Pipeline</p>
              {results.pipeline.map((item) => {
                const icon = getFormatIcon(item.format)
                return (
                  <Link
                    key={item.id}
                    href={`/cms/pipeline/items/${item.id}`}
                    onClick={() => setOpen(false)}
                    role="option"
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 transition-colors"
                  >
                    <span className="text-xs">{icon.icon}</span>
                    <span className="text-[10px] font-mono" style={{ color: 'var(--gem-muted)' }}>{item.code}</span>
                    <span className="text-xs truncate" style={{ color: 'var(--gem-text)' }}>{item.title_pt || item.title_en}</span>
                    <span className="text-[10px] ml-auto px-1 rounded" style={{ backgroundColor: 'var(--gem-well)', color: 'var(--gem-dim)' }}>{item.stage}</span>
                  </Link>
                )
              })}
            </div>
          )}

          {results.blog_posts.length > 0 && (
            <div className="p-2 border-t" style={{ borderColor: 'var(--gem-border)' }}>
              <p className="text-[10px] uppercase tracking-wider px-1 mb-1" style={{ color: 'var(--gem-dim)' }}>Blog Posts</p>
              {results.blog_posts.map((post) => (
                <Link key={post.id} href={`/cms/blog/${post.id}`} onClick={() => setOpen(false)} role="option" className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 transition-colors">
                  <span className="text-xs">✍️</span>
                  <span className="text-xs truncate" style={{ color: 'var(--gem-text)' }}>{post.title}</span>
                  <span className="text-[10px] ml-auto" style={{ color: 'var(--gem-dim)' }}>{post.status}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
