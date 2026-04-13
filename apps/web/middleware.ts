import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Subdomain routing:
 * - dev.bythiagofigueiredo.com → rewrite to /dev internally
 *
 * Hostname-based rewrites must NOT use redirects (would expose /dev path).
 * Use rewrite so the URL bar stays at dev.bythiagofigueiredo.com.
 */
export function middleware(request: NextRequest) {
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
