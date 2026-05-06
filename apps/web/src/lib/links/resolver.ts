import { getSupabaseServiceClient } from '../../../lib/supabase/service'

export interface ResolvedLink {
  id: string
  site_id: string
  code: string
  destination_url: string
  redirect_type: number
  active: boolean
  deleted_at: string | null
  password_hash: string | null
  click_limit: number | null
  total_clicks: number
  expires_at: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_term: string | null
  utm_content: string | null
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
      'id, site_id, code, destination_url, redirect_type, active, deleted_at, password_hash, click_limit, total_clicks, expires_at, utm_source, utm_medium, utm_campaign, utm_term, utm_content',
    )
    .eq('site_id', siteId)
    .eq('code', code)
    .maybeSingle()

  if (error || !data) return null
  return data as ResolvedLink
}
