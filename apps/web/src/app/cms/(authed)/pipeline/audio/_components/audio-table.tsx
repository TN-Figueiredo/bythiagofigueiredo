'use client'

import { useState, useMemo, useCallback } from 'react'
import type { AudioAssetRow } from '@/lib/pipeline/audio-schemas'
import { WaveformMini } from './waveform-mini'

interface AudioTableProps {
  assets: AudioAssetRow[]
  selectedId: string | null
  onSelect: (id: string) => void
  onRefetch?: () => void
}

type SortKey = 'name' | 'type' | 'category' | 'tags' | 'energy' | 'bpm' | 'status'

const STATUS_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  downloaded: { label: 'Downloaded', bg: 'rgba(16,185,129,0.15)', color: '#10b981' },
  pending: { label: 'Pending', bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
  retired: { label: 'Retired', bg: 'rgba(107,114,128,0.15)', color: '#6b7280' },
}

export function AudioTable({ assets, selectedId, onSelect, onRefetch }: AudioTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortAsc, setSortAsc] = useState(true)
  const [checked, setChecked] = useState<Set<string>>(new Set())

  const sorted = useMemo(() => {
    const list = [...assets]
    if (sortKey === 'tags') {
      list.sort((a, b) => {
        const cmp = a.tags.length - b.tags.length
        return sortAsc ? cmp : -cmp
      })
    } else {
      const key = sortKey === 'name' ? 'track_name' : sortKey
      list.sort((a, b) => {
        const va = a[key] ?? ''
        const vb = b[key] ?? ''
        const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb))
        return sortAsc ? cmp : -cmp
      })
    }
    return list
  }, [assets, sortKey, sortAsc])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc)
    else { setSortKey(key); setSortAsc(true) }
  }

  const toggleCheck = useCallback((id: string) => {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    if (checked.size === sorted.length) setChecked(new Set())
    else setChecked(new Set(sorted.map(a => a.id)))
  }, [checked.size, sorted])

  const bulkAction = useCallback(async (action: 'tag' | 'category' | 'status' | 'delete' | 'export') => {
    const ids = Array.from(checked)
    if (ids.length === 0) return

    if (action === 'export') {
      const selected = assets.filter(a => checked.has(a.id))
      const blob = new Blob([JSON.stringify({ schema_version: '6.1.0', assets: selected }, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `audio-selection-${ids.length}.json`; a.click()
      URL.revokeObjectURL(url)
      return
    }

    if (action === 'delete') {
      if (!confirm(`Delete ${ids.length} assets?`)) return
      const results = await Promise.allSettled(ids.map(id => fetch(`/api/pipeline/audio-library/${id}`, { method: 'DELETE' })))
      const failed = results.filter(r => r.status === 'rejected').length
      if (failed > 0) alert(`${failed} of ${ids.length} deletes failed`)
      setChecked(new Set())
      onRefetch?.()
      return
    }

    const value = prompt(`Enter ${action} value for ${ids.length} assets:`)
    if (!value) return
    const body: Record<string, unknown> = {}
    if (action === 'tag') body.tags = value.split(',').map(t => t.trim())
    else body[action] = value
    const results = await Promise.allSettled(ids.map(id => fetch(`/api/pipeline/audio-library/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, version: assets.find(a => a.id === id)?.version ?? 1 }),
    })))
    const failed = results.filter(r => r.status === 'rejected').length
    if (failed > 0) alert(`${failed} of ${ids.length} updates failed`)
    setChecked(new Set())
    onRefetch?.()
  }, [assets, checked, onRefetch])

  const headers: Array<{ key: SortKey; label: string; width?: number }> = [
    { key: 'name', label: 'Name' },
    { key: 'type', label: 'Type', width: 60 },
    { key: 'category', label: 'Category', width: 100 },
    { key: 'tags', label: 'Tags', width: 140 },
    { key: 'energy', label: 'Energy', width: 60 },
    { key: 'bpm', label: 'BPM', width: 60 },
    { key: 'status', label: 'Status', width: 90 },
  ]

  return (
    <div>
      {checked.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'rgba(99,102,241,0.08)', borderRadius: 6, marginBottom: 8, fontSize: 12 }}>
          <span style={{ color: 'var(--gem-text)', fontWeight: 600 }}>{checked.size} selected</span>
          <button onClick={() => bulkAction('tag')} style={{ padding: '2px 8px', borderRadius: 4, border: '1px solid var(--gem-border)', background: 'transparent', color: 'var(--gem-text)', cursor: 'pointer', fontSize: 11 }}>Tag</button>
          <button onClick={() => bulkAction('category')} style={{ padding: '2px 8px', borderRadius: 4, border: '1px solid var(--gem-border)', background: 'transparent', color: 'var(--gem-text)', cursor: 'pointer', fontSize: 11 }}>Category</button>
          <button onClick={() => bulkAction('status')} style={{ padding: '2px 8px', borderRadius: 4, border: '1px solid var(--gem-border)', background: 'transparent', color: 'var(--gem-text)', cursor: 'pointer', fontSize: 11 }}>Status</button>
          <button onClick={() => bulkAction('export')} style={{ padding: '2px 8px', borderRadius: 4, border: '1px solid var(--gem-border)', background: 'transparent', color: 'var(--gem-text)', cursor: 'pointer', fontSize: 11 }}>Export</button>
          <button onClick={() => bulkAction('delete')} style={{ padding: '2px 8px', borderRadius: 4, border: '1px solid var(--gem-border)', background: 'transparent', color: 'var(--gem-danger)', cursor: 'pointer', fontSize: 11 }}>Delete</button>
          <button onClick={() => setChecked(new Set())} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--gem-muted)', cursor: 'pointer', fontSize: 11 }}>Clear</button>
        </div>
      )}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--gem-border)' }}>
            <th style={{ width: 32, padding: '6px 4px' }}>
              <input type="checkbox" checked={checked.size === sorted.length && sorted.length > 0} onChange={toggleAll} />
            </th>
            <th style={{ width: 80, padding: '6px 8px' }} />
            {headers.map(h => (
              <th key={h.key} onClick={() => toggleSort(h.key)} style={{ padding: '6px 8px', textAlign: 'left', color: 'var(--gem-muted)', fontWeight: 600, cursor: 'pointer', width: h.width }}>
                {h.label}{sortKey === h.key ? (sortAsc ? ' ↑' : ' ↓') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((a) => {
            const wf = a.metadata?.waveform as { peaks?: number[] } | undefined
            const peaks = wf?.peaks ?? []
            const badge = STATUS_BADGE[a.status] ?? STATUS_BADGE.retired!
            return (
              <tr key={a.id} onClick={() => onSelect(a.id)} style={{ borderBottom: '1px solid var(--gem-border)', cursor: 'pointer', background: selectedId === a.id ? 'rgba(99,102,241,0.08)' : checked.has(a.id) ? 'rgba(99,102,241,0.04)' : 'transparent' }}>
                <td style={{ padding: '4px 4px' }} onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={checked.has(a.id)} onChange={() => toggleCheck(a.id)} />
                </td>
                <td style={{ padding: '4px 8px' }}><WaveformMini peaks={peaks} color={a.type === 'music' ? 'purple' : 'cyan'} /></td>
                <td style={{ padding: '4px 8px', color: 'var(--gem-text)' }}>{a.track_name || a.asset_id}</td>
                <td style={{ padding: '4px 8px', color: 'var(--gem-muted)' }}>{a.type === 'music' ? '🎵' : '🔊'}</td>
                <td style={{ padding: '4px 8px', color: 'var(--gem-muted)' }}>{a.category ?? '—'}</td>
                <td style={{ padding: '4px 8px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                    {a.tags.slice(0, 3).map(tag => (
                      <span key={tag} style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: 'rgba(99,102,241,0.1)', color: 'var(--gem-accent)' }}>{tag}</span>
                    ))}
                    {a.tags.length > 3 && (
                      <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: 'rgba(99,102,241,0.1)', color: 'var(--gem-accent)' }}>+{a.tags.length - 3}</span>
                    )}
                  </div>
                </td>
                <td style={{ padding: '4px 8px', color: 'var(--gem-muted)' }}>{a.energy ?? '—'}</td>
                <td style={{ padding: '4px 8px', color: 'var(--gem-muted)' }}>{a.bpm ?? '—'}</td>
                <td style={{ padding: '4px 8px' }}>
                  <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: badge.bg, color: badge.color }}>{badge.label}</span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
