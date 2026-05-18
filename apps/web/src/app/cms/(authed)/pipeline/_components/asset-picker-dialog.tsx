'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import type { BRollAssetRow } from '@/lib/pipeline/broll-schemas'
import type { AudioAssetRow } from '@/lib/pipeline/audio-schemas'
import { sanitizeThumbnailUrl } from '../brolls/_helpers/broll-helpers'

// ─── Types ──────────────────────────────────────────────────────────────────

type AssetRow = BRollAssetRow | AudioAssetRow

interface AssetPickerContext {
  description: string
  suggestedTags: string[]
  suggestedCategory?: string
  suggestedResolution?: string
}

export interface AssetPickerDialogProps {
  assetType: 'broll' | 'audio'
  context: AssetPickerContext
  onSelect: (asset: AssetRow) => void
  onCancel: () => void
  initialSelectedId?: string
}

// ─── Type guards ────────────────────────────────────────────────────────────

function isBRoll(asset: AssetRow): asset is BRollAssetRow {
  return 'source_type' in asset && 'resolution' in asset
}

function isAudio(asset: AssetRow): asset is AudioAssetRow {
  return 'type' in asset && ('bpm' in asset || 'music_key' in asset)
}

// ─── Card sub-components ────────────────────────────────────────────────────

function BRollPickerCard({ asset, selected, onClick }: { asset: BRollAssetRow; selected: boolean; onClick: () => void }) {
  const safeThumbnail = sanitizeThumbnailUrl(asset.thumbnail_url)
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      style={{
        borderRadius: 6,
        overflow: 'hidden',
        cursor: 'pointer',
        border: selected ? '2px solid var(--gem-accent)' : '1px solid var(--gem-border)',
        boxShadow: selected ? '0 0 0 2px color-mix(in srgb, var(--gem-accent) 20%, transparent)' : 'none',
        background: 'var(--gem-surface)',
        transition: 'border-color 0.1s, box-shadow 0.1s',
        outline: 'none',
      }}
    >
      {/* Thumbnail */}
      <div
        style={{
          height: 80,
          background: safeThumbnail
            ? `url(${safeThumbnail}) center/cover`
            : 'linear-gradient(135deg, #1e293b, #0f172a)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {!safeThumbnail && (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5a6b7f" strokeWidth="1.5" opacity="0.2">
            <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
            <line x1="7" y1="2" x2="7" y2="22" />
            <line x1="17" y1="2" x2="17" y2="22" />
          </svg>
        )}
        {asset.duration_seconds != null && (
          <span style={{ position: 'absolute', bottom: 3, right: 4, fontSize: 8, color: 'rgba(255,255,255,0.6)', background: 'rgba(0,0,0,0.5)', borderRadius: 2, padding: '0 3px', fontVariantNumeric: 'tabular-nums' }}>
            {asset.duration_seconds < 60 ? `${Math.round(asset.duration_seconds)}s` : `${Math.floor(asset.duration_seconds / 60)}:${Math.round(asset.duration_seconds % 60).toString().padStart(2, '0')}`}
          </span>
        )}
        <span style={{ position: 'absolute', top: 3, right: 4, fontSize: 7, fontWeight: 700, color: 'rgba(255,255,255,0.6)', background: 'rgba(0,0,0,0.4)', borderRadius: 2, padding: '0 3px', textTransform: 'uppercase' }}>
          {asset.resolution === '4k' ? '4K' : asset.resolution}
        </span>
      </div>
      {/* Body */}
      <div style={{ padding: '6px 8px 8px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gem-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>
          {asset.renamed_to ?? asset.original_filename}
        </div>
        <div style={{ fontSize: 9, color: 'var(--gem-dim)' }}>
          {asset.source_type} {asset.category ? `· ${asset.category}` : ''}
        </div>
      </div>
    </div>
  )
}

function AudioPickerCard({ asset, selected, onClick }: { asset: AudioAssetRow; selected: boolean; onClick: () => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      style={{
        borderRadius: 6,
        overflow: 'hidden',
        cursor: 'pointer',
        border: selected ? '2px solid var(--gem-accent)' : '1px solid var(--gem-border)',
        boxShadow: selected ? '0 0 0 2px color-mix(in srgb, var(--gem-accent) 20%, transparent)' : 'none',
        background: 'var(--gem-surface)',
        transition: 'border-color 0.1s, box-shadow 0.1s',
        outline: 'none',
      }}
    >
      {/* Waveform area */}
      <div style={{ height: 48, background: 'linear-gradient(135deg, rgba(167,139,250,0.08), rgba(99,102,241,0.04))', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <span style={{ fontSize: 18, opacity: 0.2 }}>{asset.type === 'music' ? '♫' : '◎'}</span>
        {asset.duration_seconds != null && (
          <span style={{ position: 'absolute', bottom: 3, right: 4, fontSize: 8, color: 'rgba(255,255,255,0.5)', background: 'rgba(0,0,0,0.4)', borderRadius: 2, padding: '0 3px', fontVariantNumeric: 'tabular-nums' }}>
            {Math.floor(asset.duration_seconds / 60)}:{Math.round(asset.duration_seconds % 60).toString().padStart(2, '0')}
          </span>
        )}
      </div>
      {/* Body */}
      <div style={{ padding: '6px 8px 8px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gem-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>
          {asset.track_name ?? asset.original_filename}
        </div>
        <div style={{ fontSize: 9, color: 'var(--gem-dim)' }}>
          {asset.type}{asset.bpm ? ` · ${asset.bpm} BPM` : ''}{asset.music_key ? ` · ${asset.music_key}` : ''}
        </div>
      </div>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export function AssetPickerDialog({ assetType, context, onSelect, onCancel, initialSelectedId }: AssetPickerDialogProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<AssetRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId ?? null)
  const [activeTagFilters, setActiveTagFilters] = useState<Set<string>>(() => new Set(context.suggestedTags))
  const [categoryFilter, setCategoryFilter] = useState<string | null>(context.suggestedCategory ?? null)
  const [resolutionFilter, setResolutionFilter] = useState<string | null>(context.suggestedResolution ?? null)
  const [audioTypeFilter, setAudioTypeFilter] = useState<'music' | 'sfx' | null>(null)

  const dialogRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const mountedRef = useRef(true)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => () => { mountedRef.current = false }, [])

  const apiBase = assetType === 'broll' ? '/api/pipeline/broll-library' : '/api/pipeline/audio-library'
  const title = assetType === 'broll' ? 'SELECIONAR B-ROLL' : 'SELECIONAR AUDIO'

  // Build search params
  const buildParams = useCallback(() => {
    const params = new URLSearchParams()
    if (query.trim()) params.set('q', query.trim())
    const tags = Array.from(activeTagFilters)
    if (tags.length > 0) params.set('tags', tags.join(','))
    if (categoryFilter) params.set('category', categoryFilter)
    if (assetType === 'broll' && resolutionFilter) params.set('resolution', resolutionFilter)
    if (assetType === 'audio' && audioTypeFilter) params.set('type', audioTypeFilter)
    params.set('limit', '40')
    return params
  }, [query, activeTagFilters, categoryFilter, resolutionFilter, audioTypeFilter, assetType])

  // Fetch results
  const fetchResults = useCallback(async () => {
    // Abort any in-flight request
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    try {
      const params = buildParams()
      const res = await fetch(`${apiBase}?${params.toString()}`, { signal: controller.signal })
      if (!res.ok) return
      const json = await res.json()
      if (mountedRef.current) setResults(json.data ?? [])
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      // silently fail other errors
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [apiBase, buildParams])

  // Initial fetch and refetch on filter change; abort + debounce cleanup on unmount
  useEffect(() => {
    fetchResults()
    return () => {
      abortRef.current?.abort()
      clearTimeout(debounceRef.current)
    }
  }, [fetchResults])

  // Debounced search
  const handleSearchChange = useCallback((value: string) => {
    setQuery(value)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { void fetchResults() }, 300)
  }, [fetchResults])

  // Focus trap + keyboard
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    // Focus first focusable element on mount
    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',')

    const getFocusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelectors))

    const firstFocusable = getFocusable()[0]
    firstFocusable?.focus()

    function onDialogKeydown(e: KeyboardEvent) {
      if (e.key === 'Escape') { onCancel(); return }
      if (e.key === 'Enter' && selectedId) {
        const selected = results.find(r => r.id === selectedId)
        if (selected) onSelect(selected)
        return
      }
      if (e.key === 'Tab') {
        const focusable = getFocusable()
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault()
            last?.focus()
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault()
            first?.focus()
          }
        }
      }
    }

    function onWindowEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }

    dialog.addEventListener('keydown', onDialogKeydown)
    window.addEventListener('keydown', onWindowEscape)
    return () => {
      dialog.removeEventListener('keydown', onDialogKeydown)
      window.removeEventListener('keydown', onWindowEscape)
    }
  }, [onCancel, onSelect, selectedId, results])

  const toggleTag = useCallback((tag: string) => {
    setActiveTagFilters(prev => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
  }, [])

  const selectedAsset = useMemo(() => results.find(r => r.id === selectedId) ?? null, [results, selectedId])

  // All unique tags from suggested + results
  const allTags = useMemo(() => {
    const tags = new Set(context.suggestedTags)
    for (const r of results) {
      for (const t of r.tags) tags.add(t)
    }
    return Array.from(tags).sort()
  }, [context.suggestedTags, results])

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={onCancel}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={e => e.stopPropagation()}
        style={{
          width: 900,
          maxWidth: '95vw',
          maxHeight: '80vh',
          background: 'var(--gem-surface)',
          border: '1px solid var(--gem-border)',
          borderRadius: 12,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ flexShrink: 0, padding: '14px 16px', borderBottom: '1px solid var(--gem-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--gem-text)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</h3>
            {context.description && <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--gem-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 600 }}>{context.description}</p>}
          </div>
          <button aria-label="Close" onClick={onCancel} style={{ background: 'none', border: 'none', color: 'var(--gem-muted)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>&#x2715;</button>
        </div>

        {/* Body: sidebar + content */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
          {/* Sidebar (200px) */}
          <div style={{ width: 200, minWidth: 200, borderRight: '1px solid var(--gem-border)', padding: '12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Tags */}
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gem-muted)', marginBottom: 6 }}>Tags</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {allTags.slice(0, 15).map(tag => {
                  const active = activeTagFilters.has(tag)
                  const isSuggested = context.suggestedTags.includes(tag)
                  return (
                    <button
                      key={tag}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleTag(tag)}
                      style={{
                        padding: '2px 6px',
                        fontSize: 10,
                        borderRadius: 4,
                        border: `1px solid ${active ? (isSuggested ? '#14b8a6' : 'var(--gem-accent)') : 'var(--gem-border)'}`,
                        background: active ? (isSuggested ? 'rgba(20,184,166,0.15)' : 'var(--gem-accent)') : 'var(--gem-well)',
                        color: active ? (isSuggested ? '#14b8a6' : '#fff') : 'var(--gem-text)',
                        cursor: 'pointer',
                        fontWeight: active ? 600 : 400,
                        transition: 'all 0.1s',
                      }}
                    >
                      {tag}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Resolution (B-Roll) or Type (Audio) */}
            {assetType === 'broll' ? (
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gem-muted)', marginBottom: 6 }}>Resolucao</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {([null, '4k', '1080p', '720p'] as const).map(r => {
                    const active = resolutionFilter === r
                    return (
                      <button key={String(r)} type="button" aria-pressed={active} onClick={() => setResolutionFilter(r)}
                        style={{ padding: '3px 6px', fontSize: 10, borderRadius: 4, border: '1px solid var(--gem-border)', background: active ? 'var(--gem-accent)' : 'var(--gem-well)', color: active ? '#fff' : 'var(--gem-muted)', cursor: 'pointer', fontWeight: active ? 600 : 400, textAlign: 'left' }}>
                        {r === null ? 'All' : r === '4k' ? '4K' : r}
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gem-muted)', marginBottom: 6 }}>Type</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {([null, 'music', 'sfx'] as const).map(t => {
                    const active = audioTypeFilter === t
                    return (
                      <button key={String(t)} type="button" aria-pressed={active} onClick={() => setAudioTypeFilter(t)}
                        style={{ padding: '3px 6px', fontSize: 10, borderRadius: 4, border: '1px solid var(--gem-border)', background: active ? 'var(--gem-accent)' : 'var(--gem-well)', color: active ? '#fff' : 'var(--gem-muted)', cursor: 'pointer', fontWeight: active ? 600 : 400, textAlign: 'left' }}>
                        {t === null ? 'All' : t === 'music' ? 'Music' : 'SFX'}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Category */}
            {categoryFilter && (
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gem-muted)', marginBottom: 6 }}>Category</div>
                <button onClick={() => setCategoryFilter(null)} style={{ padding: '3px 8px', fontSize: 10, borderRadius: 4, border: '1px solid var(--gem-accent)', background: 'var(--gem-accent)', color: '#fff', cursor: 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {categoryFilter} <span style={{ fontSize: 8 }}>&#x2715;</span>
                </button>
              </div>
            )}
          </div>

          {/* Content area */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Search */}
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--gem-border)', flexShrink: 0 }}>
              <input
                ref={searchRef}
                type="search"
                placeholder="Search assets..."
                value={query}
                onChange={e => handleSearchChange(e.target.value)}
                style={{ width: '100%', padding: '6px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--gem-border)', background: 'var(--gem-well)', color: 'var(--gem-text)', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            {/* Grid */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
              {loading && (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--gem-dim)', fontSize: 12 }}>Loading...</div>
              )}

              {!loading && results.length === 0 && (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--gem-dim)', fontSize: 12 }}>No assets found. Try adjusting filters.</div>
              )}

              {!loading && results.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
                  {results.map(asset => {
                    const isSelected = asset.id === selectedId
                    if (isBRoll(asset)) {
                      return <BRollPickerCard key={asset.id} asset={asset} selected={isSelected} onClick={() => setSelectedId(asset.id)} />
                    }
                    if (isAudio(asset)) {
                      return <AudioPickerCard key={asset.id} asset={asset} selected={isSelected} onClick={() => setSelectedId(asset.id)} />
                    }
                    return null
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ flexShrink: 0, padding: '10px 16px', borderTop: '1px solid var(--gem-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--gem-muted)' }}>
            {results.length} resultado{results.length !== 1 ? 's' : ''}{selectedId ? ' · 1 selecionado' : ''}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onCancel} style={{ padding: '6px 14px', fontSize: 12, borderRadius: 5, border: '1px solid var(--gem-border)', background: 'transparent', color: 'var(--gem-text)', cursor: 'pointer' }}>Cancelar</button>
            <button
              onClick={() => { if (selectedAsset) onSelect(selectedAsset) }}
              disabled={!selectedId}
              style={{ padding: '6px 14px', fontSize: 12, borderRadius: 5, border: 'none', background: selectedId ? 'var(--gem-accent)' : 'var(--gem-faint)', color: selectedId ? '#fff' : 'var(--gem-dim)', cursor: selectedId ? 'pointer' : 'not-allowed', fontWeight: 600, transition: 'background 0.15s' }}
            >
              Selecionar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
