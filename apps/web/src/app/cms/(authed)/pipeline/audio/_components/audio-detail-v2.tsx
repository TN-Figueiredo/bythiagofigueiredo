'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { AudioAssetRow, AudioAssetUsageRow } from '@/lib/pipeline/audio-schemas'
import { WaveformDisplay } from './waveform-display'
import {
  energyColor,
  formatDuration,
  categoryConfig,
  similarityScore,
} from '../_helpers/audio-helpers'
import type { AudioFilterState } from '../_helpers/use-audio-filters'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AudioDetailV2Props {
  assetId: string
  allAssets: AudioAssetRow[]
  onClose: () => void
  onFilter: (partial: Partial<AudioFilterState>) => void
  fullWidth?: boolean
}

type Tab = 'details' | 'usage' | 'related' | 'raw'

type AssetWithUsage = AudioAssetRow & { usage: AudioAssetUsageRow[] }

interface EditDraft {
  track_name: string
  category: string
  tags: string
  mood: string
  instruments: string
  energy: number | null
  status: 'downloaded' | 'pending' | 'retired'
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_DOT: Record<string, string> = {
  downloaded: '#22c55e',
  pending: '#eab308',
  retired: '#ef4444',
}

const STATUS_LABELS: Record<string, string> = {
  downloaded: 'Ready',
  pending: 'Pending',
  retired: 'Retired',
}

const KEY_NAMES: Record<string, string> = {
  C: 'C',  'C#': 'C# / Db', Db: 'C# / Db',
  D: 'D',  'D#': 'D# / Eb', Eb: 'D# / Eb',
  E: 'E',  F: 'F',
  'F#': 'F# / Gb', Gb: 'F# / Gb',
  G: 'G',  'G#': 'G# / Ab', Ab: 'G# / Ab',
  A: 'A',  'A#': 'A# / Bb', Bb: 'A# / Bb',
  B: 'B',
}

function fullKeyName(key: string | null | undefined): string {
  if (!key) return '—'
  const parts = key.split(' ')
  const root = parts[0] ?? key
  const mode = parts[1]
  const rootLabel = KEY_NAMES[root] ?? root
  if (!mode) return rootLabel
  return `${rootLabel} ${mode.charAt(0).toUpperCase()}${mode.slice(1)}`
}

function assetToDraft(asset: AssetWithUsage): EditDraft {
  return {
    track_name: asset.track_name ?? '',
    category: asset.category ?? '',
    tags: asset.tags.join(', '),
    mood: asset.mood.join(', '),
    instruments: asset.instruments.join(', '),
    energy: asset.energy ?? null,
    status: asset.status,
  }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16 }}>
      {[120, 72, 36, 80, 60, 60, 100].map((h, i) => (
        <div
          key={i}
          style={{
            height: h,
            borderRadius: 6,
            background: 'var(--gem-well)',
            opacity: 0.6,
            animation: 'pulse-subtle 1.6s ease-in-out infinite',
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}
    </div>
  )
}

function Chip({
  label,
  onClick,
  color,
}: {
  label: string
  onClick?: () => void
  color?: string
}) {
  return (
    <span
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick() } : undefined}
      style={{
        display: 'inline-block',
        fontSize: 10,
        padding: '2px 7px',
        borderRadius: 10,
        background: color ?? 'var(--gem-well)',
        border: '1px solid var(--gem-border)',
        color: 'var(--gem-text)',
        cursor: onClick ? 'pointer' : 'default',
        lineHeight: 1.6,
        userSelect: 'none',
        transition: 'opacity 0.15s',
      }}
    >
      {label}
    </span>
  )
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 10,
        padding: '2px 8px',
        borderRadius: 10,
        background: 'var(--gem-well)',
        border: '1px solid var(--gem-border)',
        color: 'var(--gem-text)',
        lineHeight: 1.6,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}

function EnergyBars({
  value,
  onSelect,
}: {
  value: number | null
  onSelect?: (n: number) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = value != null && n <= value
        const color = filled ? energyColor(value) : undefined
        return (
          <div
            key={n}
            role={onSelect ? 'button' : undefined}
            tabIndex={onSelect ? 0 : undefined}
            aria-label={onSelect ? `Energy ${n}` : undefined}
            onClick={onSelect ? () => onSelect(n) : undefined}
            onKeyDown={onSelect ? (e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(n) } : undefined}
            style={{
              width: 10,
              height: 20,
              borderRadius: 3,
              background: filled ? color : 'var(--gem-well)',
              border: `1px solid ${filled ? color ?? 'transparent' : 'var(--gem-border)'}`,
              opacity: filled ? 1 : 0.25,
              cursor: onSelect ? 'pointer' : 'default',
              transition: 'opacity 0.15s, background 0.15s',
            }}
          />
        )
      })}
    </div>
  )
}

function CollapsibleJson({ data }: { data: object }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          color: 'var(--gem-dim)',
          fontSize: 10,
        }}
      >
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{open ? '▾' : '▸'}</span>
        <span>JSON</span>
      </button>
      {open && (
        <pre
          style={{
            fontSize: 9,
            fontFamily: 'monospace',
            color: 'var(--gem-text)',
            background: 'var(--gem-well)',
            border: '1px solid var(--gem-border)',
            borderRadius: 4,
            padding: 8,
            overflowX: 'auto',
            overflowY: 'auto',
            maxHeight: 160,
            marginTop: 6,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}
        >
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  )
}

const inputBase: React.CSSProperties = {
  fontSize: 12,
  padding: '3px 7px',
  background: 'var(--gem-surface-hi)',
  border: '1px solid var(--gem-border)',
  color: 'var(--gem-text)',
  borderRadius: 4,
  width: '100%',
  boxSizing: 'border-box',
}

// ─── Tab panels ──────────────────────────────────────────────────────────────

function DetailsPanel({
  asset,
  editing,
  draft,
  setField,
  onFilter,
}: {
  asset: AssetWithUsage
  editing: boolean
  draft: EditDraft | null
  setField: <K extends keyof EditDraft>(k: K, v: EditDraft[K]) => void
  onFilter: (partial: Partial<AudioFilterState>) => void
}) {
  const cat = categoryConfig(asset.category)
  const pairsWellWith = Array.isArray(asset.metadata?.pairs_well_with) ? (asset.metadata.pairs_well_with as string[]) : []
  const avoidWith = Array.isArray(asset.metadata?.avoid_with) ? (asset.metadata.avoid_with as string[]) : []
  const notes = typeof asset.metadata?.mix_notes === 'string' ? asset.metadata.mix_notes : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '12px 14px 20px' }}>

      {/* Classification */}
      <section>
        <SectionLabel>Classification</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Category */}
          <DetailRow label="Category">
            {editing && draft ? (
              <select
                value={draft.category}
                onChange={(e) => setField('category', e.target.value)}
                style={inputBase}
              >
                {['', 'cinematic', 'ambient', 'electronic', 'impact', 'drop', 'riser'].map((c) => (
                  <option key={c} value={c}>{c || '—'}</option>
                ))}
              </select>
            ) : asset.category ? (
              <span
                style={{
                  fontSize: 11,
                  padding: '1px 8px',
                  borderRadius: 8,
                  background: cat.badgeBg,
                  color: cat.badgeColor,
                  fontWeight: 600,
                }}
              >
                {asset.category}
              </span>
            ) : <DimValue>—</DimValue>}
          </DetailRow>
          <DetailRow label="Genre"><DimValue>{asset.genre || '—'}</DimValue></DetailRow>
          <DetailRow label="Artist"><DimValue>{asset.artist || '—'}</DimValue></DetailRow>
          {asset.artlist_url && (
            <DetailRow label="Source">
              <a
                href={asset.artlist_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 11, color: 'var(--gem-accent)', textDecoration: 'none' }}
              >
                {asset.source} ↗
              </a>
            </DetailRow>
          )}
          {!asset.artlist_url && (
            <DetailRow label="Source"><DimValue>{asset.source}</DimValue></DetailRow>
          )}
        </div>
      </section>

      {/* Audio */}
      <section>
        <SectionLabel>Audio</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <DetailRow label="Energy">
            {editing && draft ? (
              <EnergyBars value={draft.energy} onSelect={(n) => setField('energy', n)} />
            ) : (
              <EnergyBars value={asset.energy} />
            )}
          </DetailRow>
          <DetailRow label="BPM"><DimValue>{asset.bpm ?? '—'}</DimValue></DetailRow>
          <DetailRow label="Key"><DimValue>{fullKeyName(asset.music_key)}</DimValue></DetailRow>
          <DetailRow label="Time Sig"><DimValue>{asset.time_signature}</DimValue></DetailRow>
          {asset.tempo_feel && <DetailRow label="Tempo Feel"><DimValue>{asset.tempo_feel}</DimValue></DetailRow>}
        </div>
      </section>

      {/* Instruments */}
      {(editing ? true : asset.instruments.length > 0) && (
        <section>
          <SectionLabel>Instruments</SectionLabel>
          {editing && draft ? (
            <input
              value={draft.instruments}
              onChange={(e) => setField('instruments', e.target.value)}
              placeholder="comma-separated"
              style={inputBase}
            />
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {asset.instruments.map((inst) => (
                <Chip
                  key={inst}
                  label={inst}
                  onClick={() => onFilter({ instruments: [inst] })}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Tags */}
      {(editing ? true : asset.tags.length > 0) && (
        <section>
          <SectionLabel>Tags</SectionLabel>
          {editing && draft ? (
            <input
              value={draft.tags}
              onChange={(e) => setField('tags', e.target.value)}
              placeholder="comma-separated"
              style={inputBase}
            />
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {asset.tags.map((tag) => (
                <Chip key={tag} label={tag} onClick={() => onFilter({ q: tag })} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Mood */}
      {(editing ? true : asset.mood.length > 0) && (
        <section>
          <SectionLabel>Mood</SectionLabel>
          {editing && draft ? (
            <input
              value={draft.mood}
              onChange={(e) => setField('mood', e.target.value)}
              placeholder="comma-separated"
              style={inputBase}
            />
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {asset.mood.map((m) => (
                <Chip key={m} label={m} onClick={() => onFilter({ mood: [m] })} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Notes */}
      {notes && (
        <section>
          <SectionLabel>Notes</SectionLabel>
          <div
            style={{
              fontSize: 11,
              color: 'var(--gem-text)',
              background: 'var(--gem-well)',
              border: '1px solid var(--gem-border)',
              borderRadius: 4,
              padding: '6px 10px',
              lineHeight: 1.6,
            }}
          >
            {notes}
          </div>
        </section>
      )}

      {/* Compatibility */}
      {(pairsWellWith.length > 0 || avoidWith.length > 0) && (
        <section>
          <SectionLabel>Compatibility</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {pairsWellWith.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 600, marginRight: 4 }}>Pairs well</span>
                {pairsWellWith.map((id) => (
                  <Chip key={id} label={id} />
                ))}
              </div>
            )}
            {avoidWith.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: '#f87171', fontWeight: 600, marginRight: 4 }}>Avoid</span>
                {avoidWith.map((id) => (
                  <Chip key={id} label={id} />
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}

function UsagePanel({ asset }: { asset: AssetWithUsage }) {
  if (asset.usage.length === 0) {
    return (
      <div style={{ padding: '20px 14px', fontSize: 11, color: 'var(--gem-dim)', textAlign: 'center' }}>
        Not used in any project yet.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '12px 14px' }}>
      {asset.usage.map((u) => (
        <div
          key={u.id}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '6px 10px',
            borderRadius: 6,
            background: 'var(--gem-well)',
            border: '1px solid var(--gem-border)',
            cursor: 'pointer',
            fontSize: 11,
            color: 'var(--gem-text)',
            transition: 'opacity 0.15s',
          }}
        >
          <span style={{ fontWeight: 600 }}>
            {u.content_pipeline?.code ?? u.pipeline_item_id}
          </span>
          <span style={{ color: 'var(--gem-dim)', fontSize: 10 }}>
            Scene {u.scene_number ?? '?'} · {u.usage_type}
          </span>
        </div>
      ))}
    </div>
  )
}

function RelatedPanel({
  asset,
  allAssets,
  onFilter,
}: {
  asset: AssetWithUsage
  allAssets: AudioAssetRow[]
  onFilter: (partial: Partial<AudioFilterState>) => void
}) {
  const related = allAssets
    .filter((a) => a.id !== asset.id && a.status !== 'retired')
    .map((a) => ({ asset: a, score: similarityScore(asset, a) }))
    .sort((x, y) => y.score - x.score)
    .slice(0, 5)

  if (related.length === 0) {
    return (
      <div style={{ padding: '20px 14px', fontSize: 11, color: 'var(--gem-dim)', textAlign: 'center' }}>
        No related assets found.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 14px' }}>
      {related.map(({ asset: rel, score }) => {
        const rCat = categoryConfig(rel.category)
        return (
          <div
            key={rel.id}
            style={{
              padding: '7px 10px',
              borderRadius: 6,
              background: 'var(--gem-well)',
              border: '1px solid var(--gem-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: 5,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--gem-text)' }}>
                {rel.track_name ?? rel.asset_id}
              </span>
              {rel.category && (
                <span
                  style={{
                    fontSize: 9,
                    padding: '1px 6px',
                    borderRadius: 8,
                    background: rCat.badgeBg,
                    color: rCat.badgeColor,
                    fontWeight: 600,
                  }}
                >
                  {rel.category}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  flex: 1,
                  height: 3,
                  borderRadius: 3,
                  background: 'var(--gem-border)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${score}%`,
                    height: '100%',
                    background: 'var(--gem-accent)',
                    borderRadius: 3,
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>
              <span style={{ fontSize: 10, color: 'var(--gem-dim)', minWidth: 32, textAlign: 'right' }}>
                {score}%
              </span>
            </div>
          </div>
        )
      })}
      <div style={{ paddingTop: 4, fontSize: 10, color: 'var(--gem-dim)', textAlign: 'center' }}>
        Scores based on category, tags, key, BPM, energy, instruments, mood
      </div>
    </div>
  )
}

function RawPanel({ asset }: { asset: AssetWithUsage }) {
  const raw = {
    asset_id: asset.asset_id,
    file_path: asset.renamed_to ?? asset.original_filename,
    sha256: asset.sha256,
    version: asset.version,
  }

  return (
    <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 10, color: 'var(--gem-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Asset ID</span>
        <code style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--gem-text)', wordBreak: 'break-all' }}>{asset.asset_id}</code>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 10, color: 'var(--gem-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>File Path</span>
        <code style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--gem-text)', wordBreak: 'break-all' }}>{asset.renamed_to ?? asset.original_filename}</code>
      </div>
      {asset.sha256 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 10, color: 'var(--gem-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>SHA-256</span>
          <code style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--gem-text)', wordBreak: 'break-all' }}>{asset.sha256}</code>
        </div>
      )}
      <div style={{ marginTop: 4 }}>
        <CollapsibleJson data={raw} />
      </div>
    </div>
  )
}

// ─── Helper micro-components ─────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h4
      style={{
        fontSize: 9,
        fontWeight: 700,
        color: 'var(--gem-dim)',
        textTransform: 'uppercase',
        letterSpacing: '0.07em',
        margin: '0 0 6px 0',
      }}
    >
      {children}
    </h4>
  )
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 11 }}>
      <span style={{ color: 'var(--gem-dim)', flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, textAlign: 'right' }}>{children}</div>
    </div>
  )
}

function DimValue({ children }: { children: React.ReactNode }) {
  return <span style={{ color: 'var(--gem-text)', fontSize: 11 }}>{children}</span>
}

// ─── Main component ──────────────────────────────────────────────────────────

export function AudioDetailV2({ assetId, allAssets, onClose, onFilter, fullWidth }: AudioDetailV2Props) {
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

  // ── Fetch asset ────────────────────────────────────────────────────────────
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setFetchError(null)
    setAsset(null)

    fetch(`/api/pipeline/audio-library/${assetId}`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<{ data: AssetWithUsage }>
      })
      .then((json) => {
        if (!controller.signal.aborted) {
          setAsset(json.data)
          setLoading(false)
        }
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') return
        if (!controller.signal.aborted) {
          setFetchError('Failed to load asset')
          setLoading(false)
        }
      })

    return () => controller.abort()
  }, [assetId])

  // ── Keyboard: Escape ───────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      e.stopImmediatePropagation()
      if (editingRef.current) {
        setEditing(false)
        setDraft(null)
        setConflict(false)
        setSaveError(null)
      } else {
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // ── Edit helpers ───────────────────────────────────────────────────────────
  const handleEditStart = useCallback(() => {
    if (!asset) return
    setDraft(assetToDraft(asset))
    setConflict(false)
    setSaveError(null)
    setEditing(true)
  }, [asset])

  const handleCancel = useCallback(() => {
    setEditing(false)
    setDraft(null)
    setConflict(false)
    setSaveError(null)
  }, [])

  const setField = useCallback(<K extends keyof EditDraft>(key: K, value: EditDraft[K]) => {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev))
  }, [])

  const handleSave = useCallback(async (force = false) => {
    if (!asset || !draft) return
    setSaving(true)
    setConflict(false)
    setSaveError(null)

    try {
      const body: Record<string, unknown> = {
        track_name: draft.track_name || null,
        category: draft.category || null,
        tags: draft.tags.split(',').map((s) => s.trim()).filter(Boolean),
        mood: draft.mood.split(',').map((s) => s.trim()).filter(Boolean),
        instruments: draft.instruments.split(',').map((s) => s.trim()).filter(Boolean),
        energy: draft.energy,
        status: draft.status,
        version: asset.version,
      }
      if (force) body['force'] = true

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
      setSaveError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }, [asset, draft])

  // ── Derived data ───────────────────────────────────────────────────────────
  const peaks = (asset?.metadata?.waveform as { peaks?: number[] } | undefined)?.peaks ?? []
  const hasUsage = (asset?.usage.length ?? 0) > 0

  // ── Render ─────────────────────────────────────────────────────────────────
  const panelStyle: React.CSSProperties = {
    width: fullWidth ? '100%' : 360,
    minWidth: fullWidth ? undefined : 360,
    maxWidth: fullWidth ? undefined : 360,
    display: 'flex',
    flexDirection: 'column',
    borderRadius: 10,
    border: '1px solid var(--gem-border)',
    background: 'var(--gem-surface)',
    overflow: 'hidden',
    flexShrink: 0,
  }

  if (loading) {
    return (
      <div style={panelStyle}>
        <Skeleton />
      </div>
    )
  }

  if (fetchError || !asset) {
    return (
      <div style={{ ...panelStyle, padding: 20, gap: 10, display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 12, color: '#f87171' }}>{fetchError ?? 'Asset not found'}</span>
        <button
          onClick={onClose}
          style={{ fontSize: 11, background: 'none', border: '1px solid var(--gem-border)', color: 'var(--gem-muted)', cursor: 'pointer', borderRadius: 4, padding: '3px 10px', alignSelf: 'flex-start' }}
        >
          Close
        </button>
      </div>
    )
  }

  const cat = categoryConfig(asset.category)
  const typeIcon = asset.type === 'music' ? '♫' : '◎'
  const statusColor = STATUS_DOT[asset.status] ?? '#9ca3af'
  const statusLabel = STATUS_LABELS[asset.status] ?? asset.status

  return (
    <div style={panelStyle}>
      {/* ── Header ── */}
      <div
        style={{
          flexShrink: 0,
          padding: '12px 14px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          borderBottom: '1px solid var(--gem-border)',
          background: 'var(--gem-surface)',
          position: 'sticky',
          top: 0,
          zIndex: 2,
        }}
      >
        {/* Title row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {editing && draft ? (
              <input
                value={draft.track_name}
                onChange={(e) => setField('track_name', e.target.value)}
                placeholder={asset.asset_id}
                style={{ ...inputBase, fontSize: 15, fontWeight: 700, padding: '2px 6px' }}
              />
            ) : (
              <h3
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: 'var(--gem-text)',
                  margin: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {asset.track_name ?? asset.asset_id}
              </h3>
            )}
            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--gem-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {[asset.artist, asset.source, `v${asset.version}`].filter(Boolean).join(' · ')}
            </p>
          </div>
          {/* Action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            {editing ? (
              <>
                <button
                  aria-label="Save changes"
                  onClick={() => handleSave(false)}
                  disabled={saving}
                  style={{
                    fontSize: 11,
                    padding: '3px 10px',
                    borderRadius: 4,
                    background: 'var(--gem-accent)',
                    color: '#fff',
                    border: 'none',
                    cursor: saving ? 'wait' : 'pointer',
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  aria-label="Cancel editing"
                  onClick={handleCancel}
                  disabled={saving}
                  style={{
                    fontSize: 11,
                    padding: '3px 8px',
                    borderRadius: 4,
                    background: 'none',
                    border: '1px solid var(--gem-border)',
                    color: 'var(--gem-muted)',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                aria-label="Edit asset"
                onClick={handleEditStart}
                style={{
                  fontSize: 11,
                  padding: '3px 8px',
                  borderRadius: 4,
                  background: 'none',
                  border: '1px solid var(--gem-border)',
                  color: 'var(--gem-muted)',
                  cursor: 'pointer',
                }}
              >
                Edit
              </button>
            )}
            <button
              aria-label="Close detail panel"
              onClick={onClose}
              style={{
                fontSize: 14,
                padding: '2px 6px',
                borderRadius: 4,
                background: 'none',
                border: 'none',
                color: 'var(--gem-muted)',
                cursor: 'pointer',
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Conflict alert */}
        {conflict && (
          <div
            role="alert"
            style={{
              fontSize: 11,
              color: '#f87171',
              background: 'rgba(248,113,113,0.08)',
              border: '1px solid rgba(248,113,113,0.3)',
              borderRadius: 4,
              padding: '5px 10px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>Asset was modified. Merge or force save?</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => {
                  setConflict(false)
                  setEditing(false)
                  setDraft(null)
                  // re-fetch latest
                  setLoading(true)
                  fetch(`/api/pipeline/audio-library/${assetId}`)
                    .then((r) => r.json() as Promise<{ data: AssetWithUsage }>)
                    .then((json) => { setAsset(json.data); setLoading(false) })
                    .catch(() => setLoading(false))
                }}
                style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: 'none', border: '1px solid #f87171', color: '#f87171', cursor: 'pointer' }}
              >
                Refresh &amp; merge
              </button>
              <button
                onClick={() => handleSave(true)}
                style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: 'rgba(248,113,113,0.2)', border: '1px solid #f87171', color: '#f87171', cursor: 'pointer' }}
              >
                Force save
              </button>
            </div>
          </div>
        )}

        {/* Save error */}
        {saveError && (
          <div
            role="alert"
            style={{ fontSize: 11, color: '#fb923c', background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.3)', borderRadius: 4, padding: '5px 10px' }}
          >
            {saveError}
          </div>
        )}

        {/* Status selector (edit mode) */}
        {editing && draft && (
          <div style={{ display: 'flex', gap: 4 }}>
            {(['downloaded', 'pending', 'retired'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setField('status', s)}
                style={{
                  flex: 1,
                  fontSize: 10,
                  padding: '3px 0',
                  borderRadius: 4,
                  border: `1px solid ${draft.status === s ? STATUS_DOT[s] : 'var(--gem-border)'}`,
                  background: draft.status === s ? `${STATUS_DOT[s]}22` : 'none',
                  color: draft.status === s ? STATUS_DOT[s] : 'var(--gem-muted)',
                  cursor: 'pointer',
                  fontWeight: draft.status === s ? 600 : 400,
                  transition: 'all 0.15s',
                }}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        )}

        {/* Quick stats pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, paddingBottom: 10 }}>
          <Pill>
            <span>{typeIcon}</span>
            <span>{asset.type === 'music' ? 'Music' : 'SFX'}</span>
          </Pill>
          {asset.bpm != null && <Pill>{asset.bpm} BPM</Pill>}
          {asset.duration_seconds != null && <Pill>{formatDuration(asset.duration_seconds)}</Pill>}
          {asset.music_key && <Pill>{asset.music_key}</Pill>}
          <Pill>
            <span
              style={{
                display: 'inline-block',
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: statusColor,
                flexShrink: 0,
              }}
            />
            <span>{statusLabel}</span>
          </Pill>
          {asset.category && (
            <Pill>
              <span style={{ color: cat.badgeColor }}>{asset.category}</span>
            </Pill>
          )}
        </div>
      </div>

      {/* ── Waveform ── */}
      <div
        style={{
          flexShrink: 0,
          padding: '8px 14px 0',
          background: 'var(--gem-surface)',
          position: 'sticky',
          top: 0,
          zIndex: 1,
        }}
      >
        <WaveformDisplay
          variant="detail"
          peaks={peaks}
          energy={asset.energy}
          type={asset.type}
          duration={asset.duration_seconds}
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 10,
            color: 'var(--gem-dim)',
            marginTop: 3,
            marginBottom: 8,
          }}
        >
          <span>{formatDuration(asset.duration_seconds)}</span>
          <span>Peaks: {peaks.length} samples</span>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          borderBottom: '1px solid var(--gem-border)',
          background: 'var(--gem-surface)',
          position: 'sticky',
          top: 0,
          zIndex: 1,
          paddingLeft: 14,
          paddingRight: 14,
        }}
      >
        {((['details', 'usage', 'related', 'raw'] as Tab[])).map((tab) => {
          const active = activeTab === tab
          return (
            <button
              key={tab}
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(tab)}
              style={{
                fontSize: 11,
                padding: '7px 10px',
                background: 'none',
                border: 'none',
                borderBottom: active ? '2px solid var(--gem-accent)' : '2px solid transparent',
                color: active ? 'var(--gem-text)' : 'var(--gem-dim)',
                fontWeight: active ? 600 : 400,
                cursor: 'pointer',
                position: 'relative',
                transition: 'color 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'usage' && hasUsage && (
                <span
                  style={{
                    position: 'absolute',
                    top: 5,
                    right: 3,
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#3b82f6',
                    display: 'block',
                  }}
                />
              )}
            </button>
          )
        })}
      </div>

      {/* ── Tab content (scrollable) ── */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {activeTab === 'details' && (
          <DetailsPanel
            asset={asset}
            editing={editing}
            draft={draft}
            setField={setField}
            onFilter={onFilter}
          />
        )}
        {activeTab === 'usage' && <UsagePanel asset={asset} />}
        {activeTab === 'related' && (
          <RelatedPanel asset={asset} allAssets={allAssets} onFilter={onFilter} />
        )}
        {activeTab === 'raw' && <RawPanel asset={asset} />}
      </div>
    </div>
  )
}
