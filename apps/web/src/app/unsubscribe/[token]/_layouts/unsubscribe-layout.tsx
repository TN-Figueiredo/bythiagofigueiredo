import React from 'react'

/* ── State visual config ─────────────────────────────────────────────────── */

export type StateKind = 'initial' | 'ok' | 'already' | 'not_found' | 'error' | 'invalid'

const STATE_CONFIG: Record<StateKind, { accent: string; icon: string }> = {
  initial:   { accent: '#958A75', icon: '❦' },
  ok:        { accent: '#958A75', icon: '❦' },
  already:   { accent: '#FF8240', icon: 'ℹ' },
  not_found: { accent: '#958A75', icon: '⁇' },
  error:     { accent: '#C14513', icon: '⚠' },
  invalid:   { accent: '#C14513', icon: '✕' },
}

/* ── Shared inline styles ────────────────────────────────────────────────── */

const s = {
  /* Full-page wrapper with grain texture via SVG filter */
  outer: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    background: 'var(--pb-bg, #1A1714)',
    position: 'relative' as const,
    isolation: 'isolate' as const,
  } as React.CSSProperties,

  /* Grain SVG noise overlay (same approach as confirm page) */
  grain: {
    position: 'absolute' as const,
    inset: 0,
    zIndex: 0,
    pointerEvents: 'none' as const,
    opacity: 0.35,
  } as React.CSSProperties,

  /* Content column — everything sits above the grain */
  column: {
    position: 'relative' as const,
    zIndex: 1,
    width: '100%',
    maxWidth: 520,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 0,
  } as React.CSSProperties,

  /* Monogram above the card */
  monogramWrap: {
    marginBottom: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    animation: 'fadeIn 0.5s ease-out',
  } as React.CSSProperties,

  /* Main card */
  card: {
    width: '100%',
    background: 'var(--pb-paper, #221E1A)',
    borderRadius: 6,
    boxShadow: 'var(--pb-shadow-card, 0 2px 0 rgba(0,0,0,0.5), 0 12px 24px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.03))',
    overflow: 'hidden',
    textAlign: 'center' as const,
  } as React.CSSProperties,

  /* Muted top stripe (departure theme — always var(--pb-line)) */
  stripe: {
    height: 4,
    background: 'var(--pb-line, #332D25)',
    borderRadius: '6px 6px 0 0',
  } as React.CSSProperties,

  /* Card inner padding */
  cardInner: {
    padding: '48px 48px 44px',
  } as React.CSSProperties,

  /* Farewell fleuron icon */
  iconWrap: (color: string) => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 52,
    height: 52,
    borderRadius: '50%',
    border: `1.5px solid ${color}`,
    fontSize: 22,
    lineHeight: 1,
    marginBottom: 24,
    color,
    opacity: 0.75,
  } as React.CSSProperties),

  /* Divider line inside icon area */
  iconDivider: (color: string) => ({
    width: 32,
    height: 1,
    background: color,
    margin: '0 auto 24px',
    opacity: 0.3,
  } as React.CSSProperties),

  title: {
    fontFamily: 'var(--font-fraunces-var), serif',
    fontSize: 28,
    fontWeight: 500,
    color: 'var(--pb-ink, #F5EFE6)',
    margin: '0 0 16px',
    lineHeight: 1.2,
    letterSpacing: '-0.02em',
  } as React.CSSProperties,

  body: {
    fontFamily: 'var(--font-source-serif-var), serif',
    fontSize: 17,
    lineHeight: 1.65,
    color: 'var(--pb-muted, #958A75)',
    margin: '0 0 0',
    maxWidth: 480,
    marginLeft: 'auto',
    marginRight: 'auto',
  } as React.CSSProperties,

  /* Sign-off (ok state only) */
  signoff: {
    fontFamily: 'var(--font-source-serif-var), serif',
    fontSize: 16,
    color: 'var(--pb-muted, #958A75)',
    marginTop: 24,
    marginBottom: 0,
    lineHeight: 1.6,
  } as React.CSSProperties,

  /* Outlined (departure) unsubscribe button */
  unsubBtn: {
    display: 'inline-block',
    padding: '10px 24px',
    border: '1.5px solid #C14513',
    borderRadius: 4,
    background: 'transparent',
    color: '#C14513',
    fontFamily: 'var(--font-inter-var), var(--font-jetbrains-var), sans-serif',
    fontSize: 14,
    fontWeight: 500,
    letterSpacing: '0.01em',
    cursor: 'pointer',
    transition: 'background 0.15s ease, color 0.15s ease',
    textDecoration: 'none',
  } as React.CSSProperties,

  /* Card divider before home link */
  cardDivider: {
    width: '100%',
    height: 1,
    background: 'var(--pb-line, #332D25)',
    border: 'none',
    margin: '32px 0',
  } as React.CSSProperties,

  /* Home link */
  homeLink: {
    fontFamily: 'var(--font-inter-var), Arial, sans-serif',
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--pb-faint, #6B634F)',
    textDecoration: 'none',
  } as React.CSSProperties,

  homeLinkArrow: {
    marginLeft: 4,
  } as React.CSSProperties,

  /* End mark + signature below the card */
  endMark: {
    marginTop: 36,
    display: 'flex',
    flexDirection: 'row' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  } as React.CSSProperties,

  endLine: {
    width: 36,
    height: 1,
    background: 'var(--pb-line, #332D25)',
  } as React.CSSProperties,

  endFleuron: {
    fontFamily: "'Source Serif 4', Georgia, serif",
    fontSize: 16,
    color: 'var(--pb-accent, #FF8240)',
    lineHeight: 1,
  } as React.CSSProperties,
}

/* ── Responsive title (larger on desktop via media query simulation) ─────── */
// We use a style tag injection for the media query since inline styles can't do @media.
function ResponsiveStyles() {
  return (
    <style>{`
      @keyframes fadeUp {
        from { opacity: 0; transform: translateY(16px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @media (prefers-reduced-motion: reduce) {
        * { animation: none !important; }
      }
      @media (max-width: 560px) {
        .unsub-card-inner { padding: 36px 28px 32px !important; }
        .unsub-title { font-size: 24px !important; }
        .unsub-monogram { font-size: 38px !important; margin-bottom: 24px !important; }
      }
      .unsub-btn:focus-visible {
        outline: 2px solid var(--pb-accent, #FF8240);
        outline-offset: 2px;
      }
      .unsub-btn:hover {
        background: rgba(193, 69, 19, 0.1) !important;
      }
      .unsub-manage:hover {
        background: var(--pb-accent, #FF8240) !important;
        color: #1F1B17 !important;
        transform: translateY(-1px);
      }
      .unsub-manage:focus-visible {
        outline: 2px solid var(--pb-accent, #FF8240);
        outline-offset: 3px;
      }
      .unsub-home-link:hover {
        color: var(--pb-accent, #FF8240) !important;
      }
      .unsub-card { animation: fadeUp 0.6s ease-out both; animation-delay: 0.15s; transition: background 0.3s ease, box-shadow 0.3s ease; }
      .unsub-icon { animation: fadeIn 0.4s ease-out both; animation-delay: 0.45s; }
    `}</style>
  )
}

/* ── Grain SVG (noise texture on bg) ────────────────────────────────────── */
function GrainOverlay() {
  return (
    <svg
      aria-hidden="true"
      style={s.grain}
      xmlns="http://www.w3.org/2000/svg"
      width="100%"
      height="100%"
    >
      <filter id="unsub-grain">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.65"
          numOctaves="3"
          stitchTiles="stitch"
        />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#unsub-grain)" />
    </svg>
  )
}

/* ── Monogram ────────────────────────────────────────────────────────────── */
function Monogram() {
  return (
    <div style={s.monogramWrap} aria-hidden="true">
      <span className="unsub-monogram" style={{
        fontFamily: 'var(--font-source-serif-var), serif',
        fontSize: 44,
        fontWeight: 500,
        color: 'var(--pb-ink, #EFE6D2)',
        letterSpacing: '-4px',
        lineHeight: 1,
        whiteSpace: 'nowrap' as const,
      }}>
        T<span style={{ fontStyle: 'italic', color: 'var(--pb-accent, #FF8240)' }}>F</span><span style={{ fontSize: 8, color: 'var(--pb-ink, #EFE6D2)', verticalAlign: 'middle', marginLeft: 2 }}>●</span>
      </span>
    </div>
  )
}

/* ── End mark + signature ────────────────────────────────────────────────── */
function EndMark() {
  return (
    <>
      <div style={s.endMark} aria-hidden="true">
        <div style={s.endLine} />
        <span style={s.endFleuron}>❦</span>
        <div style={s.endLine} />
      </div>
      <div style={{ marginTop: 16, textAlign: 'center' }} aria-hidden="true">
        <p style={{
          fontFamily: "'Source Serif 4', var(--font-source-serif-var), Georgia, serif",
          fontSize: 13,
          color: 'var(--pb-faint, #6B634F)',
          lineHeight: 1.4,
          margin: 0,
        }}>
          <span style={{ fontStyle: 'italic', fontWeight: 300, opacity: 0.7 }}>tf</span>
          {' '}
          <span style={{ color: 'var(--pb-accent, #FF8240)' }}>❦</span>
          {' '}
          <span style={{ fontWeight: 500 }}>Thiago Figueiredo</span>
        </p>
        <p style={{
          fontFamily: "'Inter', var(--font-inter-var), Arial, sans-serif",
          fontSize: 11,
          color: 'var(--pb-faint, #6B634F)',
          marginTop: 2,
          letterSpacing: '0.02em',
        }}>
          <a href="https://bythiagofigueiredo.com" style={{ color: 'var(--pb-faint, #6B634F)', textDecoration: 'none' }}>
            bythiagofigueiredo.com
          </a>
        </p>
      </div>
    </>
  )
}

/* ── Layout component ────────────────────────────────────────────────────── */

export function localePath(locale: string | undefined): string {
  return locale === 'pt-BR' ? '/pt/' : '/'
}

interface UnsubscribeLayoutProps {
  state: StateKind
  title: string
  body: string
  backLabel: string
  manageLabel?: string
  lang?: string
  locale?: string
  signoff?: string
  form?: React.ReactNode
}

export function UnsubscribeLayout({
  state,
  title,
  body,
  backLabel,
  manageLabel,
  lang,
  locale,
  signoff,
  form,
}: UnsubscribeLayoutProps) {
  const { accent, icon } = STATE_CONFIG[state]
  const showManageLink = manageLabel && (state === 'ok' || state === 'already')

  return (
    <main style={s.outer} lang={lang}>
      <ResponsiveStyles />
      <GrainOverlay />

      <div style={s.column}>
        <Monogram />

        <div style={s.card} className="unsub-card">
          {/* Muted top stripe — departure theme, NOT orange */}
          <div style={s.stripe} />

          <div style={{ ...s.cardInner }} className="unsub-card-inner">
            {/* Farewell fleuron / state icon */}
            <div>
              {(state === 'initial' || state === 'ok') ? (
                <div
                  className="unsub-icon font-source-serif"
                  style={{ fontSize: 36, color: 'var(--pb-faint, #6B634F)', lineHeight: 1, marginBottom: 28 }}
                  role="img"
                  aria-hidden="true"
                >
                  {icon}
                </div>
              ) : (
                <div style={s.iconWrap(accent)} className="unsub-icon" role="img" aria-hidden="true">
                  {icon}
                </div>
              )}
            </div>

            {/* Thin divider below icon (error/not_found/already/invalid states only) */}
            {(state !== 'initial' && state !== 'ok') && (
              <div style={s.iconDivider(accent)} />
            )}

            <h1 style={s.title} className="unsub-title">{title}</h1>
            <p style={s.body}>{body}</p>

            {/* Sign-off for ok state */}
            {signoff && (
              <p style={s.signoff}>
                {signoff}
                <br />— Thiago
              </p>
            )}

            {/* Unsubscribe form (initial state only) */}
            {form}

            {/* Divider before home link */}
            <hr style={s.cardDivider} />

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              {showManageLink && (
                <a
                  href={`${localePath(locale)}newsletter`}
                  className="unsub-manage"
                  style={{
                    display: 'inline-block',
                    padding: '12px 32px',
                    border: '1.5px solid var(--pb-accent, #FF8240)',
                    borderRadius: 4,
                    background: 'transparent',
                    color: 'var(--pb-accent, #FF8240)',
                    fontFamily: 'var(--font-inter-var), Arial, sans-serif',
                    fontSize: 14,
                    fontWeight: 600,
                    letterSpacing: '0.01em',
                    textDecoration: 'none',
                    transition: 'background 0.2s ease, color 0.2s ease, transform 0.15s ease',
                  }}
                >
                  {manageLabel}
                </a>
              )}
              <a href={localePath(locale)} className="unsub-home-link" style={s.homeLink}>
                {backLabel}
                <span style={s.homeLinkArrow}>→</span>
              </a>
            </div>

            <EndMark />
          </div>
        </div>
      </div>
    </main>
  )
}
