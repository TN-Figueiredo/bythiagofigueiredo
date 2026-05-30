import { useMemo } from 'react'

export interface DonutSegment {
  k: string
  v: number
  color: string
}

export interface DonutProps {
  segments: DonutSegment[]
  size?: number
  thickness?: number
  centerLabel?: string
  centerSub?: string
}

export function Donut({
  segments,
  size = 120,
  thickness = 16,
  centerLabel,
  centerSub,
}: DonutProps) {
  const { total, r, c } = useMemo(() => {
    const total = segments.reduce((s, x) => s + x.v, 0) || 1
    const r = (size - thickness) / 2
    const c = 2 * Math.PI * r
    return { total, r, c }
  }, [segments, size, thickness])
  let off = 0

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} role="img" aria-label={`Donut chart: ${segments.map(s => `${s.k} ${s.v}%`).join(', ')}`} style={{ transform: 'rotate(-90deg)' }}>
          {segments.map((s, i) => {
            const len = (s.v / total) * c
            const el = (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={thickness}
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-off}
              />
            )
            off += len
            return el
          })}
        </svg>
        {centerLabel && (
          <div
            data-center
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
            }}
          >
            <span
              style={{
                fontSize: 17,
                fontWeight: 700,
                lineHeight: 1,
                fontFamily: 'var(--font-mono, monospace)',
                color: 'var(--ink, #ECE6DA)',
              }}
            >
              {centerLabel}
            </span>
            {centerSub && (
              <span
                style={{
                  fontSize: 8,
                  marginTop: 3,
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-faint, #6E685D)',
                }}
              >
                {centerSub}
              </span>
            )}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {segments.map((s) => (
          <div
            key={s.k}
            style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}
          >
            <span
              data-legend-dot
              style={{ width: 9, height: 9, borderRadius: 3, background: s.color }}
            />
            <span style={{ color: 'var(--ink, #ECE6DA)', flex: 1 }}>{s.k}</span>
            <span
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                color: 'var(--ink-dim, #A39C8E)',
              }}
            >
              {s.v}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
