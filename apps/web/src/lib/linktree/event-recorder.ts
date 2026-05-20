import { createHash } from 'node:crypto'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { resolveGeo } from '@/lib/request/geo'
import { isBot } from '@/lib/request/bot-patterns'

type DeviceType = 'mobile' | 'desktop' | 'tablet' | 'bot' | 'other'

interface DeviceInfo {
  deviceType: DeviceType
  browser: string
  os: string
}

function classifyDeviceType(ua: string): DeviceType {
  if (/iPad/i.test(ua)) return 'tablet'
  if (/Android/i.test(ua) && !/Mobile/i.test(ua)) return 'tablet'
  if (/Mobile|iPhone|iPod|Android.*Mobile|webOS|BlackBerry|Opera Mini|IEMobile/i.test(ua)) return 'mobile'
  if (/Windows NT|Macintosh|Linux x86_64|X11/i.test(ua)) return 'desktop'
  return 'other'
}

function classifyBrowser(ua: string): string {
  if (/Edg\//i.test(ua)) return 'Edge'
  if (/OPR\//i.test(ua) || /Opera/i.test(ua)) return 'Opera'
  if (/Firefox\//i.test(ua)) return 'Firefox'
  if (/Chrome\//i.test(ua) && /Safari\//i.test(ua)) return 'Chrome'
  if (/Safari\//i.test(ua) && /Version\//i.test(ua)) return 'Safari'
  if (/MSIE|Trident/i.test(ua)) return 'IE'
  return 'Unknown'
}

function classifyOs(ua: string): string {
  if (/iPad/i.test(ua)) return 'iPadOS'
  if (/iPhone|iPod/i.test(ua)) return 'iOS'
  if (/Android/i.test(ua)) return 'Android'
  if (/Windows NT/i.test(ua)) return 'Windows'
  if (/Macintosh|Mac OS X/i.test(ua)) return 'macOS'
  if (/CrOS/i.test(ua)) return 'ChromeOS'
  if (/Linux/i.test(ua)) return 'Linux'
  return 'Unknown'
}

function classifyDevice(userAgent: string): DeviceInfo {
  if (!userAgent) {
    return { deviceType: 'other', browser: 'Unknown', os: 'Unknown' }
  }
  return {
    deviceType: classifyDeviceType(userAgent),
    browser: classifyBrowser(userAgent),
    os: classifyOs(userAgent),
  }
}

const DEDUP_WINDOW_MS = 30_000

export interface LinktreeEventInput {
  siteId: string
  eventType: 'pageview' | 'link_click'
  linkKey: string | null
  ip: string
  userAgent: string
  referrer: string | null
  headers: Headers
}

interface LinktreeEventRow {
  site_id: string
  event_type: string
  link_key: string | null
  visitor_id: string
  is_unique: boolean
  is_bot: boolean
  device_type: string | null
  browser: string
  os: string
  country: string | null
  region: string | null
  city: string | null
  referrer_url: string | null
  referrer_domain: string | null
  referrer_source: string
  ip: string
  user_agent: string
  language: string | null
}

function generateVisitorId(ip: string, ua: string): string {
  const today = new Date().toISOString().slice(0, 10)
  return createHash('sha256').update(`${ip}|${ua}|${today}`).digest('hex')
}

function extractReferrerDomain(referrer: string | null): string | null {
  if (!referrer) return null
  try {
    return new URL(referrer).hostname
  } catch {
    return null
  }
}

function classifyReferrerSource(referrer: string | null): string {
  if (!referrer) return 'direct'
  try {
    const host = new URL(referrer).hostname.toLowerCase()
    if (
      host.includes('google') ||
      host.includes('bing') ||
      host.includes('yahoo') ||
      host.includes('duckduckgo')
    ) return 'search'
    if (
      host.includes('facebook') ||
      host.includes('fb.com') ||
      host.includes('instagram') ||
      host.includes('twitter') ||
      host.includes('x.com') ||
      host.includes('linkedin') ||
      host.includes('tiktok') ||
      host.includes('reddit') ||
      host.includes('youtube') ||
      host.includes('pinterest') ||
      host.includes('threads.net') ||
      host.includes('bsky.app')
    ) return 'social'
    if (
      host.includes('mail') ||
      host.includes('outlook') ||
      host.includes('proton')
    ) return 'email'
    return 'referral'
  } catch {
    return 'other'
  }
}

export function buildLinktreeEvent(input: LinktreeEventInput): LinktreeEventRow {
  const { siteId, eventType, linkKey, ip, userAgent, referrer, headers } = input
  const visitorId = generateVisitorId(ip, userAgent)
  const bot = isBot(userAgent)
  const geo = resolveGeo(headers)
  const device = bot
    ? { deviceType: 'bot' as const, browser: 'Bot', os: 'Bot' }
    : classifyDevice(userAgent)

  return {
    site_id: siteId,
    event_type: eventType,
    link_key: linkKey,
    visitor_id: visitorId,
    is_unique: false,
    is_bot: bot,
    device_type: device.deviceType,
    browser: device.browser,
    os: device.os,
    country: geo.country,
    region: geo.region,
    city: geo.city,
    referrer_url: referrer,
    referrer_domain: extractReferrerDomain(referrer),
    referrer_source: classifyReferrerSource(referrer),
    ip,
    user_agent: userAgent.length > 512 ? userAgent.slice(0, 512) : userAgent,
    language: headers.get('accept-language')?.split(',')[0] ?? null,
  }
}

export async function recordLinktreeEvent(input: LinktreeEventInput): Promise<{ deduplicated: boolean }> {
  const row = buildLinktreeEvent(input)
  const supabase = getSupabaseServiceClient()

  const cutoff = new Date(Date.now() - DEDUP_WINDOW_MS).toISOString()
  let dedupQuery = supabase
    .from('linktree_events')
    .select('id')
    .eq('site_id', row.site_id)
    .eq('visitor_id', row.visitor_id)
    .eq('event_type', row.event_type)
    .gte('created_at', cutoff)

  dedupQuery = row.link_key
    ? dedupQuery.eq('link_key', row.link_key)
    : dedupQuery.is('link_key', null)

  const { data: existing } = await dedupQuery.maybeSingle()

  if (existing) return { deduplicated: true }

  const { count: priorCount } = await supabase
    .from('linktree_events')
    .select('id', { count: 'exact', head: true })
    .eq('site_id', row.site_id)
    .eq('visitor_id', row.visitor_id)
    .eq('event_type', row.event_type)
    .limit(1)

  row.is_unique = (priorCount ?? 0) === 0

  const { error } = await supabase.from('linktree_events').insert(row)
  if (error) {
    Sentry.captureException(new Error(error.message), {
      tags: { component: 'linktree-event-recorder' },
    })
  }

  return { deduplicated: false }
}
