'use client'

export function CharCount({ current, max, id }: { current: number; max: number; id?: string }) {
  return (
    <span id={id} style={{ fontSize: '10px', color: current > max ? 'var(--red)' : 'var(--ink-faint)' }}>
      {current}/{max}
    </span>
  )
}

export function LangBadge({ lang }: { lang: 'PT' | 'EN' }) {
  const isPt = lang === 'PT'
  return (
    <span
      className="mono"
      style={{
        fontSize: 9,
        fontWeight: 700,
        padding: '1px 6px',
        borderRadius: 5,
        background: isPt ? 'var(--accent-soft)' : 'var(--green-soft)',
        color: isPt ? 'var(--accent)' : 'var(--green)',
      }}
    >
      {lang}
    </span>
  )
}
