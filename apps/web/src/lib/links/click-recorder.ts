import { createHash } from 'node:crypto'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '../../../lib/supabase/service'
import { resolveGeo } from '../../../lib/request/geo'
import { isBot as isBotShared } from '../../../lib/request/bot-patterns'

const DEDUP_WINDOW_MS = 30_000 // 30 seconds

export function generateVisitorId(ip: string, ua: string, dateStr: string): string {
  return createHash('sha256').update(`${ip}|${ua}|${dateStr}`).digest('hex')
}

export function extractReferrerDomain(referrer: string | null | undefined): string | null {
  if (!referrer) return null
  try {
    return new URL(referrer).hostname
  } catch {
    return null
  }
}

export function isBot(userAgent: string): boolean {
  return isBotShared(userAgent)
}

export interface RecordClickInput {
  linkId: string
  siteId: string
  ip: string
  userAgent: string
  referrer: string | null
  headers: Headers
  utmSource?: string | null
  utmMedium?: string | null
  utmCampaign?: string | null
  utmTerm?: string | null
  utmContent?: string | null
  utmId?: string | null
  adClickIds?: Record<string, string> | null
}

export interface RecordClickResult {
  deduplicated: boolean
  isBot: boolean
}

export async function recordClick(input: RecordClickInput): Promise<RecordClickResult> {
  const { linkId, siteId, ip, userAgent, referrer, headers } = input
  const { utmSource, utmMedium, utmCampaign, utmTerm, utmContent, utmId, adClickIds } = input
  const today = new Date().toISOString().slice(0, 10)
  const visitorId = generateVisitorId(ip, userAgent, today)
  const bot = isBot(userAgent)
  const geo = resolveGeo(headers)
  const referrerDomain = extractReferrerDomain(referrer)

  const supabase = getSupabaseServiceClient()

  // Dedup check: same visitor_id + link_id within 30s
  const cutoff = new Date(Date.now() - DEDUP_WINDOW_MS).toISOString()
  const { data: existing, error: dedupErr } = await supabase
    .from('link_clicks')
    .select('id')
    .eq('link_id', linkId)
    .eq('visitor_id', visitorId)
    .gte('clicked_at', cutoff)
    .maybeSingle()

  if (dedupErr) {
    Sentry.captureException(dedupErr, { tags: { links: 'true', component: 'click-recorder' } })
  }

  if (existing) {
    return { deduplicated: true, isBot: bot }
  }

  // Insert click record
  const { error: insertErr } = await supabase.from('link_clicks').insert({
    link_id: linkId,
    site_id: siteId,
    visitor_id: visitorId,
    ip,
    user_agent: userAgent,
    referrer_domain: referrerDomain,
    referrer_url: referrer,
    country: geo.country,
    city: geo.city,
    region: geo.region,
    is_bot: bot,
    is_unique: true, // determined by aggregation cron later
    clicked_at: new Date().toISOString(),
    utm_source: utmSource ?? null,
    utm_medium: utmMedium ?? null,
    utm_campaign: utmCampaign ?? null,
    utm_term: utmTerm ?? null,
    utm_content: utmContent ?? null,
    utm_id: utmId ?? null,
    ad_click_ids: adClickIds ?? null,
  })

  if (insertErr) {
    Sentry.captureException(insertErr, { tags: { links: 'true', component: 'click-recorder' } })
  }

  if (!bot) {
    await supabase
      .from('tracked_links')
      .update({ launched_at: new Date().toISOString() })
      .eq('id', linkId)
      .is('launched_at', null)
  }

  // Update link counters (best-effort, non-blocking in caller)
  const { error: rpcErr } = await supabase.rpc('increment_link_clicks', {
    p_link_id: linkId,
    p_is_unique: true,
  })

  if (rpcErr) {
    Sentry.captureException(rpcErr, { tags: { links: 'true', component: 'click-recorder' } })
  }

  return { deduplicated: false, isBot: bot }
}
