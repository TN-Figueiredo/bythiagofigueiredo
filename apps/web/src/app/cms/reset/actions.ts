'use server'

import { resetPassword as resetPasswordBase } from '@tn-figueiredo/auth-nextjs/actions'
import type {
  ResetPasswordInput,
  ActionResult,
} from '@tn-figueiredo/auth-nextjs/actions'

/**
 * Thin wrapper around auth-nextjs's `resetPassword`. Exported as an async
 * function declaration (not a re-export) because Next.js 'use server' files
 * only allow async function exports.
 */
export async function resetPassword(
  input: ResetPasswordInput,
): Promise<ActionResult> {
  return resetPasswordBase(input)
}
