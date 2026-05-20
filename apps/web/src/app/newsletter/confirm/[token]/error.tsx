'use client'

export default function ConfirmError() {
  return (
    <main
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
          ⚠
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
          Something went wrong
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-jetbrains-var), monospace',
            fontSize: 14,
            lineHeight: 1.7,
            color: 'var(--pb-muted, #958A75)',
            margin: '0 0 32px',
            maxWidth: 420,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          An unexpected error occurred while confirming your subscription. Please try again later.
        </p>
        <hr
          style={{
            width: 32,
            height: 1,
            background: 'var(--pb-line, #332D25)',
            margin: '0 auto 20px',
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
          Back to home
        </a>
      </div>
    </main>
  )
}
