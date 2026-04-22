import { getSupabaseServiceClient } from '../supabase/service'
export { parseUserAgent } from '@tn-figueiredo/newsletter'

export async function refreshStaleStats(): Promise<number> {
  const supabase = getSupabaseServiceClient()
  const { data } = await supabase.rpc('refresh_newsletter_stats')
  return (data as number) ?? 0
}
