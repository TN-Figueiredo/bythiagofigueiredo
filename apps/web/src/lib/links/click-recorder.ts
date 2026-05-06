import { createHash } from 'node:crypto'
import { getSupabaseServiceClient } from '../../../lib/supabase/service'
import { resolveGeo } from './geo'

const BOT_PATTERNS = [
  /googlebot/i,
  /bingbot/i,
  /twitterbot/i,
  /facebookexternalhit/i,
  /linkedinbot/i,
  /slackbot/i,
]

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
  return BOT_PATTERNS.some((pattern) => pattern.test(userAgent))
}

export interface RecordClickInput {
  linkId: string
  siteId: string
  ip: string
  userAgent: string
  referrer: string | null
  headers: Headers
}

export interface RecordClickResult {
  deduplicated: boolean
  isBot: boolean
}

export async function recordClick(input: RecordClickInput): Promise<RecordClickResult> {
  const { linkId, siteId, ip, userAgent, referrer, headers } = input
  const today = new Date().toISOString().slice(0, 10)
  const visitorId = generateVisitorId(ip, userAgent, today)
  const bot = isBot(userAgent)
  const geo = resolveGeo(headers)
  const referrerDomain = extractReferrerDomain(referrer)

  const supabase = getSupabaseServiceClient()

  // Dedup check: same visitor_id + link_id within 30s
  const cutoff = new Date(Date.now() - DEDUP_WINDOW_MS).toISOString()
  const { data: existing } = await supabase
    .from('link_clicks')
    .select('id')
    .eq('link_id', linkId)
    .eq('visitor_id', visitorId)
    .gte('clicked_at', cutoff)
    .maybeSingle()

  if (existing) {
    return { deduplicated: true, isBot: bot }
  }

  // Insert click record
  await supabase.from('link_clicks').insert({
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
  })

  // Update link counters (best-effort, non-blocking in caller)
  await supabase.rpc('increment_link_clicks', {
    p_link_id: linkId,
    p_is_unique: true,
  })

  return { deduplicated: false, isBot: bot }
}
