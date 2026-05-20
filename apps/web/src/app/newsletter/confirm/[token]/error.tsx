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
  if (window.location.pathname.startsWith('/pt')) return 'pt-BR'
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
      {/* TF Monogram — outside card */}
      <div className="mb-6 flex flex-col items-center">
        <span
          className="inline-flex items-baseline font-source-serif select-none"
          style={{ letterSpacing: '-0.08em', fontSize: 56 }}
          role="img"
          aria-label="TF"
        >
          <span style={{ fontWeight: 500, lineHeight: 1, color: 'var(--pb-ink)' }}>T</span>
          <span
            style={{
              fontWeight: 500,
              fontStyle: 'italic',
              lineHeight: 1,
              color: 'var(--pb-accent)',
              opacity: 0.95,
            }}
          >
            F
          </span>
        </span>
      </div>

      {/* Card */}
      <div
        className="w-full overflow-hidden rounded-md"
        style={{
          maxWidth: 680,
          background: 'var(--pb-paper)',
          boxShadow: 'var(--pb-shadow-card)',
        }}
      >
        {/* Top stripe — muted error color */}
        <div
          aria-hidden="true"
          className="h-1 w-full"
          style={{ background: '#C14513', opacity: 0.7 }}
        />

        {/* Card body */}
        <div className="px-8 py-12 sm:px-14 sm:py-14 text-center">
          {/* Icon */}
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-5"
            style={{
              border: '2px solid #C14513',
              color: '#C14513',
              fontSize: 24,
              lineHeight: 1,
            }}
            role="img"
            aria-hidden="true"
          >
            ⚠
          </div>

          {/* Title */}
          <h1
            className="font-fraunces font-semibold m-0 mb-3 leading-tight"
            style={{
              fontSize: 'clamp(28px, 5vw, 34px)',
              color: 'var(--pb-ink)',
            }}
          >
            {c.title}
          </h1>

          {/* Body */}
          <p
            className="font-jetbrains text-sm leading-[1.7] mb-8 mx-auto"
            style={{ maxWidth: 420, color: 'var(--pb-muted)' }}
          >
            {c.body}
          </p>

          {/* Retry button */}
          <button
            onClick={reset}
            className="font-jetbrains text-sm font-semibold px-5 py-2.5 rounded cursor-pointer mb-4 transition-opacity duration-150 hover:opacity-90"
            style={{
              background: '#C14513',
              color: '#fff',
              border: 'none',
            }}
          >
            {c.retry}
          </button>

          {/* Divider */}
          <hr
            className="border-none mx-auto mb-5"
            style={{
              width: 32,
              height: 1,
              background: 'var(--pb-line)',
              marginTop: 16,
            }}
          />

          {/* Home link */}
          <a
            href={homePath}
            className="font-jetbrains text-xs uppercase pb-0.5 transition-colors duration-150"
            style={{
              color: 'var(--pb-muted)',
              textDecoration: 'none',
              borderBottom: '1px dashed var(--pb-line)',
              letterSpacing: '0.05em',
            }}
          >
            {c.back}
          </a>
        </div>
      </div>

      {/* End mark — outside card */}
      <div className="mt-8 flex items-center gap-3" aria-hidden="true">
        <span className="block h-px w-10" style={{ background: 'var(--pb-line)' }} />
        <span
          className="font-source-serif text-base"
          style={{ color: 'var(--pb-muted)', opacity: 0.5 }}
        >
          ❦
        </span>
        <span className="block h-px w-10" style={{ background: 'var(--pb-line)' }} />
      </div>

      {/* Signature — outside card */}
      <div className="mt-4 text-center">
        <p
          className="font-jetbrains text-xs"
          style={{ color: 'var(--pb-muted)', opacity: 0.5 }}
        >
          tf ❦ Thiago Figueiredo
        </p>
        <a
          href="https://bythiagofigueiredo.com"
          className="font-jetbrains text-xs"
          style={{ color: 'var(--pb-muted)', opacity: 0.4, textDecoration: 'none' }}
          tabIndex={-1}
          aria-hidden="true"
        >
          bythiagofigueiredo.com
        </a>
      </div>
    </main>
  )
}
