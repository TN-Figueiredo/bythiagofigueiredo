export interface HBarRow {
  k: string
  v: number
}

export interface HBarsProps {
  rows: HBarRow[]
  color?: string
  suffix?: string
}

export function HBars({
  rows,
  color = 'var(--accent, #F2683C)',
  suffix = '%',
}: HBarsProps) {
  const max = Math.max(...rows.map((r) => r.v), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {rows.map((r) => (
        <div
          key={r.k}
          data-hbar-row
          style={{ display: 'flex', alignItems: 'center', gap: 10 }}
        >
          <span
            data-hbar-label
            style={{
              width: 96,
              fontSize: 12.5,
              color: 'var(--ink, #ECE6DA)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              flexShrink: 0,
            }}
          >
            {r.k}
          </span>
          <div
            style={{
              flex: 1,
              height: 8,
              background: 'var(--surface-2, #1E1B16)',
              borderRadius: 99,
              overflow: 'hidden',
            }}
          >
            <div
              data-hbar-fill
              style={{
                width: `${(r.v / max) * 100}%`,
                height: '100%',
                background: color,
                borderRadius: 99,
                transition: 'width .5s',
              }}
            />
          </div>
          <span
            style={{
              width: 38,
              textAlign: 'right',
              fontSize: 11.5,
              fontFamily: 'var(--font-mono, monospace)',
              color: 'var(--ink-dim, #A39C8E)',
            }}
          >
            {r.v}{suffix}
          </span>
        </div>
      ))}
    </div>
  )
}
