import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '../../../lib/supabase/service'

interface CacheEntry {
  data: ResolvedLink | null
  expires: number
}

const linkCache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 30_000
const CACHE_MAX = 200

function getCached(key: string): ResolvedLink | null | undefined {
  const entry = linkCache.get(key)
  if (!entry) return undefined
  if (Date.now() > entry.expires) {
    linkCache.delete(key)
    return undefined
  }
  return entry.data
}

function setCached(key: string, data: ResolvedLink | null): void {
  if (linkCache.size >= CACHE_MAX) {
    const oldest = linkCache.keys().next().value
    if (oldest) linkCache.delete(oldest)
  }
  linkCache.set(key, { data, expires: Date.now() + CACHE_TTL_MS })
}

export function invalidateLinkCache(siteId: string, code: string): void {
  linkCache.delete(`${siteId}:${code}`)
}

/** Clears the entire link cache. Intended for use in tests only. */
export function _clearLinkCacheForTesting(): void {
  linkCache.clear()
}

export interface ResolvedLink {
  id: string
  site_id: string
  code: string
  title: string | null
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
  utm_id: string | null
  launched_at: string | null
  activates_at: string | null
  custom_params: Record<string, string>
  pass_click_ids: boolean
}

/**
 * Resolve a tracked link by site + short code.
 * Uses service-role client to bypass RLS (cron/redirect context).
 */
export async function resolveLink(siteId: string, code: string): Promise<ResolvedLink | null> {
  const cacheKey = `${siteId}:${code}`
  const cached = getCached(cacheKey)
  if (cached !== undefined) return cached

  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('tracked_links')
    .select(
      'id, site_id, code, title, destination_url, redirect_type, active, deleted_at, password_hash, click_limit, total_clicks, expires_at, utm_source, utm_medium, utm_campaign, utm_term, utm_content, utm_id, launched_at, activates_at, custom_params, pass_click_ids',
    )
    .eq('site_id', siteId)
    .eq('code', code)
    .maybeSingle()

  if (error) {
    Sentry.captureException(error, { tags: { links: 'true', component: 'resolver' } })
    return null  // DON'T cache errors
  }
  if (!data) return null  // DON'T cache not-found (link might be being created right now)
  const result = data as ResolvedLink
  setCached(cacheKey, result)
  return result
}
