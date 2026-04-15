'use server'

import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { verifyTurnstileToken } from '../../../lib/turnstile'

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
  const turnstileOk = await verifyTurnstileToken(input.turnstileToken)
  if (!turnstileOk) return { ok: false, error: 'Verificação anti-bot falhou' }

  const supabase = await getUserClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  })
  if (error) {
    if (/invalid login credentials/i.test(error.message)) {
      return { ok: false, error: 'Email ou senha incorretos' }
    }
    if (/email not confirmed/i.test(error.message)) {
      return { ok: false, error: 'Confirme seu email antes de entrar' }
    }
    return { ok: false, error: 'Erro ao entrar. Tente novamente.' }
  }
  return { ok: true }
}

export async function signInWithGoogleAction(input: {
  redirectTo: string
}): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const supabase = await getUserClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=${encodeURIComponent(input.redirectTo)}`,
    },
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true, url: data.url }
}
