import { Suspense } from 'react'
import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { AdminLogin } from '@tn-figueiredo/admin/login'
import { signInWithPassword, signInWithGoogle } from './actions'

/**
 * Track F4 — per-site branding for the admin login. Mirrors the CMS login
 * page: reads `x-site-id` (middleware) + calls `get_site_branding()` through
 * the anon client to resolve logo/accent colour. See
 * `apps/web/src/app/cms/login/page.tsx` for the shared contract.
 */
interface SiteBrandingRow {
  site_name?: string
  primary_domain?: string
  logo_url?: string | null
  primary_color?: string | null
  default_locale?: string
}

async function loadBranding(): Promise<SiteBrandingRow | null> {
  const h = await headers()
  const siteId = h.get('x-site-id')
  if (!siteId) return null
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) return null
  const client = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data } = await client.rpc('get_site_branding', { p_site_id: siteId })
  return (data ?? null) as SiteBrandingRow | null
}

export default async function Page() {
  const branding = await loadBranding()
  const logo = branding?.logo_url ? (
    <img
      src={branding.logo_url}
      alt={branding.site_name ?? ''}
      style={{ maxHeight: 48, width: 'auto' }}
    />
  ) : undefined
  const theme = branding?.primary_color
    ? { accent: branding.primary_color, accentHover: branding.primary_color }
    : undefined

  // AdminLogin internally calls useSearchParams (reads `?redirect=`). In Next 15
  // App Router, components that read searchParams during prerender must be
  // wrapped in a Suspense boundary — otherwise the build errors with
  // "missing-suspense-with-csr-bailout". Before the T10a split this page
  // inherited an implicit Suspense from `/admin/layout.tsx` (async server
  // layout); moving the authed layout under `(authed)/` removed that, so we
  // wrap explicitly here.
  return (
    <Suspense fallback={null}>
      <AdminLogin
        actions={{ signInWithPassword, signInWithGoogle }}
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
