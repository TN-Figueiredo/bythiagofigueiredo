'use client'

import { useState, useMemo, useCallback, useRef, useEffect, memo } from 'react'
import type { AudioAssetRow } from '@/lib/pipeline/audio-schemas'
import { WaveformDisplay } from './waveform-display'
import { energyColor, formatDuration, categoryConfig } from '../_helpers/audio-helpers'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AudioTableV2Props {
  assets: AudioAssetRow[]
  selectedId: string | null
  onSelect: (id: string) => void
  onRefetch?: () => void
}

type SortKey = 'name' | 'bpm' | 'duration'
type SortDir = 'asc' | 'desc'
type Density = 'compact' | 'default' | 'comfortable'

type ColumnId =
  | 'checkbox'
  | 'waveform'
  | 'name'
  | 'type'
  | 'category'
  | 'energy'
  | 'bpm'
  | 'duration'
  | 'key'
  | 'artist'
  | 'status'

interface ColumnDef {
  id: ColumnId
  label: string
  width: number | string
  sortable: boolean
  locked?: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COLUMNS: ColumnDef[] = [
  { id: 'checkbox',  label: '',         width: 32,     sortable: false },
  { id: 'waveform',  label: '',         width: 64,     sortable: false },
  { id: 'name',      label: 'Name',     width: '1fr',  sortable: true,  locked: true },
  { id: 'type',      label: 'Type',     width: 44,     sortable: false },
  { id: 'category',  label: 'Category', width: 100,    sortable: false },
  { id: 'energy',    label: 'Energy',   width: 70,     sortable: false },
  { id: 'bpm',       label: 'BPM',      width: 55,     sortable: true  },
  { id: 'duration',  label: 'Dur.',     width: 55,     sortable: true  },
  { id: 'key',       label: 'Key',      width: 55,     sortable: false },
  { id: 'artist',    label: 'Artist',   width: 110,    sortable: false },
  { id: 'status',    label: 'Status',   width: 80,     sortable: false },
]

const DEFAULT_VISIBLE = new Set<ColumnId>([
  'checkbox', 'waveform', 'name', 'type', 'category',
  'energy', 'bpm', 'duration', 'key', 'artist', 'status',
])

const DENSITY_PAD: Record<Density, string> = {
  compact:     '5px 10px',
  default:     '8px 10px',
  comfortable: '10px 10px',
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; dot: string }> = {
  downloaded: { label: 'Ready',    bg: 'rgba(16,185,129,0.12)',  color: '#10b981', dot: '#10b981' },
  pending:    { label: 'Pending',  bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', dot: '#f59e0b' },
  retired:    { label: 'Retired',  bg: 'rgba(107,114,128,0.12)',color: '#6b7280', dot: '#6b7280' },
}

const TYPE_CONFIG: Record<string, { emoji: string; bg: string; color: string }> = {
  music: { emoji: '♪', bg: 'rgba(167,139,250,0.15)', color: '#a78bfa' },
  sfx:   { emoji: '⚡', bg: 'rgba(34,211,238,0.15)',  color: '#22d3ee' },
}

// ─── Row component (memoised) ─────────────────────────────────────────────────

interface RowProps {
  asset: AudioAssetRow
  selected: boolean
  checked: boolean
  visibleCols: Set<ColumnId>
  tdPad: string
  onSelect: () => void
  onCheck: (e: React.MouseEvent) => void
}

const AudioTableRow = memo(function AudioTableRow({
  asset, selected, checked, visibleCols, tdPad, onSelect, onCheck,
}: RowProps) {
  const peaks = useMemo(() => {
    const wf = asset.metadata?.waveform as { peaks?: number[] } | undefined
    return wf?.peaks ?? []
  }, [asset.metadata])

  const isRetired = asset.status === 'retired'
  const rowBg = selected
    ? 'color-mix(in srgb, var(--gem-accent) 8%, var(--gem-surface))'
    : checked
      ? 'color-mix(in srgb, var(--gem-accent) 4%, var(--gem-surface))'
      : 'transparent'

  const catCfg = categoryConfig(asset.category)
  const statusCfg = STATUS_CONFIG[asset.status] ?? { label: asset.status, bg: 'rgba(107,114,128,0.12)', color: '#6b7280', dot: '#6b7280' }
  const typeCfg = TYPE_CONFIG[asset.type] ?? { emoji: '?', bg: 'rgba(107,114,128,0.12)', color: '#6b7280' }

  return (
    <tr
      onClick={onSelect}
      style={{
        contentVisibility: 'auto',
        containIntrinsicSize: 'auto 48px',
        borderBottom: '1px solid var(--gem-border)',
        cursor: 'pointer',
        background: rowBg,
        opacity: isRetired ? 0.5 : 1,
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => { if (!selected && !checked) (e.currentTarget as HTMLElement).style.background = 'var(--gem-surface-hi)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = rowBg }}
    >
      {visibleCols.has('checkbox') && (
        <td style={{ padding: tdPad, width: 32 }} onClick={onCheck}>
          <input
            type="checkbox"
            checked={checked}
            onChange={() => {/* handled by onClick */}}
            aria-label={`Select ${asset.track_name ?? asset.asset_id}`}
            style={{ cursor: 'pointer' }}
          />
        </td>
      )}

      {visibleCols.has('waveform') && (
        <td style={{ padding: tdPad, width: 64 }}>
          <WaveformDisplay variant="table" peaks={peaks} type={asset.type} />
        </td>
      )}

      {visibleCols.has('name') && (
        <td style={{ padding: tdPad, minWidth: 180 }}>
          <div style={{ fontWeight: 500, color: 'var(--gem-text)', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 240 }}>
            {asset.track_name ?? asset.asset_id}
          </div>
          <div style={{ fontSize: 10, color: 'var(--gem-dim)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 240 }}>
            {[asset.source, asset.asset_id].filter(Boolean).join(' · ')}
          </div>
        </td>
      )}

      {visibleCols.has('type') && (
        <td style={{ padding: tdPad, width: 44 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 18, borderRadius: 4, background: typeCfg.bg, color: typeCfg.color, fontSize: 11 }}>
            {typeCfg.emoji}
          </span>
        </td>
      )}

      {visibleCols.has('category') && (
        <td style={{ padding: tdPad, width: 100 }}>
          {asset.category ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '2px 6px', borderRadius: 4, background: catCfg.badgeBg, color: catCfg.badgeColor }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: catCfg.dotColor, flexShrink: 0 }} />
              {asset.category}
            </span>
          ) : (
            <span style={{ color: 'var(--gem-dim)', opacity: 0.4 }}>—</span>
          )}
        </td>
      )}

      {visibleCols.has('energy') && (
        <td style={{ padding: tdPad, width: 70 }}>
          <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            {[1, 2, 3, 4, 5].map(lvl => (
              <span
                key={lvl}
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: energyColor(asset.energy != null ? asset.energy : null),
                  opacity: asset.energy != null && lvl <= asset.energy ? 1 : 0.25,
                  display: 'inline-block',
                }}
              />
            ))}
          </div>
        </td>
      )}

      {visibleCols.has('bpm') && (
        <td style={{ padding: tdPad, width: 55, fontVariantNumeric: 'tabular-nums', color: asset.bpm != null ? 'var(--gem-text)' : undefined }}>
          {asset.bpm != null ? asset.bpm : <span style={{ opacity: 0.4 }}>—</span>}
        </td>
      )}

      {visibleCols.has('duration') && (
        <td style={{ padding: tdPad, width: 55, fontVariantNumeric: 'tabular-nums', color: asset.duration_seconds != null ? 'var(--gem-text)' : undefined }}>
          {asset.duration_seconds != null
            ? formatDuration(asset.duration_seconds)
            : <span style={{ opacity: 0.4 }}>—</span>}
        </td>
      )}

      {visibleCols.has('key') && (
        <td style={{ padding: tdPad, width: 55, fontVariantNumeric: 'tabular-nums' }}>
          {asset.music_key != null
            ? <span style={{ color: 'var(--gem-text)' }}>{asset.music_key}</span>
            : <span style={{ opacity: 0.4 }}>—</span>}
        </td>
      )}

      {visibleCols.has('artist') && (
        <td style={{ padding: tdPad, width: 110, color: 'var(--gem-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 110 }}>
          {asset.artist ?? <span style={{ opacity: 0.4 }}>—</span>}
        </td>
      )}

      {visibleCols.has('status') && (
        <td style={{ padding: tdPad, width: 80 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '2px 6px', borderRadius: 4, background: statusCfg.bg, color: statusCfg.color }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: statusCfg.dot, flexShrink: 0 }} />
            {statusCfg.label}
          </span>
        </td>
      )}
    </tr>
  )
})

// ─── Column Picker popover ─────────────────────────────────────────────────────

interface ColumnPickerProps {
  visible: Set<ColumnId>
  onChange: (id: ColumnId, on: boolean) => void
  onClose: () => void
}

function ColumnPicker({ visible, onChange, onClose }: ColumnPickerProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  const pickable = COLUMNS.filter(c => c.id !== 'checkbox' && c.id !== 'waveform')

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Column picker"
      style={{
        position: 'absolute',
        top: '100%',
        right: 0,
        marginTop: 4,
        width: 200,
        zIndex: 100,
        background: 'var(--gem-surface)',
        border: '1px solid var(--gem-border)',
        borderRadius: 8,
        padding: '8px 0',
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      }}
    >
      <div style={{ padding: '4px 12px 6px', fontSize: 10, fontWeight: 600, color: 'var(--gem-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Columns
      </div>
      {pickable.map(col => {
        const locked = col.locked === true
        const isVisible = visible.has(col.id)
        return (
          <label
            key={col.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '5px 12px',
              cursor: locked ? 'default' : 'pointer',
              opacity: locked ? 0.4 : 1,
              fontSize: 12,
              color: 'var(--gem-text)',
            }}
          >
            <input
              type="checkbox"
              checked={isVisible}
              disabled={locked}
              onChange={e => onChange(col.id, e.target.checked)}
              style={{ cursor: locked ? 'default' : 'pointer' }}
            />
            {col.label}
          </label>
        )
      })}
    </div>
  )
}

// ─── Bulk actions bar ─────────────────────────────────────────────────────────

interface BulkBarProps {
  count: number
  loading: boolean
  onAction: (action: 'tag' | 'category' | 'status' | 'export' | 'delete') => void
  onClear: () => void
}

function BulkBar({ count, loading, onAction, onClear }: BulkBarProps) {
  const btn: React.CSSProperties = {
    padding: '3px 10px',
    borderRadius: 4,
    border: '1px solid var(--gem-border)',
    background: 'transparent',
    color: 'var(--gem-text)',
    cursor: loading ? 'not-allowed' : 'pointer',
    fontSize: 11,
    opacity: loading ? 0.5 : 1,
    fontFamily: 'inherit',
  }
  const dangerBtn: React.CSSProperties = { ...btn, color: 'var(--gem-danger, #ef4444)', borderColor: 'rgba(239,68,68,0.3)' }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '6px 12px',
      background: 'color-mix(in srgb, var(--gem-accent) 8%, var(--gem-surface))',
      borderRadius: 6,
      marginBottom: 8,
      fontSize: 12,
      border: '1px solid color-mix(in srgb, var(--gem-accent) 20%, transparent)',
    }}>
      <span style={{ color: 'var(--gem-text)', fontWeight: 600 }}>
        {count} selected{loading ? ' · Working…' : ''}
      </span>
      <button onClick={() => onAction('tag')}      disabled={loading} style={btn}>Set Tag</button>
      <button onClick={() => onAction('category')} disabled={loading} style={btn}>Set Category</button>
      <button onClick={() => onAction('status')}   disabled={loading} style={btn}>Set Status</button>
      <button onClick={() => onAction('export')}   disabled={loading} style={btn}>Export JSON</button>
      <button onClick={() => onAction('delete')}   disabled={loading} style={dangerBtn}>Delete</button>
      <button onClick={onClear} disabled={loading} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--gem-muted)', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 11, fontFamily: 'inherit' }}>
        Clear
      </button>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AudioTableV2({ assets, selectedId, onSelect, onRefetch }: AudioTableV2Props) {
  const [sortKey, setSortKey]     = useState<SortKey>('name')
  const [sortDir, setSortDir]     = useState<SortDir>('asc')
  const [density, setDensity]     = useState<Density>('default')
  const [checked, setChecked]     = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)
  const [pickerOpen, setPickerOpen]   = useState(false)
  const [visibleCols, setVisibleCols] = useState<Set<ColumnId>>(DEFAULT_VISIBLE)
  const pickerAnchorRef = useRef<HTMLDivElement>(null)

  const tdPad = DENSITY_PAD[density]

  // ── Sorting ──────────────────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    const list = [...assets]
    list.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name') {
        cmp = (a.track_name ?? a.asset_id).localeCompare(b.track_name ?? b.asset_id)
      } else if (sortKey === 'bpm') {
        cmp = (a.bpm ?? -1) - (b.bpm ?? -1)
      } else if (sortKey === 'duration') {
        cmp = (a.duration_seconds ?? -1) - (b.duration_seconds ?? -1)
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return list
  }, [assets, sortKey, sortDir])

  const toggleSort = useCallback((key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }, [sortKey])

  // ── Checkbox helpers ──────────────────────────────────────────────────────────
  const toggleCheck = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    setChecked(prev =>
      prev.size === sorted.length && sorted.length > 0
        ? new Set()
        : new Set(sorted.map(a => a.id))
    )
  }, [sorted])

  // ── Column visibility ─────────────────────────────────────────────────────────
  const toggleColumn = useCallback((id: ColumnId, on: boolean) => {
    setVisibleCols(prev => {
      const next = new Set(prev)
      if (on) next.add(id); else next.delete(id)
      return next
    })
  }, [])

  // ── Bulk actions ──────────────────────────────────────────────────────────────
  const bulkAction = useCallback(async (action: 'tag' | 'category' | 'status' | 'export' | 'delete') => {
    const ids = Array.from(checked)
    if (ids.length === 0) return

    if (action === 'export') {
      const selected = assets.filter(a => checked.has(a.id))
      const blob = new Blob(
        [JSON.stringify({ schema_version: '6.1.0', assets: selected }, null, 2)],
        { type: 'application/json' },
      )
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `audio-selection-${ids.length}.json`
      link.click()
      URL.revokeObjectURL(url)
      return
    }

    if (action === 'delete') {
      if (!confirm(`Delete ${ids.length} asset${ids.length > 1 ? 's' : ''}?`)) return
      setBulkLoading(true)
      try {
        const results = await Promise.allSettled(
          ids.map(id => {
            const asset = assets.find(a => a.id === id)
            const url = asset
              ? `/api/pipeline/audio-library/${id}?version=${asset.version}`
              : `/api/pipeline/audio-library/${id}`
            return fetch(url, { method: 'DELETE' })
          })
        )
        const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok)).length
        if (failed > 0) alert(`${failed} of ${ids.length} deletes failed`)
        setChecked(new Set())
        onRefetch?.()
      } finally {
        setBulkLoading(false)
      }
      return
    }

    const value = prompt(`Enter ${action} value for ${ids.length} asset${ids.length > 1 ? 's' : ''}:`)
    if (!value) return

    const body: Record<string, unknown> = {}
    if (action === 'tag') body.tags = value.split(',').map(t => t.trim())
    else body[action] = value

    setBulkLoading(true)
    try {
      const results = await Promise.allSettled(
        ids.map(id => fetch(`/api/pipeline/audio-library/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, version: assets.find(a => a.id === id)?.version ?? 1 }),
        }))
      )
      const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok)).length
      if (failed > 0) alert(`${failed} of ${ids.length} updates failed`)
      setChecked(new Set())
      onRefetch?.()
    } finally {
      setBulkLoading(false)
    }
  }, [assets, checked, onRefetch])

  // ── Sortable column headers ───────────────────────────────────────────────────
  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return null
    return <span aria-hidden="true" style={{ marginLeft: 3, opacity: 0.7 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  const thBase: React.CSSProperties = {
    padding: tdPad,
    textAlign: 'left',
    color: 'var(--gem-muted)',
    fontWeight: 600,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    userSelect: 'none',
    whiteSpace: 'nowrap',
  }

  const thSortable: React.CSSProperties = { ...thBase, cursor: 'pointer' }

  const allChecked = sorted.length > 0 && checked.size === sorted.length
  const someChecked = checked.size > 0 && checked.size < sorted.length

  return (
    <div>
      {/* ── Toolbar ────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
        gap: 8,
      }}>
        <span style={{ fontSize: 12, color: 'var(--gem-muted)', fontWeight: 500 }}>
          {assets.length} track{assets.length !== 1 ? 's' : ''}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Density toggle */}
          <div role="group" aria-label="Table density" style={{ display: 'flex', borderRadius: 5, overflow: 'hidden', border: '1px solid var(--gem-border)' }}>
            {(['compact', 'default', 'comfortable'] as Density[]).map(d => (
              <button
                key={d}
                onClick={() => setDensity(d)}
                aria-pressed={density === d}
                title={d.charAt(0).toUpperCase() + d.slice(1)}
                style={{
                  padding: '3px 9px',
                  border: 'none',
                  borderRight: d !== 'comfortable' ? '1px solid var(--gem-border)' : 'none',
                  background: density === d ? 'var(--gem-surface-hi)' : 'transparent',
                  color: density === d ? 'var(--gem-text)' : 'var(--gem-muted)',
                  cursor: 'pointer',
                  fontSize: 10,
                  fontFamily: 'inherit',
                  fontWeight: density === d ? 600 : 400,
                  transition: 'background 0.1s',
                }}
              >
                {d === 'compact' ? 'C' : d === 'default' ? 'D' : 'R'}
              </button>
            ))}
          </div>

          {/* Column picker */}
          <div ref={pickerAnchorRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setPickerOpen(o => !o)}
              aria-haspopup="dialog"
              aria-expanded={pickerOpen}
              aria-label="Column picker"
              title="Choose columns"
              style={{
                padding: '3px 9px',
                borderRadius: 5,
                border: '1px solid var(--gem-border)',
                background: pickerOpen ? 'var(--gem-surface-hi)' : 'transparent',
                color: 'var(--gem-muted)',
                cursor: 'pointer',
                fontSize: 11,
                fontFamily: 'inherit',
              }}
            >
              ⊞ Cols
            </button>
            {pickerOpen && (
              <ColumnPicker
                visible={visibleCols}
                onChange={toggleColumn}
                onClose={() => setPickerOpen(false)}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Bulk actions ───────────────────────────────────────────────────── */}
      {checked.size > 0 && (
        <BulkBar
          count={checked.size}
          loading={bulkLoading}
          onAction={bulkAction}
          onClear={() => setChecked(new Set())}
        />
      )}

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <div style={{ overflowX: 'auto' }}>
        <table
          aria-label="Audio assets"
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 12,
            minWidth: 600,
          }}
        >
          <thead>
            <tr style={{ borderBottom: '1px solid var(--gem-border)' }}>
              {visibleCols.has('checkbox') && (
                <th style={{ ...thBase, width: 32, padding: tdPad }}>
                  <input
                    type="checkbox"
                    checked={allChecked}
                    ref={el => { if (el) el.indeterminate = someChecked }}
                    onChange={toggleAll}
                    aria-label="Select all"
                    style={{ cursor: 'pointer' }}
                  />
                </th>
              )}
              {visibleCols.has('waveform') && (
                <th style={{ ...thBase, width: 64, padding: tdPad }} aria-label="Waveform" />
              )}
              {visibleCols.has('name') && (
                <th
                  style={{ ...thSortable, minWidth: 180, padding: tdPad }}
                  onClick={() => toggleSort('name')}
                  aria-sort={sortKey === 'name' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  Name{sortIndicator('name')}
                </th>
              )}
              {visibleCols.has('type') && (
                <th style={{ ...thBase, width: 44, padding: tdPad }}>Type</th>
              )}
              {visibleCols.has('category') && (
                <th style={{ ...thBase, width: 100, padding: tdPad }}>Category</th>
              )}
              {visibleCols.has('energy') && (
                <th style={{ ...thBase, width: 70, padding: tdPad }}>Energy</th>
              )}
              {visibleCols.has('bpm') && (
                <th
                  style={{ ...thSortable, width: 55, padding: tdPad }}
                  onClick={() => toggleSort('bpm')}
                  aria-sort={sortKey === 'bpm' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  BPM{sortIndicator('bpm')}
                </th>
              )}
              {visibleCols.has('duration') && (
                <th
                  style={{ ...thSortable, width: 55, padding: tdPad }}
                  onClick={() => toggleSort('duration')}
                  aria-sort={sortKey === 'duration' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  Dur.{sortIndicator('duration')}
                </th>
              )}
              {visibleCols.has('key') && (
                <th style={{ ...thBase, width: 55, padding: tdPad }}>Key</th>
              )}
              {visibleCols.has('artist') && (
                <th style={{ ...thBase, width: 110, padding: tdPad }}>Artist</th>
              )}
              {visibleCols.has('status') && (
                <th style={{ ...thBase, width: 80, padding: tdPad }}>Status</th>
              )}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={visibleCols.size}
                  style={{ padding: 40, textAlign: 'center', color: 'var(--gem-muted)', fontSize: 13 }}
                >
                  No assets match your filters.
                </td>
              </tr>
            )}
            {sorted.map(asset => (
              <AudioTableRow
                key={asset.id}
                asset={asset}
                selected={selectedId === asset.id}
                checked={checked.has(asset.id)}
                visibleCols={visibleCols}
                tdPad={tdPad}
                onSelect={() => onSelect(asset.id)}
                onCheck={e => toggleCheck(asset.id, e)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
