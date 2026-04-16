'use server'

import { forgotPassword as forgotPasswordBase } from '@tn-figueiredo/auth-nextjs/actions'
import type { ActionResult } from '@tn-figueiredo/auth-nextjs/actions'

/**
 * Thin wrapper that injects the consumer-specific `appUrl` + `resetPath`
 * (required by auth-nextjs but treated as consumer concerns by
 * `<CmsForgotPassword>` from `@tn-figueiredo/cms/login`).
 */
export async function forgotPassword(
  input: { email: string; turnstileToken?: string | null },
): Promise<ActionResult> {
  return forgotPasswordBase({
    email: input.email,
    turnstileToken: input.turnstileToken ?? undefined,
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? '',
    resetPath: '/cms/reset',
  })
}
