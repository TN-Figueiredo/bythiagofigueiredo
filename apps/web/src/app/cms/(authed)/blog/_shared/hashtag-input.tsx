'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { searchHashtags, createHashtag } from '../[id]/edit/hashtag-actions'

interface Hashtag {
  id: string
  name: string
  slug: string
}

interface HashtagInputProps {
  siteId: string
  selected: Hashtag[]
  onChange: (hashtags: Hashtag[]) => void
}

export function HashtagInput({ siteId, selected, onChange }: HashtagInputProps) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Hashtag[]>([])
  const [loading, setLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const search = useCallback(async (q: string) => {
    if (q.length < 1) { setSuggestions([]); return }
    setLoading(true)
    const result = await searchHashtags(siteId, q)
    if (result.ok) {
      const existing = new Set(selected.map(h => h.id))
      setSuggestions(result.hashtags.filter(h => !existing.has(h.id)))
    }
    setLoading(false)
  }, [siteId, selected])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(query), 200)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, search])

  const addHashtag = useCallback((hashtag: Hashtag) => {
    onChange([...selected, hashtag])
    setQuery('')
    setSuggestions([])
    inputRef.current?.focus()
  }, [selected, onChange])

  const createAndAdd = useCallback(async () => {
    const name = query.trim().replace(/^#/, '')
    if (!name) return
    const result = await createHashtag(siteId, name)
    if (result.ok) {
      addHashtag(result.hashtag)
    }
  }, [query, siteId, addHashtag])

  const removeHashtag = useCallback((id: string) => {
    onChange(selected.filter(h => h.id !== id))
  }, [selected, onChange])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (suggestions.length > 0 && suggestions[0]) {
        addHashtag(suggestions[0])
      } else if (query.trim()) {
        createAndAdd()
      }
    }
    if (e.key === 'Backspace' && !query && selected.length > 0) {
      removeHashtag(selected[selected.length - 1].id)
    }
  }, [query, suggestions, selected, addHashtag, createAndAdd, removeHashtag])

  return (
    <div className="mb-6">
      <label className="font-mono text-[10px] tracking-widest uppercase text-neutral-400 font-semibold block mb-2">
        Marcadores
      </label>
      <div className="flex flex-wrap gap-1.5 p-2 border border-neutral-700 rounded-lg min-h-[40px] focus-within:border-indigo-500 transition-colors">
        {selected.map(h => (
          <span
            key={h.id}
            className="inline-flex items-center gap-1 bg-neutral-800 px-2 py-0.5 text-xs font-mono text-neutral-200"
          >
            #{h.name}
            <button
              type="button"
              onClick={() => removeHashtag(h.id)}
              className="text-neutral-400 hover:text-red-400 text-xs"
            >
              ✕
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setShowDropdown(true) }}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
          placeholder={selected.length === 0 ? '#tag' : ''}
          className="flex-1 min-w-[80px] bg-transparent text-xs text-neutral-200 outline-none font-mono"
        />
      </div>
      {showDropdown && (suggestions.length > 0 || (query.trim() && !loading)) && (
        <div className="mt-1 border border-neutral-700 rounded bg-neutral-900 max-h-40 overflow-y-auto">
          {suggestions.map(h => (
            <button
              key={h.id}
              type="button"
              onMouseDown={() => addHashtag(h)}
              className="w-full text-left px-3 py-1.5 text-xs font-mono text-neutral-200 hover:bg-neutral-800"
            >
              #{h.name}
            </button>
          ))}
          {query.trim() && suggestions.every(s => s.name.toLowerCase() !== query.trim().toLowerCase()) && (
            <button
              type="button"
              onMouseDown={createAndAdd}
              className="w-full text-left px-3 py-1.5 text-xs font-mono text-indigo-400 hover:bg-neutral-800"
            >
              + Criar &quot;#{query.trim()}&quot;
            </button>
          )}
        </div>
      )}
    </div>
  )
}
