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

  // CmsLogin internally calls useSearchParams (reads `?redirect=`, which this page does not use: the destination comes from `next`, validated by destinoSeguro). In Next 15
  // App Router, components that read searchParams during prerender must be
  // wrapped in a Suspense boundary — otherwise the build errors with
  // "missing-suspense-with-csr-bailout". Before the T10a split this page
  // inherited an implicit Suspense from `/cms/layout.tsx` (async server
  // layout); moving the authed layout under `(authed)/` removed that, so we
  // wrap explicitly here.
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
