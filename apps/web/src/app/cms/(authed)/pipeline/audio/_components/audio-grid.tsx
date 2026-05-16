'use client'

import type { AudioAssetRow } from '@/lib/pipeline/audio-schemas'
import { WaveformMini } from './waveform-mini'

interface AudioGridProps {
  assets: AudioAssetRow[]
  selectedId: string | null
  onSelect: (id: string) => void
}

const STATUS_DOT: Record<string, string> = { downloaded: '#10b981', pending: '#f59e0b', retired: '#6b7280' }

export function AudioGrid({ assets, selectedId, onSelect }: AudioGridProps) {
  if (assets.length === 0) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--gem-muted)', fontSize: 13 }}>No assets found. Import a JSON library or create assets via API.</div>
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
      {assets.map((a) => {
        const isSelected = selectedId === a.id
        const wf = a.metadata?.waveform as { peaks?: number[] } | undefined
        const peaks = wf?.peaks ?? []
        return (
          <button key={a.id} onClick={() => onSelect(a.id)} aria-label={`${a.track_name || a.asset_id} — ${a.type}, ${a.status}`} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 10, borderRadius: 8, border: isSelected ? '2px solid var(--gem-accent)' : '1px solid var(--gem-border)', background: 'var(--gem-surface-hi)', cursor: 'pointer', textAlign: 'left' }}>
            <WaveformMini peaks={peaks} width={180} height={24} color={a.type === 'music' ? 'purple' : 'cyan'} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14 }}>{a.type === 'music' ? '🎵' : '🔊'}</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--gem-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{a.track_name || a.asset_id}</span>
              <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_DOT[a.status] ?? '#6b7280', flexShrink: 0 }} />
              <span className="sr-only">{a.status}</span>
            </div>
            {a.category && <span style={{ fontSize: 10, color: 'var(--gem-muted)' }}>{a.category}</span>}
            {a.tags.length > 0 && (
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                {a.tags.slice(0, 3).map(tag => (
                  <span key={tag} style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: 'rgba(99,102,241,0.1)', color: 'var(--gem-accent)' }}>{tag}</span>
                ))}
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}
