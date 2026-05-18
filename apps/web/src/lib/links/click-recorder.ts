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

function classifyDevice(ua: string): 'mobile' | 'tablet' | 'desktop' {
  const lower = ua.toLowerCase()
  if (/ipad|tablet|playbook|silk/i.test(lower)) return 'tablet'
  if (/mobile|iphone|ipod|android.*mobile|opera\s*m(ob|in)|windows\s*phone/i.test(lower))
    return 'mobile'
  return 'desktop'
}

function classifyReferrer(referrer: string | null): string {
  if (!referrer) return 'direct'
  try {
    const host = new URL(referrer).hostname.toLowerCase()
    if (host.includes('google')) return 'google'
    if (host.includes('youtube')) return 'youtube'
    if (host.includes('facebook') || host.includes('fb.com')) return 'facebook'
    if (host.includes('instagram')) return 'instagram'
    if (host.includes('twitter') || host.includes('x.com')) return 'twitter'
    if (host.includes('linkedin')) return 'linkedin'
    if (host.includes('tiktok')) return 'tiktok'
    if (host.includes('reddit')) return 'reddit'
    if (host.includes('pinterest')) return 'pinterest'
    return 'other'
  } catch {
    return 'other'
  }
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

  const deviceType = classifyDevice(userAgent)
  const referrerSource = classifyReferrer(referrer)

  let isUnique = true
  try {
    const { count: priorCount } = await supabase
      .from('link_clicks')
      .select('id', { count: 'exact', head: true })
      .eq('link_id', linkId)
      .eq('visitor_id', visitorId)
      .limit(1)

    isUnique = (priorCount ?? 0) === 0
  } catch {
    isUnique = true
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
    referrer_source: referrerSource,
    device_type: deviceType,
    country: geo.country,
    city: geo.city,
    region: geo.region,
    is_bot: bot,
    is_unique: isUnique,
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
    p_is_unique: isUnique,
  })

  if (rpcErr) {
    Sentry.captureException(rpcErr, { tags: { links: 'true', component: 'click-recorder' } })
  }

  return { deduplicated: false, isBot: bot }
}
