import { getSupabaseServiceClient } from '../../../lib/supabase/service'

export interface ResolvedLink {
  id: string
  site_id: string
  short_code: string
  destination_url: string
  redirect_type: number
  status: string
  is_password_protected: boolean
  max_clicks: number | null
  total_clicks: number
  expires_at: string | null
}

/**
 * Resolve a tracked link by site + short code.
 * Uses service-role client to bypass RLS (cron/redirect context).
 */
export async function resolveLink(siteId: string, code: string): Promise<ResolvedLink | null> {
  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('tracked_links')
    .select(
      'id, site_id, short_code, destination_url, redirect_type, status, is_password_protected, max_clicks, total_clicks, expires_at',
    )
    .eq('site_id', siteId)
    .eq('short_code', code)
    .maybeSingle()

  if (error || !data) return null
  return data as ResolvedLink
}
