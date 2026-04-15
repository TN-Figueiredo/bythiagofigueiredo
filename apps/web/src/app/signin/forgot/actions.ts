'use server'

import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { verifyTurnstileToken } from '../../../../lib/turnstile'

export async function forgotPasswordAction(input: {
  email: string
  turnstileToken: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  // C2: verify Turnstile server-side before doing anything
  const turnstileOk = await verifyTurnstileToken(input.turnstileToken)
  if (!turnstileOk) return { ok: false, error: 'Verificação anti-bot falhou' }

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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'

  // C2: always call reset regardless; never surface the real error to the UI
  const { error } = await supabase.auth.resetPasswordForEmail(input.email, {
    redirectTo: `${appUrl}/signin/reset`,
  })

  if (error) {
    // Log internally but do NOT surface to the user — prevents email enumeration
    console.error('[forgotPasswordAction] resetPasswordForEmail error', error.message)
  }

  // C2: always return generic success — same message whether email exists or not
  return { ok: true }
}
