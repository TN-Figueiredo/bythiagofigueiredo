import { NextResponse, type NextRequest } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import * as Sentry from '@sentry/nextjs'
import { createAuthMiddleware } from '@tn-figueiredo/auth-nextjs/middleware'
import { SupabaseRingContext } from '@tn-figueiredo/cms/ring'

/**
 * Middleware responsibilities:
 * 1. Subdomain rewrite: dev.bythiagofigueiredo.com → /dev internally
 * 2. Site resolution (FIRST, Edge-safe): hostname → site_id/org_id/locale
 *    - Uses **anon key** — service-role bypass is not needed for
 *      `sites.getByDomain` since the RLS policy allows public read
 *    - Fail-loud on unknown hostname: Sentry capture + rewrite `/cms`/`/admin`
 *      paths to `/site-not-configured`
 *    - `cms_enabled` kill switch: rewrites `/cms/*` to `/cms/disabled` when
 *      the site has the column explicitly set to `false`. Defaults
 *      permissively (undefined → allow) for backward compat while Track A
 *      schema migration is in-flight.
 *    - Attaches `x-site-id / x-org-id / x-default-locale` headers for the
 *      downstream response.
 * 3. Auth gating (AFTER site resolution):
 *    - `/admin` protected by adminAuth (signInPath `/admin/login`)
 *    - `/cms` protected by cmsAuth (signInPath `/cms/login`)
 *
 * Order matters: site resolution runs FIRST so that an unknown host or a
 * disabled-CMS site short-circuits to a friendly page *before* auth can
 * redirect to `/cms/login` (which would be a confusing UX for misconfigured
 * domains).
 *
 * Note: `@tn-figueiredo/auth-nextjs` exports `buildAuthRegex` for consumers
 * that use locale-prefixed routing (next-intl, [locale] segments). apps/web
 * is single-locale at the URL level today, so plain regex literals suffice.
 * If locale routing is ever adopted, replace the literals below with
 * `buildAuthRegex({ path: '/admin/login', locales: [...] })` etc.
 */

const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
}

const adminAuth = createAuthMiddleware({
  publicRoutes: [
    /^\/admin\/login$/,
    /^\/admin\/forgot$/,
    /^\/admin\/reset/,
    // Logout POSTs clear the session and redirect to /admin/login. Without
    // this, the middleware would race the outgoing 303: the cookie is cleared
    // in the response but the *next* guarded request (the redirect target)
    // runs through the middleware and sees no session — which is fine — but
    // the logout route itself also needs to execute, and a mid-request
    // redirect by the middleware would swallow the signOut server action.
    /^\/admin\/logout$/,
    /^\/auth\/callback$/,
    /^\/api\//,
    /^\/_next\//,
  ],
  protectedRoutes: [/^\/admin(\/.*)?$/],
  signInPath: '/admin/login',
  env,
})

const cmsAuth = createAuthMiddleware({
  publicRoutes: [
    /^\/cms\/login$/,
    /^\/cms\/forgot$/,
    /^\/cms\/reset/,
    // See /admin/logout comment above — same rationale applies to the cms area.
    /^\/cms\/logout$/,
    /^\/auth\/callback$/,
    /^\/api\//,
    /^\/_next\//,
  ],
  protectedRoutes: [/^\/cms(\/.*)?$/],
  signInPath: '/cms/login',
  env,
})

// Lazy anon-key client + ring context. Instantiating `createClient` at module
// scope would throw `"supabaseUrl is required."` in environments where the
// public env vars are not present (e.g. vitest without `.env.local`). The
// lazy factory defers client construction and wraps it in a try/catch so a
// missing env triggers the /site-error fallback cleanly in dev/tests. In
// production the env MUST be present — the healthcheck covers that.
//
// Tests that mock `@tn-figueiredo/cms/ring` bypass createClient entirely
// because the mocked constructor ignores the passed client. To support
// that, we pass a sentinel null to the SupabaseRingContext constructor
// when createClient fails so the mock still works.
let cachedRing: SupabaseRingContext | null = null
function getRingContext(): SupabaseRingContext {
  if (cachedRing) return cachedRing
  let anonClient: SupabaseClient | null = null
  try {
    anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
  } catch {
    anonClient = null
  }
  // `as SupabaseClient` — the ring context in tests is mocked and ignores
  // the client. In prod the try succeeds and we pass a real client.
  cachedRing = new SupabaseRingContext(anonClient as SupabaseClient)
  return cachedRing
}

export async function middleware(
  request: NextRequest,
): Promise<NextResponse> {
  const host = request.headers.get('host') ?? request.nextUrl.host ?? ''
  const hostname = host.split(':')[0] ?? ''
  const url = request.nextUrl.clone()
  const { pathname } = request.nextUrl

  // Dev subdomain rewrite (unchanged from Sprint 1a) — runs before site
  // resolution because the rewrite changes the pathname, not the host.
  //
  // Sprint 5b PR-B: short-circuit `/sitemap.xml` and `/robots.txt` so the
  // dev subdomain rewrite does NOT divert them to `/dev/sitemap.xml` etc.
  // The route handlers themselves detect `isPreviewOrDevHost(host)` and
  // return `Disallow: /` (robots) or `[]` (sitemap) for dev — but only if
  // they actually run, which requires NOT being rewritten away first.
  const isDevSubdomain =
    hostname === 'dev.bythiagofigueiredo.com' ||
    hostname === 'dev.localhost'
  const isSeoRoute = pathname === '/sitemap.xml' || pathname === '/robots.txt'
  if (isDevSubdomain && !isSeoRoute && !url.pathname.startsWith('/dev')) {
    url.pathname = `/dev${url.pathname === '/' ? '' : url.pathname}`
    return NextResponse.rewrite(url)
  }

  // --- i18n: locale prefix detection + legacy redirects ---
  const skipLocale =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/cms') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/og/')

  let detectedLocale = 'en'
  let effectivePathname = pathname

  if (!skipLocale) {
    // Legacy URL redirects (301) — preserve SEO equity
    if (pathname === '/pt-BR' || pathname.startsWith('/pt-BR/')) {
      const rest = pathname.slice(6) // '/pt-BR'.length = 6
      return NextResponse.redirect(new URL(`/pt${rest}`, request.url), 301)
    }
    const legacyContentMatch = pathname.match(/^\/(blog|campaigns)\/(pt-BR|en)(?:\/(.*))?$/)
    if (legacyContentMatch) {
      const [, section, locale, slug] = legacyContentMatch
      if (locale === 'en') {
        return NextResponse.redirect(
          new URL(slug ? `/${section}/${slug}` : `/${section}`, request.url),
          301,
        )
      }
      return NextResponse.redirect(
        new URL(slug ? `/pt/${section}/${slug}` : `/pt/${section}`, request.url),
        301,
      )
    }

    // Uppercase normalization: /PT/... → 308 → /pt/...
    if (pathname === '/PT' || pathname.startsWith('/PT/')) {
      return NextResponse.redirect(
        new URL(`/pt${pathname.slice(3)}`, request.url),
        308,
      )
    }

    // Active /pt/ prefix detection
    if (pathname === '/pt' || pathname.startsWith('/pt/')) {
      detectedLocale = 'pt-BR'
      effectivePathname = pathname.slice(3) || '/'
    }
  }

  // Dev hostname override: when running on localhost, resolve the site using
  // NEXT_PUBLIC_DEV_SITE_HOSTNAME instead of 'localhost' (which isn't
  // registered in the DB). Set in .env.local — no-op in production because
  // the var is absent and the real hostname is used as-is.
  const resolveHostname =
    (hostname === 'localhost' || hostname === '127.0.0.1') &&
    process.env.NEXT_PUBLIC_DEV_SITE_HOSTNAME
      ? process.env.NEXT_PUBLIC_DEV_SITE_HOSTNAME
      : hostname

  // Site resolution (Edge-safe, anon key) — use effectivePathname (stripped)
  const siteRes = await resolveSite(request, resolveHostname, effectivePathname)

  // Inject x-locale header
  if (!skipLocale) {
    siteRes.response.headers.set('x-locale', detectedLocale)
  }

  // If /pt/ prefix was detected, rewrite to stripped path
  if (detectedLocale !== 'en' && !siteRes.shortCircuit) {
    const rewriteUrl = request.nextUrl.clone()
    rewriteUrl.pathname = effectivePathname
    const res = NextResponse.rewrite(rewriteUrl)
    // Copy all headers from site resolution
    siteRes.response.headers.forEach((value, key) => {
      res.headers.set(key, value)
    })
    res.headers.set('x-locale', detectedLocale)

    // Auth gating for rewritten paths
    if (effectivePathname.startsWith('/admin')) {
      const authRes = await adminAuth(request)
      return mergeSiteHeaders(authRes, res)
    }
    if (effectivePathname.startsWith('/cms')) {
      const authRes = await cmsAuth(request)
      return mergeSiteHeaders(authRes, res)
    }
    return res
  }

  if (siteRes.shortCircuit) return siteRes.response

  // Auth gating — dispatch to area-specific instance. The site headers are
  // propagated by `resolveSite` into the shared response object below.
  if (pathname.startsWith('/admin')) {
    const authRes = await adminAuth(request)
    return mergeSiteHeaders(authRes, siteRes.response)
  }
  if (pathname.startsWith('/cms')) {
    const authRes = await cmsAuth(request)
    return mergeSiteHeaders(authRes, siteRes.response)
  }

  return siteRes.response
}

type SiteResolution =
  | { shortCircuit: true; response: NextResponse }
  | { shortCircuit: false; response: NextResponse }

async function resolveSite(
  request: NextRequest,
  hostname: string,
  pathname: string,
): Promise<SiteResolution> {
  const res = NextResponse.next()
  try {
    const ring = getRingContext()
    const site = await ring.getSiteByDomain(hostname)
    if (!site) {
      Sentry.captureException(new Error(`Unknown hostname: ${hostname}`), {
        level: 'warning',
      })
      if (pathname.startsWith('/cms') || pathname.startsWith('/admin')) {
        return {
          shortCircuit: true,
          response: NextResponse.rewrite(
            new URL('/site-not-configured', request.url),
          ),
        }
      }
      return { shortCircuit: false, response: res }
    }
    // cms_enabled kill switch — only rewrite when explicitly set to false.
    // `undefined` (schema not yet migrated) defaults to allow for backward
    // compat with Track A in-flight.
    const cmsEnabled = (site as { cms_enabled?: boolean }).cms_enabled
    if (pathname.startsWith('/cms') && cmsEnabled === false) {
      return {
        shortCircuit: true,
        response: NextResponse.rewrite(
          new URL('/cms/disabled', request.url),
        ),
      }
    }
    res.headers.set('x-site-id', site.id)
    res.headers.set('x-org-id', site.org_id)
    res.headers.set('x-default-locale', site.default_locale)
    return { shortCircuit: false, response: res }
  } catch (err) {
    Sentry.captureException(err)
    return {
      shortCircuit: true,
      response: NextResponse.rewrite(new URL('/site-error', request.url)),
    }
  }
}

function mergeSiteHeaders(
  target: NextResponse,
  source: NextResponse,
): NextResponse {
  const siteId = source.headers.get('x-site-id')
  const orgId = source.headers.get('x-org-id')
  const defaultLocale = source.headers.get('x-default-locale')
  const xLocale = source.headers.get('x-locale')
  if (siteId) target.headers.set('x-site-id', siteId)
  if (orgId) target.headers.set('x-org-id', orgId)
  if (defaultLocale) target.headers.set('x-default-locale', defaultLocale)
  if (xLocale) target.headers.set('x-locale', xLocale)
  return target
}

export default middleware

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
