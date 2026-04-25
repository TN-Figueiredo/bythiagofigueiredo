import { Asterisk } from './asterisk'

export type BrandVariant = 'wordmark' | 'wordmark-tagline' | 'monogram' | 'symbol'

type Props = {
  variant?: BrandVariant
  className?: string
  tagline?: string
}

export function Brand({ variant = 'wordmark', className, tagline }: Props) {
  if (variant === 'symbol') {
    return (
      <span role="img" aria-label="Marginalia" data-testid="brand-symbol" className={className}>
        <Asterisk className="text-pb-accent" />
      </span>
    )
  }

  if (variant === 'monogram') {
    return (
      <span
        className={['inline-flex items-baseline font-source-serif', className].filter(Boolean).join(' ')}
        style={{ letterSpacing: '-0.08em' }}
        role="img"
        aria-label="TF"
        data-testid="brand-monogram"
      >
        <span className="font-medium leading-none text-pb-ink">T</span>
        <span className="font-medium italic leading-none text-pb-accent" style={{ opacity: 0.95 }}>F</span>
      </span>
    )
  }

  const showTagline = variant === 'wordmark-tagline' && tagline

  return (
    <span
      className={['inline-flex flex-col', className].filter(Boolean).join(' ')}
      aria-label="by Thiago Figueiredo"
      data-testid="brand-wordmark"
    >
      <span
        className="inline-flex items-baseline font-source-serif text-pb-ink leading-none"
        style={{ gap: '0.18em', letterSpacing: '-0.015em' }}
      >
        <span
          className="font-light italic opacity-75"
          style={{
            fontSize: '0.72em',
            marginRight: '-0.02em',
            transform: 'translateY(-0.05em)',
            display: 'inline-block',
          }}
        >
          by
        </span>
        <span className="font-medium">
          Thiago{' '}Figueiredo
        </span>
        <span
          style={{
            display: 'inline-block',
            marginLeft: '0.06em',
            transform: 'translateY(-0.22em)',
          }}
        >
          <Asterisk className="text-pb-accent" size="0.42em" />
        </span>
      </span>
      {showTagline && (
        <span className="font-jetbrains text-pb-ink opacity-55 tracking-[3px] text-[0.19em] mt-[0.1em]">
          {tagline}
        </span>
      )}
    </span>
  )
}
