'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

const COPY = {
  en: {
    title: 'Something went wrong',
    body: "We couldn't process your request. Please try again.",
    retry: 'Try again',
    back: 'Go to site',
  },
  'pt-BR': {
    title: 'Algo deu errado',
    body: 'Não foi possível processar sua solicitação. Tente novamente.',
    retry: 'Tentar novamente',
    back: 'Ir para o site',
  },
} as const

function detectLocale(): keyof typeof COPY {
  if (typeof window === 'undefined') return 'pt-BR'
  const htmlLang = document.documentElement.lang
  if (htmlLang?.startsWith('pt')) return 'pt-BR'
  if (navigator.language?.startsWith('pt')) return 'pt-BR'
  return 'en'
}

export default function UnsubscribeError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: { component: 'newsletter-unsubscribe', boundary: 'error' },
    })
  }, [error])

  const loc = detectLocale()
  const c = COPY[loc]
  const homePath = loc === 'pt-BR' ? '/pt' : '/'

  const s = {
    outer: {
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 24px 56px',
      background: 'var(--pb-bg, #1A1714)',
      position: 'relative' as const,
      isolation: 'isolate' as const,
    } as React.CSSProperties,

    grain: {
      position: 'absolute' as const,
      inset: 0,
      zIndex: 0,
      pointerEvents: 'none' as const,
      opacity: 0.35,
    } as React.CSSProperties,

    column: {
      position: 'relative' as const,
      zIndex: 1,
      width: '100%',
      maxWidth: 680,
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
    } as React.CSSProperties,

    monogramWrap: {
      marginBottom: 20,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    } as React.CSSProperties,

    monogramBox: {
      width: 56,
      height: 56,
      borderRadius: '50%',
      border: '1.5px solid var(--pb-line, #332D25)',
      background: 'var(--pb-paper, #221E1A)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
    } as React.CSSProperties,

    monogramText: {
      fontFamily: 'var(--font-source-serif-var), serif',
      fontSize: 22,
      fontWeight: 500,
      letterSpacing: '-0.06em',
      lineHeight: 1,
      color: 'var(--pb-ink, #F5EFE6)',
    } as React.CSSProperties,

    monogramItalic: {
      fontStyle: 'italic' as const,
      color: 'var(--pb-muted, #958A75)',
    } as React.CSSProperties,

    card: {
      width: '100%',
      background: 'var(--pb-paper, #221E1A)',
      borderRadius: 6,
      boxShadow: 'var(--pb-shadow-card, 0 2px 0 rgba(0,0,0,0.5), 0 12px 24px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.03))',
      overflow: 'hidden',
      textAlign: 'center' as const,
    } as React.CSSProperties,

    stripe: {
      height: 3,
      background: '#C14513',
      opacity: 0.7,
      borderRadius: '6px 6px 0 0',
    } as React.CSSProperties,

    cardInner: {
      padding: '40px 40px 44px',
    } as React.CSSProperties,

    iconWrap: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 52,
      height: 52,
      borderRadius: '50%',
      border: '1.5px solid #C14513',
      fontSize: 22,
      lineHeight: 1,
      marginBottom: 24,
      color: '#C14513',
      opacity: 0.75,
    } as React.CSSProperties,

    iconDivider: {
      width: 32,
      height: 1,
      background: '#C14513',
      margin: '0 auto 24px',
      opacity: 0.3,
    } as React.CSSProperties,

    title: {
      fontFamily: 'var(--font-fraunces-var), serif',
      fontSize: 28,
      fontWeight: 600,
      color: 'var(--pb-ink, #F5EFE6)',
      margin: '0 0 14px',
      lineHeight: 1.2,
    } as React.CSSProperties,

    body: {
      fontFamily: 'var(--font-source-serif-var), serif',
      fontSize: 17,
      lineHeight: 1.7,
      color: 'var(--pb-muted, #958A75)',
      margin: '0 0 28px',
      maxWidth: 480,
      marginLeft: 'auto',
      marginRight: 'auto',
    } as React.CSSProperties,

    retryBtn: {
      display: 'inline-block',
      padding: '10px 24px',
      border: '1.5px solid #C14513',
      borderRadius: 4,
      background: '#C14513',
      color: '#fff',
      fontFamily: 'var(--font-jetbrains-var), monospace',
      fontSize: 14,
      fontWeight: 600,
      cursor: 'pointer',
      marginBottom: 28,
      transition: 'opacity 0.15s ease',
    } as React.CSSProperties,

    cardDivider: {
      width: '100%',
      height: 1,
      background: 'var(--pb-line, #332D25)',
      border: 'none',
      margin: '0 0 24px',
    } as React.CSSProperties,

    homeLink: {
      fontFamily: 'var(--font-jetbrains-var), monospace',
      fontSize: 12,
      letterSpacing: '0.06em',
      textTransform: 'uppercase' as const,
      color: 'var(--pb-muted, #958A75)',
      textDecoration: 'none',
      borderBottom: '1px dashed var(--pb-line, #332D25)',
      paddingBottom: 2,
    } as React.CSSProperties,

    endMark: {
      marginTop: 36,
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      gap: 8,
    } as React.CSSProperties,

    endLine: {
      width: 40,
      height: 1,
      background: 'var(--pb-line, #332D25)',
    } as React.CSSProperties,

    endFleuron: {
      fontFamily: 'serif',
      fontSize: 14,
      color: 'var(--pb-faint, #928871)',
      opacity: 0.5,
      lineHeight: 1,
    } as React.CSSProperties,

    signature: {
      fontFamily: 'var(--font-source-serif-var), serif',
      fontSize: 12,
      color: 'var(--pb-faint, #928871)',
      opacity: 0.6,
      letterSpacing: '0.02em',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
    } as React.CSSProperties,
  }

  return (
    <main
      lang={loc === 'pt-BR' ? 'pt-BR' : 'en'}
      style={s.outer}
    >
      {/* Grain texture */}
      <svg
        aria-hidden="true"
        style={s.grain}
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height="100%"
      >
        <filter id="unsub-error-grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.65"
            numOctaves="3"
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#unsub-error-grain)" />
      </svg>

      <div style={s.column}>
        {/* TF Monogram */}
        <div style={s.monogramWrap} aria-hidden="true">
          <div style={s.monogramBox}>
            <span style={s.monogramText}>
              T<span style={s.monogramItalic}>F</span>
            </span>
          </div>
        </div>

        {/* Card */}
        <div role="alert" aria-live="assertive" style={s.card}>
          {/* Error-colored top stripe */}
          <div aria-hidden="true" style={s.stripe} />

          <div style={s.cardInner}>
            {/* Warning icon */}
            <div>
              <div style={s.iconWrap} role="img" aria-hidden="true">
                ⚠
              </div>
            </div>

            {/* Thin divider below icon */}
            <div style={s.iconDivider} />

            <h1 style={s.title}>{c.title}</h1>
            <p style={s.body}>{c.body}</p>

            {/* Retry button */}
            <button
              onClick={reset}
              style={s.retryBtn}
              className="hover:opacity-90 transition-opacity focus-visible:ring-2 focus-visible:ring-[var(--pb-accent)] focus-visible:outline-none"
            >
              {c.retry}
            </button>

            {/* Divider before home link */}
            <hr style={s.cardDivider} />

            <a href={homePath} style={s.homeLink}>
              {c.back}
              <span style={{ marginLeft: 4 }}>→</span>
            </a>
          </div>
        </div>

        {/* End mark */}
        <div style={s.endMark} aria-hidden="true">
          <div style={s.endLine} />
          <span style={s.endFleuron}>❦</span>
          <div style={s.endLine} />
          <span style={s.signature}>
            <span style={{ fontWeight: 500, letterSpacing: '-0.04em' }}>tf</span>
            <span style={{ opacity: 0.45 }}>❦</span>
            <span>Thiago Figueiredo</span>
          </span>
        </div>
      </div>
    </main>
  )
}
