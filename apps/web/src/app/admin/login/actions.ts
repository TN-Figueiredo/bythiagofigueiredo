'use server'

import { cookies } from 'next/headers'
import {
  signInWithGoogle as signInWithGoogleBase,
} from '@tn-figueiredo/auth-nextjs/actions'
import type { ActionResult } from '@tn-figueiredo/auth-nextjs/actions'

function deriveStorageKey(supabaseUrl: string): string {
  const projectRef = new URL(supabaseUrl).hostname.split('.')[0]
  return `sb-${projectRef}-auth-token`
}

function encodeBase64url(json: unknown): string {
  const encoded = Buffer.from(JSON.stringify(json), 'utf8').toString('base64url')
  return 'base64-' + encoded
}

export async function signInWithPassword(
  input: { email: string; password: string; turnstileToken?: string | null },
): Promise<ActionResult> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL
  if (!apiUrl) {
    return { ok: false, error: 'API URL não configurada.' }
  }

  let response: Response
  try {
    response = await fetch(`${apiUrl}/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: input.email, password: input.password }),
    })
  } catch {
    return { ok: false, error: 'Erro de comunicação com o servidor.' }
  }

  let data: Record<string, unknown>
  try {
    data = await response.json() as Record<string, unknown>
  } catch {
    return { ok: false, error: 'Resposta inválida do servidor.' }
  }

  if (!data.success) {
    const err = typeof data.error === 'string' ? data.error : 'Email ou senha incorretos.'
    return { ok: false, error: err }
  }

  const payload = data.data as { user?: { id?: string }; session?: { accessToken?: string; refreshToken?: string } } | undefined
  const session = payload?.session
  if (session?.accessToken && session?.refreshToken) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
    const cookieName = deriveStorageKey(supabaseUrl)
    const cookieValue = encodeBase64url({
      access_token: session.accessToken,
      refresh_token: session.refreshToken,
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: payload?.user?.id ?? '' },
    })
    const cookieStore = await cookies()
    // BTF-096 — httpOnly:false is REQUIRED here, not an oversight. This is the
    // Supabase SSR session cookie (`sb-<ref>-auth-token`); apps/web uses
    // `createBrowserClient` (@supabase/ssr) for authenticated realtime —
    // `lib/notifications/use-notification-channel.ts` and `lib/social/realtime.ts`
    // — which reads this session from `document.cookie`. An httpOnly cookie is
    // invisible to `document.cookie`, so those clients would connect
    // unauthenticated and RLS would block them.
    //
    // These options intentionally mirror @supabase/ssr `DEFAULT_COOKIE_OPTIONS`
    // (path '/', sameSite 'lax', httpOnly false, maxAge 400d). The middleware's
    // `createServerClient` (`src/middleware.ts`) RE-WRITES this exact cookie with
    // those same defaults on every session refresh — so overriding httpOnly /
    // maxAge here would be reverted on the next refresh (~1h) while breaking the
    // realtime clients in the interim. There is no durable login-action-local fix.
    //
    // The XSS exposure of the long-lived refresh_token is a known, accepted
    // trade-off of the Supabase SSR cookie-session model. The real mitigation is
    // the nonce-based CSP (BTF-089b, `lib/security/csp.ts`) — enforce it in prod
    // via `CSP_NONCE_ENABLED=true` (currently flag-gated, legacy default).
    // sameSite 'lax' (not 'strict') is required so the OAuth top-level redirect
    // back to the app carries the session; `secure` is on in production.
    cookieStore.set(cookieName, cookieValue, {
      path: '/',
      sameSite: 'lax',
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 400 * 24 * 60 * 60,
    })
  }

  return { ok: true }
}

export async function signInWithGoogle(
  input: { appUrl?: string; redirectTo?: string },
): Promise<ActionResult<{ url: string }>> {
  return signInWithGoogleBase({
    appUrl: input.appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? '',
    redirectTo: input.redirectTo ?? '/admin',
  })
}
