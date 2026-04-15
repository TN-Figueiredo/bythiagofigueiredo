'use server'

import { createHash } from 'node:crypto'
import { getSupabaseServiceClient } from '../../../../lib/supabase/service'
import { captureServerActionError } from '../../../lib/sentry-wrap'

interface UnsubscribeRpcResult {
  ok: boolean
  already?: boolean
  error?: 'not_found'
}

export type UnsubscribeResult =
  | { status: 'ok' }
  | { status: 'already' }
  | { status: 'not_found' }
  | { status: 'error' }

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function unsubscribeViaToken(token: string): Promise<UnsubscribeResult> {
  if (!token || typeof token !== 'string') {
    return { status: 'not_found' }
  }

  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase.rpc('unsubscribe_via_token', {
    p_token_hash: hashToken(token),
  })

  if (error || data === null) {
    captureServerActionError(error ?? new Error('unsubscribe_rpc_returned_null'), {
      action: 'unsubscribe_via_token',
      branch: 'rpc',
    })
    return { status: 'error' }
  }

  const result = data as UnsubscribeRpcResult

  if (!result.ok) {
    if (result.error === 'not_found') return { status: 'not_found' }
    captureServerActionError(new Error(`unsubscribe_rpc_not_ok: ${JSON.stringify(result)}`), {
      action: 'unsubscribe_via_token',
      branch: 'rpc_not_ok',
    })
    return { status: 'error' }
  }

  if (result.already) return { status: 'already' }
  return { status: 'ok' }
}
