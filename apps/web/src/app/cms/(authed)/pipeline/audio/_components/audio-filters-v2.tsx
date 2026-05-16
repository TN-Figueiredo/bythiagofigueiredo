'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import type { AudioAssetRow } from '@/lib/pipeline/audio-schemas'
import type { AudioFilterState } from '../_helpers/use-audio-filters'
import { energyColor, categoryConfig } from '../_helpers/audio-helpers'

/* ─── Props ─────────────────────────────────────────────────────────────── */

interface AudioFiltersV2Props {
  filters: AudioFilterState
  setFilters: (partial: Partial<AudioFilterState>) => void
  clearAll: () => void
  activeCount: number
  assets: AudioAssetRow[]
  availableTags: string[]
}

/* ─── Constants ─────────────────────────────────────────────────────────── */

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'bpm_asc', label: 'BPM ↑' },
  { value: 'bpm_desc', label: 'BPM ↓' },
  { value: 'energy_asc', label: 'Energy ↑' },
  { value: 'energy_desc', label: 'Energy ↓' },
  { value: 'dur_asc', label: 'Duration ↑' },
  { value: 'dur_desc', label: 'Duration ↓' },
  { value: 'name_asc', label: 'Name A-Z' },
] as const

const DUR_OPTIONS = [
  { value: '<30s', label: '<30s' },
  { value: '30s-2m', label: '30s–2m' },
  { value: '2-5m', label: '2–5m' },
  { value: '>5m', label: '>5m' },
] as const

const MUSICAL_KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

const PILL_LABELS: Partial<Record<keyof AudioFilterState, string>> = {
  q: 'Search',
  type: 'Type',
  status: 'Status',
  category: 'Category',
  energy_min: 'Energy',
  energy_max: 'Energy',
  bpm_min: 'BPM',
  bpm_max: 'BPM',
  dur: 'Duration',
  key: 'Key',
  mode: 'Mode',
  mood: 'Mood',
  instruments: 'Instruments',
  sort: 'Sort',
}

/* ─── Helpers ───────────────────────────────────────────────────────────── */

function sectionIcon(key: string): string {
  const icons: Record<string, string> = {
    q: '🔍', type: '🎵', status: '⚡', category: '🗂', energy_min: '🔥',
    energy_max: '🔥', bpm_min: '🥁', bpm_max: '🥁', dur: '⏱', key: '🎹',
    mode: '🎼', mood: '🌊', instruments: '🪗', sort: '↕',
  }
  return icons[key] ?? '•'
}

function pillLabel(key: keyof AudioFilterState, value: AudioFilterState[typeof key]): string {
  if (value == null) return ''
  if (Array.isArray(value)) return value.join(', ')
  return String(value)
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

interface SegmentedProps<T extends string | null> {
  options: { value: T; label: string; count?: number }[]
  value: T
  onChange: (v: T) => void
  ariaLabel: string
}

function Segmented<T extends string | null>({ options, value, onChange, ariaLabel }: SegmentedProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}
    >
      {options.map(opt => {
        const active = opt.value === value
        return (
          <button
            key={String(opt.value ?? '__null__')}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            style={{
              flex: 1,
              minWidth: 0,
              padding: '4px 6px',
              fontSize: 11,
              fontWeight: active ? 600 : 400,
              borderRadius: 5,
              border: '1px solid var(--gem-border)',
              background: active ? 'var(--gem-accent)' : 'var(--gem-well)',
              color: active ? '#fff' : 'var(--gem-muted)',
              cursor: 'pointer',
              transition: 'background 0.1s, color 0.1s',
              whiteSpace: 'nowrap',
            }}
          >
            {opt.label}
            {opt.count != null && (
              <span style={{ marginLeft: 3, opacity: 0.7, fontSize: 10 }}>({opt.count})</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      color: 'var(--gem-muted)',
      marginBottom: 6,
    }}>
      {children}
    </div>
  )
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {children}
    </div>
  )
}

/* ─── Main Component ────────────────────────────────────────────────────── */

export function AudioFiltersV2({
  filters,
  setFilters,
  clearAll,
  activeCount,
  assets,
  availableTags: _availableTags,
}: AudioFiltersV2Props) {
  const searchRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [localQ, setLocalQ] = useState(filters.q ?? '')
  const [advancedOpen, setAdvancedOpen] = useState(false)

  /* Sync localQ when filters.q changes externally */
  useEffect(() => {
    setLocalQ(filters.q ?? '')
  }, [filters.q])

  /* "/" hotkey focuses search */
  useEffect(() => {
    function onKeydown(e: KeyboardEvent) {
      if (e.key !== '/') return
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      e.preventDefault()
      searchRef.current?.focus()
    }
    window.addEventListener('keydown', onKeydown)
    return () => window.removeEventListener('keydown', onKeydown)
  }, [])

  /* Derived counts */
  const typeCounts = useMemo(() => ({
    all: assets.length,
    music: assets.filter(a => a.type === 'music').length,
    sfx: assets.filter(a => a.type === 'sfx').length,
  }), [assets])

  const statusCounts = useMemo(() => ({
    all: assets.length,
    downloaded: assets.filter(a => a.status === 'downloaded').length,
    pending: assets.filter(a => a.status === 'pending').length,
    retired: assets.filter(a => a.status === 'retired').length,
  }), [assets])

  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const a of assets) {
      if (a.category) map.set(a.category, (map.get(a.category) ?? 0) + 1)
    }
    return map
  }, [assets])

  const allCategories = useMemo(() => {
    const all = new Set<string>()
    for (const a of assets) { if (a.category) all.add(a.category) }
    return Array.from(all).sort()
  }, [assets])

  const moodCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const a of assets) {
      for (const m of a.mood) map.set(m, (map.get(m) ?? 0) + 1)
    }
    return map
  }, [assets])

  const instrumentCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const a of assets) {
      for (const i of a.instruments) map.set(i, (map.get(i) ?? 0) + 1)
    }
    return map
  }, [assets])

  /* Count active advanced filters */
  const advancedActiveCount = useMemo(() => {
    let n = 0
    if (filters.key) n++
    if (filters.mode) n++
    if (filters.mood && filters.mood.length > 0) n++
    if (filters.instruments && filters.instruments.length > 0) n++
    return n
  }, [filters.key, filters.mode, filters.mood, filters.instruments])

  /* Active filter pills (excluding sort=newest) */
  const activePills = useMemo(() => {
    const pills: { key: keyof AudioFilterState; label: string; icon: string }[] = []

    const visited = new Set<string>()
    const add = (key: keyof AudioFilterState, value: AudioFilterState[keyof AudioFilterState]) => {
      const group = key === 'energy_max' ? 'energy' : key === 'bpm_max' ? 'bpm' : key
      if (visited.has(group)) return
      visited.add(group)
      const lbl = pillLabel(key, value)
      if (!lbl) return
      pills.push({ key, label: `${PILL_LABELS[key] ?? key}: ${lbl}`, icon: sectionIcon(key) })
    }

    if (filters.q) add('q', filters.q)
    if (filters.type) add('type', filters.type)
    if (filters.status) add('status', filters.status)
    if (filters.category) add('category', filters.category)
    if (filters.energy_min != null || filters.energy_max != null) {
      const min = filters.energy_min
      const max = filters.energy_max
      const lbl = min === max ? `${min}` : `${min ?? '?'}–${max ?? '?'}`
      pills.push({ key: 'energy_min', label: `Energy: ${lbl}`, icon: '🔥' })
      visited.add('energy')
    }
    if (filters.bpm_min != null || filters.bpm_max != null) {
      const min = filters.bpm_min
      const max = filters.bpm_max
      const lbl = min != null && max != null ? `${min}–${max}` : min != null ? `≥${min}` : `≤${max}`
      pills.push({ key: 'bpm_min', label: `BPM: ${lbl}`, icon: '🥁' })
      visited.add('bpm_min')
      visited.add('bpm_max')
    }
    if (filters.dur) add('dur', filters.dur)
    if (filters.key) add('key', filters.key)
    if (filters.mode) add('mode', filters.mode)
    if (filters.mood && filters.mood.length > 0) add('mood', filters.mood)
    if (filters.instruments && filters.instruments.length > 0) add('instruments', filters.instruments)
    if (filters.sort && filters.sort !== 'newest') add('sort', filters.sort)

    return pills
  }, [filters])

  /* Dismiss a pill */
  const dismissPill = useCallback((key: keyof AudioFilterState) => {
    if (key === 'energy_min' || key === 'energy_max') {
      setFilters({ energy_min: null, energy_max: null })
    } else if (key === 'bpm_min' || key === 'bpm_max') {
      setFilters({ bpm_min: null, bpm_max: null })
    } else if (key === 'sort') {
      setFilters({ sort: 'newest' })
    } else {
      setFilters({ [key]: null } as Partial<AudioFilterState>)
    }
  }, [setFilters])

  /* Energy bar interaction */
  const handleEnergyClick = useCallback((level: number) => {
    const { energy_min, energy_max } = filters
    if (energy_min === level && energy_max === level) {
      setFilters({ energy_min: null, energy_max: null })
      return
    }
    if (energy_min != null && energy_min !== level && energy_max == null) {
      setFilters({ energy_min: Math.min(energy_min, level), energy_max: Math.max(energy_min, level) })
      return
    }
    if (energy_min != null && energy_max != null && energy_min !== energy_max) {
      setFilters({ energy_min: level, energy_max: level })
      return
    }
    setFilters({ energy_min: level, energy_max: level })
  }, [filters, setFilters])

  /* BPM inputs */
  const [localBpmMin, setLocalBpmMin] = useState(filters.bpm_min != null ? String(filters.bpm_min) : '')
  const [localBpmMax, setLocalBpmMax] = useState(filters.bpm_max != null ? String(filters.bpm_max) : '')

  useEffect(() => {
    setLocalBpmMin(filters.bpm_min != null ? String(filters.bpm_min) : '')
    setLocalBpmMax(filters.bpm_max != null ? String(filters.bpm_max) : '')
  }, [filters.bpm_min, filters.bpm_max])

  function applyBpm(min: string, max: string) {
    const parsed_min = min.trim() !== '' ? parseInt(min, 10) : null
    const parsed_max = max.trim() !== '' ? parseInt(max, 10) : null
    setFilters({
      bpm_min: parsed_min != null && !isNaN(parsed_min) ? parsed_min : null,
      bpm_max: parsed_max != null && !isNaN(parsed_max) ? parsed_max : null,
    })
  }

  function applyBpmPreset(min: number, max: number) {
    setLocalBpmMin(String(min))
    setLocalBpmMax(String(max))
    setFilters({ bpm_min: min, bpm_max: max })
  }

  /* Toggle multi-select arrays */
  function toggleArray(field: 'mood' | 'instruments', value: string) {
    const current = filters[field] ?? []
    const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value]
    setFilters({ [field]: next.length > 0 ? next : null })
  }

  /* ─── Render ─────────────────────────────────────────────────────────── */

  return (
    <div
      style={{
        width: 280,
        minWidth: 280,
        maxHeight: 'calc(100vh - 8rem)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderRadius: 10,
        border: '1px solid var(--gem-border)',
        background: 'var(--gem-surface)',
        position: 'sticky',
        top: '4rem',
      }}
    >
      {/* ── Sticky Header ─────────────────────────────────────────────── */}
      <div style={{ padding: '10px 12px 0', borderBottom: '1px solid var(--gem-border)', flexShrink: 0 }}>
        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 8 }}>
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: 13,
              color: 'var(--gem-muted)',
              pointerEvents: 'none',
            }}
          >
            ⌕
          </span>
          <input
            ref={searchRef}
            data-audio-search
            type="search"
            role="combobox"
            aria-expanded="false"
            aria-autocomplete="none"
            aria-label="Search audio assets"
            placeholder="Search…"
            value={localQ}
            onChange={e => {
              const val = e.target.value
              setLocalQ(val)
              clearTimeout(debounceRef.current)
              debounceRef.current = setTimeout(() => {
                setFilters({ q: val.trim() !== '' ? val : null })
              }, 300)
            }}
            style={{
              width: '100%',
              padding: '5px 52px 5px 28px',
              fontSize: 12,
              borderRadius: 6,
              border: '1px solid var(--gem-border)',
              background: 'var(--gem-well)',
              color: 'var(--gem-text)',
              boxSizing: 'border-box',
              outline: 'none',
            }}
          />
          <kbd
            aria-hidden="true"
            style={{
              position: 'absolute',
              right: 6,
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: 9,
              fontFamily: 'inherit',
              color: 'var(--gem-muted)',
              border: '1px solid var(--gem-border)',
              borderRadius: 3,
              padding: '1px 4px',
              background: 'var(--gem-well)',
            }}
          >
            /
          </kbd>
        </div>

        {/* Sort */}
        <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <SectionLabel>Sort</SectionLabel>
          <select
            aria-label="Sort by"
            value={filters.sort}
            onChange={e => setFilters({ sort: e.target.value })}
            style={{
              flex: 1,
              fontSize: 11,
              padding: '3px 6px',
              borderRadius: 5,
              border: '1px solid var(--gem-border)',
              background: 'var(--gem-well)',
              color: 'var(--gem-text)',
              cursor: 'pointer',
            }}
          >
            {SORT_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Active pills */}
        {activePills.length > 0 && (
          <div style={{ paddingBottom: 8 }}>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 4,
              maxHeight: 56,
              overflow: 'hidden',
            }}>
              {activePills.map(pill => (
                <span
                  key={pill.key}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    fontSize: 10,
                    padding: '2px 4px 2px 5px',
                    borderRadius: 4,
                    border: '1px solid var(--gem-border)',
                    background: 'var(--gem-well)',
                    color: 'var(--gem-text)',
                    maxWidth: 160,
                    overflow: 'hidden',
                  }}
                >
                  <span aria-hidden="true" style={{ fontSize: 9 }}>{pill.icon}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {pill.label}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${pill.label} filter`}
                    onClick={() => dismissPill(pill.key)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '0 2px',
                      cursor: 'pointer',
                      color: 'var(--gem-muted)',
                      fontSize: 10,
                      lineHeight: 1,
                      flexShrink: 0,
                    }}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
            <button
              type="button"
              onClick={clearAll}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                fontSize: 10,
                color: 'var(--gem-accent)',
                cursor: 'pointer',
                marginTop: 4,
              }}
            >
              Clear all ({activeCount})
            </button>
          </div>
        )}
      </div>

      {/* ── Scrollable Body ───────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 12px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          scrollbarWidth: 'thin',
          scrollbarColor: 'var(--gem-border) transparent',
        }}
      >
        <style>{`
          .afv2-scroll::-webkit-scrollbar { width: 4px; }
          .afv2-scroll::-webkit-scrollbar-thumb { background: var(--gem-border); border-radius: 2px; }
          .afv2-scroll::-webkit-scrollbar-track { background: transparent; }
        `}</style>

        {/* Type */}
        <Section>
          <SectionLabel>Type</SectionLabel>
          <Segmented
            ariaLabel="Filter by type"
            value={filters.type}
            onChange={(v) => setFilters({ type: v as AudioFilterState['type'] })}
            options={[
              { value: null, label: 'All', count: typeCounts.all },
              { value: 'music', label: 'Music', count: typeCounts.music },
              { value: 'sfx', label: 'SFX', count: typeCounts.sfx },
            ]}
          />
        </Section>

        {/* Status */}
        <Section>
          <SectionLabel>Status</SectionLabel>
          <Segmented
            ariaLabel="Filter by status"
            value={filters.status}
            onChange={(v) => setFilters({ status: v as AudioFilterState['status'] })}
            options={[
              { value: null, label: 'All', count: statusCounts.all },
              { value: 'downloaded', label: 'Ready', count: statusCounts.downloaded },
              { value: 'pending', label: 'Pending', count: statusCounts.pending },
              { value: 'retired', label: 'Retired', count: statusCounts.retired },
            ]}
          />
        </Section>

        {/* Category */}
        {allCategories.length > 0 && (
          <Section>
            <SectionLabel>Category</SectionLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {allCategories.map(cat => {
                const count = categoryCounts.get(cat) ?? 0
                const active = filters.category === cat
                const cfg = categoryConfig(cat)
                const zeroCount = count === 0
                return (
                  <button
                    key={cat}
                    type="button"
                    aria-pressed={active}
                    aria-disabled={zeroCount}
                    disabled={zeroCount}
                    onClick={() => setFilters({ category: active ? null : cat })}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '3px 7px',
                      fontSize: 11,
                      borderRadius: 5,
                      border: `1px solid ${active ? cfg.badgeColor : 'var(--gem-border)'}`,
                      background: active ? cfg.badgeBg : 'var(--gem-well)',
                      color: active ? cfg.badgeColor : 'var(--gem-text)',
                      cursor: zeroCount ? 'default' : 'pointer',
                      fontWeight: active ? 600 : 400,
                      opacity: zeroCount ? 0.35 : 1,
                      pointerEvents: zeroCount ? 'none' : 'auto',
                      transition: 'background 0.1s, border-color 0.1s',
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: cfg.dotColor,
                        flexShrink: 0,
                      }}
                    />
                    {cat}
                    <span style={{ opacity: 0.6, fontSize: 9 }}>{count}</span>
                  </button>
                )
              })}
            </div>
          </Section>
        )}

        {/* Energy */}
        <Section>
          <SectionLabel>Energy</SectionLabel>
          <div
            role="group"
            aria-label="Filter by energy level"
            style={{ display: 'flex', gap: 4 }}
          >
            {([1, 2, 3, 4, 5] as const).map(level => {
              const color = energyColor(level)
              const isMin = filters.energy_min === level
              const isMax = filters.energy_max === level
              const inRange = filters.energy_min != null && filters.energy_max != null
                && level >= filters.energy_min && level <= filters.energy_max
              const active = inRange || isMin || isMax

              return (
                <button
                  key={level}
                  type="button"
                  aria-label={`Energy level ${level}`}
                  aria-pressed={active}
                  onClick={() => handleEnergyClick(level)}
                  style={{
                    flex: 1,
                    height: 28,
                    borderRadius: 5,
                    border: `1px solid ${active ? color : 'var(--gem-border)'}`,
                    background: active ? `${color}22` : 'var(--gem-well)',
                    color: active ? color : 'var(--gem-muted)',
                    cursor: 'pointer',
                    fontSize: 11,
                    fontWeight: active ? 700 : 400,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 3,
                    transition: 'all 0.1s',
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: active ? 6 : 4,
                      height: active ? 6 : 4,
                      borderRadius: '50%',
                      background: active ? color : 'var(--gem-muted)',
                      transition: 'all 0.1s',
                      flexShrink: 0,
                    }}
                  />
                  {level}
                </button>
              )
            })}
          </div>
        </Section>

        {/* BPM */}
        <Section>
          <SectionLabel>BPM</SectionLabel>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <input
              type="number"
              aria-label="BPM minimum"
              placeholder="Min"
              min={0}
              max={300}
              value={localBpmMin}
              onChange={e => setLocalBpmMin(e.target.value)}
              onBlur={() => applyBpm(localBpmMin, localBpmMax)}
              onKeyDown={e => e.key === 'Enter' && applyBpm(localBpmMin, localBpmMax)}
              style={{
                flex: 1,
                padding: '4px 6px',
                fontSize: 11,
                borderRadius: 5,
                border: '1px solid var(--gem-border)',
                background: 'var(--gem-well)',
                color: 'var(--gem-text)',
                minWidth: 0,
              }}
            />
            <span style={{ fontSize: 11, color: 'var(--gem-muted)', alignSelf: 'center' }}>–</span>
            <input
              type="number"
              aria-label="BPM maximum"
              placeholder="Max"
              min={0}
              max={300}
              value={localBpmMax}
              onChange={e => setLocalBpmMax(e.target.value)}
              onBlur={() => applyBpm(localBpmMin, localBpmMax)}
              onKeyDown={e => e.key === 'Enter' && applyBpm(localBpmMin, localBpmMax)}
              style={{
                flex: 1,
                padding: '4px 6px',
                fontSize: 11,
                borderRadius: 5,
                border: '1px solid var(--gem-border)',
                background: 'var(--gem-well)',
                color: 'var(--gem-text)',
                minWidth: 0,
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {[
              { label: 'Slow', min: 60, max: 90 },
              { label: 'Mid', min: 90, max: 130 },
              { label: 'Fast', min: 130, max: 180 },
            ].map(preset => {
              const active = filters.bpm_min === preset.min && filters.bpm_max === preset.max
              return (
                <button
                  key={preset.label}
                  type="button"
                  aria-label={`BPM preset: ${preset.label} (${preset.min}–${preset.max})`}
                  aria-pressed={active}
                  onClick={() => applyBpmPreset(preset.min, preset.max)}
                  style={{
                    flex: 1,
                    padding: '3px 0',
                    fontSize: 10,
                    borderRadius: 4,
                    border: '1px solid var(--gem-border)',
                    background: active ? 'var(--gem-accent)' : 'var(--gem-well)',
                    color: active ? '#fff' : 'var(--gem-muted)',
                    cursor: 'pointer',
                    fontWeight: active ? 600 : 400,
                    transition: 'background 0.1s',
                  }}
                >
                  {preset.label}
                </button>
              )
            })}
          </div>
        </Section>

        {/* Duration */}
        <Section>
          <SectionLabel>Duration</SectionLabel>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {DUR_OPTIONS.map(opt => {
              const active = filters.dur === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilters({ dur: active ? null : opt.value })}
                  style={{
                    padding: '3px 8px',
                    fontSize: 11,
                    borderRadius: 5,
                    border: '1px solid var(--gem-border)',
                    background: active ? 'var(--gem-accent)' : 'var(--gem-well)',
                    color: active ? '#fff' : 'var(--gem-muted)',
                    cursor: 'pointer',
                    fontWeight: active ? 600 : 400,
                    transition: 'background 0.1s',
                  }}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </Section>

        {/* ── Advanced (collapsible) ────────────────────────────────── */}
        <div style={{ borderTop: '1px solid var(--gem-border)', paddingTop: 12 }}>
          <button
            type="button"
            aria-expanded={advancedOpen}
            onClick={() => setAdvancedOpen(v => !v)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              marginBottom: advancedOpen ? 12 : 0,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                fontSize: 10,
                color: 'var(--gem-muted)',
                transform: advancedOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: 'transform 0.15s',
                display: 'inline-block',
              }}
            >
              ▶
            </span>
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--gem-muted)',
            }}>
              Advanced
            </span>
            {advancedActiveCount > 0 && (
              <span
                aria-label={`${advancedActiveCount} advanced filters active`}
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  background: 'var(--gem-accent)',
                  color: '#fff',
                  borderRadius: '50%',
                  width: 14,
                  height: 14,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {advancedActiveCount}
              </span>
            )}
          </button>

          {advancedOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Key */}
              <Section>
                <SectionLabel>Key</SectionLabel>
                <div
                  role="group"
                  aria-label="Musical key"
                  style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 6 }}
                >
                  {MUSICAL_KEYS.map(k => {
                    const active = filters.key === k
                    return (
                      <button
                        key={k}
                        type="button"
                        aria-label={`Key ${k}`}
                        aria-pressed={active}
                        onClick={() => setFilters({ key: active ? null : k })}
                        style={{
                          width: 30,
                          height: 26,
                          fontSize: 10,
                          fontWeight: active ? 700 : 400,
                          borderRadius: 4,
                          border: '1px solid var(--gem-border)',
                          background: active ? 'var(--gem-accent)' : 'var(--gem-well)',
                          color: active ? '#fff' : 'var(--gem-text)',
                          cursor: 'pointer',
                          transition: 'background 0.1s',
                          padding: 0,
                        }}
                      >
                        {k}
                      </button>
                    )
                  })}
                </div>
                {/* Mode */}
                <div
                  role="group"
                  aria-label="Musical mode"
                  style={{ display: 'flex', gap: 4 }}
                >
                  {([null, 'major', 'minor'] as const).map(m => {
                    const active = filters.mode === m
                    return (
                      <button
                        key={String(m ?? 'any')}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setFilters({ mode: m })}
                        style={{
                          flex: 1,
                          padding: '3px 4px',
                          fontSize: 10,
                          fontWeight: active ? 600 : 400,
                          borderRadius: 4,
                          border: '1px solid var(--gem-border)',
                          background: active ? 'var(--gem-accent)' : 'var(--gem-well)',
                          color: active ? '#fff' : 'var(--gem-muted)',
                          cursor: 'pointer',
                          transition: 'background 0.1s',
                        }}
                      >
                        {m === null ? 'Any' : m.charAt(0).toUpperCase() + m.slice(1)}
                      </button>
                    )
                  })}
                </div>
              </Section>

              {/* Mood */}
              {moodCounts.size > 0 && (
                <Section>
                  <SectionLabel>Mood</SectionLabel>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {Array.from(moodCounts.entries()).sort((a, b) => b[1] - a[1]).map(([mood, count]) => {
                      const active = filters.mood?.includes(mood) ?? false
                      return (
                        <button
                          key={mood}
                          type="button"
                          aria-pressed={active}
                          onClick={() => toggleArray('mood', mood)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                            padding: '2px 6px',
                            fontSize: 10,
                            borderRadius: 4,
                            border: '1px solid var(--gem-border)',
                            background: active ? 'var(--gem-accent)' : 'var(--gem-well)',
                            color: active ? '#fff' : 'var(--gem-text)',
                            cursor: 'pointer',
                            fontWeight: active ? 600 : 400,
                            transition: 'background 0.1s',
                          }}
                        >
                          {mood}
                          <span style={{ opacity: 0.6, fontSize: 9 }}>{count}</span>
                        </button>
                      )
                    })}
                  </div>
                </Section>
              )}

              {/* Instruments */}
              {instrumentCounts.size > 0 && (
                <Section>
                  <SectionLabel>Instruments</SectionLabel>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {Array.from(instrumentCounts.entries()).sort((a, b) => b[1] - a[1]).map(([inst, count]) => {
                      const active = filters.instruments?.includes(inst) ?? false
                      return (
                        <button
                          key={inst}
                          type="button"
                          aria-pressed={active}
                          onClick={() => toggleArray('instruments', inst)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                            padding: '2px 6px',
                            fontSize: 10,
                            borderRadius: 4,
                            border: '1px solid var(--gem-border)',
                            background: active ? 'var(--gem-accent)' : 'var(--gem-well)',
                            color: active ? '#fff' : 'var(--gem-text)',
                            cursor: 'pointer',
                            fontWeight: active ? 600 : 400,
                            transition: 'background 0.1s',
                          }}
                        >
                          {inst}
                          <span style={{ opacity: 0.6, fontSize: 9 }}>{count}</span>
                        </button>
                      )
                    })}
                  </div>
                </Section>
              )}
            </div>
          )}
        </div>

        {/* Bottom padding */}
        <div style={{ height: 8 }} />
      </div>
    </div>
  )
}
