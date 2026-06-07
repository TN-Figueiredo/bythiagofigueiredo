import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { z } from 'zod'
import { recordLinktreeEvent } from '@/lib/linktree/event-recorder'

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 30

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

const TrackSchema = z.object({
  type: z.enum(['pageview', 'link_click']),
  key: z.string().max(200).optional(),
  siteId: z.string().uuid(),
  hasConsent: z.boolean().optional().default(false),
})

export async function POST(request: Request): Promise<Response> {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'

  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: { 'Retry-After': '60' } })
  }

  let parsed: z.infer<typeof TrackSchema>
  try {
    parsed = TrackSchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const userAgent = request.headers.get('user-agent') ?? ''
  const referrer = request.headers.get('referer') ?? null

  void recordLinktreeEvent({
    siteId: parsed.siteId,
    eventType: parsed.type,
    linkKey: parsed.type === 'link_click' ? (parsed.key ?? null) : null,
    ip,
    userAgent,
    referrer,
    hasConsent: parsed.hasConsent,
    headers: request.headers,
  }).catch((err) => {
    Sentry.captureException(err, { tags: { component: 'linktree-track' } })
  })

  return new Response(null, { status: 204 })
}
