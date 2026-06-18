'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getLogger } from '../../../../../../lib/logger'
import { redactMessage } from '../../../../../../lib/waitlists/scrub'
import { hashWaitlistDsarToken, isWaitlistDsarTokenShape, isWaitlistDsarTokenFresh } from '../../../../../../lib/waitlists/dsar-token'

// LGPD Art. 18 ERASURE: anonymize every waitlist signup tied to the token's (site, email).
// Invoked from the manage page's "delete my data" form. No-oracle: an invalid/expired/used
// token redirects to the same neutral state as a successful erasure of zero rows.
export async function eraseMyWaitlistData(formData: FormData): Promise<void> {
  const token = String(formData.get('token') ?? '')
  let outcome: 'done' | 'invalid' = 'invalid'

  if (isWaitlistDsarTokenShape(token)) {
    const supabase = getSupabaseServiceClient()
    const hash = hashWaitlistDsarToken(token)
    const { data: tok } = await supabase
      .from('waitlist_dsar_tokens')
      .select('site_id, email, created_at, used_at')
      .eq('token_hash', hash)
      .maybeSingle()
    // Only an unburned, in-TTL token authorizes erasure (replay + stale-link guard).
    if (tok && isWaitlistDsarTokenFresh(tok)) {
      const h = await headers()
      const ip = h.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ?? null
      const ua = h.get('user-agent') ?? null
      const { error } = await supabase.rpc('waitlist_erase_by_email', {
        p_site_id: tok.site_id, p_email: tok.email, p_ip: ip, p_user_agent: ua,
      })
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
  // Redirect to a token-LESS URL: the raw token must not linger in browser history / proxy
  // logs after the action (esp. on `invalid`, where the token may still be live). The manage
  // page renders the done/invalid state from `?status` alone; the segment is a placeholder.
  redirect(`/waitlists/manage/${outcome}?status=${outcome}`)
}
