'use client'

import { WaveformMini } from './waveform-mini'

interface AudioGridProps {
  assets: Record<string, unknown>[]
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
      {assets.map((asset) => {
        const a = asset as Record<string, unknown>
        const isSelected = selectedId === a.id
        const peaks = ((a.metadata as Record<string, unknown>)?.waveform as Record<string, unknown>)?.peaks as number[] ?? []
        return (
          <button key={a.id as string} onClick={() => onSelect(a.id as string)} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 10, borderRadius: 8, border: isSelected ? '2px solid var(--gem-accent)' : '1px solid var(--gem-border)', background: 'var(--gem-surface-hi)', cursor: 'pointer', textAlign: 'left' }}>
            <WaveformMini peaks={peaks} width={180} height={24} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14 }}>{a.type === 'music' ? '🎵' : '🔊'}</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--gem-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{(a.track_name as string) || (a.asset_id as string)}</span>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_DOT[a.status as string] ?? '#6b7280', flexShrink: 0 }} />
            </div>
            {a.category && <span style={{ fontSize: 10, color: 'var(--gem-muted)' }}>{a.category as string}</span>}
            {(a.tags as string[])?.length > 0 && (
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                {(a.tags as string[]).slice(0, 3).map((tag: string) => (
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
