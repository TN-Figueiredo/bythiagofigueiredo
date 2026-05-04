type Props = {
  locale: 'en' | 'pt-BR'
  t: Record<string, string>
}

export function BookmarkPlaceholder({ locale, t }: Props) {
  const isPt = locale === 'pt-BR'

  return (
    <aside aria-label={isPt ? 'Publicidade' : 'Advertisement'} className="px-[18px] md:px-7" style={{ maxWidth: 760, margin: '-8px auto 0' }}>
      <div style={{ margin: '44px 0', display: 'flex', justifyContent: 'center' }}>
        <div
          style={{
            position: 'relative',
            background: 'var(--pb-paper)',
            padding: '20px 24px',
            maxWidth: 540,
            width: '100%',
            boxShadow: 'var(--pb-shadow-card)',
            transform: 'rotate(-0.2deg)',
          }}
        >
          {/* Tape */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: -10,
              left: '50%',
              transform: 'translateX(-50%) rotate(2deg)',
              width: 72,
              height: 18,
              background: 'var(--pb-tape-warm)',
              boxShadow: 'var(--pb-shadow-sm)',
            }}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <span className="font-mono" style={{ fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--pb-faint)', opacity: 0.6 }}>
              ad
            </span>
            <span style={{ color: 'var(--pb-faint)', fontSize: 9, opacity: 0.4 }}>·</span>
            <span className="font-mono" style={{ fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--pb-faint)', opacity: 0.6 }}>
              {t['home.ad.label']}
            </span>
          </div>

          <p className="font-fraunces" style={{ fontSize: 19, fontWeight: 500, lineHeight: 1.22, color: 'var(--pb-ink)', margin: '0 0 8px', letterSpacing: '-0.01em' }}>
            {t['home.ad.title']}
          </p>
          <p style={{ fontSize: 13, color: 'var(--pb-muted)', lineHeight: 1.5, margin: '0 0 12px' }}>
            {t['home.ad.body']}
          </p>

          <a
            href={`/${isPt ? 'anuncie' : 'advertise'}`}
            className="font-mono inline-block"
            style={{
              fontSize: 11,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              fontWeight: 600,
              color: 'var(--pb-bg)',
              background: 'var(--pb-ink)',
              padding: '8px 16px',
              textDecoration: 'none',
            }}
          >
            {t['home.ad.cta']}
          </a>
        </div>
      </div>
    </aside>
  )
}
