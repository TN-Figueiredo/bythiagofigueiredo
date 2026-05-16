'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import type { AudioAssetRow } from '@/lib/pipeline/audio-schemas'
import { AudioFilters } from './audio-filters'
import { AudioGrid } from './audio-grid'
import { AudioTable } from './audio-table'
import { AudioDetail } from './audio-detail'
import { AudioImportModal } from './audio-import-modal'

interface Stats { total: number; music: number; sfx: number; downloaded: number; pending: number; retired: number }

interface AudioLibraryProps {
  initialAssets: AudioAssetRow[]
  stats: Stats
}

function deriveCategories(assets: AudioAssetRow[]): string[] {
  const seen = new Set<string>()
  for (const a of assets) {
    if (a.category) seen.add(a.category)
  }
  return Array.from(seen).sort()
}

function deriveTags(assets: AudioAssetRow[]): string[] {
  const seen = new Set<string>()
  for (const a of assets) {
    for (const t of a.tags) seen.add(t)
  }
  return Array.from(seen).sort()
}

export function AudioLibrary({ initialAssets, stats }: AudioLibraryProps) {
  const [assets, setAssets] = useState<AudioAssetRow[]>(initialAssets)
  const categories = useMemo(() => deriveCategories(assets), [assets])
  const availableTags = useMemo(() => deriveTags(assets), [assets])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [showImport, setShowImport] = useState(false)
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const gTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [isNarrow, setIsNarrow] = useState(false)
  const [showFilters, setShowFilters] = useState(true)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)')
    setIsNarrow(mq.matches)
    setShowFilters(!mq.matches)
    const handler = (e: MediaQueryListEvent) => {
      setIsNarrow(e.matches)
      setShowFilters(!e.matches)
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const refetch = useCallback(async (params: Record<string, string> = {}) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setFetchError(null)
    setLoading(true)
    try {
      const qs = new URLSearchParams(params).toString()
      const res = await fetch(`/api/pipeline/audio-library${qs ? `?${qs}` : ''}`, { signal: controller.signal })
      if (!res.ok) {
        setFetchError('Failed to load assets')
        return
      }
      const json = await res.json()
      if (!controller.signal.aborted) setAssets(json.data)
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      setFetchError('Network error')
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [])

  const handleFilterChange = useCallback((newFilters: Record<string, string>) => {
    setFilters(newFilters)
    refetch(newFilters)
  }, [refetch])

  const [gPressed, setGPressed] = useState(false)

  useEffect(() => {
    function onKeydown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === '/') { e.preventDefault(); document.querySelector<HTMLInputElement>('[data-audio-search]')?.focus() }
      if (e.key === 'Escape') { setSelectedId(null); setGPressed(false) }
      if (e.key === 'g') { clearTimeout(gTimerRef.current); setGPressed(true); gTimerRef.current = setTimeout(() => setGPressed(false), 500); return }
      if (gPressed && e.key === 't') { setViewMode(v => v === 'grid' ? 'table' : 'grid'); setGPressed(false); return }
      if (e.key === 'Enter') {
        if (!selectedId && assets.length > 0) setSelectedId(assets[0]!.id)
        return
      }
      if (e.key === 'j' || e.key === 'k') {
        if (assets.length === 0) return
        const ids = assets.map(a => a.id)
        const idx = selectedId ? ids.indexOf(selectedId) : -1
        const next = e.key === 'j' ? Math.min(idx + 1, ids.length - 1) : Math.max(idx - 1, 0)
        setSelectedId(ids[next]!)
      }
    }
    window.addEventListener('keydown', onKeydown)
    return () => { window.removeEventListener('keydown', onKeydown); clearTimeout(gTimerRef.current) }
  }, [assets, selectedId, gPressed])

  return (
    <div style={{ display: 'flex', height: '100%', gap: 0, overflow: 'hidden' }}>
      {showFilters && <AudioFilters filters={filters} onChange={handleFilterChange} categories={categories} availableTags={availableTags} />}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid var(--gem-border)' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => setShowFilters(v => !v)} style={{ padding: '4px 10px', fontSize: 12, borderRadius: 5, border: '1px solid var(--gem-border)', background: showFilters ? 'var(--gem-accent)' : 'transparent', color: 'var(--gem-text)', cursor: 'pointer' }}>
              {showFilters ? 'Hide Filters' : 'Filters'}
            </button>
            <button aria-pressed={viewMode === 'grid'} onClick={() => setViewMode('grid')} style={{ padding: '4px 10px', fontSize: 12, borderRadius: 5, border: '1px solid var(--gem-border)', background: viewMode === 'grid' ? 'var(--gem-accent)' : 'transparent', color: 'var(--gem-text)', cursor: 'pointer' }}>Grid</button>
            <button aria-pressed={viewMode === 'table'} onClick={() => setViewMode('table')} style={{ padding: '4px 10px', fontSize: 12, borderRadius: 5, border: '1px solid var(--gem-border)', background: viewMode === 'table' ? 'var(--gem-accent)' : 'transparent', color: 'var(--gem-text)', cursor: 'pointer' }}>Table</button>
          </div>
          <button onClick={() => setShowImport(true)} style={{ padding: '4px 12px', fontSize: 12, borderRadius: 5, border: '1px solid var(--gem-border)', background: 'var(--gem-surface-hi)', color: 'var(--gem-text)', cursor: 'pointer' }}>Import JSON</button>
        </div>

        {/* Error banner */}
        {fetchError && (
          <div style={{ padding: '6px 12px', background: 'rgba(245,158,11,0.1)', borderBottom: '1px solid rgba(245,158,11,0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
            <span style={{ color: '#f59e0b' }}>{fetchError}</span>
            <button aria-label="Dismiss error" onClick={() => setFetchError(null)} style={{ background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer', fontSize: 11 }}>✕</button>
          </div>
        )}

        {/* Main content */}
        <div style={{ flex: 1, overflow: 'auto', padding: 12, position: 'relative' }}>
          {loading && <div role="status" aria-live="polite" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, borderRadius: 4 }}><span style={{ fontSize: 12, color: 'var(--gem-text)' }}>Loading...</span></div>}
          {viewMode === 'grid'
            ? <AudioGrid assets={assets} selectedId={selectedId} onSelect={setSelectedId} />
            : <AudioTable assets={assets} selectedId={selectedId} onSelect={setSelectedId} onRefetch={() => refetch(filters)} />
          }
        </div>

        {/* Stats bar */}
        <div style={{ padding: '6px 12px', borderTop: '1px solid var(--gem-border)', fontSize: 11, color: 'var(--gem-muted)' }}>
          {stats.total} assets · {stats.music} music · {stats.sfx} sfx · {stats.pending} pending
        </div>
      </div>

      {selectedId && (
        isNarrow ? (
          <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 400, zIndex: 40, background: 'var(--gem-surface)', boxShadow: '-4px 0 20px rgba(0,0,0,0.3)' }}>
            <AudioDetail assetId={selectedId} onClose={() => setSelectedId(null)} fullWidth />
          </div>
        ) : (
          <AudioDetail assetId={selectedId} onClose={() => setSelectedId(null)} />
        )
      )}
      {showImport && <AudioImportModal onClose={() => { setShowImport(false); refetch(filters) }} />}
    </div>
  )
}
