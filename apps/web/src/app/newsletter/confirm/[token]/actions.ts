'use server'

import { createHash } from 'node:crypto'
import { revalidateTag } from 'next/cache'
import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'
import { captureServerActionError } from '../../../../lib/sentry-wrap'

interface ConfirmRpcResult {
  ok: boolean
  already?: boolean
  error?: 'not_found' | 'expired' | 'invalid_state'
  site_id?: string
  email?: string
  /** Rows actually flipped pending_confirmation → confirmed. The RPC returns
   *  ok with confirmed_count=0 when the token matched a row that is no longer
   *  pending (e.g. unsubscribed meanwhile) — confirming nothing. */
  confirmed_count?: number
}

export interface ConfirmActionResult {
  state: 'success' | 'already' | 'not_found' | 'expired' | 'error'
  siteId?: string
  email?: string
}

export async function confirmSubscription(token: string): Promise<ConfirmActionResult> {
  try {
    const supabase = getSupabaseServiceClient()
    const tokenHash = createHash('sha256').update(token).digest('hex')

    const { data, error: rpcError } = await supabase.rpc('confirm_newsletter_subscription', {
      p_token_hash: tokenHash,
    })

    const result = (data ?? null) as ConfirmRpcResult | null

    if (rpcError || !result) {
      if (rpcError) {
        captureServerActionError(rpcError, { action: 'confirm_newsletter' })
      }
      return { state: 'error' }
    }

    if (!result.ok) {
      if (result.error === 'not_found') return { state: 'not_found' }
      if (result.error === 'expired') return { state: 'expired' }
      return { state: 'error' }
    }

    if (result.already) {
      return { state: 'already', siteId: result.site_id, email: result.email }
    }

    // ok but 0 rows confirmed: the token matched a row that is no longer
    // pending (unsubscribed/changed state meanwhile). Nothing was confirmed —
    // saying 'Inscrição confirmada!' here would be a false success. Map to the
    // friendly not_found state (same UX as a reused/invalid link).
    if (result.confirmed_count === 0) {
      return { state: 'not_found' }
    }

    revalidateTag('newsletter-suggestions')
    return { state: 'success', siteId: result.site_id, email: result.email }
  } catch (err) {
    captureServerActionError(err, { action: 'confirm_newsletter', branch: 'action_catch' })
    return { state: 'error' }
  }
}
