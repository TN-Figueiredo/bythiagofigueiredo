'use server'

import {
  signInWithPassword as signInWithPasswordBase,
  signInWithGoogle as signInWithGoogleBase,
} from '@tn-figueiredo/auth-nextjs/actions'
import type {
  SignInPasswordInput,
  ActionResult,
} from '@tn-figueiredo/auth-nextjs/actions'

/**
 * Thin re-exports that adapt the auth-nextjs server actions to the shapes
 * expected by `<AdminLogin>` from `@tn-figueiredo/admin/login`.
 *
 * The admin component treats `appUrl` + `redirectTo` as optional (the consumer
 * is expected to inject them here), while auth-nextjs requires them. We close
 * over `process.env.NEXT_PUBLIC_APP_URL` at the consumer so admin stays
 * app-agnostic.
 */

export async function signInWithPassword(
  input: SignInPasswordInput,
): Promise<ActionResult> {
  return signInWithPasswordBase(input)
}

export async function signInWithGoogle(
  input: { appUrl?: string; redirectTo?: string },
): Promise<ActionResult<{ url: string }>> {
  return signInWithGoogleBase({
    appUrl: input.appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? '',
    redirectTo: input.redirectTo ?? '/admin',
  })
}
