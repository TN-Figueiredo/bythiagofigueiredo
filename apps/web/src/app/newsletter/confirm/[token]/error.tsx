'use client'

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
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const loc = detectLocale()
  const c = COPY[loc]
  return (
    <main
      lang={loc === 'pt-BR' ? 'pt-BR' : 'en'}
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        background: 'var(--pb-bg, #1A1714)',
      }}
    >
      <div style={{ width: '100%', maxWidth: 520, textAlign: 'center' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 56,
            height: 56,
            borderRadius: '50%',
            border: '2px solid #C14513',
            fontSize: 24,
            lineHeight: 1,
            marginBottom: 20,
            color: '#C14513',
          }}
          role="img"
          aria-hidden="true"
        >
          &#x26A0;
        </div>
        <div
          style={{
            width: 48,
            height: 3,
            borderRadius: 2,
            background: '#C14513',
            margin: '0 auto 28px',
          }}
        />
        <h1
          style={{
            fontFamily: 'var(--font-fraunces-var), serif',
            fontSize: 28,
            fontWeight: 600,
            color: 'var(--pb-ink, #F5EFE6)',
            margin: '0 0 12px',
            lineHeight: 1.2,
          }}
        >
          {c.title}
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-jetbrains-var), monospace',
            fontSize: 14,
            lineHeight: 1.7,
            color: 'var(--pb-muted, #958A75)',
            margin: '0 0 24px',
            maxWidth: 420,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          {c.body}
        </p>
        <button
          onClick={reset}
          style={{
            fontFamily: 'var(--font-jetbrains-var), monospace',
            fontSize: 13,
            padding: '10px 20px',
            background: '#C14513',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontWeight: 600,
            marginBottom: 16,
          }}
        >
          {c.retry}
        </button>
        <hr
          style={{
            width: 32,
            height: 1,
            background: 'var(--pb-line, #332D25)',
            margin: '16px auto 20px',
            border: 'none',
          }}
        />
        <a
          href="/"
          style={{
            fontFamily: 'var(--font-jetbrains-var), monospace',
            fontSize: 12,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: 'var(--pb-muted, #958A75)',
            textDecoration: 'none',
            borderBottom: '1px dashed var(--pb-line, #332D25)',
            paddingBottom: 2,
          }}
        >
          {c.back}
        </a>
      </div>
    </main>
  )
}
