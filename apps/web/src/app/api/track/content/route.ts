import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { TrackingRequestSchema, type TrackingEvent } from '@/lib/tracking/events'
import {
  CONTENT_TRACKING_ENABLED,
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX,
  MAX_USER_AGENT_LENGTH,
} from '@/lib/tracking/config'

const ipBuckets = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const bucket = ipBuckets.get(ip)
  if (!bucket || now > bucket.resetAt) {
    ipBuckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return false
  }
  bucket.count++
  return bucket.count > RATE_LIMIT_MAX
}

if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [ip, bucket] of ipBuckets) {
      if (now > bucket.resetAt) ipBuckets.delete(ip)
    }
  }, 300_000)
}

export async function POST(request: Request): Promise<Response> {
  if (!CONTENT_TRACKING_ENABLED) {
    return new Response(null, { status: 204 })
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': '60' } },
    )
  }

  let parsed: { events: TrackingEvent[] }
  try {
    parsed = TrackingRequestSchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const rawUa = request.headers.get('user-agent')
  const userAgent = rawUa && rawUa.length > MAX_USER_AGENT_LENGTH
    ? rawUa.slice(0, MAX_USER_AGENT_LENGTH)
    : rawUa
  const supabase = getSupabaseServiceClient()

  const rows = parsed.events.map((e) => ({
    session_id: e.sessionId,
    site_id: e.siteId,
    resource_type: e.resourceType,
    resource_id: e.resourceId,
    event_type: e.eventType,
    anonymous_id: e.anonymousId,
    locale: e.locale ?? null,
    referrer_src: e.referrerSrc ?? null,
    read_depth: e.readDepth ?? null,
    time_on_page: e.timeOnPage ?? null,
    has_consent: e.hasConsent,
    user_agent: e.hasConsent ? userAgent : null,
  }))

  const { error } = await supabase.from('content_events').insert(rows)
  if (error) {
    Sentry.captureException(new Error(error.message), {
      tags: { component: 'content-tracking' },
      extra: { eventCount: rows.length, ip },
    })
  }

  return new Response(null, { status: 204 })
}
