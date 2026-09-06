import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { withCronLock, newRunId } from '@/lib/logger'

// Vercel Cron: { "path": "/api/cron/uptime-probe", "schedule": "*/5 * * * *" }
//
// Same probe as .github/workflows/uptime.yml (GitHub's scheduler ran that
// once in 68 minutes during the 2026-09-05 incident window) — this is the
// primary sonda from inside Vercel, whose crons ran with 0 failures that
// day. GitHub stays wired as a second layer (covers a Vercel-wide outage).

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const JOB = 'uptime-probe'
const LOCK_KEY = 'cron:uptime-probe'

const DEFAULT_TARGET = 'https://bythiagofigueiredo.com'
// Same thresholds as uptime.yml's WARN_THRESHOLD_S/FAIL_THRESHOLD_S.
const WARN_THRESHOLD_MS = 3_000
const FAIL_THRESHOLD_MS = 10_000
const FETCH_TIMEOUT_MS = 20_000

type ProbeStatus = 'ok' | 'degraded' | 'down'

function classify(httpCode: number, elapsedMs: number): ProbeStatus {
  if (httpCode >= 500 || elapsedMs >= FAIL_THRESHOLD_MS) return 'down'
  if (httpCode >= 200 && httpCode < 400 && elapsedMs < WARN_THRESHOLD_MS) return 'ok'
  if (httpCode < 500 && elapsedMs >= WARN_THRESHOLD_MS) return 'degraded'
  return 'down'
}

async function sendAlert(
  status: ProbeStatus,
  httpCode: number,
  elapsedMs: number,
  target: string,
): Promise<{ alerted: boolean; reason?: string; alertError?: string }> {
  const ntfyUrl = process.env.NTFY_URL
  if (!ntfyUrl) {
    return { alerted: false, reason: 'NTFY_URL unset' }
  }
  const elapsedS = (elapsedMs / 1000).toFixed(1)
  try {
    await fetch(ntfyUrl, {
      method: 'POST',
      headers: {
        Title: `bythiagofigueiredo ${status}`,
        Priority: status === 'down' ? 'urgent' : 'high',
        Tags: status === 'down' ? 'rotating_light' : 'warning',
      },
      body: `${status} · ${httpCode} · ${elapsedS}s · ${target}`,
    })
    return { alerted: true }
  } catch (err) {
    return { alerted: false, alertError: err instanceof Error ? err.message : String(err) }
  }
}

export async function POST(req: Request): Promise<Response> {
  const authHeader = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()
  const runId = newRunId()
  const target = `${process.env.UPTIME_PROBE_TARGET ?? DEFAULT_TARGET}/robots.txt`

  return withCronLock(supabase, LOCK_KEY, runId, JOB, async () => {
    const start = performance.now()
    let httpCode = 0
    try {
      const res = await fetch(target, { cache: 'no-store', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
      httpCode = res.status
    } catch {
      httpCode = 0
    }
    const elapsedMs = Math.round(performance.now() - start)
    const status: ProbeStatus = httpCode === 0 ? 'down' : classify(httpCode, elapsedMs)

    const alertResult = status !== 'ok' ? await sendAlert(status, httpCode, elapsedMs, target) : { alerted: false as const }

    // status is 'ok'/'degraded'/'down', never the literal 'error' — this
    // cron itself always succeeded (it ran and measured); a bad target is
    // data, not a cron failure. cron_health always records success here.
    return { status, httpCode, elapsedMs, target, ...alertResult }
  })
}

// Cron da Vercel dispara GET; auth le o header Authorization independente do verbo, entao o alias e seguro.
export const GET = POST
