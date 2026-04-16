'use server'

import { forgotPassword as forgotPasswordBase } from '@tn-figueiredo/auth-nextjs/actions'
import type { ActionResult } from '@tn-figueiredo/auth-nextjs/actions'

/**
 * Thin wrapper that injects the consumer-specific `appUrl` + `resetPath`
 * (which are required by auth-nextjs but treated as consumer concerns by
 * `<AdminForgotPassword>` from `@tn-figueiredo/admin/login`).
 */
export async function forgotPassword(
  input: { email: string; turnstileToken?: string },
): Promise<ActionResult> {
  return forgotPasswordBase({
    email: input.email,
    turnstileToken: input.turnstileToken,
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? '',
    resetPath: '/admin/reset',
  })
}
