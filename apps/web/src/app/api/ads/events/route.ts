import { NextResponse } from 'next/server'
import { z } from 'zod'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

const EventSchema = z.object({
  events: z
    .array(
      z.object({
        type: z.enum(['impression', 'click', 'dismiss']),
        slotKey: z.string().min(1),
        campaignId: z.string().nullable(),
        userHash: z.string().min(1),
        timestamp: z.number(),
      }),
    )
    .max(50),
})

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 50
const ipBuckets = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const bucket = ipBuckets.get(ip)
  if (!bucket || now > bucket.resetAt) {
    ipBuckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return false
  }
  bucket.count++
  if (bucket.count > RATE_LIMIT_MAX) return true
  return false
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

  let parsed: z.infer<typeof EventSchema>
  try {
    parsed = EventSchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  if (parsed.events.length === 0) {
    return new Response(null, { status: 204 })
  }

  const supabase = getSupabaseServiceClient()
  const rows = parsed.events.map((e) => ({
    event_type: e.type,
    slot_key: e.slotKey,
    campaign_id: e.campaignId ?? null,
    user_hash: e.userHash,
    occurred_at: new Date(e.timestamp).toISOString(),
    ip: ip !== 'unknown' ? ip : null,
  }))

  const { error } = await supabase.from('ad_events').insert(rows)
  if (error) {
    Sentry.captureException(new Error(error.message), {
      tags: { component: 'ad-tracking' },
      extra: { eventCount: rows.length, ip },
    })
  }

  return new Response(null, { status: 204 })
}
