import { Suspense } from 'react'
import { CmsLogin } from '@tn-figueiredo/cms/login'
import { loadBranding } from '@/lib/auth/auth-branding'
import { buildAuthTheme } from '@/lib/auth/auth-theme'
import { signInWithPassword, signInWithGoogle } from './actions'

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string }>
}) {
  const { next } = (await searchParams) ?? {}
  const redirectTo = next ?? '/cms'
  const branding = await loadBranding()
  const logo = branding?.logo_url ? (
    <img
      src={branding.logo_url}
      alt={branding.site_name ?? ''}
      style={{ maxHeight: 48, width: 'auto' }}
    />
  ) : undefined
  const theme = buildAuthTheme(branding?.primary_color)

  // CmsLogin internally calls useSearchParams (reads `?redirect=`). In Next 15
  // App Router, components that read searchParams during prerender must be
  // wrapped in a Suspense boundary — otherwise the build errors with
  // "missing-suspense-with-csr-bailout". Before the T10a split this page
  // inherited an implicit Suspense from `/cms/layout.tsx` (async server
  // layout); moving the authed layout under `(authed)/` removed that, so we
  // wrap explicitly here.
  return (
    <Suspense fallback={null}>
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
    </Suspense>
  )
}
