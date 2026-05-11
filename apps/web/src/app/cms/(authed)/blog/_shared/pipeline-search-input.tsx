'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import type { PipelineSearchResult } from '@/app/cms/(authed)/blog/actions'
import { getFormatIcon, getPriorityConfig, getLangConfig } from '@/lib/pipeline/gem-design'

interface PipelineSearchInputProps {
  onSearch: (query: string) => Promise<PipelineSearchResult[]>
  onSelect: (item: PipelineSearchResult) => void
  mode: 'create' | 'select'
}

export function PipelineSearchInput({ onSearch, onSelect, mode }: PipelineSearchInputProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PipelineSearchResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [isSearching, setIsSearching] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const placeholder =
    mode === 'create'
      ? 'Criar do pipeline... (código ou título)'
      : 'Buscar pipeline... (código ou título)'

  const doSearch = useCallback(
    async (q: string) => {
      if (q.length < 2) {
        setResults([])
        setIsOpen(false)
        return
      }
      setIsSearching(true)
      try {
        const items = await onSearch(q)
        setResults(items)
        setIsOpen(true)
        setSelectedIndex(-1)
      } finally {
        setIsSearching(false)
      }
    },
    [onSearch],
  )

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(query), 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, doSearch])

  // Click-outside to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const availableItems = results.filter((r) => !r.blog_post_id)

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen) return

    if (e.key === 'Escape') {
      setIsOpen(false)
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.min(prev + 1, availableItems.length - 1))
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.max(prev - 1, -1))
      return
    }

    if (e.key === 'Enter') {
      e.preventDefault()
      const item = availableItems[selectedIndex]
      if (item) {
        handleSelect(item)
      }
    }
  }

  function handleSelect(item: PipelineSearchResult) {
    onSelect(item)
    setQuery('')
    setResults([])
    setIsOpen(false)
    setSelectedIndex(-1)
  }

  const langBadge = (language: string) => {
    const config = getLangConfig(language)
    return (
      <span
        className={`text-[10px] px-1 py-px rounded font-mono ${config.className}`}
      >
        {config.label}
      </span>
    )
  }

  return (
    <div ref={containerRef} className="relative" style={{ minWidth: 240 }}>
      {/* Input */}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#222d40] bg-[#0c1222] focus-within:border-[#6366f1] transition-colors"
      >
        <span className="text-base select-none">📋</span>
        <input
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls="pipeline-search-results"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsOpen(false)
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true)
          }}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm outline-none text-[#edf2f7] placeholder:text-[#5a6b7f]"
        />
        {isSearching && (
          <span className="animate-spin text-xs text-[#6366f1]">⟳</span>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div
          id="pipeline-search-results"
          role="listbox"
          aria-label="Pipeline search results"
          className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-lg border border-[#222d40] bg-[#161d2d] shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
          style={{ minWidth: 320 }}
        >
          {results.length === 0 ? (
            <div className="px-4 py-5 text-center">
              <p className="text-sm text-[#edf2f7] mb-1">Nenhum item encontrado</p>
              <p className="text-xs text-[#5a6b7f]">Busque por código (ex: tg-01) ou título</p>
            </div>
          ) : (
            <ul>
              {results.map((item, idx) => {
                const isLinked = !!item.blog_post_id
                const fmtConfig = getFormatIcon(item.format as Parameters<typeof getFormatIcon>[0])
                const pConfig = getPriorityConfig(item.priority)
                const isHighlighted = !isLinked && availableItems.indexOf(item) === selectedIndex

                return (
                  <li
                    key={item.id}
                    role="option"
                    aria-selected={isHighlighted}
                    aria-disabled={isLinked}
                    style={{
                      opacity: isLinked ? 0.4 : 1,
                      cursor: isLinked ? 'not-allowed' : 'pointer',
                      backgroundColor: isHighlighted ? 'rgba(99,102,241,0.08)' : undefined,
                    }}
                    className="px-3 py-2.5 border-b border-[#222d40] last:border-b-0 transition-colors hover:bg-white/5"
                    onMouseDown={
                      isLinked
                        ? undefined
                        : (e) => {
                            e.preventDefault()
                            handleSelect(item)
                          }
                    }
                  >
                    {/* Row: format icon + priority + code + lang + stage */}
                    <div className="flex items-center gap-2 mb-0.5">
                      {/* Format icon */}
                      <span
                        className={`inline-flex items-center justify-center w-5 h-5 rounded text-xs ${fmtConfig.bgClass}`}
                      >
                        {fmtConfig.icon}
                      </span>

                      {/* Priority badge */}
                      <span
                        className="text-[10px] font-mono font-semibold"
                        style={{ color: pConfig.accent }}
                      >
                        {pConfig.label}
                      </span>

                      {/* Code */}
                      <span className="text-[11px] font-mono text-[#6366f1]">{item.code}</span>

                      {/* Language badge */}
                      {langBadge(item.language)}

                      {/* Stage badge */}
                      <span
                        className="ml-auto text-[10px] px-1.5 py-px rounded font-mono"
                        style={{
                          color: '#06b6d4',
                          backgroundColor: 'rgba(6,182,212,0.1)',
                          border: '1px solid rgba(6,182,212,0.25)',
                        }}
                      >
                        {item.stage}
                      </span>
                    </div>

                    {/* Title */}
                    <p className="text-sm text-[#edf2f7] truncate leading-snug">
                      {item.title}
                    </p>

                    {/* Hook or linked notice */}
                    {isLinked ? (
                      <p className="text-xs mt-0.5" style={{ color: '#5a6b7f' }}>
                        {`→ vinculado a '${item.linked_post_title ?? ''}'`}
                      </p>
                    ) : item.hook ? (
                      <p
                        className="text-xs mt-0.5 line-clamp-1"
                        style={{ color: '#5a6b7f' }}
                      >
                        {item.hook}
                      </p>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
