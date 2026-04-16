import { NextResponse, type NextRequest } from 'next/server'
import { createAuthMiddleware } from '@tn-figueiredo/auth-nextjs/middleware'
import { SupabaseRingContext } from '@tn-figueiredo/cms/ring'
import { getSupabaseServiceClient } from './lib/supabase/service'

/**
 * Middleware responsibilities:
 * 1. Subdomain rewrite: dev.bythiagofigueiredo.com → /dev internally
 * 2. Site resolution: hostname → site_id/org_id/default_locale (Sprint 2)
 * 3. Auth gating: protect /cms and /admin via createAuthMiddleware
 *
 * Hostname-based rewrites must NOT use redirects (would expose /dev path).
 * Use rewrite so the URL bar stays at dev.bythiagofigueiredo.com.
 */

const authMiddleware = createAuthMiddleware({
  publicRoutes: [
    /^\/$/,
    '/signin',
    /^\/signin\/(forgot|reset)/,
    /^\/auth\/callback$/,
    /^\/api\//,
    /^\/_next\//,
    /^\/blog/,
    /^\/campaigns/,
    /^\/contact$/,
    /^\/signup\/invite\//,
    /^\/unsubscribe\//,
    /^\/newsletter\/confirm\//,
  ],
  protectedRoutes: [/^\/cms(\/.*)?$/, /^\/admin(\/.*)?$/],
  signInPath: '/signin',
  env: {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  },
})

export default async function middleware(
  request: NextRequest,
): Promise<NextResponse> {
  const host = request.headers.get('host') ?? request.nextUrl.host ?? ''
  const hostname = host.split(':')[0] ?? ''
  const url = request.nextUrl.clone()

  // Dev subdomain rewrite (unchanged from Sprint 1a)
  const isDevSubdomain =
    hostname === 'dev.bythiagofigueiredo.com' ||
    hostname === 'dev.localhost'
  if (isDevSubdomain && !url.pathname.startsWith('/dev')) {
    url.pathname = `/dev${url.pathname === '/' ? '' : url.pathname}`
    return NextResponse.rewrite(url)
  }

  // Auth gating for protected routes — run FIRST to preserve its response shape
  // (it may redirect/block before we attach site headers; that's fine).
  if (/^\/(cms|admin)(\/|$)/.test(request.nextUrl.pathname)) {
    return authMiddleware(request)
  }

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
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
