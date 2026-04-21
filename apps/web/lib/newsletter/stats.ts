import { getSupabaseServiceClient } from '../supabase/service'

export async function refreshStaleStats(): Promise<number> {
  const supabase = getSupabaseServiceClient()
  const { data } = await supabase.rpc('refresh_newsletter_stats')
  return (data as number) ?? 0
}

export function parseUserAgent(ua: string): { client: string; device: string } {
  const lc = ua.toLowerCase()
  const client =
    lc.includes('gmail') ? 'Gmail' :
    lc.includes('apple') || lc.includes('webkit') ? 'Apple Mail' :
    lc.includes('outlook') || lc.includes('microsoft') ? 'Outlook' :
    lc.includes('thunderbird') ? 'Thunderbird' :
    'Other'
  const device =
    lc.includes('mobile') || lc.includes('android') || lc.includes('iphone') ? 'Mobile' :
    lc.includes('tablet') || lc.includes('ipad') ? 'Tablet' :
    'Desktop'
  return { client, device }
}
