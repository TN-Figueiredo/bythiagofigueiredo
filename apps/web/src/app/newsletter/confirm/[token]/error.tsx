'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

const COPY = {
  en: {
    title: 'Something went wrong',
    body: 'An unexpected error occurred while confirming your subscription. Please try again later.',
    retry: 'Try again',
    back: 'Back to home',
  },
  'pt-BR': {
    title: 'Algo deu errado',
    body: 'Ocorreu um erro inesperado ao confirmar sua inscrição. Tente novamente mais tarde.',
    retry: 'Tentar novamente',
    back: 'Voltar ao início',
  },
} as const

function detectLocale(): keyof typeof COPY {
  if (typeof window === 'undefined') return 'pt-BR'
  const htmlLang = document.documentElement.lang
  if (htmlLang?.startsWith('pt')) return 'pt-BR'
  if (navigator.language?.startsWith('pt')) return 'pt-BR'
  return 'en'
}

export default function ConfirmError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: { component: 'newsletter-confirm', boundary: 'error' },
    })
  }, [error])

  const loc = detectLocale()
  const c = COPY[loc]
  const homePath = loc === 'pt-BR' ? '/pt' : '/'

  return (
    <main
      lang={loc === 'pt-BR' ? 'pt-BR' : 'en'}
      className="min-h-screen flex flex-col items-center justify-center px-6 py-10 bg-[var(--pb-bg)]"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E")`,
      }}
    >
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
          .confirm-error-card-body { padding: 36px 28px 32px !important; }
          .confirm-error-title { font-size: 26px !important; }
          .confirm-error-monogram { font-size: 38px !important; margin-bottom: 24px !important; }
        }
      `}</style>

      {/* Page wrapper — constrains all content to 520px */}
      <div style={{ maxWidth: 520, width: '100%' }}>

        {/* TF Monogram — outside card */}
        <div className="flex justify-center" style={{ marginBottom: 32, animation: 'fadeIn 0.5s ease-out' }}>
          <span
            className="confirm-error-monogram font-source-serif select-none"
            style={{ fontSize: 44, fontWeight: 500, letterSpacing: '-4px', lineHeight: 1, color: 'var(--pb-ink)', whiteSpace: 'nowrap' }}
            role="img"
            aria-label="TF"
          >
            T<span style={{ fontStyle: 'italic', color: 'var(--pb-accent)' }}>F</span><span style={{ fontSize: 8, color: 'var(--pb-ink)', verticalAlign: 'middle', marginLeft: 2 }}>●</span>
          </span>
        </div>

        {/* Card */}
        <div
          role="alert"
          aria-live="assertive"
          className="w-full overflow-hidden rounded-md"
          style={{
            maxWidth: 520,
            background: 'var(--pb-paper)',
            boxShadow: 'var(--pb-shadow-card)',
            animation: 'fadeUp 0.6s ease-out both',
            animationDelay: '0.15s',
          }}
        >
          {/* Top stripe — muted error color */}
          <div
            aria-hidden="true"
            className="w-full"
            style={{ height: 4, background: '#C14513', opacity: 0.7 }}
          />

          {/* Card body */}
          <div className="confirm-error-card-body text-center" style={{ padding: '48px 48px 44px' }}>
            {/* Icon */}
            <div
              className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-5"
              style={{
                border: '2px solid #C14513',
                color: '#C14513',
                fontSize: 24,
                lineHeight: 1,
                animation: 'fadeIn 0.4s ease-out both',
                animationDelay: '0.45s',
              }}
              role="img"
              aria-hidden="true"
            >
              ⚠
            </div>

            {/* Title */}
            <h1
              className="confirm-error-title font-fraunces font-medium m-0 mb-4"
              style={{
                fontSize: 'clamp(26px, 5vw, 30px)',
                color: 'var(--pb-ink)',
                lineHeight: 1.2,
                letterSpacing: '-0.02em',
              }}
            >
              {c.title}
            </h1>

            {/* Body */}
            <p
              className="font-source-serif leading-[1.65] mb-8 mx-auto"
              style={{ maxWidth: 420, color: 'var(--pb-muted)', fontSize: 17 }}
            >
              {c.body}
            </p>

            {/* Retry button */}
            <button
              onClick={reset}
              className="font-inter cursor-pointer mb-4 transition-opacity duration-150 hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--pb-accent)] focus-visible:outline-none"
              style={{
                display: 'inline-block',
                padding: '15px 40px',
                background: '#C14513',
                color: '#fff',
                border: 'none',
                fontSize: 15,
                fontWeight: 600,
                borderRadius: 4,
                letterSpacing: '0.01em',
              }}
            >
              {c.retry}
            </button>

            {/* Divider */}
            <hr
              className="border-none"
              style={{
                width: '100%',
                height: 1,
                background: 'var(--pb-line)',
                margin: '32px 0',
              }}
            />

            {/* Home link */}
            <a
              href={homePath}
              className="font-inter transition-colors duration-150"
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--pb-faint)',
                textDecoration: 'none',
              }}
            >
              {c.back} <span style={{ marginLeft: 4 }}>→</span>
            </a>

            {/* End mark — inside card */}
            <div className="flex items-center justify-center" style={{ marginTop: 36, gap: 14 }} aria-hidden="true">
              <span className="block" style={{ width: 36, height: 1, background: 'var(--pb-line)' }} />
              <span className="font-source-serif" style={{ fontSize: 16, color: 'var(--pb-accent)', lineHeight: 1 }}>❦</span>
              <span className="block" style={{ width: 36, height: 1, background: 'var(--pb-line)' }} />
            </div>

            {/* Signature — inside card */}
            <div className="mt-4 text-center">
              <p className="font-source-serif" style={{ fontSize: 13, color: 'var(--pb-faint)', lineHeight: 1.4, margin: 0 }}>
                <span style={{ fontStyle: 'italic', fontWeight: 300, opacity: 0.7 }}>tf</span>
                {' '}
                <span style={{ color: 'var(--pb-accent)' }}>❦</span>
                {' '}
                <span style={{ fontWeight: 500 }}>Thiago Figueiredo</span>
              </p>
              <p className="font-inter" style={{ fontSize: 11, color: 'var(--pb-faint)', marginTop: 2, letterSpacing: '0.02em' }}>
                <a
                  href="https://bythiagofigueiredo.com"
                  style={{ color: 'var(--pb-faint)', textDecoration: 'none' }}
                  tabIndex={-1}
                  aria-hidden="true"
                >
                  bythiagofigueiredo.com
                </a>
              </p>
            </div>

          </div>
        </div>

      </div>
    </main>
  )
}
