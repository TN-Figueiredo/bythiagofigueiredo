'use client'

import { useState, useEffect } from 'react'
import { Waveform } from './waveform'

interface AudioDetailProps {
  assetId: string
  onClose: () => void
}

export function AudioDetail({ assetId, onClose }: AudioDetailProps) {
  const [asset, setAsset] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/pipeline/audio-library/${assetId}`)
      .then(r => r.json())
      .then(json => { setAsset(json.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [assetId])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (loading) return <div style={{ width: 400, borderLeft: '1px solid var(--gem-border)', padding: 20, color: 'var(--gem-muted)' }}>Loading...</div>
  if (!asset) return <div style={{ width: 400, borderLeft: '1px solid var(--gem-border)', padding: 20, color: 'var(--gem-muted)' }}>Not found</div>

  const peaks = (asset.metadata as Record<string, unknown>)?.waveform ? ((asset.metadata as Record<string, Record<string, unknown>>).waveform.peaks as number[]) : []
  const usage = (asset.usage as Array<Record<string, unknown>>) ?? []

  return (
    <div style={{ width: 400, minWidth: 400, borderLeft: '1px solid var(--gem-border)', overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--gem-text)', margin: 0 }}>{(asset.track_name as string) || (asset.asset_id as string)}</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--gem-muted)', cursor: 'pointer', fontSize: 16 }}>✕</button>
      </div>

      {/* Waveform */}
      <Waveform peaks={peaks} width={360} height={80} color={asset.type === 'music' ? 'purple' : 'cyan'} duration={asset.duration_seconds as number | undefined} />

      {/* Identity */}
      <Section title="Identity">
        <Row label="Asset ID" value={asset.asset_id as string} />
        <Row label="Artist" value={asset.artist as string} />
        <Row label="Source" value={asset.source as string} />
        {asset.artlist_url && <Row label="Artlist" value={<a href={asset.artlist_url as string} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gem-accent)', textDecoration: 'none' }}>Open ↗</a>} />}
      </Section>

      {/* Classification */}
      <Section title="Classification">
        <Row label="Type" value={asset.type === 'music' ? '🎵 Music' : '🔊 SFX'} />
        <Row label="Category" value={asset.category as string} />
        {asset.genre && <Row label="Genre" value={asset.genre as string} />}
        <Row label="Tags" value={((asset.tags as string[]) ?? []).join(', ')} />
        <Row label="Mood" value={((asset.mood as string[]) ?? []).join(', ')} />
      </Section>

      {/* Audio */}
      <Section title="Audio">
        <Row label="Duration" value={asset.duration_seconds ? `${asset.duration_seconds}s` : '—'} />
        <Row label="BPM" value={asset.bpm ? String(asset.bpm) : '—'} />
        <Row label="Key" value={(asset.music_key as string) ?? '—'} />
        <Row label="Energy" value={asset.energy ? `${'●'.repeat(asset.energy as number)}${'○'.repeat(5 - (asset.energy as number))}` : '—'} />
        <Row label="Instruments" value={((asset.instruments as string[]) ?? []).join(', ')} />
      </Section>

      {/* Usage */}
      <Section title={`Usage (${usage.length})`}>
        {usage.length === 0 && <span style={{ fontSize: 11, color: 'var(--gem-muted)' }}>Not used in any project yet</span>}
        {usage.map((u) => (
          <div key={u.id as string} style={{ fontSize: 11, color: 'var(--gem-text)', marginBottom: 4 }}>
            {(u.content_pipeline as Record<string, unknown>)?.code as string ?? u.pipeline_item_id as string} — scene {(u.scene_number as number) ?? '?'} ({u.usage_type as string})
          </div>
        ))}
      </Section>
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
