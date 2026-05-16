'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
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

export function AudioLibrary({ initialAssets, stats }: AudioLibraryProps) {
  const [assets, setAssets] = useState<AudioAssetRow[]>(initialAssets)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [showImport, setShowImport] = useState(false)
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const refetch = useCallback(async (params: Record<string, string> = {}) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    try {
      const qs = new URLSearchParams(params).toString()
      const res = await fetch(`/api/pipeline/audio-library${qs ? `?${qs}` : ''}`, { signal: controller.signal })
      if (res.ok) {
        const json = await res.json()
        if (!controller.signal.aborted) setAssets(json.data)
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
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
      if (e.key === 'g') { setGPressed(true); setTimeout(() => setGPressed(false), 500); return }
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
    return () => window.removeEventListener('keydown', onKeydown)
  }, [assets, selectedId, gPressed])

  return (
    <div style={{ display: 'flex', height: '100%', gap: 0, overflow: 'hidden' }}>
      <AudioFilters filters={filters} onChange={handleFilterChange} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid var(--gem-border)' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => setViewMode('grid')} style={{ padding: '4px 10px', fontSize: 12, borderRadius: 5, border: '1px solid var(--gem-border)', background: viewMode === 'grid' ? 'var(--gem-accent)' : 'transparent', color: 'var(--gem-text)', cursor: 'pointer' }}>Grid</button>
            <button onClick={() => setViewMode('table')} style={{ padding: '4px 10px', fontSize: 12, borderRadius: 5, border: '1px solid var(--gem-border)', background: viewMode === 'table' ? 'var(--gem-accent)' : 'transparent', color: 'var(--gem-text)', cursor: 'pointer' }}>Table</button>
          </div>
          <button onClick={() => setShowImport(true)} style={{ padding: '4px 12px', fontSize: 12, borderRadius: 5, border: '1px solid var(--gem-border)', background: 'var(--gem-surface-hi)', color: 'var(--gem-text)', cursor: 'pointer' }}>Import JSON</button>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, overflow: 'auto', padding: 12, position: 'relative' }}>
          {loading && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, borderRadius: 4 }}><span style={{ fontSize: 12, color: 'var(--gem-text)' }}>Loading...</span></div>}
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

      {selectedId && <AudioDetail assetId={selectedId} onClose={() => setSelectedId(null)} />}
      {showImport && <AudioImportModal onClose={() => { setShowImport(false); refetch(filters) }} />}
    </div>
  )
}
