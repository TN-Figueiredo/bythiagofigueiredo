import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// TODO: [APP_NAME] Configure auth middleware
// import { createMiddleware } from '@tn-figueiredo/auth-nextjs'
// export const middleware = createMiddleware({ ... })

export function middleware(_request: NextRequest) {
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
