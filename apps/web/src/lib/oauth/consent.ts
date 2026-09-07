import * as Sentry from '@sentry/nextjs'
import type { getSupabaseServiceClient } from '@/lib/supabase/service'

/**
 * LGPD consent row for an OAuth connection.
 *
 * Extracted in commit B from `api/social/oauth/[provider]/callback/route.ts:8-41`,
 * which took six positional arguments (one of them, `provider`, unused), hard-coded
 * `locale: 'pt-BR'`, and used `upsert({ onConflict: 'user_id,category,site_id' })` —
 * a constraint that does not exist. `consents` only carries the PARTIAL unique
 * indexes `consents_auth_current` / `consents_anon_current`, so PostgREST answers
 * 42P10 and the write was silently lost. A plain `insert` tolerating 23505 is the
 * shape those partial indexes actually support.
 */

type ServiceClient = ReturnType<typeof getSupabaseServiceClient>

export interface IRecordSocialConsentArgs {
  userId: string
  siteId: string
  /** e.g. `'social_integration'` — must satisfy `consents_category_check`. */
  category: string
  /** The callback request — `x-default-locale`, `x-forwarded-for`, `user-agent`. */
  req: Request
}

export async function recordSocialConsent(
  supabase: ServiceClient,
  { userId, siteId, category, req }: IRecordSocialConsentArgs,
): Promise<void> {
  try {
    const locale = req.headers.get('x-default-locale') ?? 'pt-BR'
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
    const userAgent = req.headers.get('user-agent')

    const { data: textRow, error: textError } = await supabase
      .from('consent_texts')
      .select('id')
      .eq('category', category)
      .eq('locale', locale)
      .is('superseded_at', null)
      .order('effective_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (textError) {
      Sentry.captureMessage(
        `recordSocialConsent: consent_texts lookup failed for ${category}/${locale}`,
        'warning',
      )
      return
    }

    const consentTextId = (textRow as { id?: unknown } | null)?.id
    if (typeof consentTextId !== 'string') {
      Sentry.captureMessage(
        `recordSocialConsent: no consent text for ${category}/${locale}`,
        'warning',
      )
      return
    }

    const { error: insertError } = await supabase.from('consents').insert({
      user_id: userId,
      category,
      site_id: siteId,
      consent_text_id: consentTextId,
      granted: true,
      granted_at: new Date().toISOString(),
      ip,
      user_agent: userAgent,
    })

    // 23505 = the partial unique index fired: the consent is already on record.
    if (insertError && insertError.code !== '23505') {
      Sentry.captureMessage(
        `recordSocialConsent: insert failed (${insertError.code ?? 'unknown'})`,
        'warning',
      )
    }
  } catch (err) {
    // Never take the OAuth callback down over a consent write.
    Sentry.captureException(err)
  }
}
