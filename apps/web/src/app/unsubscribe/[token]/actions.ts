'use server'

import { getSupabaseServiceClient } from '../../../../lib/supabase/service'

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

export async function unsubscribeViaToken(token: string): Promise<UnsubscribeResult> {
  if (!token || typeof token !== 'string') {
    return { status: 'not_found' }
  }

  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase.rpc('unsubscribe_via_token', { p_token: token })

  if (error || data === null) {
    return { status: 'error' }
  }

  const result = data as UnsubscribeRpcResult

  if (!result.ok) {
    if (result.error === 'not_found') return { status: 'not_found' }
    return { status: 'error' }
  }

  if (result.already) return { status: 'already' }
  return { status: 'ok' }
}
