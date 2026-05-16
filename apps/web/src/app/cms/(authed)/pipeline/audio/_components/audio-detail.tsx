'use client'

import { useState, useEffect } from 'react'
import type { AudioAssetRow, AudioAssetUsageRow } from '@/lib/pipeline/audio-schemas'
import { Waveform } from './waveform'

interface AudioDetailProps {
  assetId: string
  onClose: () => void
}

type AssetWithUsage = AudioAssetRow & { usage: AudioAssetUsageRow[] }

export function AudioDetail({ assetId, onClose }: AudioDetailProps) {
  const [asset, setAsset] = useState<AssetWithUsage | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    fetch(`/api/pipeline/audio-library/${assetId}`, { signal: controller.signal })
      .then(r => r.json())
      .then(json => { if (!controller.signal.aborted) { setAsset(json.data); setLoading(false) } })
      .catch(e => { if (!(e instanceof DOMException && e.name === 'AbortError')) setLoading(false) })
    return () => controller.abort()
  }, [assetId])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (loading) return <div style={{ width: 400, borderLeft: '1px solid var(--gem-border)', padding: 20, color: 'var(--gem-muted)' }}>Loading...</div>
  if (!asset) return <div style={{ width: 400, borderLeft: '1px solid var(--gem-border)', padding: 20, color: 'var(--gem-muted)' }}>Not found</div>

  const wf = asset.metadata?.waveform as { peaks?: number[] } | undefined
  const peaks = wf?.peaks ?? []

  return (
    <div style={{ width: 400, minWidth: 400, borderLeft: '1px solid var(--gem-border)', overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--gem-text)', margin: 0 }}>{asset.track_name || asset.asset_id}</h3>
        <button aria-label="Close detail panel" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--gem-muted)', cursor: 'pointer', fontSize: 16 }}>✕</button>
      </div>

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
        <Row label="Category" value={asset.category} />
        {asset.genre && <Row label="Genre" value={asset.genre} />}
        <Row label="Tags" value={asset.tags.join(', ')} />
        <Row label="Mood" value={asset.mood.join(', ')} />
      </Section>

      {/* Audio */}
      <Section title="Audio">
        <Row label="Duration" value={asset.duration_seconds ? `${asset.duration_seconds}s` : '—'} />
        <Row label="BPM" value={asset.bpm ? String(asset.bpm) : '—'} />
        <Row label="Key" value={asset.music_key ?? '—'} />
        <Row label="Energy" value={asset.energy ? `${'●'.repeat(asset.energy)}${'○'.repeat(5 - asset.energy)}` : '—'} />
        <Row label="Instruments" value={asset.instruments.join(', ')} />
      </Section>

      {/* Metadata */}
      {(asset.metadata?.mix_notes || asset.metadata?.pairs_well_with || asset.metadata?.avoid_with) && (
        <Section title="Notes">
          {asset.metadata.mix_notes && <Row label="Mix Notes" value={String(asset.metadata.mix_notes)} />}
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
