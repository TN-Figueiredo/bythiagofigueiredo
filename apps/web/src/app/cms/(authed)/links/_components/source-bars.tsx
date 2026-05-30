'use client'

import { SOURCE_COLORS, SOURCE_LABELS, type SourceId } from '@tn-figueiredo/links-admin'
import { fmt } from './fmt'

interface SourceBarData {
  id: string
  label?: string
  clicks: number
  pct: number
}

interface SourceBarsProps {
  sources: SourceBarData[]
}

export function SourceBars({ sources }: SourceBarsProps) {
  const max = Math.max(...sources.map(s => s.clicks), 1)
  return (
    <div role="img" aria-label="Distribuicao de cliques por origem" style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      {sources.map((s) => {
        const color = SOURCE_COLORS[s.id as SourceId] || '#8A8F98'
        const label = s.label || SOURCE_LABELS[s.id as SourceId] || s.id
        return (
          <div key={s.id} data-source-row style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              aria-hidden="true"
              style={{ width: 9, height: 9, borderRadius: 3, background: color, flexShrink: 0 }}
            />
            <span style={{ width: 96, fontSize: '12.5px', color: 'var(--ink)', flexShrink: 0 }}>
              {label}
            </span>
            <div style={{ flex: 1, height: 8, background: 'var(--surface-2)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ width: `${(s.clicks / max) * 100}%`, height: '100%', background: color, borderRadius: 99 }} />
            </div>
            <span className="mono" style={{ width: 64, textAlign: 'right', fontSize: '11.5px', color: 'var(--ink-dim)' }}>
              {fmt(s.clicks)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
