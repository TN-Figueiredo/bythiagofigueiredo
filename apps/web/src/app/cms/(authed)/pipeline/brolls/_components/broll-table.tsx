'use client'

import { useState, useMemo, useCallback, useRef, useEffect, memo } from 'react'
import type { BRollAssetRow } from '@/lib/pipeline/broll-schemas'
import { formatDuration, sourceTypeConfig, categoryConfig } from '../_helpers/broll-helpers'

// ─── Types ────────────────────────────────────────────────────────────────────

interface BRollTableProps {
  assets: BRollAssetRow[]
  selectedId: string | null
  onSelect: (id: string) => void
  onRefetch?: () => void
}

type SortKey = 'name' | 'duration' | 'resolution'
type SortDir = 'asc' | 'desc'
type Density = 'compact' | 'default' | 'comfortable'

type ColumnId =
  | 'checkbox'
  | 'thumbnail'
  | 'name'
  | 'source_type'
  | 'category'
  | 'resolution'
  | 'duration'
  | 'codec'
  | 'fps'
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
  { id: 'checkbox',    label: '',          width: 32,     sortable: false },
  { id: 'thumbnail',   label: '',          width: 64,     sortable: false },
  { id: 'name',        label: 'Name',      width: '1fr',  sortable: true, locked: true },
  { id: 'source_type', label: 'Source',    width: 80,     sortable: false },
  { id: 'category',    label: 'Category',  width: 100,    sortable: false },
  { id: 'resolution',  label: 'Res.',      width: 60,     sortable: true },
  { id: 'duration',    label: 'Dur.',      width: 55,     sortable: true },
  { id: 'codec',       label: 'Codec',     width: 60,     sortable: false },
  { id: 'fps',         label: 'FPS',       width: 45,     sortable: false },
  { id: 'status',      label: 'Status',    width: 80,     sortable: false },
]

const DEFAULT_VISIBLE = new Set<ColumnId>([
  'checkbox', 'thumbnail', 'name', 'source_type', 'category',
  'resolution', 'duration', 'codec', 'fps', 'status',
])

const DENSITY_PAD: Record<Density, string> = {
  compact:     '5px 10px',
  default:     '8px 10px',
  comfortable: '10px 10px',
}

const RESOLUTION_ORDER: Record<string, number> = { '4k': 4, '1080p': 3, '720p': 2, '480p': 1 }

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; dot: string }> = {
  ready:   { label: 'Ready',   bg: 'rgba(16,185,129,0.12)',  color: '#10b981', dot: '#10b981' },
  pending: { label: 'Pending', bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', dot: '#f59e0b' },
}

const SOURCE_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  pessoal:  { label: 'Pessoal',  bg: 'rgba(34,197,94,0.15)',  color: '#22c55e' },
  generico: { label: 'Generico', bg: 'rgba(59,130,246,0.15)', color: '#3b82f6' },
}

// ─── Row component (memoised) ─────────────────────────────────────────────────

interface RowProps {
  asset: BRollAssetRow
  selected: boolean
  checked: boolean
  visibleCols: Set<ColumnId>
  tdPad: string
  onSelect: () => void
  onCheck: (e: React.MouseEvent) => void
}

const BRollTableRow = memo(function BRollTableRow({
  asset, selected, checked, visibleCols, tdPad, onSelect, onCheck,
}: RowProps) {
  const rowBg = selected
    ? 'color-mix(in srgb, var(--gem-accent) 8%, var(--gem-surface))'
    : checked
      ? 'color-mix(in srgb, var(--gem-accent) 4%, var(--gem-surface))'
      : 'transparent'

  const catCfg = categoryConfig(asset.category)
  const statusCfg = STATUS_CONFIG[asset.status] ?? { label: asset.status, bg: 'rgba(107,114,128,0.12)', color: '#6b7280', dot: '#6b7280' }
  const srcCfg = SOURCE_CONFIG[asset.source_type] ?? { label: asset.source_type, bg: 'rgba(107,114,128,0.12)', color: '#6b7280' }

  return (
    <tr
      onClick={onSelect}
      style={{
        borderBottom: '1px solid var(--gem-border)',
        cursor: 'pointer',
        background: rowBg,
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
            onChange={() => {}}
            aria-label={`Select ${asset.renamed_to ?? asset.original_filename}`}
            style={{ cursor: 'pointer' }}
          />
        </td>
      )}

      {visibleCols.has('thumbnail') && (
        <td style={{ padding: tdPad, width: 64 }}>
          <div style={{
            width: 56, height: 32, borderRadius: 4, overflow: 'hidden',
            background: asset.thumbnail_url
              ? `url(${asset.thumbnail_url}) center/cover`
              : 'linear-gradient(135deg, #1e293b, #0f172a)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {!asset.thumbnail_url && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5a6b7f" strokeWidth="1.5" opacity="0.3">
                <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
                <line x1="7" y1="2" x2="7" y2="22" />
                <line x1="17" y1="2" x2="17" y2="22" />
              </svg>
            )}
          </div>
        </td>
      )}

      {visibleCols.has('name') && (
        <td style={{ padding: tdPad, minWidth: 180 }}>
          <div style={{ fontWeight: 500, color: 'var(--gem-text)', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 240 }}>
            {asset.renamed_to ?? asset.original_filename}
          </div>
          <div style={{ fontSize: 10, color: 'var(--gem-dim)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 240 }}>
            {[asset.source, asset.asset_id].filter(Boolean).join(' · ')}
          </div>
        </td>
      )}

      {visibleCols.has('source_type') && (
        <td style={{ padding: tdPad, width: 80 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '2px 6px', borderRadius: 4, background: srcCfg.bg, color: srcCfg.color }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: srcCfg.color, flexShrink: 0 }} />
            {srcCfg.label}
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
            <span style={{ color: 'var(--gem-dim)', opacity: 0.4 }}>--</span>
          )}
        </td>
      )}

      {visibleCols.has('resolution') && (
        <td style={{ padding: tdPad, width: 60, fontSize: 11, fontWeight: 500, color: 'var(--gem-text)' }}>
          {asset.resolution === '4k' ? '4K' : asset.resolution}
        </td>
      )}

      {visibleCols.has('duration') && (
        <td style={{ padding: tdPad, width: 55, fontVariantNumeric: 'tabular-nums', color: asset.duration_seconds != null ? 'var(--gem-text)' : undefined }}>
          {asset.duration_seconds != null
            ? formatDuration(asset.duration_seconds)
            : <span style={{ opacity: 0.4 }}>--</span>}
        </td>
      )}

      {visibleCols.has('codec') && (
        <td style={{ padding: tdPad, width: 60, fontSize: 11, color: 'var(--gem-muted)' }}>
          {asset.codec ?? <span style={{ opacity: 0.4 }}>--</span>}
        </td>
      )}

      {visibleCols.has('fps') && (
        <td style={{ padding: tdPad, width: 45, fontVariantNumeric: 'tabular-nums', color: 'var(--gem-muted)' }}>
          {asset.fps ?? <span style={{ opacity: 0.4 }}>--</span>}
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

  const pickable = COLUMNS.filter(c => c.id !== 'checkbox' && c.id !== 'thumbnail')

  return (
    <div ref={ref} role="dialog" aria-label="Column picker" style={{
      position: 'absolute', top: '100%', right: 0, marginTop: 4, width: 200, zIndex: 100,
      background: 'var(--gem-surface)', border: '1px solid var(--gem-border)', borderRadius: 8, padding: '8px 0',
      boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    }}>
      <div style={{ padding: '4px 12px 6px', fontSize: 10, fontWeight: 600, color: 'var(--gem-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Columns</div>
      {pickable.map(col => {
        const locked = col.locked === true
        const isVisible = visible.has(col.id)
        return (
          <label key={col.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', cursor: locked ? 'default' : 'pointer', opacity: locked ? 0.4 : 1, fontSize: 12, color: 'var(--gem-text)' }}>
            <input type="checkbox" checked={isVisible} disabled={locked} onChange={e => onChange(col.id, e.target.checked)} style={{ cursor: locked ? 'default' : 'pointer' }} />
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
    padding: '3px 10px', borderRadius: 4, border: '1px solid var(--gem-border)', background: 'transparent',
    color: 'var(--gem-text)', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 11, opacity: loading ? 0.5 : 1, fontFamily: 'inherit',
  }
  const dangerBtn: React.CSSProperties = { ...btn, color: 'var(--gem-danger, #ef4444)', borderColor: 'rgba(239,68,68,0.3)' }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'color-mix(in srgb, var(--gem-accent) 8%, var(--gem-surface))', borderRadius: 6, marginBottom: 8, fontSize: 12, border: '1px solid color-mix(in srgb, var(--gem-accent) 20%, transparent)' }}>
      <span style={{ color: 'var(--gem-text)', fontWeight: 600 }}>{count} selected{loading ? ' · Working...' : ''}</span>
      <button onClick={() => onAction('tag')} disabled={loading} style={btn}>Set Tag</button>
      <button onClick={() => onAction('category')} disabled={loading} style={btn}>Set Category</button>
      <button onClick={() => onAction('status')} disabled={loading} style={btn}>Set Status</button>
      <button onClick={() => onAction('export')} disabled={loading} style={btn}>Export JSON</button>
      <button onClick={() => onAction('delete')} disabled={loading} style={dangerBtn}>Delete</button>
      <button onClick={onClear} disabled={loading} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--gem-muted)', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 11, fontFamily: 'inherit' }}>Clear</button>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function BRollTable({ assets, selectedId, onSelect, onRefetch }: BRollTableProps) {
  const [sortKey, setSortKey]     = useState<SortKey>('name')
  const [sortDir, setSortDir]     = useState<SortDir>('asc')
  const [density, setDensity]     = useState<Density>('default')
  const [checked, setChecked]     = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)
  const [pickerOpen, setPickerOpen]   = useState(false)
  const [visibleCols, setVisibleCols] = useState<Set<ColumnId>>(DEFAULT_VISIBLE)
  const pickerAnchorRef = useRef<HTMLDivElement>(null)
  const tdPad = DENSITY_PAD[density]

  const sorted = useMemo(() => {
    const list = [...assets]
    list.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name') cmp = (a.renamed_to ?? a.original_filename).localeCompare(b.renamed_to ?? b.original_filename)
      else if (sortKey === 'duration') cmp = (a.duration_seconds ?? -1) - (b.duration_seconds ?? -1)
      else if (sortKey === 'resolution') cmp = (RESOLUTION_ORDER[a.resolution] ?? 0) - (RESOLUTION_ORDER[b.resolution] ?? 0)
      return sortDir === 'asc' ? cmp : -cmp
    })
    return list
  }, [assets, sortKey, sortDir])

  const toggleSort = useCallback((key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }, [sortKey])

  const toggleCheck = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setChecked(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }, [])

  const toggleAll = useCallback(() => {
    setChecked(prev => prev.size === sorted.length && sorted.length > 0 ? new Set() : new Set(sorted.map(a => a.id)))
  }, [sorted])

  const toggleColumn = useCallback((id: ColumnId, on: boolean) => {
    setVisibleCols(prev => { const next = new Set(prev); if (on) next.add(id); else next.delete(id); return next })
  }, [])

  const bulkAction = useCallback(async (action: 'tag' | 'category' | 'status' | 'export' | 'delete') => {
    const ids = Array.from(checked)
    if (ids.length === 0) return
    if (action === 'export') {
      const selected = assets.filter(a => checked.has(a.id))
      const blob = new Blob([JSON.stringify({ schema_version: '1.0', brolls: selected }, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url; link.download = `broll-selection-${ids.length}.json`; link.click()
      URL.revokeObjectURL(url)
      return
    }
    if (action === 'delete') {
      if (!confirm(`Delete ${ids.length} asset${ids.length > 1 ? 's' : ''}?`)) return
      setBulkLoading(true)
      try {
        const results = await Promise.allSettled(ids.map(id => {
          const asset = assets.find(a => a.id === id)
          const url = asset ? `/api/pipeline/broll-library/${id}?version=${asset.version}` : `/api/pipeline/broll-library/${id}`
          return fetch(url, { method: 'DELETE' })
        }))
        const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok)).length
        if (failed > 0) alert(`${failed} of ${ids.length} deletes failed`)
        setChecked(new Set()); onRefetch?.()
      } finally { setBulkLoading(false) }
      return
    }
    const value = prompt(`Enter ${action} value for ${ids.length} asset${ids.length > 1 ? 's' : ''}:`)
    if (!value) return
    const body: Record<string, unknown> = {}
    if (action === 'tag') body.tags = value.split(',').map(t => t.trim())
    else body[action] = value
    setBulkLoading(true)
    try {
      const results = await Promise.allSettled(ids.map(id => fetch(`/api/pipeline/broll-library/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, version: assets.find(a => a.id === id)?.version ?? 1 }),
      })))
      const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok)).length
      if (failed > 0) alert(`${failed} of ${ids.length} updates failed`)
      setChecked(new Set()); onRefetch?.()
    } finally { setBulkLoading(false) }
  }, [assets, checked, onRefetch])

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return null
    return <span aria-hidden="true" style={{ marginLeft: 3, opacity: 0.7 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  const thBase: React.CSSProperties = { padding: tdPad, textAlign: 'left', color: 'var(--gem-muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', userSelect: 'none', whiteSpace: 'nowrap' }
  const thSortable: React.CSSProperties = { ...thBase, cursor: 'pointer' }
  const allChecked = sorted.length > 0 && checked.size === sorted.length
  const someChecked = checked.size > 0 && checked.size < sorted.length

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--gem-muted)', fontWeight: 500 }}>{assets.length} clip{assets.length !== 1 ? 's' : ''}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div role="group" aria-label="Table density" style={{ display: 'flex', borderRadius: 5, overflow: 'hidden', border: '1px solid var(--gem-border)' }}>
            {(['compact', 'default', 'comfortable'] as Density[]).map(d => (
              <button key={d} onClick={() => setDensity(d)} aria-pressed={density === d} title={d.charAt(0).toUpperCase() + d.slice(1)} style={{ padding: '3px 9px', border: 'none', borderRight: d !== 'comfortable' ? '1px solid var(--gem-border)' : 'none', background: density === d ? 'var(--gem-surface-hi)' : 'transparent', color: density === d ? 'var(--gem-text)' : 'var(--gem-muted)', cursor: 'pointer', fontSize: 10, fontFamily: 'inherit', fontWeight: density === d ? 600 : 400, transition: 'background 0.1s' }}>
                {d === 'compact' ? 'C' : d === 'default' ? 'D' : 'R'}
              </button>
            ))}
          </div>
          <div ref={pickerAnchorRef} style={{ position: 'relative' }}>
            <button onClick={() => setPickerOpen(o => !o)} aria-haspopup="dialog" aria-expanded={pickerOpen} aria-label="Column picker" title="Choose columns" style={{ padding: '3px 9px', borderRadius: 5, border: '1px solid var(--gem-border)', background: pickerOpen ? 'var(--gem-surface-hi)' : 'transparent', color: 'var(--gem-muted)', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>
              Cols
            </button>
            {pickerOpen && <ColumnPicker visible={visibleCols} onChange={toggleColumn} onClose={() => setPickerOpen(false)} />}
          </div>
        </div>
      </div>

      {checked.size > 0 && <BulkBar count={checked.size} loading={bulkLoading} onAction={bulkAction} onClear={() => setChecked(new Set())} />}

      <div style={{ overflowX: 'auto' }}>
        <table aria-label="B-Roll assets" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 600 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--gem-border)' }}>
              {visibleCols.has('checkbox') && (<th style={{ ...thBase, width: 32, padding: tdPad }}><input type="checkbox" checked={allChecked} ref={el => { if (el) el.indeterminate = someChecked }} onChange={toggleAll} aria-label="Select all" style={{ cursor: 'pointer' }} /></th>)}
              {visibleCols.has('thumbnail') && (<th style={{ ...thBase, width: 64, padding: tdPad }} aria-label="Thumbnail" />)}
              {visibleCols.has('name') && (<th style={{ ...thSortable, minWidth: 180, padding: tdPad }} onClick={() => toggleSort('name')} aria-sort={sortKey === 'name' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>Name{sortIndicator('name')}</th>)}
              {visibleCols.has('source_type') && (<th style={{ ...thBase, width: 80, padding: tdPad }}>Source</th>)}
              {visibleCols.has('category') && (<th style={{ ...thBase, width: 100, padding: tdPad }}>Category</th>)}
              {visibleCols.has('resolution') && (<th style={{ ...thSortable, width: 60, padding: tdPad }} onClick={() => toggleSort('resolution')} aria-sort={sortKey === 'resolution' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>Res.{sortIndicator('resolution')}</th>)}
              {visibleCols.has('duration') && (<th style={{ ...thSortable, width: 55, padding: tdPad }} onClick={() => toggleSort('duration')} aria-sort={sortKey === 'duration' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>Dur.{sortIndicator('duration')}</th>)}
              {visibleCols.has('codec') && (<th style={{ ...thBase, width: 60, padding: tdPad }}>Codec</th>)}
              {visibleCols.has('fps') && (<th style={{ ...thBase, width: 45, padding: tdPad }}>FPS</th>)}
              {visibleCols.has('status') && (<th style={{ ...thBase, width: 80, padding: tdPad }}>Status</th>)}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (<tr><td colSpan={visibleCols.size} style={{ padding: 40, textAlign: 'center', color: 'var(--gem-muted)', fontSize: 13 }}>No assets match your filters.</td></tr>)}
            {sorted.map(asset => (
              <BRollTableRow key={asset.id} asset={asset} selected={selectedId === asset.id} checked={checked.has(asset.id)} visibleCols={visibleCols} tdPad={tdPad} onSelect={() => onSelect(asset.id)} onCheck={e => toggleCheck(asset.id, e)} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
