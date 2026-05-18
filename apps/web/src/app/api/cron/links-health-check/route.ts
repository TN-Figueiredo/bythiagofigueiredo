import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'
import { withCronLock, newRunId } from '../../../../../lib/logger'

export const runtime = 'nodejs'
export const maxDuration = 120

const JOB = 'links-health-check'
const LOCK_KEY = 'cron:links-health-check'
const BATCH_SIZE = 50
const REQUEST_TIMEOUT_MS = 10_000
const RATE_LIMIT_MS = 1_000

const PRIVATE_IP_RE =
  /^(https?:\/\/)?(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|169\.254\.\d{1,3}\.\d{1,3}|127\.\d{1,3}\.\d{1,3}\.\d{1,3}|0\.0\.0\.0|localhost|\[?::1\]?|\[?0+:0+:0+:0+:0+:0+:0+:0*1\]?|\[?fe80:[^\]]*\]?|\[?fc[0-9a-f]{2}:[^\]]*\]?|\[?fd[0-9a-f]{2}:[^\]]*\]?)/i

function isPrivateUrl(url: string): boolean {
  if (PRIVATE_IP_RE.test(url)) return true
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase()
    if (
      host === 'localhost' ||
      host === '0.0.0.0' ||
      host === 'metadata.google.internal' ||
      host.startsWith('fe80') ||
      host.startsWith('fc') ||
      host.startsWith('fd')
    ) {
      return true
    }
  } catch { /* invalid URL, let the regex handle it */ }
  return false
}

type HealthStatus = 'healthy' | 'unhealthy' | 'timeout' | 'dns_error'

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function checkUrl(url: string): Promise<HealthStatus> {
  try {
    if (isPrivateUrl(url)) return 'unhealthy'

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    try {
      const res = await fetch(url, {
        method: 'HEAD',
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'User-Agent': 'bythiagofigueiredo-health-check/1.0' },
      })
      clearTimeout(timer)

      const ok = (res.status >= 200 && res.status < 400) || res.status === 401 || res.status === 403
      return ok ? 'healthy' : 'unhealthy'
    } catch (err) {
      clearTimeout(timer)
      if (err instanceof DOMException && err.name === 'AbortError') return 'timeout'
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('ENOTFOUND') || msg.includes('getaddrinfo')) return 'dns_error'
      return 'unhealthy'
    }
  } catch {
    return 'unhealthy'
  }
}

export async function GET(req: Request): Promise<Response> {
  if (process.env.LINKS_HEALTH_CHECK_ENABLED !== 'true') {
    return Response.json({ status: 'disabled' })
  }

  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()
  const runId = newRunId()

  return withCronLock(supabase, LOCK_KEY, runId, JOB, async () => {
    const { data: links, error } = await supabase
      .from('tracked_links')
      .select('id, destination_url')
      .eq('active', true)
      .is('deleted_at', null)
      .gt('total_clicks', 0)
      .or(`health_checked_at.is.null,health_checked_at.lt.${new Date(Date.now() - 86_400_000).toISOString()}`)
      .order('health_checked_at', { ascending: true, nullsFirst: true })
      .limit(BATCH_SIZE)

    if (error) {
      Sentry.captureException(error, { tags: { links: 'true', component: 'cron-health-check' } })
      return { status: 'error' as const, error: error.message }
    }

    if (!links?.length) {
      return { status: 'ok' as const, checked: 0 }
    }

    const byDomain = new Map<string, typeof links>()
    for (const link of links) {
      try {
        const domain = new URL(link.destination_url).hostname
        const group = byDomain.get(domain) ?? []
        group.push(link)
        byDomain.set(domain, group)
      } catch {
        // skip invalid URLs
      }
    }

    let checked = 0
    let healthy = 0
    let unhealthy = 0

    for (const [, domainLinks] of byDomain) {
      for (const link of domainLinks) {
        const status = await checkUrl(link.destination_url)
        const now = new Date().toISOString()

        await supabase
          .from('tracked_links')
          .update({ health_status: status, health_checked_at: now })
          .eq('id', link.id)

        checked++
        if (status === 'healthy') healthy++
        else unhealthy++

        await delay(RATE_LIMIT_MS)
      }
    }

    return { status: 'ok' as const, checked, healthy, unhealthy }
  })
}
