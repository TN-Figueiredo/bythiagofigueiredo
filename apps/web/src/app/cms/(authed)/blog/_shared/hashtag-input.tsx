'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { searchHashtags, createHashtag } from '../[id]/edit/hashtag-actions'
import { getCmsEditorLabels } from './labels'

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
  const l = getCmsEditorLabels()
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

  const createAndAdd = useCallback(async (raw?: string) => {
    const name = (raw ?? query).trim().replace(/^#+/, '')
    if (!name) return
    const existingSlugs = new Set(selected.map(h => h.slug))
    const slug = name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    if (existingSlugs.has(slug)) {
      if (!raw) { setQuery(''); setSuggestions([]) }
      return
    }
    const result = await createHashtag(siteId, name)
    if (result.ok) {
      addHashtag(result.hashtag)
    }
  }, [query, siteId, addHashtag, selected])

  const removeHashtag = useCallback((id: string) => {
    onChange(selected.filter(h => h.id !== id))
  }, [selected, onChange])

  const processBatch = useCallback(async (text: string) => {
    const parts = text.split(/[,\s]+/).map(p => p.trim().replace(/^#+/, '')).filter(Boolean)
    const existingSlugs = new Set(selected.map(h => h.slug))
    const newHashtags: Hashtag[] = []
    for (const part of parts) {
      const slug = part
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
      if (existingSlugs.has(slug)) continue
      existingSlugs.add(slug)
      const result = await createHashtag(siteId, part)
      if (result.ok) newHashtags.push(result.hashtag)
    }
    if (newHashtags.length > 0) {
      onChange([...selected, ...newHashtags])
    }
    setQuery('')
    setSuggestions([])
    inputRef.current?.focus()
  }, [selected, onChange, siteId])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      if (e.key === 'Enter' && suggestions.length > 0 && suggestions[0]) {
        addHashtag(suggestions[0])
      } else if (query.trim()) {
        processBatch(query)
        setQuery('')
        setSuggestions([])
      }
    }
    if (e.key === ' ' && query.trim()) {
      e.preventDefault()
      processBatch(query)
      setQuery('')
      setSuggestions([])
    }
    if (e.key === 'Backspace' && !query && selected.length > 0) {
      const last = selected[selected.length - 1]
      if (last) removeHashtag(last.id)
    }
  }, [query, suggestions, selected, addHashtag, processBatch, removeHashtag])

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text')
    if (pasted.includes(',') || pasted.includes(' ') || pasted.includes('\n')) {
      e.preventDefault()
      processBatch(pasted)
    }
  }, [processBatch])

  return (
    <div className="mb-6">
      <label className="font-mono text-[10px] tracking-widest uppercase text-neutral-400 font-semibold block mb-2">
        {l.hashtags}
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
          onPaste={handlePaste}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
          placeholder={selected.length === 0 ? l.hashtagPlaceholder : ''}
          className="flex-1 min-w-[80px] bg-transparent text-xs text-neutral-200 outline-none font-mono"
          role="combobox"
          aria-expanded={showDropdown && (suggestions.length > 0 || (!!query.trim() && !loading))}
          aria-autocomplete="list"
          aria-controls="hashtag-listbox"
          aria-label={l.searchHashtags}
        />
      </div>
      {showDropdown && (suggestions.length > 0 || (query.trim() && !loading)) && (
        <div id="hashtag-listbox" role="listbox" className="mt-1 border border-neutral-700 rounded bg-neutral-900 max-h-40 overflow-y-auto">
          {suggestions.map(h => (
            <button
              key={h.id}
              type="button"
              role="option"
              onMouseDown={() => addHashtag(h)}
              className="w-full text-left px-3 py-1.5 text-xs font-mono text-neutral-200 hover:bg-neutral-800"
            >
              #{h.name}
            </button>
          ))}
          {query.trim() && suggestions.every(s => s.name.toLowerCase() !== query.trim().replace(/^#+/, '').toLowerCase()) && (
            <button
              type="button"
              role="option"
              onMouseDown={() => createAndAdd()}
              className="w-full text-left px-3 py-1.5 text-xs font-mono text-indigo-400 hover:bg-neutral-800"
            >
              {l.createNew(query.trim().replace(/^#+/, ''))}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
