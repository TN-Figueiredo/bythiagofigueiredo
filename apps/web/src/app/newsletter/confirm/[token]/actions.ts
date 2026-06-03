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

    revalidateTag('newsletter-suggestions')
    return { state: 'success', siteId: result.site_id, email: result.email }
  } catch (err) {
    captureServerActionError(err, { action: 'confirm_newsletter', branch: 'action_catch' })
    return { state: 'error' }
  }
}
