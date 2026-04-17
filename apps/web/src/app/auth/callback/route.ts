import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { safeRedirect } from '@tn-figueiredo/auth-nextjs/safe-redirect'

/** Derive which login page to bounce back to on OAuth error. */
function areaLoginPath(next: string): '/admin/login' | '/cms/login' {
  if (next.startsWith('/cms')) return '/cms/login'
  return '/admin/login' // default — admin is the primary OAuth entry point
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  // sanitise `next` param to block open-redirect attacks
  const next = safeRedirect(url.searchParams.get('next'))
  const loginPath = areaLoginPath(next)

  if (!code) {
    return NextResponse.redirect(`${url.origin}${loginPath}?error=oauth_no_code`)
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        },
      },
    },
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return NextResponse.redirect(`${url.origin}${loginPath}?error=oauth_exchange_failed`)
  }

  return NextResponse.redirect(`${url.origin}${next}`)
}
