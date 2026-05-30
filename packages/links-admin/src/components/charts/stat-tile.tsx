import type { ReactNode } from 'react'
import { CARD_STYLE } from './tokens'

export interface StatTileProps {
  label: string
  value: string
  sub?: string
  icon?: string
  iconTint?: string
  delta?: ReactNode
  spark?: ReactNode
}

export function StatTile({ label, value, sub, icon, iconTint, delta, spark }: StatTileProps) {
  const tint = iconTint || 'var(--accent, #FF8240)'
  return (
    <div
      data-stat-tile
      role="group"
      aria-label={`${label}: ${value}`}
      style={{ padding: 16, ...CARD_STYLE, minWidth: 0 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
        {icon && (
          <span
            data-icon
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: tint + '22',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              fontSize: 14,
              color: tint,
            }}
          >
            {icon.slice(0, 2)}
          </span>
        )}
        <span
          style={{
            flex: 1,
            fontSize: 10.5,
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--ink-faint, #6E685D)',
          }}
        >
          {label}
        </span>
        {delta}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <div
            style={{
              fontSize: 26,
              fontWeight: 700,
              lineHeight: 1,
              fontFamily: 'var(--font-mono, monospace)',
              color: 'var(--ink, #ECE6DA)',
            }}
          >
            {value}
          </div>
          {sub && (
            <div style={{ fontSize: 11, color: 'var(--ink-dim, #A39C8E)', marginTop: 4 }}>
              {sub}
            </div>
          )}
        </div>
        {spark}
      </div>
    </div>
  )
}
