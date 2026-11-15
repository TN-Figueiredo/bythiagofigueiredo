import { Suspense } from 'react'
import { CmsLogin } from '@tn-figueiredo/cms/login'
import { loadBranding } from '@/lib/auth/auth-branding'
import { buildAuthTheme } from '@/lib/auth/auth-theme'
import { LoginSemGoogle } from '@/lib/auth/login-sem-google'
import { FRASES_DA_TELA } from '@/lib/youtube/observatorio/acesso-ia/frases'
import { FRASES_CONECTAR } from '@/lib/youtube/observatorio/acesso-ia/frases-conectar'
import { destinoDoLogin } from './destino'
import { signInWithPassword, signInWithGoogle } from './actions'

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string; ia?: string }>
}) {
  const { next, ia } = (await searchParams) ?? {}
  const redirectTo = destinoDoLogin(typeof next === 'string' ? next : undefined, typeof ia === 'string' ? ia : undefined)
  const contexto = redirectTo.startsWith('/oauth/consentimento')
    ? FRASES_DA_TELA.login_contexto
    : redirectTo.startsWith('/cms/conectar-ia')
      ? `${FRASES_CONECTAR.loginContexto}.`
      : null
  const branding = await loadBranding()
  const logo = branding?.logo_url ? (
    <img
      src={branding.logo_url}
      alt={branding.site_name ?? ''}
      style={{ maxHeight: 48, width: 'auto' }}
    />
  ) : undefined
  const theme = buildAuthTheme(branding?.primary_color)

  // CmsLogin (@tn-figueiredo/cms 0.2.0) does NOT read searchParams: it navigates
  // only through the `redirectTo` prop (window.location.href). The destination
  // comes from `next`, validated by destinoSeguro; LoginSemGoogle does not read
  // searchParams either. The Suspense boundary dates from the T10a split, when
  // CmsLogin still called useSearchParams (Next would fail the build with
  // "missing-suspense-with-csr-bailout" without it). It is harmless now; remove
  // it only together with a `next build` check.
  return (
    <Suspense fallback={null}>
      <LoginSemGoogle>
        {contexto ? <p data-testid="login-contexto" style={{ textAlign: 'center', fontSize: 14, lineHeight: '20px', color: 'var(--muted, #6A5F48)', maxWidth: 400, margin: '0 auto 12px', padding: '0 16px' }}>{contexto}</p> : null}
        <CmsLogin
          actions={{ signInWithPassword, signInWithGoogle }}
          redirectTo={redirectTo}
          logo={logo}
          theme={theme}
          turnstile={
            process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
              ? { siteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY }
              : undefined
          }
        />
      </LoginSemGoogle>
    </Suspense>
  )
}
