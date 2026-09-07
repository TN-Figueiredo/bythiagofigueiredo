import type { SupabaseClient } from '@supabase/supabase-js'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { withCronLock, newRunId } from '@/lib/logger'
import { sendNtfyAlert, type INtfyResult } from '@/lib/ops/ntfy'
import { claimAlert } from '@/lib/ops/alert-state'

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
  supabase: SupabaseClient,
  status: ProbeStatus,
  httpCode: number,
  elapsedMs: number,
  target: string,
): Promise<INtfyResult> {
  // Dedupe POR STATUS (MUST): com chave única, um `degraded` em t=0 carimbava
  // e calava um `down` genuíno em t=5 e t=10. Intervalos abaixo da grade
  // porque a comparação do claim é estrita. 288/dia => ≤ 96/dia em down,
  // ≤ 24/dia em degraded.
  let shouldSend = true
  try {
    shouldSend = await claimAlert(
      supabase,
      status === 'down' ? 'uptime:down' : 'uptime:degraded',
      status === 'down' ? '14 minutes' : '59 minutes',
    )
  } catch {
    // FAIL-OPEN: o dedupe existe para reduzir ruído, nunca para calar o sinal
    // mais rápido do projeto quando o banco está ruim.
    Sentry.captureMessage('uptime dedupe claim failed — alerting anyway', 'warning')
    shouldSend = true
  }
  if (!shouldSend) return { alerted: false, reason: 'deduped' }

  const elapsedS = (elapsedMs / 1000).toFixed(1)
  return sendNtfyAlert({
    title: `bythiagofigueiredo ${status}`,
    body: `${status} · ${httpCode} · ${elapsedS}s · ${target}`,
    priority: status === 'down' ? 'urgent' : 'high',
    tags: [status === 'down' ? 'rotating_light' : 'warning'],
  })
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

    const alertResult: INtfyResult =
      status !== 'ok'
        ? await sendAlert(supabase, status, httpCode, elapsedMs, target)
        : { alerted: false }

    // status is 'ok'/'degraded'/'down', never the literal 'error' — this
    // cron itself always succeeded (it ran and measured); a bad target is
    // data, not a cron failure. cron_health always records success here.
    return { status, httpCode, elapsedMs, target, ...alertResult }
  })
}

// Cron da Vercel dispara GET; auth le o header Authorization independente do verbo, entao o alias e seguro.
export const GET = POST
