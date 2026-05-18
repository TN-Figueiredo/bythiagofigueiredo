'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import type { BRollAssetRow } from '@/lib/pipeline/broll-schemas'
import { BRollFilters } from './broll-filters'
import { BRollGrid } from './broll-grid'
import { BRollTable } from './broll-table'
import { BRollDetail } from './broll-detail'
import { BRollEmpty } from './broll-empty'
import { BRollGridSkeleton } from './broll-skeleton'
import { BRollImportModal } from './broll-import-modal'
import { useBRollFilters, serializeFilters } from '../_helpers/use-broll-filters'

interface Stats { total: number; pessoal: number; generico: number; ready: number; pending: number }

interface BRollLibraryProps {
  initialAssets: BRollAssetRow[]
  stats: Stats
}

function deriveTags(assets: BRollAssetRow[]): string[] {
  const seen = new Set<string>()
  for (const a of assets) { for (const t of a.tags) seen.add(t) }
  return Array.from(seen).sort()
}

export function BRollLibrary({ initialAssets, stats }: BRollLibraryProps) {
  const [assets, setAssets] = useState<BRollAssetRow[]>(initialAssets)
  const availableTags = useMemo(() => deriveTags(assets), [assets])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [showImport, setShowImport] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasNext, setHasNext] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const loadMoreAbortRef = useRef<AbortController | null>(null)
  const gTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const assetsRef = useRef(assets)
  const selectedIdRef = useRef(selectedId)
  assetsRef.current = assets
  selectedIdRef.current = selectedId

  const { filters, setFilters, clearAll, activeCount } = useBRollFilters()

  const liveStats = useMemo(() => ({
    total: assets.length,
    pessoal: assets.filter(a => a.source_type === 'pessoal').length,
    generico: assets.filter(a => a.source_type === 'generico').length,
    ready: assets.filter(a => a.status === 'available').length,
    pending: assets.filter(a => a.status === 'pending').length,
  }), [assets])

  const [isNarrow, setIsNarrow] = useState(false)
  const [showFilters, setShowFilters] = useState(true)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)')
    setIsNarrow(mq.matches); setShowFilters(!mq.matches)
    const handler = (e: MediaQueryListEvent) => { setIsNarrow(e.matches); setShowFilters(!e.matches) }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const refetch = useCallback(async (params: URLSearchParams | Record<string, string> = {}) => {
    abortRef.current?.abort()
    const controller = new AbortController(); abortRef.current = controller
    setFetchError(null); setLoading(true)
    try {
      const qs = params instanceof URLSearchParams ? params.toString() : new URLSearchParams(params).toString()
      const res = await fetch(`/api/pipeline/broll-library${qs ? `?${qs}` : ''}`, { signal: controller.signal })
      if (controller.signal.aborted) return
      if (!res.ok) { setFetchError('Failed to load assets'); return }
      const json = await res.json()
      if (!controller.signal.aborted) { setAssets(json.data); setHasNext(json.meta?.has_next ?? false); setNextCursor(json.meta?.next_cursor ?? null) }
    } catch (e) { if (e instanceof DOMException && e.name === 'AbortError') return; if (!controller.signal.aborted) setFetchError('Network error') }
    finally { if (!controller.signal.aborted) setLoading(false) }
  }, [])

  const loadMore = useCallback(async () => {
    if (!hasNext || !nextCursor || loadingMore) return
    loadMoreAbortRef.current?.abort()
    const controller = new AbortController(); loadMoreAbortRef.current = controller
    setLoadingMore(true)
    try {
      const params = serializeFilters(filters); params.set('cursor', nextCursor)
      const res = await fetch(`/api/pipeline/broll-library?${params.toString()}`, { signal: controller.signal })
      if (controller.signal.aborted) return
      if (!res.ok) { setFetchError('Failed to load more assets'); return }
      const json = await res.json()
      if (!controller.signal.aborted) { setAssets(prev => [...prev, ...json.data]); setHasNext(json.meta?.has_next ?? false); setNextCursor(json.meta?.next_cursor ?? null) }
    } catch (e) { if (e instanceof DOMException && e.name === 'AbortError') return; if (!controller.signal.aborted) setFetchError('Network error') }
    finally { if (!controller.signal.aborted) setLoadingMore(false) }
  }, [hasNext, nextCursor, loadingMore, filters])

  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    loadMoreAbortRef.current?.abort(); setHasNext(false); setNextCursor(null)
    refetch(serializeFilters(filters))
  }, [filters, refetch])

  const [gPressed, setGPressed] = useState(false)
  useEffect(() => {
    function onKeydown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === '/') { e.preventDefault(); document.querySelector<HTMLInputElement>('[data-broll-search]')?.focus() }
      if (e.key === 'Escape') { setSelectedId(null); setGPressed(false) }
      if (e.key === 'g') { clearTimeout(gTimerRef.current); setGPressed(true); gTimerRef.current = setTimeout(() => setGPressed(false), 500); return }
      if (gPressed && e.key === 't') { setViewMode(v => v === 'grid' ? 'table' : 'grid'); setGPressed(false); return }
      if (e.key === 'Enter') { if (!selectedIdRef.current && assetsRef.current.length > 0) setSelectedId(assetsRef.current[0]!.id); return }
      if (e.key === 'j' || e.key === 'k') {
        if (assetsRef.current.length === 0) return
        const ids = assetsRef.current.map(a => a.id)
        const idx = selectedIdRef.current ? ids.indexOf(selectedIdRef.current) : -1
        const next = e.key === 'j' ? Math.min(idx + 1, ids.length - 1) : Math.max(idx - 1, 0)
        setSelectedId(ids[next]!)
      }
    }
    window.addEventListener('keydown', onKeydown)
    return () => { window.removeEventListener('keydown', onKeydown); clearTimeout(gTimerRef.current) }
  }, [gPressed])

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 4rem)', overflow: 'hidden', gap: 12 }}>
      {showFilters && <BRollFilters filters={filters} setFilters={setFilters} clearAll={clearAll} activeCount={activeCount} assets={assets} availableTags={availableTags} />}

      <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 0 }}>
        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => setShowFilters(v => !v)} style={{ padding: '4px 10px', fontSize: 12, borderRadius: 5, border: '1px solid var(--gem-border)', background: showFilters ? 'var(--gem-accent)' : 'transparent', color: 'var(--gem-text)', cursor: 'pointer' }}>
              {showFilters ? 'Hide Filters' : 'Filters'}
            </button>
            <span style={{ fontSize: 12, color: 'var(--gem-muted)' }}>
              {liveStats.total} clip{liveStats.total !== 1 ? 's' : ''}{activeCount > 0 && ' (filtered)'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div role="group" aria-label="View mode" style={{ display: 'flex', borderRadius: 5, overflow: 'hidden', border: '1px solid var(--gem-border)' }}>
              <button aria-pressed={viewMode === 'grid'} onClick={() => setViewMode('grid')} style={{ padding: '4px 10px', fontSize: 12, border: 'none', borderRight: '1px solid var(--gem-border)', background: viewMode === 'grid' ? 'var(--gem-surface-hi)' : 'transparent', color: viewMode === 'grid' ? 'var(--gem-text)' : 'var(--gem-muted)', cursor: 'pointer', fontWeight: viewMode === 'grid' ? 600 : 400 }}>Grid</button>
              <button aria-pressed={viewMode === 'table'} onClick={() => setViewMode('table')} style={{ padding: '4px 10px', fontSize: 12, border: 'none', background: viewMode === 'table' ? 'var(--gem-surface-hi)' : 'transparent', color: viewMode === 'table' ? 'var(--gem-text)' : 'var(--gem-muted)', cursor: 'pointer', fontWeight: viewMode === 'table' ? 600 : 400 }}>Table</button>
            </div>
            <button onClick={() => setShowImport(true)} style={{ padding: '4px 12px', fontSize: 12, borderRadius: 5, border: '1px solid var(--gem-border)', background: 'var(--gem-surface-hi)', color: 'var(--gem-text)', cursor: 'pointer' }}>Import JSON</button>
          </div>
        </div>

        {fetchError && (
          <div style={{ padding: '6px 12px', background: 'rgba(245,158,11,0.1)', borderBottom: '1px solid rgba(245,158,11,0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, marginBottom: 12, borderRadius: 6 }}>
            <span style={{ color: '#f59e0b' }}>{fetchError}</span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button onClick={() => refetch(serializeFilters(filters))} style={{ background: 'none', border: '1px solid rgba(245,158,11,0.4)', color: '#f59e0b', cursor: 'pointer', fontSize: 11, padding: '1px 8px', borderRadius: 4 }}>Retry</button>
              <button aria-label="Dismiss error" onClick={() => setFetchError(null)} style={{ background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer', fontSize: 11 }}>✕</button>
            </div>
          </div>
        )}

        {loading && <BRollGridSkeleton />}
        {!loading && assets.length === 0 && activeCount === 0 && <BRollEmpty variant="no-assets" onImport={() => setShowImport(true)} />}
        {!loading && assets.length === 0 && activeCount > 0 && <BRollEmpty variant="no-results" onClearFilters={clearAll} />}

        {!loading && assets.length > 0 && (
          viewMode === 'grid'
            ? <BRollGrid assets={assets} selectedId={selectedId} onSelect={setSelectedId} />
            : <BRollTable assets={assets} selectedId={selectedId} onSelect={setSelectedId} onRefetch={() => refetch(serializeFilters(filters))} />
        )}

        {hasNext && (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 16 }}>
            <button onClick={loadMore} disabled={loadingMore} style={{ padding: '6px 20px', fontSize: 12, borderRadius: 5, border: '1px solid var(--gem-border)', background: 'var(--gem-surface-hi)', color: 'var(--gem-text)', cursor: loadingMore ? 'not-allowed' : 'pointer', opacity: loadingMore ? 0.6 : 1 }}>{loadingMore ? 'Loading more...' : 'Load more'}</button>
          </div>
        )}

        <div style={{ marginTop: 'auto', paddingTop: 24, fontSize: 11, color: 'var(--gem-muted)' }}>
          {stats.total} total · Showing {liveStats.total} · {liveStats.pessoal} pessoal · {liveStats.generico} generico · {liveStats.ready} ready · {liveStats.pending} pending
        </div>
      </div>

      {selectedId && (
        isNarrow ? (
          <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 400, zIndex: 40, background: 'var(--gem-surface)', boxShadow: '-4px 0 20px rgba(0,0,0,0.3)' }}>
            <BRollDetail assetId={selectedId} allAssets={assets} onClose={() => setSelectedId(null)} onFilter={setFilters} fullWidth />
          </div>
        ) : (
          <BRollDetail assetId={selectedId} allAssets={assets} onClose={() => setSelectedId(null)} onFilter={setFilters} />
        )
      )}

      {showImport && <BRollImportModal onClose={() => { setShowImport(false); refetch(serializeFilters(filters)) }} />}
    </div>
  )
}
