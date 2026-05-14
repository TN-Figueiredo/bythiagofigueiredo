import { revalidatePath, revalidateTag } from 'next/cache'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSiteContext } from '@/lib/cms/site-context'
import type { SocialConnection } from '@tn-figueiredo/social'
import type { ZodError } from 'zod'

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string }

export const SENTRY_TAG = { component: 'social-actions' }

export function zodError(err: ZodError): string {
  return err.issues.map((i) => i.message).join(', ') || 'Validation failed'
}

export async function requireEditAccess(): Promise<{ siteId: string; userId: string }> {
  const { siteId } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) {
    throw new Error(
      res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden',
    )
  }
  return { siteId, userId: res.user.id }
}

export function revalidateSocialPaths(): void {
  revalidateTag('social')
  revalidatePath('/cms/social')
}

export type SafeConnection = Omit<
  SocialConnection,
  'access_token_enc' | 'refresh_token_enc' | 'page_token_enc'
>
