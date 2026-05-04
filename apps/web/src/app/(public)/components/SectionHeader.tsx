type Props = {
  number: string
  label: string
  title: string
  subtitle?: string
  linkText?: string
  linkHref?: string
  linkColor?: string
  kickerColor?: string
  marker?: boolean
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
  marker = true,
}: Props) {
  return (
    <div style={{ marginBottom: 40 }}>
      <div className="flex items-baseline justify-between flex-wrap" style={{ gap: 16 }}>
        <div>
          <span
            data-testid="section-kicker"
            className="font-mono uppercase"
            style={{
              fontSize: 11,
              letterSpacing: '0.2em',
              fontWeight: 600,
              color: kickerColor,
              marginBottom: 8,
              display: 'block',
            }}
          >
            § {number} · {label}
          </span>
          <h2
            className="font-fraunces"
            style={{
              fontSize: 'clamp(28px, 4vw, 42px)',
              fontWeight: 500,
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
              color: 'var(--pb-ink)',
              margin: 0,
            }}
          >
            {marker ? (
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
            ) : title}
          </h2>
          {subtitle && (
            <p
              className="font-mono"
              style={{ fontSize: 13, color: 'var(--pb-muted)', marginTop: 8 }}
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
    </div>
  )
}
