import type { SupabaseClient } from '@supabase/supabase-js'

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function ensureUnsubscribeToken(
  supabase: SupabaseClient,
  siteId: string,
  email: string,
  baseUrl: string,
): Promise<string> {
  const token = generateToken()
  const cleanBase = baseUrl.replace(/\/$/, '')

  const { data } = await supabase
    .from('unsubscribe_tokens')
    .upsert({ token, site_id: siteId, email }, { onConflict: 'site_id,email', ignoreDuplicates: true })
    .select('token')
    .single()

  if (data?.token) {
    return `${cleanBase}/unsubscribe/${data.token}`
  }

  // Conflict path: fetch existing
  const { data: existing } = await supabase
    .from('unsubscribe_tokens')
    .select('token')
    .eq('site_id', siteId)
    .eq('email', email)
    .single()

  if (!existing) throw new Error('unsubscribe_token_lookup_failed')
  return `${cleanBase}/unsubscribe/${existing.token}`
}
