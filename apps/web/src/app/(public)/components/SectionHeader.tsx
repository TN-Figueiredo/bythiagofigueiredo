type Props = {
  number: string
  label: string
  title: string
  subtitle?: string
  linkText?: string
  linkHref?: string
  linkColor?: string
  kickerColor?: string
}

export function SectionHeader({
  number,
  label,
  title,
  subtitle,
  linkText,
  linkHref,
  linkColor,
  kickerColor = 'var(--pb-accent)',
}: Props) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <span
            data-testid="section-kicker"
            className="font-mono uppercase"
            style={{
              fontSize: 11,
              letterSpacing: '0.16em',
              fontWeight: 600,
              color: kickerColor,
            }}
          >
            § {number} · {label}
          </span>
          <h2
            className="font-fraunces"
            style={{
              fontSize: 'clamp(28px, 4vw, 42px)',
              fontWeight: 400,
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
              color: 'var(--pb-ink)',
              marginTop: 6,
            }}
          >
            <span
              style={{
                backgroundImage: 'linear-gradient(transparent 60%, var(--pb-marker) 60%)',
                backgroundSize: '100% 100%',
                backgroundRepeat: 'no-repeat',
                paddingBottom: 2,
              }}
            >
              {title}
            </span>
          </h2>
          {subtitle && (
            <p
              className="font-mono"
              style={{ fontSize: 12, color: 'var(--pb-muted)', marginTop: 6, letterSpacing: '0.02em' }}
            >
              {subtitle}
            </p>
          )}
        </div>
        {linkText && linkHref && (
          <a
            href={linkHref}
            className="font-caveat shrink-0"
            style={{
              fontSize: 20,
              color: linkColor ?? kickerColor,
              textDecoration: 'none',
              transform: 'rotate(-1deg)',
              display: 'inline-block',
            }}
          >
            {linkText}
          </a>
        )}
      </div>
      <div style={{ height: 1, background: 'var(--pb-line)', marginTop: 16 }} />
    </div>
  )
}
