import { NextResponse } from 'next/server'
import { signOutAction } from '@tn-figueiredo/auth-nextjs/actions'

/**
 * POST-only logout endpoint for the CMS area.
 *
 * Why POST-only: GET-based logout is CSRF-vulnerable — any third-party page
 * embedding `<img src="/cms/logout">` could sign users out. Forms with
 * `method="POST"` require a same-origin submission, and browsers reject
 * cross-origin POSTs for HTML forms without CORS preflight. The GET branch
 * below explicitly responds 405 to make the constraint obvious to callers.
 *
 * After signOut clears the Supabase session cookies, redirect with 303 so
 * the browser issues a GET on /cms/login — standard POST-redirect-GET.
 */
export async function POST(request: Request) {
  await signOutAction()
  const origin = new URL(request.url).origin
  return NextResponse.redirect(`${origin}/cms/login`, { status: 303 })
}

export function GET() {
  return new NextResponse('Method Not Allowed', {
    status: 405,
    headers: { Allow: 'POST' },
  })
}
