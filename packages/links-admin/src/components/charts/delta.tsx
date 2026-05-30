export interface DeltaProps {
  cur: number
  prev: number | null
  suffix?: string
  invert?: boolean
}

export function Delta({ cur, prev, suffix = '%', invert }: DeltaProps) {
  if (prev == null) return null
  if (prev === 0 && cur === 0) return null
  const pct = prev === 0 ? 100 : Math.round(((cur - prev) / prev) * 100)
  const up = pct >= 0
  const good = invert ? !up : up
  const color = good ? 'var(--green, #46B17E)' : 'var(--red, #D9614A)'

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        fontSize: 11,
        fontWeight: 700,
        fontFamily: 'var(--font-mono, monospace)',
        color,
      }}
    >
      {up ? '▲' : '▼'} {up ? '+' : ''}{pct}{suffix}
    </span>
  )
}
