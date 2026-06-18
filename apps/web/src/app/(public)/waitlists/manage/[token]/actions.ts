'use server'

import { redirect } from 'next/navigation'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getLogger } from '../../../../../../lib/logger'
import { redactMessage } from '../../../../../../lib/waitlists/scrub'
import { hashWaitlistDsarToken } from '../../../../../../lib/waitlists/dsar-token'

// LGPD Art. 18 ERASURE: anonymize every waitlist signup tied to the token's (site, email).
// Invoked from the manage page's "delete my data" form. No-oracle: an invalid token
// redirects to the same neutral state as a successful erasure of zero rows.
export async function eraseMyWaitlistData(formData: FormData): Promise<void> {
  const token = String(formData.get('token') ?? '')
  let outcome: 'done' | 'invalid' = 'invalid'

  if (token && token.length >= 16 && token.length <= 256) {
    const supabase = getSupabaseServiceClient()
    const hash = hashWaitlistDsarToken(token)
    const { data: tok } = await supabase
      .from('waitlist_dsar_tokens')
      .select('site_id, email')
      .eq('token_hash', hash)
      .maybeSingle()
    if (tok) {
      const { error } = await supabase.rpc('waitlist_erase_by_email', { p_site_id: tok.site_id, p_email: tok.email })
      if (error) {
        getLogger().error('[waitlist_erase]', { code: error.code })
        Sentry.captureException(new Error(`waitlist_erase ${error.code}: ${redactMessage(error.message ?? '')}`), { tags: { component: 'waitlist', action: 'erasure' }, level: 'warning' })
      } else {
        // Burn the token so the now-dead link can't be replayed.
        await supabase.from('waitlist_dsar_tokens').update({ used_at: new Date().toISOString() }).eq('token_hash', hash)
        outcome = 'done'
      }
    }
  }
  redirect(`/waitlists/manage/${token}?status=${outcome}`)
}
