import { NextResponse, type NextRequest } from 'next/server'
import { createAuthMiddleware } from '@tn-figueiredo/auth-nextjs/middleware'
import { SupabaseRingContext } from '@tn-figueiredo/cms/ring'
import { getSupabaseServiceClient } from '../lib/supabase/service'

/**
 * Middleware responsibilities:
 * 1. Subdomain rewrite: dev.bythiagofigueiredo.com → /dev internally
 * 2. Auth gating: /admin protected by adminAuth (signInPath /admin/login)
 *                 /cms protected by cmsAuth (signInPath /cms/login)
 * 3. Site resolution: hostname → site_id/org_id/default_locale for public routes
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
    /^\/auth\/callback$/,
    /^\/api\//,
    /^\/_next\//,
  ],
  protectedRoutes: [/^\/cms(\/.*)?$/],
  signInPath: '/cms/login',
  env,
})

export default async function middleware(
  request: NextRequest,
): Promise<NextResponse> {
  const host = request.headers.get('host') ?? request.nextUrl.host ?? ''
  const hostname = host.split(':')[0] ?? ''
  const url = request.nextUrl.clone()
  const { pathname } = request.nextUrl

  // Dev subdomain rewrite (unchanged from Sprint 1a)
  const isDevSubdomain =
    hostname === 'dev.bythiagofigueiredo.com' ||
    hostname === 'dev.localhost'
  if (isDevSubdomain && !url.pathname.startsWith('/dev')) {
    url.pathname = `/dev${url.pathname === '/' ? '' : url.pathname}`
    return NextResponse.rewrite(url)
  }

  // Auth gating — dispatch to area-specific instance
  if (pathname.startsWith('/admin')) return adminAuth(request)
  if (pathname.startsWith('/cms')) return cmsAuth(request)

  // Site resolution for public routes (Sprint 2).
  const res = NextResponse.next()
  try {
    const ring = new SupabaseRingContext(getSupabaseServiceClient())
    const site = await ring.getSiteByDomain(hostname)
    if (site) {
      res.headers.set('x-site-id', site.id)
      res.headers.set('x-org-id', site.org_id)
      res.headers.set('x-default-locale', site.default_locale)
    }
  } catch {
    // Resolution failed (DB down, service-role env missing in edge context).
    // Leave headers unset — server components will throw via getSiteContext().
  }

  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
