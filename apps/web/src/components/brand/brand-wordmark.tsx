type Props = {
  theme: 'dark' | 'light'
  size?: number
  className?: string
}

const FILLS = {
  dark: { text: '#EFE6D2', asterisk: '#FF8240' },
  light: { text: '#1A140C', asterisk: '#C14513' },
}

function Asterisk({ color, size }: { color: string; size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ display: 'inline-block', verticalAlign: 'baseline' }}
      aria-hidden="true"
    >
      <g fill={color}>
        {[0, 60, 120].map((deg) => (
          <path
            key={deg}
            d="M 12 1 C 10.2 5, 10.2 19, 12 23 C 13.8 19, 13.8 5, 12 1 Z"
            transform={`rotate(${deg} 12 12)`}
          />
        ))}
        <circle cx="12" cy="12" r="0.81" />
      </g>
    </svg>
  )
}

export function BrandWordmark({ theme, size = 22, className }: Props) {
  const { text, asterisk } = FILLS[theme]

  return (
    <span
      className={`font-source-serif ${className ?? ''}`}
      data-testid="brand-wordmark"
      style={{
        color: text,
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: size * 0.18,
        lineHeight: 1,
        letterSpacing: '-0.015em',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        data-testid="brand-by"
        style={{
          fontSize: size * 0.72,
          fontWeight: 300,
          fontStyle: 'italic',
          opacity: 0.75,
          marginRight: -size * 0.02,
          transform: `translateY(-${size * 0.05}px)`,
          display: 'inline-block',
        }}
      >
        by
      </span>
      <span data-testid="brand-name" style={{ fontSize: size, fontWeight: 500 }}>
        Thiago&nbsp;Figueiredo
      </span>
      <span
        data-testid="brand-asterisk"
        style={{
          display: 'inline-block',
          marginLeft: size * 0.06,
          transform: `translateY(-${size * 0.22}px)`,
        }}
      >
        <Asterisk color={asterisk} size={size * 0.42} />
      </span>
    </span>
  )
}
