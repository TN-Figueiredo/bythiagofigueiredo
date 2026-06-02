'use client'

interface LongevityProps {
  /** Number of filled dots (0-4) */
  n: number
  /** Dot size in px (default 6) */
  size?: number
}

/**
 * 4-dot longevity indicator.
 * Filled dots up to n. Color: n>=3 green, n>=2 amber, else neutral.
 */
export function Longevity({ n, size = 6 }: LongevityProps) {
  const clamped = Math.max(0, Math.min(4, n))

  const filledColor =
    clamped >= 3
      ? 'var(--cms-green, #22c55e)'
      : clamped >= 2
        ? 'var(--cms-amber, #f59e0b)'
        : 'var(--cms-text-dim, #7C7060)'

  const emptyColor = 'var(--cms-surface-hover, #332D25)'

  const label =
    clamped === 0
      ? 'Sem dados de longevidade'
      : clamped === 1
        ? 'Queimou rapido'
        : clamped === 2
          ? 'Durou ~2 semanas'
          : clamped === 3
            ? 'Durou ~1 mes'
            : 'Evergreen'

  return (
    <span
      className="inline-flex items-center"
      style={{ gap: size * 0.5 }}
      role="img"
      aria-label={`Longevidade: ${label} (${clamped} de 4)`}
    >
      {[0, 1, 2, 3].map(i => (
        <span
          key={i}
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            background: i < clamped ? filledColor : emptyColor,
          }}
          aria-hidden="true"
        />
      ))}
    </span>
  )
}
