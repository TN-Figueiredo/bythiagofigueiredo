'use server'

import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { verifyTurnstileToken } from '../../../lib/turnstile'
import { safeRedirect } from '../../../lib/auth/safe-redirect'

async function getUserClient() {
  const cookieStore = await cookies()
  return createServerClient(
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
}

export async function signInWithPasswordAction(input: {
  email: string
  password: string
  turnstileToken: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  // TODO(Sprint 4): add rate limiting via Redis/Upstash to prevent brute-force (C5)
  const turnstileOk = await verifyTurnstileToken(input.turnstileToken)
  if (!turnstileOk) return { ok: false, error: 'Verificação anti-bot falhou' }

  const supabase = await getUserClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  })
  if (error) {
    // I7: collapse "invalid login credentials" and "email not confirmed" into the same
    // generic message — prevents email enumeration via distinct error responses.
    if (/invalid login credentials/i.test(error.message) || /email not confirmed/i.test(error.message)) {
      return { ok: false, error: 'Email ou senha incorretos.' }
    }
    return { ok: false, error: 'Erro ao entrar. Tente novamente.' }
  }
  return { ok: true }
}

export async function signInWithGoogleAction(input: {
  redirectTo: string
}): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const safeNext = safeRedirect(input.redirectTo) // C1: sanitise before embedding in OAuth URL
  const supabase = await getUserClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=${encodeURIComponent(safeNext)}`,
    },
  })
  if (error) {
    console.error('[signInWithGoogleAction] OAuth error', error) // I9: log real error, surface generic
    return { ok: false, error: 'Falha ao iniciar login com Google' }
  }
  if (!data.url) {
    console.error('[signInWithGoogleAction] OAuth returned no URL') // I22: null guard
    return { ok: false, error: 'Falha ao iniciar login com Google' }
  }
  return { ok: true, url: data.url }
}
