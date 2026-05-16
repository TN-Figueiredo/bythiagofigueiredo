'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

interface AudioFiltersProps {
  filters: Record<string, string>
  onChange: (filters: Record<string, string>) => void
  categories?: string[]
  availableTags?: string[]
}

export function AudioFilters({ filters, onChange, categories = [], availableTags = [] }: AudioFiltersProps) {
  const [search, setSearch] = useState('')
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const searchRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  useEffect(() => () => clearTimeout(debounceRef.current), [])

  const updateFilter = useCallback((key: string, value: string | undefined) => {
    const next = { ...filters }
    if (value) next[key] = value
    else delete next[key]
    onChange(next)
  }, [filters, onChange])

  // Compute tag suggestions based on the portion after the last comma
  const computeSuggestions = useCallback((val: string) => {
    const commaIdx = val.lastIndexOf(',')
    if (commaIdx === -1) {
      setTagSuggestions([])
      setShowSuggestions(false)
      return
    }
    const fragment = val.slice(commaIdx + 1).trim().toLowerCase()
    if (!fragment) {
      setTagSuggestions([])
      setShowSuggestions(false)
      return
    }
    const already = val
      .slice(0, commaIdx)
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter(Boolean)
    const matches = availableTags.filter(
      t => t.toLowerCase().includes(fragment) && !already.includes(t.toLowerCase())
    ).slice(0, 8)
    setTagSuggestions(matches)
    setShowSuggestions(matches.length > 0)
    setActiveSuggestionIndex(-1)
  }, [availableTags])

  const applyTagSuggestion = useCallback((tag: string) => {
    const val = search
    const commaIdx = val.lastIndexOf(',')
    const before = commaIdx >= 0 ? val.slice(0, commaIdx + 1) + ' ' : ''
    const newVal = before + tag
    setSearch(newVal)
    setShowSuggestions(false)
    setTagSuggestions([])
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => updateFilter('q', newVal), 300)
    searchRef.current?.focus()
  }, [search, updateFilter])

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveSuggestionIndex(i => Math.min(i + 1, tagSuggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveSuggestionIndex(i => Math.max(i - 1, -1))
    } else if (e.key === 'Enter' && activeSuggestionIndex >= 0) {
      e.preventDefault()
      applyTagSuggestion(tagSuggestions[activeSuggestionIndex]!)
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }, [showSuggestions, tagSuggestions, activeSuggestionIndex, applyTagSuggestion])

  return (
    <div style={{ width: 200, minWidth: 200, borderRight: '1px solid var(--gem-border)', padding: 12, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
      {/* Search */}
      <div style={{ position: 'relative' }}>
        <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--gem-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Search</label>
        <input
          ref={searchRef}
          data-audio-search
          role="combobox"
          aria-expanded={showSuggestions}
          aria-autocomplete="list"
          {...(showSuggestions ? { 'aria-controls': 'audio-tag-suggestions' } : {})}
          {...(activeSuggestionIndex >= 0 ? { 'aria-activedescendant': `audio-tag-suggestion-${activeSuggestionIndex}` } : {})}
          value={search}
          onChange={e => {
            const val = e.target.value
            setSearch(val)
            computeSuggestions(val)
            clearTimeout(debounceRef.current)
            debounceRef.current = setTimeout(() => {
              if (val) updateFilter('q', val)
              else updateFilter('q', undefined)
            }, 300)
          }}
          onKeyDown={handleSearchKeyDown}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder="Search… (press /)"
          style={{ width: '100%', padding: '4px 8px', fontSize: 12, borderRadius: 5, border: '1px solid var(--gem-border)', background: 'var(--gem-well)', color: 'var(--gem-text)', boxSizing: 'border-box' }}
        />
        {showSuggestions && (
          <div
            ref={suggestionsRef}
            id="audio-tag-suggestions"
            role="listbox"
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              background: 'var(--gem-surface)',
              border: '1px solid var(--gem-border)',
              borderRadius: 5,
              zIndex: 50,
              marginTop: 2,
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              overflow: 'hidden',
            }}
          >
            {tagSuggestions.map((tag, i) => (
              <div
                key={tag}
                role="option"
                id={`audio-tag-suggestion-${i}`}
                aria-selected={i === activeSuggestionIndex}
                onMouseDown={e => { e.preventDefault(); applyTagSuggestion(tag) }}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '5px 8px',
                  fontSize: 11,
                  background: i === activeSuggestionIndex ? 'var(--gem-surface-hi)' : 'transparent',
                  color: 'var(--gem-text)',
                  border: 'none',
                  cursor: 'pointer',
                  borderBottom: i < tagSuggestions.length - 1 ? '1px solid var(--gem-border)' : 'none',
                }}
              >
                {tag}
              </div>
            ))}
          </div>
        )}
        {availableTags.length > 0 && (
          <div style={{ fontSize: 10, color: 'var(--gem-muted)', marginTop: 3 }}>
            Type comma to filter tags
          </div>
        )}
      </div>

      {/* Type */}
      <div>
        <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--gem-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Type</label>
        {['all', 'music', 'sfx'].map(t => (
          <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--gem-text)', cursor: 'pointer', marginBottom: 2 }}>
            <input type="radio" name="type" checked={t === 'all' ? !filters.type : filters.type === t} onChange={() => updateFilter('type', t === 'all' ? undefined : t)} />
            {t === 'all' ? 'All' : t === 'music' ? '🎵 Music' : '🔊 SFX'}
          </label>
        ))}
      </div>

      {/* Status */}
      <div>
        <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--gem-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Status</label>
        {['all', 'downloaded', 'pending', 'retired'].map(s => (
          <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--gem-text)', cursor: 'pointer', marginBottom: 2 }}>
            <input type="radio" name="status" checked={s === 'all' ? !filters.status : filters.status === s} onChange={() => updateFilter('status', s === 'all' ? undefined : s)} />
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </label>
        ))}
      </div>

      {/* Category */}
      {categories.length > 0 && (
        <div>
          <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--gem-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Category</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {categories.map(cat => {
              const active = filters.category === cat
              return (
                <button
                  key={cat}
                  onClick={() => updateFilter('category', active ? undefined : cat)}
                  style={{
                    padding: '3px 8px',
                    fontSize: 11,
                    borderRadius: 4,
                    border: '1px solid var(--gem-border)',
                    background: active ? 'var(--gem-accent)' : 'var(--gem-well)',
                    color: active ? 'var(--gem-text)' : 'var(--gem-muted)',
                    cursor: 'pointer',
                    fontWeight: active ? 600 : 400,
                    transition: 'background 0.1s',
                  }}
                >
                  {cat}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Energy */}
      <div>
        <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--gem-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Energy</label>
        <div style={{ display: 'flex', gap: 4 }}>
          {[1, 2, 3, 4, 5].map(e => (
            <button key={e} onClick={() => {
              const val = filters.energy_min === String(e) ? undefined : String(e)
              const next = { ...filters }
              if (val) { next.energy_min = val; next.energy_max = val }
              else { delete next.energy_min; delete next.energy_max }
              onChange(next)
            }} style={{ width: 28, height: 28, borderRadius: 5, border: '1px solid var(--gem-border)', background: filters.energy_min === String(e) ? 'var(--gem-accent)' : 'var(--gem-well)', color: 'var(--gem-text)', fontSize: 11, cursor: 'pointer' }}>{e}</button>
          ))}
        </div>
      </div>

      {/* Clear */}
      <button onClick={() => { setSearch(''); setShowSuggestions(false); onChange({}) }} style={{ padding: '4px 8px', fontSize: 11, borderRadius: 5, border: '1px solid var(--gem-border)', background: 'transparent', color: 'var(--gem-muted)', cursor: 'pointer' }}>Clear filters</button>
    </div>
  )
}
