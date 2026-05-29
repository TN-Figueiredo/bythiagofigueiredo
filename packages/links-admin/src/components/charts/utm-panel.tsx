import { useState } from 'react'

interface UtmRow {
  key: string
  clicks: number
  pct: number
}

interface UtmPanelProps {
  data: UtmRow[]
  onDimensionChange?: (dim: 'source' | 'medium' | 'campaign') => void
}

const DIMS: Array<{ id: 'source' | 'medium' | 'campaign'; label: string }> = [
  { id: 'source', label: 'Source' },
  { id: 'medium', label: 'Medium' },
  { id: 'campaign', label: 'Campaign' },
]

export function UtmPanel({ data, onDimensionChange }: UtmPanelProps) {
  const [active, setActive] = useState<'source' | 'medium' | 'campaign'>('source')
  const max = Math.max(...data.map(d => d.clicks), 1)

  return (
    <div data-panel style={{ padding: 18, borderRadius: 14, border: '1px solid var(--line, rgba(255,255,255,0.08))', background: 'var(--surface, #161410)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, flex: 1, color: 'var(--ink, #ECE6DA)' }}>UTM Attribution</span>
        <div style={{ display: 'flex', gap: 2, background: 'var(--surface-2, #1E1B16)', borderRadius: 7, padding: 2 }}>
          {DIMS.map(d => (
            <button key={d.id} type="button"
              onClick={() => { setActive(d.id); onDimensionChange?.(d.id) }}
              style={{
                border: 'none', borderRadius: 5, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                background: active === d.id ? 'var(--accent, #F2683C)' : 'transparent',
                color: active === d.id ? '#fff' : 'var(--ink-faint, #6E685D)',
              }}
            >{d.label}</button>
          ))}
        </div>
      </div>
      {data.length === 0 ? (
        <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--ink-faint, #6E685D)' }}>Sem dados UTM</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.map(r => (
            <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 100, fontSize: 12, color: 'var(--ink, #ECE6DA)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.key}</span>
              <div style={{ flex: 1, height: 7, borderRadius: 99, background: 'var(--surface-2, #1E1B16)', overflow: 'hidden' }}>
                <div style={{ width: `${(r.clicks / max) * 100}%`, height: '100%', borderRadius: 99, background: 'var(--accent, #F2683C)' }} />
              </div>
              <span style={{ width: 36, textAlign: 'right', fontSize: 11, fontFamily: 'var(--font-mono, monospace)', color: 'var(--ink-dim, #A39C8E)' }}>{r.pct}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
