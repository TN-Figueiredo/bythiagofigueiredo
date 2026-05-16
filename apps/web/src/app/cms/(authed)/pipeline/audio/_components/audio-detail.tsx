'use client'

import { useState, useEffect, useCallback } from 'react'
import type { AudioAssetRow, AudioAssetUsageRow } from '@/lib/pipeline/audio-schemas'
import { Waveform } from './waveform'

interface AudioDetailProps {
  assetId: string
  onClose: () => void
  fullWidth?: boolean
}

type AssetWithUsage = AudioAssetRow & { usage: AudioAssetUsageRow[] }

interface EditDraft {
  track_name: string
  category: string
  tags: string
  mood: string
  energy: string
  status: 'downloaded' | 'pending' | 'retired'
  priority: string
}

const inputStyle: React.CSSProperties = {
  fontSize: 12,
  padding: '2px 6px',
  background: 'var(--gem-surface-hi)',
  border: '1px solid var(--gem-border)',
  color: 'var(--gem-text)',
  borderRadius: 4,
  width: '100%',
  boxSizing: 'border-box',
}

function assetToDraft(asset: AssetWithUsage): EditDraft {
  return {
    track_name: asset.track_name ?? '',
    category: asset.category ?? '',
    tags: asset.tags.join(', '),
    mood: asset.mood.join(', '),
    energy: asset.energy != null ? String(asset.energy) : '',
    status: asset.status,
    priority: asset.priority ?? '',
  }
}

export function AudioDetail({ assetId, onClose, fullWidth }: AudioDetailProps) {
  const [asset, setAsset] = useState<AssetWithUsage | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<EditDraft | null>(null)
  const [saving, setSaving] = useState(false)
  const [conflict, setConflict] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    fetch(`/api/pipeline/audio-library/${assetId}`, { signal: controller.signal })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(json => { if (!controller.signal.aborted) { setAsset(json.data); setLoading(false) } })
      .catch(e => {
        if (e instanceof DOMException && e.name === 'AbortError') return
        if (!controller.signal.aborted) { setError('Failed to load asset'); setLoading(false) }
      })
    return () => controller.abort()
  }, [assetId])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        if (editing) { setEditing(false); setDraft(null); setConflict(false) }
        else onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, editing])

  const handleEditStart = useCallback(() => {
    if (!asset) return
    setDraft(assetToDraft(asset))
    setConflict(false)
    setError(null)
    setEditing(true)
  }, [asset])

  const handleCancel = useCallback(() => {
    setEditing(false)
    setDraft(null)
    setConflict(false)
    setError(null)
  }, [])

  const handleSave = useCallback(async () => {
    if (!asset || !draft) return
    setSaving(true)
    setConflict(false)
    setError(null)
    try {
      const energyNum = draft.energy !== '' ? parseInt(draft.energy, 10) : null
      const energy = energyNum != null && !isNaN(energyNum) && energyNum >= 1 && energyNum <= 5 ? energyNum : null
      const body = {
        track_name: draft.track_name || null,
        category: draft.category || null,
        tags: draft.tags.split(',').map(s => s.trim()).filter(Boolean),
        mood: draft.mood.split(',').map(s => s.trim()).filter(Boolean),
        energy,
        status: draft.status,
        priority: draft.priority || null,
        version: asset.version,
      }
      const res = await fetch(`/api/pipeline/audio-library/${asset.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.status === 409) {
        setConflict(true)
        return
      }
      if (!res.ok) throw new Error(`PATCH failed: ${res.status}`)
      const json = await res.json() as { data: AssetWithUsage }
      setAsset(json.data)
      setEditing(false)
      setDraft(null)
    } catch {
      setError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }, [asset, draft])

  const setField = useCallback(<K extends keyof EditDraft>(key: K, value: EditDraft[K]) => {
    setDraft(prev => prev ? { ...prev, [key]: value } : prev)
  }, [])

  if (loading) return <div style={{ width: fullWidth ? '100%' : 400, borderLeft: '1px solid var(--gem-border)', padding: 20, color: 'var(--gem-muted)' }}>Loading...</div>
  if (!asset) return <div style={{ width: fullWidth ? '100%' : 400, borderLeft: '1px solid var(--gem-border)', padding: 20, color: 'var(--gem-muted)' }}>{error || 'Not found'}</div>

  const wf = asset.metadata?.waveform as { peaks?: number[] } | undefined
  const peaks = wf?.peaks ?? []

  return (
    <div style={{ width: fullWidth ? '100%' : 400, minWidth: fullWidth ? undefined : 400, borderLeft: '1px solid var(--gem-border)', overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--gem-text)', margin: 0 }}>
          {editing && draft ? (
            <input
              value={draft.track_name}
              onChange={e => setField('track_name', e.target.value)}
              placeholder={asset.asset_id}
              style={{ ...inputStyle, fontSize: 14, fontWeight: 600 }}
            />
          ) : (
            asset.track_name || asset.asset_id
          )}
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {!editing && (
            <button
              aria-label="Edit asset"
              onClick={handleEditStart}
              style={{ background: 'none', border: '1px solid var(--gem-border)', color: 'var(--gem-muted)', cursor: 'pointer', fontSize: 11, padding: '2px 8px', borderRadius: 4 }}
            >
              Edit
            </button>
          )}
          {editing && (
            <>
              <button
                aria-label="Save changes"
                onClick={handleSave}
                disabled={saving}
                style={{ background: 'var(--gem-accent)', border: 'none', color: '#fff', cursor: saving ? 'wait' : 'pointer', fontSize: 11, padding: '2px 8px', borderRadius: 4, opacity: saving ? 0.6 : 1 }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                aria-label="Cancel editing"
                onClick={handleCancel}
                disabled={saving}
                style={{ background: 'none', border: '1px solid var(--gem-border)', color: 'var(--gem-muted)', cursor: 'pointer', fontSize: 11, padding: '2px 8px', borderRadius: 4 }}
              >
                Cancel
              </button>
            </>
          )}
          <button aria-label="Close detail panel" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--gem-muted)', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>
      </div>

      {/* Conflict alert */}
      {conflict && (
        <div role="alert" style={{ fontSize: 12, color: '#f87171', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 4, padding: '6px 10px' }}>
          Asset was modified by another user. Please refresh.
        </div>
      )}

      {/* Save error alert */}
      {error && (
        <div role="alert" style={{ fontSize: 12, color: '#fb923c', background: 'rgba(251,146,60,0.1)', border: '1px solid rgba(251,146,60,0.3)', borderRadius: 4, padding: '6px 10px' }}>
          {error}
        </div>
      )}

      {/* Waveform */}
      <Waveform peaks={peaks} width={360} height={80} color={asset.type === 'music' ? 'purple' : 'cyan'} duration={asset.duration_seconds ?? undefined} />

      {/* Identity */}
      <Section title="Identity">
        <Row label="Asset ID" value={asset.asset_id} />
        <Row label="Artist" value={asset.artist} />
        <Row label="Source" value={asset.source} />
        {asset.artlist_url && <Row label="Artlist" value={<a href={asset.artlist_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gem-accent)', textDecoration: 'none' }}>Open ↗</a>} />}
      </Section>

      {/* Classification */}
      <Section title="Classification">
        <Row label="Type" value={asset.type === 'music' ? '🎵 Music' : '🔊 SFX'} />
        {editing && draft ? (
          <>
            <EditRow label="Category">
              <input value={draft.category} onChange={e => setField('category', e.target.value)} style={inputStyle} />
            </EditRow>
            {asset.genre && <Row label="Genre" value={asset.genre} />}
            <EditRow label="Tags">
              <input value={draft.tags} onChange={e => setField('tags', e.target.value)} placeholder="comma-separated" style={inputStyle} />
            </EditRow>
            <EditRow label="Mood">
              <input value={draft.mood} onChange={e => setField('mood', e.target.value)} placeholder="comma-separated" style={inputStyle} />
            </EditRow>
          </>
        ) : (
          <>
            <Row label="Category" value={asset.category} />
            {asset.genre && <Row label="Genre" value={asset.genre} />}
            <Row label="Tags" value={asset.tags.join(', ')} />
            <Row label="Mood" value={asset.mood.join(', ')} />
          </>
        )}
      </Section>

      {/* Audio */}
      <Section title="Audio">
        <Row label="Duration" value={asset.duration_seconds ? `${asset.duration_seconds}s` : '—'} />
        <Row label="BPM" value={asset.bpm ? String(asset.bpm) : '—'} />
        <Row label="Key" value={asset.music_key ?? '—'} />
        {editing && draft ? (
          <EditRow label="Energy">
            <input
              type="number"
              min={1}
              max={5}
              value={draft.energy}
              onChange={e => setField('energy', e.target.value)}
              style={{ ...inputStyle, width: 60 }}
            />
          </EditRow>
        ) : (
          <Row label="Energy" value={asset.energy ? `${'●'.repeat(asset.energy)}${'○'.repeat(5 - asset.energy)}` : '—'} />
        )}
        <Row label="Instruments" value={asset.instruments.join(', ')} />
      </Section>

      {/* Status & Priority */}
      <Section title="Status">
        {editing && draft ? (
          <>
            <EditRow label="Status">
              <select value={draft.status} onChange={e => setField('status', e.target.value as EditDraft['status'])} style={inputStyle}>
                <option value="downloaded">downloaded</option>
                <option value="pending">pending</option>
                <option value="retired">retired</option>
              </select>
            </EditRow>
            <EditRow label="Priority">
              <select value={draft.priority} onChange={e => setField('priority', e.target.value)} style={inputStyle}>
                <option value="">—</option>
                <option value="essential">essential</option>
                <option value="nice_to_have">nice to have</option>
                <option value="optional">optional</option>
              </select>
            </EditRow>
          </>
        ) : (
          <>
            <Row label="Status" value={asset.status} />
            <Row label="Priority" value={asset.priority} />
          </>
        )}
      </Section>

      {/* Metadata */}
      {Boolean(asset.metadata?.mix_notes || asset.metadata?.pairs_well_with || asset.metadata?.avoid_with) && (
        <Section title="Notes">
          {typeof asset.metadata.mix_notes === 'string' && <Row label="Mix Notes" value={asset.metadata.mix_notes} />}
          {Array.isArray(asset.metadata.pairs_well_with) && (asset.metadata.pairs_well_with as string[]).length > 0 && (
            <Row label="Pairs with" value={(asset.metadata.pairs_well_with as string[]).join(', ')} />
          )}
          {Array.isArray(asset.metadata.avoid_with) && (asset.metadata.avoid_with as string[]).length > 0 && (
            <Row label="Avoid with" value={(asset.metadata.avoid_with as string[]).join(', ')} />
          )}
        </Section>
      )}

      {/* Usage */}
      <Section title={`Usage (${asset.usage.length})`}>
        {asset.usage.length === 0 && <span style={{ fontSize: 11, color: 'var(--gem-muted)' }}>Not used in any project yet</span>}
        {asset.usage.map((u) => (
          <div key={u.id} style={{ fontSize: 11, color: 'var(--gem-text)', marginBottom: 4 }}>
            {u.content_pipeline?.code ?? u.pipeline_item_id} — scene {u.scene_number ?? '?'} ({u.usage_type})
          </div>
        ))}
      </Section>

      {/* Raw Metadata */}
      {Object.keys(asset.metadata).length > 0 && <MetadataViewer metadata={asset.metadata} />}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 style={{ fontSize: 10, fontWeight: 600, color: 'var(--gem-muted)', textTransform: 'uppercase', marginBottom: 6 }}>{title}</h4>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
      <span style={{ color: 'var(--gem-muted)' }}>{label}</span>
      <span style={{ color: 'var(--gem-text)', textAlign: 'right', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value || '—'}</span>
    </div>
  )
}

function EditRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, marginBottom: 5, gap: 8 }}>
      <span style={{ color: 'var(--gem-muted)', flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  )
}

function MetadataViewer({ metadata }: { metadata: Record<string, unknown> }) {
  const [open, setOpen] = useState(false)
  const toggle = useCallback(() => setOpen(v => !v), [])

  return (
    <div>
      <button onClick={toggle} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
        <h4 style={{ fontSize: 10, fontWeight: 600, color: 'var(--gem-muted)', textTransform: 'uppercase', margin: 0 }}>Metadata</h4>
        <span style={{ fontSize: 10, color: 'var(--gem-muted)' }}>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <pre style={{ fontSize: 10, color: 'var(--gem-text)', background: 'rgba(0,0,0,0.2)', padding: 8, borderRadius: 4, overflow: 'auto', maxHeight: 200, marginTop: 6, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {JSON.stringify(metadata, null, 2)}
        </pre>
      )}
    </div>
  )
}
