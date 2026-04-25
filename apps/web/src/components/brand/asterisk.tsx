const PETAL = 'M 12 1 C 10.2 5, 10.2 19, 12 23 C 13.8 19, 13.8 5, 12 1 Z'
const ROTATIONS = [0, 60, 120] as const

type Props = {
  size?: number | string
  className?: string
}

export function Asterisk({ size, className }: Props) {
  const sizeProps = size != null
    ? { width: size, height: size }
    : { width: '1em', height: '1em' }

  return (
    <svg
      viewBox="0 0 24 24"
      {...sizeProps}
      aria-hidden="true"
      focusable="false"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'baseline' }}
    >
      {ROTATIONS.map((r) => (
        <path
          key={r}
          d={PETAL}
          fill="currentColor"
          transform={`rotate(${r} 12 12)`}
        />
      ))}
      <circle cx="12" cy="12" r="0.81" fill="currentColor" />
    </svg>
  )
}
