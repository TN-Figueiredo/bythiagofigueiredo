type Props = {
  theme: 'dark' | 'light'
  height?: number
  className?: string
}

const FILLS = {
  dark: { text: '#EFE6D2', asterisk: '#FF8240' },
  light: { text: '#1A140C', asterisk: '#C14513' },
}

export function BrandWordmark({ theme, height = 28, className }: Props) {
  const { text, asterisk } = FILLS[theme]
  const aspectRatio = 588 / 80
  const width = Math.round(height * aspectRatio)

  return (
    <svg
      viewBox="0 0 588 80"
      width={width}
      height={height}
      role="img"
      aria-label="by Thiago Figueiredo"
      className={className}
    >
      <g data-testid="brand-text" fontFamily="'Source Serif 4', Georgia, serif" fill={text}>
        <text x="6" y="68.80" fontSize="46.08" fontWeight="300" fontStyle="italic" opacity="0.75">by</text>
        <text x="62.52" y="72" fontSize="64" fontWeight="500" letterSpacing="-0.96">Thiago Figueiredo</text>
      </g>
      <g data-testid="brand-asterisk" transform="translate(567.80 24.64)">
        <path d="M 0 -11 C -1.8 -7, -1.8 7, 0 11 C 1.8 7, 1.8 -7, 0 -11 Z" fill={asterisk} transform="rotate(0) scale(1.222)" />
        <path d="M 0 -11 C -1.8 -7, -1.8 7, 0 11 C 1.8 7, 1.8 -7, 0 -11 Z" fill={asterisk} transform="rotate(60) scale(1.222)" />
        <path d="M 0 -11 C -1.8 -7, -1.8 7, 0 11 C 1.8 7, 1.8 -7, 0 -11 Z" fill={asterisk} transform="rotate(120) scale(1.222)" />
        <circle cx="0" cy="0" r="0.99" fill={asterisk} />
      </g>
    </svg>
  )
}
