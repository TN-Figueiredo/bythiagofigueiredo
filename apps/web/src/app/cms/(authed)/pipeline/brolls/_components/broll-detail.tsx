'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { BRollAssetRow, BRollUsageRow } from '@/lib/pipeline/broll-schemas'
import { FrameStrip } from './frame-strip'
import {
  formatDuration,
  formatFileSize,
  sourceTypeConfig,
  categoryConfig,
  similarityScore,
} from '../_helpers/broll-helpers'
import type { BRollFilterState } from '../_helpers/use-broll-filters'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BRollDetailProps {
  assetId: string
  allAssets: BRollAssetRow[]
  onClose: () => void
  onFilter: (partial: Partial<BRollFilterState>) => void
  fullWidth?: boolean
}

type Tab = 'details' | 'usage' | 'related' | 'raw'

type AssetWithUsage = BRollAssetRow & { usage: BRollUsageRow[] }

interface EditDraft {
  description: string
  category: string
  tags: string
  source_type: 'pessoal' | 'generico'
  status: 'available' | 'pending' | 'retired'
  location: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_DOT: Record<string, string> = { available: '#22c55e', pending: '#eab308', retired: '#9ca3af' }
const STATUS_LABELS: Record<string, string> = { available: 'Available', pending: 'Pending', retired: 'Retired' }

function assetToDraft(asset: AssetWithUsage): EditDraft {
  return {
    description: asset.description ?? '',
    category: asset.category ?? '',
    tags: asset.tags.join(', '),
    source_type: asset.source_type,
    status: asset.status,
    location: asset.location ?? '',
  }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16 }}>
      {[100, 72, 36, 80, 60, 60].map((h, i) => (
        <div key={i} style={{ height: h, borderRadius: 6, background: 'var(--gem-well)', opacity: 0.6, animation: 'pulse-subtle 1.6s ease-in-out infinite', animationDelay: `${i * 0.1}s` }} />
      ))}
    </div>
  )
}

function Chip({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <span role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick() } : undefined}
      style={{ display: 'inline-block', fontSize: 10, padding: '2px 7px', borderRadius: 10, background: 'var(--gem-well)', border: '1px solid var(--gem-border)', color: 'var(--gem-text)', cursor: onClick ? 'pointer' : 'default', lineHeight: 1.6, userSelect: 'none', transition: 'opacity 0.15s' }}>
      {label}
    </span>
  )
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'var(--gem-well)', border: '1px solid var(--gem-border)', color: 'var(--gem-text)', lineHeight: 1.6, whiteSpace: 'nowrap' }}>
      {children}
    </span>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (<h4 style={{ fontSize: 9, fontWeight: 700, color: 'var(--gem-dim)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 6px 0' }}>{children}</h4>)
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 11 }}><span style={{ color: 'var(--gem-dim)', flexShrink: 0 }}>{label}</span><div style={{ flex: 1, textAlign: 'right' }}>{children}</div></div>)
}

function DimValue({ children }: { children: React.ReactNode }) {
  return <span style={{ color: 'var(--gem-text)', fontSize: 11 }}>{children}</span>
}

const inputBase: React.CSSProperties = { fontSize: 12, padding: '3px 7px', background: 'var(--gem-surface-hi)', border: '1px solid var(--gem-border)', color: 'var(--gem-text)', borderRadius: 4, width: '100%', boxSizing: 'border-box' }

// ─── Tab panels ──────────────────────────────────────────────────────────────

function DetailsPanel({ asset, editing, draft, setField, onFilter }: {
  asset: AssetWithUsage; editing: boolean; draft: EditDraft | null
  setField: <K extends keyof EditDraft>(k: K, v: EditDraft[K]) => void
  onFilter: (partial: Partial<BRollFilterState>) => void
}) {
  const cat = categoryConfig(asset.category)
  const srcCfg = sourceTypeConfig(asset.source_type)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '12px 14px 20px' }}>
      {/* Classification */}
      <section>
        <SectionLabel>Classification</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <DetailRow label="Category">
            {editing && draft ? (
              <select value={draft.category} onChange={(e) => setField('category', e.target.value)} style={inputBase}>
                {['', 'travel', 'urban', 'nature', 'tech', 'food', 'lifestyle', 'abstract'].map(c => (<option key={c} value={c}>{c || '--'}</option>))}
              </select>
            ) : asset.category ? (
              <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 8, background: cat.badgeBg, color: cat.badgeColor, fontWeight: 600 }}>{asset.category}</span>
            ) : <DimValue>--</DimValue>}
          </DetailRow>
          <DetailRow label="Source Type">
            {editing && draft ? (
              <select value={draft.source_type} onChange={(e) => setField('source_type', e.target.value as 'pessoal' | 'generico')} style={inputBase}>
                <option value="pessoal">Pessoal</option>
                <option value="generico">Generico</option>
              </select>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: srcCfg.dotColor }} />
                {srcCfg.label}
              </span>
            )}
          </DetailRow>
          <DetailRow label="Source"><DimValue>{asset.source || '--'}</DimValue></DetailRow>
          <DetailRow label="Location">
            {editing && draft ? (
              <input value={draft.location} onChange={(e) => setField('location', e.target.value)} placeholder="e.g., Vancouver, Canada" style={inputBase} />
            ) : <DimValue>{asset.location || '--'}</DimValue>}
          </DetailRow>
        </div>
      </section>
      {/* Video Properties */}
      <section>
        <SectionLabel>Video</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <DetailRow label="Resolution"><DimValue>{asset.resolution === '4k' ? '4K' : asset.resolution}</DimValue></DetailRow>
          {asset.width && asset.height && <DetailRow label="Dimensions"><DimValue>{asset.width}x{asset.height}</DimValue></DetailRow>}
          <DetailRow label="Duration"><DimValue>{formatDuration(asset.duration_seconds)}</DimValue></DetailRow>
          <DetailRow label="Codec"><DimValue>{asset.codec ?? '--'}</DimValue></DetailRow>
          <DetailRow label="FPS"><DimValue>{asset.fps ?? '--'}</DimValue></DetailRow>
          <DetailRow label="Bitrate"><DimValue>{asset.bitrate_kbps ? `${asset.bitrate_kbps} kbps` : '--'}</DimValue></DetailRow>
          <DetailRow label="File Size"><DimValue>{formatFileSize(asset.file_size_bytes)}</DimValue></DetailRow>
        </div>
      </section>
      {/* Description */}
      <section>
        <SectionLabel>Description</SectionLabel>
        {editing && draft ? (
          <textarea value={draft.description} onChange={(e) => setField('description', e.target.value)} rows={3}
            style={{ ...inputBase, resize: 'vertical', fontFamily: 'inherit' }} />
        ) : (
          <div style={{ fontSize: 11, color: asset.description ? 'var(--gem-text)' : 'var(--gem-dim)', lineHeight: 1.6 }}>
            {asset.description || 'No description'}
          </div>
        )}
      </section>
      {/* Tags */}
      {(editing ? true : asset.tags.length > 0) && (
        <section>
          <SectionLabel>Tags</SectionLabel>
          {editing && draft ? (
            <input value={draft.tags} onChange={(e) => setField('tags', e.target.value)} placeholder="comma-separated" style={inputBase} />
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {asset.tags.map(tag => (<Chip key={tag} label={tag} onClick={() => onFilter({ q: tag })} />))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

function UsagePanel({ asset }: { asset: AssetWithUsage }) {
  if (asset.usage.length === 0) {
    return (<div style={{ padding: '20px 14px', fontSize: 11, color: 'var(--gem-dim)', textAlign: 'center' }}>Not used in any project yet.</div>)
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '12px 14px' }}>
      {asset.usage.map(u => (
        <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', borderRadius: 6, background: 'var(--gem-well)', border: '1px solid var(--gem-border)', fontSize: 11, color: 'var(--gem-text)' }}>
          <span style={{ fontWeight: 600 }}>{u.content_pipeline?.code ?? u.pipeline_item_id}</span>
          <span style={{ color: 'var(--gem-dim)', fontSize: 10 }}>
            {u.beat_index != null ? `Beat ${u.beat_index}` : ''} {u.timecode_in ? `· ${u.timecode_in}` : ''} {`· ${u.usage_type}`}
          </span>
        </div>
      ))}
    </div>
  )
}

function RelatedPanel({ asset, allAssets, onFilter }: { asset: AssetWithUsage; allAssets: BRollAssetRow[]; onFilter: (partial: Partial<BRollFilterState>) => void }) {
  const related = allAssets
    .filter(a => a.id !== asset.id)
    .map(a => ({ asset: a, score: similarityScore(asset, a) }))
    .sort((x, y) => y.score - x.score)
    .slice(0, 5)

  if (related.length === 0) return (<div style={{ padding: '20px 14px', fontSize: 11, color: 'var(--gem-dim)', textAlign: 'center' }}>No related assets found.</div>)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 14px' }}>
      {related.map(({ asset: rel, score }) => {
        const rCat = categoryConfig(rel.category)
        return (
          <div key={rel.id} style={{ padding: '7px 10px', borderRadius: 6, background: 'var(--gem-well)', border: '1px solid var(--gem-border)', display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--gem-text)' }}>{rel.renamed_to ?? rel.original_filename}</span>
              {rel.category && (<span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 8, background: rCat.badgeBg, color: rCat.badgeColor, fontWeight: 600 }}>{rel.category}</span>)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, height: 3, borderRadius: 3, background: 'var(--gem-border)', overflow: 'hidden' }}>
                <div style={{ width: `${score}%`, height: '100%', background: 'var(--gem-accent)', borderRadius: 3, transition: 'width 0.4s ease' }} />
              </div>
              <span style={{ fontSize: 10, color: 'var(--gem-dim)', minWidth: 32, textAlign: 'right' }}>{score}%</span>
            </div>
          </div>
        )
      })}
      <div style={{ paddingTop: 4, fontSize: 10, color: 'var(--gem-dim)', textAlign: 'center' }}>Scores based on category, tags, resolution, source, duration, location</div>
    </div>
  )
}

function RawPanel({ asset }: { asset: AssetWithUsage }) {
  const [jsonOpen, setJsonOpen] = useState(false)
  const raw = { asset_id: asset.asset_id, file_path: asset.renamed_to ?? asset.original_filename, sha256: asset.sha256, version: asset.version }
  return (
    <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[
        { label: 'Asset ID', value: asset.asset_id },
        { label: 'File Path', value: asset.renamed_to ?? asset.original_filename },
        ...(asset.sha256 ? [{ label: 'SHA-256', value: asset.sha256 }] : []),
      ].map(item => (
        <div key={item.label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 10, color: 'var(--gem-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</span>
          <code style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--gem-text)', wordBreak: 'break-all' }}>{item.value}</code>
        </div>
      ))}
      <div style={{ marginTop: 4 }}>
        <button onClick={() => setJsonOpen(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--gem-dim)', fontSize: 10 }}>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{jsonOpen ? '▾' : '▸'}</span><span>JSON</span>
        </button>
        {jsonOpen && (
          <pre style={{ fontSize: 9, fontFamily: 'monospace', color: 'var(--gem-text)', background: 'var(--gem-well)', border: '1px solid var(--gem-border)', borderRadius: 4, padding: 8, overflowX: 'auto', overflowY: 'auto', maxHeight: 160, marginTop: 6, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {JSON.stringify(raw, null, 2)}
          </pre>
        )}
      </div>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export function BRollDetail({ assetId, allAssets, onClose, onFilter, fullWidth }: BRollDetailProps) {
  const [asset, setAsset] = useState<AssetWithUsage | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('details')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<EditDraft | null>(null)
  const [saving, setSaving] = useState(false)
  const [conflict, setConflict] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const editingRef = useRef(editing)
  editingRef.current = editing

  // Fetch asset
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setFetchError(null); setAsset(null)
    fetch(`/api/pipeline/broll-library/${assetId}`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<{ data: AssetWithUsage }> })
      .then(json => { if (!controller.signal.aborted) { setAsset(json.data); setLoading(false) } })
      .catch((e: unknown) => { if (e instanceof DOMException && e.name === 'AbortError') return; if (!controller.signal.aborted) { setFetchError('Failed to load asset'); setLoading(false) } })
    return () => controller.abort()
  }, [assetId])

  // Keyboard: Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      e.stopImmediatePropagation()
      if (editingRef.current) { setEditing(false); setDraft(null); setConflict(false); setSaveError(null) }
      else onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleEditStart = useCallback(() => { if (!asset) return; setDraft(assetToDraft(asset)); setConflict(false); setSaveError(null); setEditing(true) }, [asset])
  const handleCancel = useCallback(() => { setEditing(false); setDraft(null); setConflict(false); setSaveError(null) }, [])
  const setField = useCallback(<K extends keyof EditDraft>(key: K, value: EditDraft[K]) => { setDraft(prev => prev ? { ...prev, [key]: value } : prev) }, [])

  const handleSave = useCallback(async (force = false) => {
    if (!asset || !draft) return
    setSaving(true); setConflict(false); setSaveError(null)
    try {
      const body: Record<string, unknown> = {
        description: draft.description || null,
        category: draft.category || null,
        tags: draft.tags.split(',').map(s => s.trim()).filter(Boolean),
        source_type: draft.source_type,
        status: draft.status,
        location: draft.location || null,
        version: asset.version,
      }
      if (force) body['force'] = true
      const res = await fetch(`/api/pipeline/broll-library/${asset.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (res.status === 409) { setConflict(true); return }
      if (!res.ok) throw new Error(`PATCH failed: ${res.status}`)
      const json = await res.json() as { data: AssetWithUsage }
      setAsset(json.data); setEditing(false); setDraft(null)
    } catch { setSaveError('Failed to save. Please try again.') }
    finally { setSaving(false) }
  }, [asset, draft])

  // Derived
  const frames = asset ? (Array.isArray((asset.metadata as Record<string, unknown>)?.frame_strip)
    ? ((asset.metadata as Record<string, unknown>).frame_strip as Array<{ url: string; timestamp: number }>)
    : null) : null
  const hasUsage = (asset?.usage.length ?? 0) > 0

  const panelStyle: React.CSSProperties = {
    width: fullWidth ? '100%' : 360, minWidth: fullWidth ? undefined : 360, maxWidth: fullWidth ? undefined : 360,
    display: 'flex', flexDirection: 'column', borderRadius: 10, border: '1px solid var(--gem-border)',
    background: 'var(--gem-surface)', overflow: 'hidden', flexShrink: 0,
  }

  if (loading) return (<div style={panelStyle}><Skeleton /></div>)
  if (fetchError || !asset) {
    return (
      <div style={{ ...panelStyle, padding: 20, gap: 10, display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 12, color: 'var(--gem-danger, #f87171)' }}>{fetchError ?? 'Asset not found'}</span>
        <button onClick={onClose} style={{ fontSize: 11, background: 'none', border: '1px solid var(--gem-border)', color: 'var(--gem-muted)', cursor: 'pointer', borderRadius: 4, padding: '3px 10px', alignSelf: 'flex-start' }}>Close</button>
      </div>
    )
  }

  const srcCfg = sourceTypeConfig(asset.source_type)
  const statusColor = STATUS_DOT[asset.status] ?? '#9ca3af'
  const statusLabel = STATUS_LABELS[asset.status] ?? asset.status

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={{ flexShrink: 0, padding: '12px 14px 0', display: 'flex', flexDirection: 'column', gap: 8, borderBottom: '1px solid var(--gem-border)', background: 'var(--gem-surface)', position: 'sticky', top: 0, zIndex: 2 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--gem-text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {asset.renamed_to ?? asset.original_filename}
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--gem-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {[asset.source, asset.asset_id, `v${asset.version}`].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            {editing ? (
              <>
                <button aria-label="Save changes" onClick={() => handleSave(false)} disabled={saving} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 4, background: 'var(--gem-accent)', color: '#fff', border: 'none', cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving...' : 'Save'}</button>
                <button aria-label="Cancel editing" onClick={handleCancel} disabled={saving} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: 'none', border: '1px solid var(--gem-border)', color: 'var(--gem-muted)', cursor: 'pointer' }}>Cancel</button>
              </>
            ) : (
              <button aria-label="Edit asset" onClick={handleEditStart} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: 'none', border: '1px solid var(--gem-border)', color: 'var(--gem-muted)', cursor: 'pointer' }}>Edit</button>
            )}
            <button aria-label="Close detail panel" onClick={onClose} style={{ fontSize: 14, padding: '2px 6px', borderRadius: 4, background: 'none', border: 'none', color: 'var(--gem-muted)', cursor: 'pointer', lineHeight: 1 }}>&#x2715;</button>
          </div>
        </div>

        {/* Conflict alert */}
        {conflict && (
          <div role="alert" style={{ fontSize: 11, color: 'var(--gem-danger, #f87171)', background: 'color-mix(in srgb, var(--gem-danger, #f87171) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--gem-danger, #f87171) 30%, transparent)', borderRadius: 4, padding: '5px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Asset was modified. Merge or force save?</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => {
                setConflict(false); setEditing(false); setDraft(null); setLoading(true)
                fetch(`/api/pipeline/broll-library/${assetId}`)
                  .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<{ data: AssetWithUsage }> })
                  .then(json => { setAsset(json.data); setLoading(false) })
                  .catch(() => { setSaveError('Failed to refresh. Please try again.'); setLoading(false) })
              }} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: 'none', border: '1px solid var(--gem-danger, #f87171)', color: 'var(--gem-danger, #f87171)', cursor: 'pointer' }}>Refresh &amp; merge</button>
              <button onClick={() => handleSave(true)} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: 'color-mix(in srgb, var(--gem-danger, #f87171) 20%, transparent)', border: '1px solid var(--gem-danger, #f87171)', color: 'var(--gem-danger, #f87171)', cursor: 'pointer' }}>Force save</button>
            </div>
          </div>
        )}
        {saveError && (<div role="alert" style={{ fontSize: 11, color: '#fb923c', background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.3)', borderRadius: 4, padding: '5px 10px' }}>{saveError}</div>)}

        {/* Status selector (edit mode) */}
        {editing && draft && (
          <div style={{ display: 'flex', gap: 4 }}>
            {(['available', 'pending', 'retired'] as const).map(s => (
              <button key={s} onClick={() => setField('status', s)} style={{ flex: 1, fontSize: 10, padding: '3px 0', borderRadius: 4, border: `1px solid ${draft.status === s ? STATUS_DOT[s] : 'var(--gem-border)'}`, background: draft.status === s ? `${STATUS_DOT[s]}22` : 'none', color: draft.status === s ? STATUS_DOT[s] : 'var(--gem-muted)', cursor: 'pointer', fontWeight: draft.status === s ? 600 : 400, transition: 'all 0.15s' }}>{STATUS_LABELS[s]}</button>
            ))}
          </div>
        )}

        {/* Quick stats pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, paddingBottom: 10 }}>
          <Pill>{asset.resolution === '4k' ? '4K' : asset.resolution}</Pill>
          {asset.duration_seconds != null && <Pill>{formatDuration(asset.duration_seconds)}</Pill>}
          {asset.codec && <Pill>{asset.codec.toUpperCase()}</Pill>}
          {asset.fps && <Pill>{asset.fps}fps</Pill>}
          {asset.file_size_bytes && <Pill>{formatFileSize(asset.file_size_bytes)}</Pill>}
          <Pill><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: statusColor, flexShrink: 0 }} /><span>{statusLabel}</span></Pill>
          <Pill><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: srcCfg.dotColor, flexShrink: 0 }} /><span>{srcCfg.label}</span></Pill>
        </div>
      </div>

      {/* FrameStrip */}
      <div style={{ flexShrink: 0, padding: '8px 14px 0', background: 'var(--gem-surface)', position: 'sticky', top: 0, zIndex: 1 }}>
        <FrameStrip variant="detail" frames={frames} duration={asset.duration_seconds} resolution={asset.resolution} thumbnailUrl={asset.thumbnail_url} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--gem-dim)', marginTop: 3, marginBottom: 8 }}>
          <span>{formatDuration(asset.duration_seconds)}</span>
          <span>{frames ? `${frames.length} frames` : 'No frames'}</span>
        </div>
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="B-Roll detail tabs"
        style={{ flexShrink: 0, display: 'flex', borderBottom: '1px solid var(--gem-border)', background: 'var(--gem-surface)', position: 'sticky', top: 0, zIndex: 1, paddingLeft: 14, paddingRight: 14 }}
        onKeyDown={(e) => {
          const tabs: Tab[] = ['details', 'usage', 'related', 'raw']
          const currentIndex = tabs.indexOf(activeTab)
          if (e.key === 'ArrowRight') {
            e.preventDefault()
            const next = tabs[(currentIndex + 1) % tabs.length]!
            setActiveTab(next)
            ;(e.currentTarget.querySelector(`[id="tab-${next}"]`) as HTMLElement | null)?.focus()
          } else if (e.key === 'ArrowLeft') {
            e.preventDefault()
            const prev = tabs[(currentIndex - 1 + tabs.length) % tabs.length]!
            setActiveTab(prev)
            ;(e.currentTarget.querySelector(`[id="tab-${prev}"]`) as HTMLElement | null)?.focus()
          }
        }}
      >
        {(['details', 'usage', 'related', 'raw'] as Tab[]).map(tab => {
          const active = activeTab === tab
          return (
            <button
              key={tab}
              id={`tab-${tab}`}
              role="tab"
              aria-selected={active}
              aria-controls={`panel-${tab}`}
              tabIndex={active ? 0 : -1}
              onClick={() => setActiveTab(tab)}
              style={{ fontSize: 11, padding: '7px 10px', background: 'none', border: 'none', borderBottom: active ? '2px solid var(--gem-accent)' : '2px solid transparent', color: active ? 'var(--gem-text)' : 'var(--gem-dim)', fontWeight: active ? 600 : 400, cursor: 'pointer', position: 'relative', transition: 'color 0.15s', whiteSpace: 'nowrap' }}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'usage' && hasUsage && (<span style={{ position: 'absolute', top: 5, right: 3, width: 6, height: 6, borderRadius: '50%', background: '#3b82f6', display: 'block' }} />)}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div
        id={`panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
        style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}
      >
        {activeTab === 'details' && <DetailsPanel asset={asset} editing={editing} draft={draft} setField={setField} onFilter={onFilter} />}
        {activeTab === 'usage' && <UsagePanel asset={asset} />}
        {activeTab === 'related' && <RelatedPanel asset={asset} allAssets={allAssets} onFilter={onFilter} />}
        {activeTab === 'raw' && <RawPanel asset={asset} />}
      </div>
    </div>
  )
}
