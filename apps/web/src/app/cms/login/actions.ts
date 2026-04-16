'use server'

import {
  signInWithPassword as signInWithPasswordBase,
  signInWithGoogle as signInWithGoogleBase,
} from '@tn-figueiredo/auth-nextjs/actions'
import type { ActionResult } from '@tn-figueiredo/auth-nextjs/actions'

/**
 * Thin wrappers that adapt the auth-nextjs server actions to the shapes
 * expected by `<CmsLogin>` from `@tn-figueiredo/cms/login`.
 *
 * The cms component treats `appUrl` + `redirectTo` as optional (consumer
 * concern), while auth-nextjs requires them. We inject
 * `process.env.NEXT_PUBLIC_APP_URL` here so cms stays app-agnostic.
 *
 * cms's `SignInPasswordInput.turnstileToken` is `string | null | undefined`
 * (useful when the widget hasn't resolved yet), while auth-nextjs expects
 * `string | undefined`. We normalize null → undefined at the boundary.
 *
 * Also note: Next.js 'use server' files only allow async function
 * DECLARATIONS — `export { x } from '...'` fails at build time. Hence the
 * wrapper pattern instead of direct re-export.
 */

export async function signInWithPassword(
  input: { email: string; password: string; turnstileToken?: string | null },
): Promise<ActionResult> {
  return signInWithPasswordBase({
    email: input.email,
    password: input.password,
    turnstileToken: input.turnstileToken ?? undefined,
  })
}

export async function signInWithGoogle(
  input: { appUrl?: string; redirectTo?: string },
): Promise<ActionResult<{ url: string }>> {
  return signInWithGoogleBase({
    appUrl: input.appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? '',
    redirectTo: input.redirectTo ?? '/cms',
  })
}
