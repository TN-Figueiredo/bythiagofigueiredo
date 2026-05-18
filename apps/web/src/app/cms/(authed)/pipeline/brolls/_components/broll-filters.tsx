'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import type { BRollAssetRow } from '@/lib/pipeline/broll-schemas'
import type { BRollFilterState } from '../_helpers/use-broll-filters'
import { categoryConfig } from '../_helpers/broll-helpers'

/* ─── Props ─────────────────────────────────────────────────────────────── */

interface BRollFiltersProps {
  filters: BRollFilterState
  setFilters: (partial: Partial<BRollFilterState>) => void
  clearAll: () => void
  activeCount: number
  assets: BRollAssetRow[]
  availableTags: string[]
}

/* ─── Constants ─────────────────────────────────────────────────────────── */

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'name_asc', label: 'Name A-Z' },
  { value: 'dur_asc', label: 'Duration ↑' },
  { value: 'dur_desc', label: 'Duration ↓' },
  { value: 'res_desc', label: 'Resolution ↓' },
] as const

const DUR_OPTIONS = [
  { value: '<5s', label: '<5s' },
  { value: '5-15s', label: '5-15s' },
  { value: '>15s', label: '>15s' },
] as const

/* ─── Sub-components ─────────────────────────────────────────────────────── */

interface SegmentedProps<T extends string | null> {
  options: { value: T; label: string; count?: number }[]
  value: T
  onChange: (v: T) => void
  ariaLabel: string
}

function Segmented<T extends string | null>({ options, value, onChange, ariaLabel }: SegmentedProps<T>) {
  return (
    <div role="group" aria-label={ariaLabel} style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
      {options.map(opt => {
        const active = opt.value === value
        return (
          <button key={String(opt.value ?? '__null__')} type="button" aria-pressed={active} onClick={() => onChange(opt.value)}
            style={{ flex: 1, minWidth: 0, padding: '4px 6px', fontSize: 11, fontWeight: active ? 600 : 400, borderRadius: 5, border: '1px solid var(--gem-border)', background: active ? 'var(--gem-accent)' : 'var(--gem-well)', color: active ? '#fff' : 'var(--gem-muted)', cursor: 'pointer', transition: 'background 0.1s, color 0.1s', whiteSpace: 'nowrap' }}>
            {opt.label}
            {opt.count != null && (<span style={{ marginLeft: 3, opacity: 0.7, fontSize: 10 }}>({opt.count})</span>)}
          </button>
        )
      })}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (<div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gem-muted)', marginBottom: 6 }}>{children}</div>)
}

function Section({ children }: { children: React.ReactNode }) {
  return (<div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>{children}</div>)
}

/* ─── Main Component ────────────────────────────────────────────────────── */

export function BRollFilters({ filters, setFilters, clearAll, activeCount, assets, availableTags: _availableTags }: BRollFiltersProps) {
  const searchRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [localQ, setLocalQ] = useState(filters.q ?? '')
  const [advancedOpen, setAdvancedOpen] = useState(false)

  useEffect(() => { setLocalQ(filters.q ?? '') }, [filters.q])

  /* Clear debounce timer on unmount */
  useEffect(() => {
    return () => { clearTimeout(debounceRef.current) }
  }, [])

  /* Derived counts */
  const sourceCounts = useMemo(() => ({
    all: assets.length,
    pessoal: assets.filter(a => a.source_type === 'pessoal').length,
    generico: assets.filter(a => a.source_type === 'generico').length,
  }), [assets])

  const statusCounts = useMemo(() => ({
    all: assets.length,
    available: assets.filter(a => a.status === 'available').length,
    pending: assets.filter(a => a.status === 'pending').length,
  }), [assets])

  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const a of assets) { if (a.category) map.set(a.category, (map.get(a.category) ?? 0) + 1) }
    return map
  }, [assets])

  const allCategories = useMemo(() => {
    const all = new Set<string>()
    for (const a of assets) { if (a.category) all.add(a.category) }
    return Array.from(all).sort()
  }, [assets])

  const advancedActiveCount = useMemo(() => {
    let n = 0
    if (filters.codec) n++
    if (filters.fps) n++
    if (filters.tags && filters.tags.length > 0) n++
    return n
  }, [filters.codec, filters.fps, filters.tags])

  /* Active filter pills */
  const activePills = useMemo(() => {
    const pills: { key: keyof BRollFilterState; label: string }[] = []
    if (filters.q) pills.push({ key: 'q', label: `Search: ${filters.q}` })
    if (filters.source_type) pills.push({ key: 'source_type', label: `Source: ${filters.source_type}` })
    if (filters.status) pills.push({ key: 'status', label: `Status: ${filters.status}` })
    if (filters.category) pills.push({ key: 'category', label: `Category: ${filters.category}` })
    if (filters.resolution) pills.push({ key: 'resolution', label: `Resolution: ${filters.resolution}` })
    if (filters.duration) pills.push({ key: 'duration', label: `Duration: ${filters.duration}` })
    if (filters.codec) pills.push({ key: 'codec', label: `Codec: ${filters.codec}` })
    if (filters.fps) pills.push({ key: 'fps', label: `FPS: ${filters.fps}` })
    if (filters.tags && filters.tags.length > 0) pills.push({ key: 'tags', label: `Tags: ${filters.tags.join(', ')}` })
    if (filters.sort && filters.sort !== 'newest') pills.push({ key: 'sort', label: `Sort: ${filters.sort}` })
    return pills
  }, [filters])

  const dismissPill = useCallback((key: keyof BRollFilterState) => {
    if (key === 'sort') setFilters({ sort: 'newest' })
    else setFilters({ [key]: null } as Partial<BRollFilterState>)
  }, [setFilters])

  /* Tag counts for advanced section */
  const tagCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const a of assets) { for (const t of a.tags) map.set(t, (map.get(t) ?? 0) + 1) }
    return map
  }, [assets])

  function toggleTag(tag: string) {
    const current = filters.tags ?? []
    const next = current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag]
    setFilters({ tags: next.length > 0 ? next : null })
  }

  /* ─── Render ─────────────────────────────────────────────────────────── */

  return (
    <div style={{ width: 280, minWidth: 280, maxHeight: 'calc(100vh - 8rem)', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 10, border: '1px solid var(--gem-border)', background: 'var(--gem-surface)', position: 'sticky', top: '4rem' }}>
      {/* Sticky Header */}
      <div style={{ padding: '10px 12px 0', borderBottom: '1px solid var(--gem-border)', flexShrink: 0 }}>
        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 8 }}>
          <span aria-hidden="true" style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--gem-muted)', pointerEvents: 'none' }}>⌕</span>
          <input ref={searchRef} data-broll-search type="search" role="combobox" aria-expanded="false" aria-autocomplete="none" aria-label="Search B-Roll assets" placeholder="Search..." value={localQ}
            onChange={e => { const val = e.target.value; setLocalQ(val); clearTimeout(debounceRef.current); debounceRef.current = setTimeout(() => { setFilters({ q: val.trim() !== '' ? val : null }) }, 300) }}
            style={{ width: '100%', padding: '5px 52px 5px 28px', fontSize: 12, borderRadius: 6, border: '1px solid var(--gem-border)', background: 'var(--gem-well)', color: 'var(--gem-text)', boxSizing: 'border-box', outline: 'none' }} />
          <kbd aria-hidden="true" style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', fontSize: 9, fontFamily: 'inherit', color: 'var(--gem-muted)', border: '1px solid var(--gem-border)', borderRadius: 3, padding: '1px 4px', background: 'var(--gem-well)' }}>/</kbd>
        </div>
        {/* Sort */}
        <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <SectionLabel>Sort</SectionLabel>
          <select aria-label="Sort by" value={filters.sort} onChange={e => setFilters({ sort: e.target.value })} style={{ flex: 1, fontSize: 11, padding: '3px 6px', borderRadius: 5, border: '1px solid var(--gem-border)', background: 'var(--gem-well)', color: 'var(--gem-text)', cursor: 'pointer' }}>
            {SORT_OPTIONS.map(o => (<option key={o.value} value={o.value}>{o.label}</option>))}
          </select>
        </div>
        {/* Active pills */}
        {activePills.length > 0 && (
          <div style={{ paddingBottom: 8 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxHeight: 56, overflow: 'hidden' }}>
              {activePills.map(pill => (
                <span key={pill.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, padding: '2px 4px 2px 5px', borderRadius: 4, border: '1px solid var(--gem-border)', background: 'var(--gem-well)', color: 'var(--gem-text)', maxWidth: 160, overflow: 'hidden' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pill.label}</span>
                  <button type="button" aria-label={`Remove ${pill.label} filter`} onClick={() => dismissPill(pill.key)} style={{ background: 'none', border: 'none', padding: '0 2px', cursor: 'pointer', color: 'var(--gem-muted)', fontSize: 10, lineHeight: 1, flexShrink: 0 }}>✕</button>
                </span>
              ))}
            </div>
            <button type="button" onClick={clearAll} style={{ background: 'none', border: 'none', padding: 0, fontSize: 10, color: 'var(--gem-accent)', cursor: 'pointer', marginTop: 4 }}>Clear all ({activeCount})</button>
          </div>
        )}
      </div>

      {/* Scrollable Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 0', display: 'flex', flexDirection: 'column', gap: 16, scrollbarWidth: 'thin', scrollbarColor: 'var(--gem-border) transparent' }}>
        {/* Tipo (Source Type) */}
        <Section>
          <SectionLabel>Tipo</SectionLabel>
          <Segmented ariaLabel="Filter by source type" value={filters.source_type}
            onChange={(v) => setFilters({ source_type: v as BRollFilterState['source_type'] })}
            options={[
              { value: null, label: 'All', count: sourceCounts.all },
              { value: 'pessoal', label: 'Pessoais', count: sourceCounts.pessoal },
              { value: 'generico', label: 'Genericos', count: sourceCounts.generico },
            ]} />
        </Section>

        {/* Status */}
        <Section>
          <SectionLabel>Status</SectionLabel>
          <Segmented ariaLabel="Filter by status" value={filters.status}
            onChange={(v) => setFilters({ status: v as BRollFilterState['status'] })}
            options={[
              { value: null, label: 'All', count: statusCounts.all },
              { value: 'available', label: 'Available', count: statusCounts.available },
              { value: 'pending', label: 'Pending', count: statusCounts.pending },
            ]} />
        </Section>

        {/* Category */}
        {allCategories.length > 0 && (
          <Section>
            <SectionLabel>Categoria</SectionLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {allCategories.map(cat => {
                const count = categoryCounts.get(cat) ?? 0
                const active = filters.category === cat
                const cfg = categoryConfig(cat)
                return (
                  <button key={cat} type="button" aria-pressed={active} onClick={() => setFilters({ category: active ? null : cat })}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 7px', fontSize: 11, borderRadius: 5, border: `1px solid ${active ? cfg.badgeColor : 'var(--gem-border)'}`, background: active ? cfg.badgeBg : 'var(--gem-well)', color: active ? cfg.badgeColor : 'var(--gem-text)', cursor: 'pointer', fontWeight: active ? 600 : 400, transition: 'background 0.1s, border-color 0.1s' }}>
                    <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dotColor, flexShrink: 0 }} />
                    {cat}
                    <span style={{ opacity: 0.6, fontSize: 9 }}>{count}</span>
                  </button>
                )
              })}
            </div>
          </Section>
        )}

        {/* Resolution */}
        <Section>
          <SectionLabel>Resolucao</SectionLabel>
          <Segmented ariaLabel="Filter by resolution" value={filters.resolution}
            onChange={(v) => setFilters({ resolution: v as BRollFilterState['resolution'] })}
            options={[
              { value: null, label: 'All' },
              { value: '4k', label: '4K' },
              { value: '1080p', label: '1080p' },
              { value: '720p', label: '720p' },
            ]} />
        </Section>

        {/* Duration */}
        <Section>
          <SectionLabel>Duracao</SectionLabel>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {DUR_OPTIONS.map(opt => {
              const active = filters.duration === opt.value
              return (
                <button key={opt.value} type="button" aria-pressed={active} onClick={() => setFilters({ duration: active ? null : opt.value })}
                  style={{ padding: '3px 8px', fontSize: 11, borderRadius: 5, border: '1px solid var(--gem-border)', background: active ? 'var(--gem-accent)' : 'var(--gem-well)', color: active ? '#fff' : 'var(--gem-muted)', cursor: 'pointer', fontWeight: active ? 600 : 400, transition: 'background 0.1s' }}>
                  {opt.label}
                </button>
              )
            })}
          </div>
        </Section>

        {/* Advanced (collapsible) */}
        <div style={{ borderTop: '1px solid var(--gem-border)', paddingTop: 12 }}>
          <button type="button" aria-expanded={advancedOpen} onClick={() => setAdvancedOpen(v => !v)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0, cursor: 'pointer', marginBottom: advancedOpen ? 12 : 0 }}>
            <span aria-hidden="true" style={{ fontSize: 10, color: 'var(--gem-muted)', transform: advancedOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', display: 'inline-block' }}>▶</span>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gem-muted)' }}>Advanced</span>
            {advancedActiveCount > 0 && (
              <span aria-label={`${advancedActiveCount} advanced filters active`} style={{ fontSize: 9, fontWeight: 700, background: 'var(--gem-accent)', color: '#fff', borderRadius: '50%', width: 14, height: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{advancedActiveCount}</span>
            )}
          </button>

          {advancedOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Codec */}
              <Section>
                <SectionLabel>Codec</SectionLabel>
                <Segmented ariaLabel="Filter by codec" value={filters.codec}
                  onChange={(v) => setFilters({ codec: v as BRollFilterState['codec'] })}
                  options={[
                    { value: null, label: 'Any' },
                    { value: 'h265', label: 'H.265' },
                    { value: 'h264', label: 'H.264' },
                  ]} />
              </Section>
              {/* FPS */}
              <Section>
                <SectionLabel>FPS</SectionLabel>
                <Segmented ariaLabel="Filter by framerate" value={filters.fps}
                  onChange={(v) => setFilters({ fps: v as BRollFilterState['fps'] })}
                  options={[
                    { value: null, label: 'Any' },
                    { value: '24', label: '24' },
                    { value: '30', label: '30' },
                    { value: '60', label: '60' },
                  ]} />
              </Section>
              {/* Tags */}
              {tagCounts.size > 0 && (
                <Section>
                  <SectionLabel>Tags</SectionLabel>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {Array.from(tagCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([tag, count]) => {
                      const active = filters.tags?.includes(tag) ?? false
                      return (
                        <button key={tag} type="button" aria-pressed={active} onClick={() => toggleTag(tag)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 6px', fontSize: 10, borderRadius: 4, border: '1px solid var(--gem-border)', background: active ? 'var(--gem-accent)' : 'var(--gem-well)', color: active ? '#fff' : 'var(--gem-text)', cursor: 'pointer', fontWeight: active ? 600 : 400, transition: 'background 0.1s' }}>
                          {tag}
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
        <div style={{ height: 8 }} />
      </div>
    </div>
  )
}
