'use client'
import { AUTH_THEME } from '@/lib/auth/auth-theme'

/** Reset sem sessão de recuperação (link vencido, já usado ou aberto direto). Logan A2. */
export function ResetExpired({ forgotHref, loginHref }: { forgotHref: string; loginHref: string }) {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: AUTH_THEME.bg,
        color: AUTH_THEME.text,
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: 400,
          padding: 24,
          borderRadius: 12,
          background: AUTH_THEME.card,
          border: `1px solid ${AUTH_THEME.border}`,
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>Este link não vale mais</h1>
        <p style={{ color: AUTH_THEME.muted, margin: '12px 0 20px', lineHeight: 1.5 }}>
          Links de redefinição valem por tempo limitado e só funcionam uma vez. Peça um novo; leva menos de um minuto.
        </p>
        <a
          href={forgotHref}
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          style={{
            display: 'block',
            textAlign: 'center',
            minHeight: 44,
            lineHeight: '44px',
            borderRadius: 8,
            background: AUTH_THEME.accent,
            color: '#fff',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          Pedir novo link
        </a>
        <a
          href={loginHref}
          style={{ display: 'block', textAlign: 'center', marginTop: 16, color: AUTH_THEME.text }}
        >
          Voltar para o login
        </a>
      </section>
    </main>
  )
}
