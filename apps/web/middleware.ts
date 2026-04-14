import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createAuthMiddleware } from '@tn-figueiredo/auth-nextjs/middleware'

/**
 * Middleware responsibilities:
 * 1. Subdomain rewrite: dev.bythiagofigueiredo.com → /dev internally
 * 2. Auth gating: protect /cms and /admin via createAuthMiddleware
 *
 * Hostname-based rewrites must NOT use redirects (would expose /dev path).
 * Use rewrite so the URL bar stays at dev.bythiagofigueiredo.com.
 */

const authMiddleware = createAuthMiddleware({
  publicRoutes: [/^\/$/, '/signin', /^\/api\//, /^\/_next\//],
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
  const host = request.headers.get('host') ?? ''
  const url = request.nextUrl.clone()

  // Strip port for local dev (e.g. dev.localhost:3001 → dev.localhost)
  const hostname = host.split(':')[0] ?? ''

  const isDevSubdomain =
    hostname === 'dev.bythiagofigueiredo.com' ||
    hostname === 'dev.localhost'

  if (isDevSubdomain && !url.pathname.startsWith('/dev')) {
    url.pathname = `/dev${url.pathname === '/' ? '' : url.pathname}`
    return NextResponse.rewrite(url)
  }

  if (/^\/(cms|admin)(\/|$)/.test(request.nextUrl.pathname)) {
    return authMiddleware(request)
  }

  return NextResponse.next()
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
