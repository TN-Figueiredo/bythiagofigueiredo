'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

interface AudioFiltersProps {
  filters: Record<string, string>
  onChange: (filters: Record<string, string>) => void
}

export function AudioFilters({ filters, onChange }: AudioFiltersProps) {
  const [search, setSearch] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(debounceRef.current), [])

  const updateFilter = useCallback((key: string, value: string | undefined) => {
    const next = { ...filters }
    if (value) next[key] = value
    else delete next[key]
    onChange(next)
  }, [filters, onChange])

  return (
    <div style={{ width: 200, minWidth: 200, borderRight: '1px solid var(--gem-border)', padding: 12, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
      {/* Search */}
      <div>
        <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--gem-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Search</label>
        <input data-audio-search value={search} onChange={e => {
          const val = e.target.value
          setSearch(val)
          clearTimeout(debounceRef.current)
          debounceRef.current = setTimeout(() => {
            if (val) updateFilter('q', val)
            else updateFilter('q', undefined)
          }, 300)
        }} placeholder="Search… (press /)" style={{ width: '100%', padding: '4px 8px', fontSize: 12, borderRadius: 5, border: '1px solid var(--gem-border)', background: 'var(--gem-well)', color: 'var(--gem-text)' }} />
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
        {['downloaded', 'pending', 'retired'].map(s => (
          <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--gem-text)', cursor: 'pointer', marginBottom: 2 }}>
            <input type="radio" name="status" checked={filters.status === s} onChange={() => updateFilter('status', filters.status === s ? undefined : s)} />
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </label>
        ))}
      </div>

      {/* Energy */}
      <div>
        <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--gem-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Energy</label>
        <div style={{ display: 'flex', gap: 4 }}>
          {[1, 2, 3, 4, 5].map(e => (
            <button key={e} onClick={() => {
              const min = filters.energy_min === String(e) ? undefined : String(e)
              updateFilter('energy_min', min)
              updateFilter('energy_max', min)
            }} style={{ width: 28, height: 28, borderRadius: 5, border: '1px solid var(--gem-border)', background: filters.energy_min === String(e) ? 'var(--gem-accent)' : 'var(--gem-well)', color: 'var(--gem-text)', fontSize: 11, cursor: 'pointer' }}>{e}</button>
          ))}
        </div>
      </div>

      {/* Clear */}
      <button onClick={() => { setSearch(''); onChange({}) }} style={{ padding: '4px 8px', fontSize: 11, borderRadius: 5, border: '1px solid var(--gem-border)', background: 'transparent', color: 'var(--gem-muted)', cursor: 'pointer' }}>Clear filters</button>
    </div>
  )
}
