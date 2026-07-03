import { NextResponse, type NextRequest } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import * as Sentry from '@sentry/nextjs'
import { createAuthMiddleware } from '@tn-figueiredo/auth-nextjs/middleware'
import { SupabaseRingContext } from '@tn-figueiredo/cms/ring'
import { buildCsp, buildLegacyCsp, getCspMode } from '@/lib/security/csp'

/**
 * Middleware responsibilities:
 * 0. CSP nonce (BTF-089b): the exported `middleware` is a thin wrapper that
 *    generates a per-request nonce, threads it through the *request* headers
 *    (`x-nonce` + `content-security-policy` — Next.js reads the request CSP
 *    header to tag its own inline scripts with the nonce), delegates to
 *    `handle()`, and sets the CSP *response* header exactly once at the end.
 *    Every `NextResponse.next()`/`.rewrite()` inside `handle()` MUST go
 *    through `ctx.next()`/`ctx.rewrite()` — request headers can only be
 *    attached when the response is CREATED, so a raw `NextResponse.next()`
 *    would drop the nonce and break hydration under the nonce policy.
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
 * uses /pt/ prefix routing with middleware strip+rewrite — admin/cms paths
 * are excluded from locale prefixing (skipLocale), so plain regex literals
 * suffice for auth route matching.
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

const SITE_CACHE_TTL_MS = 60_000
const SITE_CACHE_MAX_ENTRIES = 50
const siteByDomainCache = new Map<string, { site: Awaited<ReturnType<InstanceType<typeof SupabaseRingContext>['getSiteByDomain']>>; exp: number }>()

async function getSiteByDomainCached(
  ring: InstanceType<typeof SupabaseRingContext>,
  hostname: string,
) {
  const now = Date.now()
  const hit = siteByDomainCache.get(hostname)
  if (hit && hit.exp > now) return hit.site
  if (siteByDomainCache.size >= SITE_CACHE_MAX_ENTRIES) siteByDomainCache.clear()
  const site = await ring.getSiteByDomain(hostname)
  siteByDomainCache.set(hostname, { site, exp: now + SITE_CACHE_TTL_MS })
  return site
}

/**
 * BTF-089b — per-request context threading the CSP nonce.
 *
 * `requestHeaders` is the single mutable copy of the incoming request headers
 * (pre-seeded with `x-nonce` + the request CSP header). Handlers that need to
 * expose extra headers to route handlers / server components (site
 * resolution, locale) MUST mutate `ctx.requestHeaders` *before* creating the
 * response, then create it via `ctx.next()` / `ctx.rewrite()` — the ONLY
 * places allowed to construct pass-through NextResponses, because request
 * headers can only be attached at creation time.
 */
interface RequestContext {
  request: NextRequest
  requestHeaders: Headers
  next(): NextResponse
  rewrite(url: URL): NextResponse
}

export async function middleware(
  request: NextRequest,
): Promise<NextResponse> {
  // btoa(uuid) — 128 bits of randomness from the Web Crypto UUID generator,
  // base64-encoded to be a valid CSP nonce token (Edge-safe, per the official
  // Next.js CSP guide).
  const nonce = btoa(crypto.randomUUID())
  const isDev = process.env.NODE_ENV !== 'production'
  const mode = getCspMode()
  const nonceCsp = mode === 'legacy' ? null : buildCsp({ nonce, isDev })

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  // Next.js reads the *request* `content-security-policy` header to decide
  // whether (and with which nonce) to tag its own inline scripts. Only set it
  // when the nonce policy is active in some form — under the legacy policy
  // ('unsafe-inline', no nonce sources) tagging is unnecessary.
  if (nonceCsp) requestHeaders.set('content-security-policy', nonceCsp)

  const ctx: RequestContext = {
    request,
    requestHeaders,
    next: () => NextResponse.next({ request: { headers: requestHeaders } }),
    rewrite: (url) => NextResponse.rewrite(url, { request: { headers: requestHeaders } }),
  }

  const response = await handle(ctx)

  // Single assignment of the enforced CSP — never two enforced policies at
  // once (browsers intersect them). Harmless on redirects (no document).
  if (mode === 'enforced' && nonceCsp) {
    response.headers.set('content-security-policy', nonceCsp)
  } else {
    response.headers.set('content-security-policy', buildLegacyCsp(isDev))
    if (mode === 'report-only' && nonceCsp) {
      // Rollout stage: legacy stays enforced; browsers *report* nonce-policy
      // violations without blocking anything.
      response.headers.set('content-security-policy-report-only', nonceCsp)
    }
  }
  return response
}

async function handle(ctx: RequestContext): Promise<NextResponse> {
  const { request } = ctx
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
    return ctx.rewrite(url)
  }

  // --- go.* short-link subdomain ---
  // go.*/ → linktree page, go.*/ig → 301 redirect, go.*/{code} → short link
  const isGoSubdomain = hostname.startsWith('go.')
  if (isGoSubdomain) {
    const rawBaseDomain = hostname.slice(3)
    const baseDomain =
      (rawBaseDomain === 'localhost' || rawBaseDomain === '127.0.0.1') &&
      process.env.NEXT_PUBLIC_DEV_SITE_HOSTNAME
        ? process.env.NEXT_PUBLIC_DEV_SITE_HOSTNAME
        : rawBaseDomain
    const code = pathname === '/' ? '' : pathname.slice(1)

    const passthrough = ['robots.txt', 'favicon.ico', 'manifest.webmanifest', 'icon.svg']
    if (passthrough.includes(code)) {
      return ctx.next()
    }

    const ring = getRingContext()
    try {
      const site = await getSiteByDomainCached(ring, baseDomain)
      if (!site) {
        const rewriteUrl = request.nextUrl.clone()
        rewriteUrl.pathname = '/go/not-found'
        const res = ctx.rewrite(rewriteUrl)
        res.headers.set('x-short-domain', host)
        return res
      }

      // Locale detection for go.* routes
      const localeCookie = request.cookies.get('btf_go_lang')?.value
      const acceptLang = request.headers.get('accept-language') ?? ''
      const supportedLocales = ['pt-BR', 'en']
      let detectedLocale = localeCookie ?? ''
      if (!detectedLocale) {
        const preferred = acceptLang.split(',').map((p) => p.split(';')[0]?.trim() ?? '')
        for (const pref of preferred) {
          if (pref.startsWith('pt')) { detectedLocale = 'pt-BR'; break }
          if (pref.startsWith('en')) { detectedLocale = 'en'; break }
        }
      }
      if (!detectedLocale || !supportedLocales.includes(detectedLocale)) {
        detectedLocale = 'pt-BR'
      }

      if (code === 'og/linktree') {
        const rewriteUrl = request.nextUrl.clone()
        rewriteUrl.pathname = '/go/linktree/og'
        const res = ctx.rewrite(rewriteUrl)
        res.headers.set('x-site-id', site.id)
        res.headers.set('x-short-domain', host)
        res.headers.set('x-locale', detectedLocale)
        return res
      }

      if (!code) {
        // Root path → rewrite to linktree page
        const rewriteUrl = request.nextUrl.clone()
        rewriteUrl.pathname = '/go/linktree'
        const res = ctx.rewrite(rewriteUrl)
        res.headers.set('x-site-id', site.id)
        res.headers.set('x-short-domain', host)
        res.headers.set('x-locale', detectedLocale)
        return res
      }

      if (code === 'ig') {
        // Old link-in-bio page → 301 redirect to linktree root
        return NextResponse.redirect(new URL('/', request.url), 301)
      }

      // Short link redirect
      const rewriteUrl = request.nextUrl.clone()
      rewriteUrl.pathname = `/go/${code}`
      const res = ctx.rewrite(rewriteUrl)
      res.headers.set('x-site-id', site.id)
      res.headers.set('x-short-domain', host)
      return res
    } catch (err) {
      Sentry.captureException(err)
      const rewriteUrl = request.nextUrl.clone()
      rewriteUrl.pathname = '/go/not-found'
      return ctx.rewrite(rewriteUrl)
    }
  }

  const skipSiteResolution =
    pathname.startsWith('/api/cron/') ||
    pathname.startsWith('/api/webhooks/') ||
    pathname.startsWith('/auth/callback')
  if (skipSiteResolution) {
    return ctx.next()
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

    // Expose the locale to route handlers / server components (layout.tsx
    // reads `x-locale` via headers()). Must be set BEFORE resolveSite creates
    // the response — request headers attach only at creation time.
    ctx.requestHeaders.set('x-locale', detectedLocale)
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
  const siteRes = await resolveSite(ctx, resolveHostname, effectivePathname)

  // Inject x-locale header
  if (!skipLocale) {
    siteRes.response.headers.set('x-locale', detectedLocale)
  }

  // If /pt/ prefix was detected, rewrite to stripped path
  if (detectedLocale !== 'en' && !siteRes.shortCircuit) {
    const rewriteUrl = request.nextUrl.clone()
    rewriteUrl.pathname = effectivePathname
    const res = ctx.rewrite(rewriteUrl)
    // Copy all headers from site resolution
    siteRes.response.headers.forEach((value, key) => {
      res.headers.set(key, value)
    })
    res.headers.set('x-locale', detectedLocale)

    // Auth gating for rewritten paths
    if (effectivePathname.startsWith('/admin')) {
      const authRes = await adminAuth(request)
      return mergeSiteHeaders(ctx, authRes, res)
    }
    if (effectivePathname.startsWith('/cms')) {
      const authRes = await cmsAuth(request)
      return mergeSiteHeaders(ctx, authRes, res)
    }
    return res
  }

  if (siteRes.shortCircuit) return siteRes.response

  // Auth gating — dispatch to area-specific instance. The site headers are
  // propagated by `resolveSite` into the shared response object below.
  if (pathname.startsWith('/admin')) {
    const authRes = await adminAuth(request)
    return mergeSiteHeaders(ctx, authRes, siteRes.response)
  }
  if (pathname.startsWith('/cms')) {
    const authRes = await cmsAuth(request)
    return mergeSiteHeaders(ctx, authRes, siteRes.response)
  }

  return siteRes.response
}

type SiteResolution =
  | { shortCircuit: true; response: NextResponse }
  | { shortCircuit: false; response: NextResponse }

async function resolveSite(
  ctx: RequestContext,
  hostname: string,
  pathname: string,
): Promise<SiteResolution> {
  const { request } = ctx
  try {
    const ring = getRingContext()
    const site = await getSiteByDomainCached(ring, hostname)
    if (!site) {
      Sentry.captureException(new Error(`Unknown hostname: ${hostname}`), {
        level: 'warning',
      })
      if (pathname.startsWith('/cms') || pathname.startsWith('/admin')) {
        return {
          shortCircuit: true,
          response: ctx.rewrite(new URL('/site-not-configured', request.url)),
        }
      }
      return { shortCircuit: false, response: ctx.next() }
    }
    const cmsEnabled = (site as { cms_enabled?: boolean }).cms_enabled
    if (pathname.startsWith('/cms') && cmsEnabled === false) {
      return {
        shortCircuit: true,
        response: ctx.rewrite(new URL('/cms/disabled', request.url)),
      }
    }
    const siteTimezone = (site as { timezone?: string }).timezone ?? 'America/Sao_Paulo'
    // Mutate the shared request-header copy (keeps the x-nonce / CSP request
    // headers already seeded by the wrapper) instead of rebuilding from the
    // original request — rebuilding would silently drop the nonce.
    ctx.requestHeaders.set('x-site-id', site.id)
    ctx.requestHeaders.set('x-org-id', site.org_id)
    ctx.requestHeaders.set('x-default-locale', site.default_locale)
    ctx.requestHeaders.set('x-site-timezone', siteTimezone)
    const res = ctx.next()
    res.headers.set('x-site-id', site.id)
    res.headers.set('x-org-id', site.org_id)
    res.headers.set('x-default-locale', site.default_locale)
    res.headers.set('x-site-timezone', siteTimezone)
    return { shortCircuit: false, response: res }
  } catch (err) {
    Sentry.captureException(err)
    return {
      shortCircuit: true,
      response: ctx.rewrite(new URL('/site-error', request.url)),
    }
  }
}

function mergeSiteHeaders(
  ctx: RequestContext,
  authResponse: NextResponse,
  siteResponse: NextResponse,
): NextResponse {
  const siteId = siteResponse.headers.get('x-site-id')
  const orgId = siteResponse.headers.get('x-org-id')
  const defaultLocale = siteResponse.headers.get('x-default-locale')
  const xLocale = siteResponse.headers.get('x-locale')
  const siteTimezone = siteResponse.headers.get('x-site-timezone')

  if (authResponse.status >= 300) {
    if (siteId) authResponse.headers.set('x-site-id', siteId)
    if (orgId) authResponse.headers.set('x-org-id', orgId)
    if (defaultLocale) authResponse.headers.set('x-default-locale', defaultLocale)
    if (xLocale) authResponse.headers.set('x-locale', xLocale)
    if (siteTimezone) authResponse.headers.set('x-site-timezone', siteTimezone)
    return authResponse
  }

  // BTF-089b: base the merged pass-through on ctx.requestHeaders (which
  // already carries x-nonce + request CSP + the site headers set by
  // resolveSite). The previous implementation rebuilt a fresh Headers from
  // the original request, which would have dropped the nonce.
  if (siteId) ctx.requestHeaders.set('x-site-id', siteId)
  if (orgId) ctx.requestHeaders.set('x-org-id', orgId)
  if (defaultLocale) ctx.requestHeaders.set('x-default-locale', defaultLocale)
  if (xLocale) ctx.requestHeaders.set('x-locale', xLocale)
  if (siteTimezone) ctx.requestHeaders.set('x-site-timezone', siteTimezone)

  const merged = ctx.next()
  authResponse.cookies.getAll().forEach((cookie) => {
    merged.cookies.set(cookie.name, cookie.value, cookie as Parameters<typeof merged.cookies.set>[2])
  })
  return merged
}

export default middleware

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
