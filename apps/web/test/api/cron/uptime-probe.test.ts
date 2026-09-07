// @vitest-environment node
/**
 * Tests for GET/POST /api/cron/uptime-probe — Vercel-side mirror of
 * .github/workflows/uptime.yml, probing /robots.txt on the target origin
 * and alerting via ntfy.sh when it's slow or down.
 *
 * Coverage focuses on:
 *   - auth gate (401 without Authorization)
 *   - classification: ok (<3s, 2xx/3xx), degraded (3-10s, <500), down (>=500,
 *     fetch throw, or >=10s)
 *   - alerting: posted to NTFY_URL on non-ok with the right priority/tags,
 *     skipped (without throwing) when NTFY_URL is unset, and a ntfy POST
 *     failure never fails the cron's own response.
 *
 * Pure mock (no DB). Route uses src/lib/logger#withCronLock (in-memory lock)
 * which calls recordCronSuccess/recordCronFailure from src/lib/cron-health.ts
 * — both resolve getSupabaseServiceClient() from the same mocked module, so
 * the mock supabase must serve `.from('cron_health').upsert(...)`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const CRON_SECRET = 'test-secret'

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}))

import { GET } from '../../../src/app/api/cron/uptime-probe/route'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

function makeSupabase() {
  const upserts: unknown[] = []
  const from = vi.fn((table: string) => {
    if (table === 'cron_health') {
      return {
        upsert: vi.fn((payload: unknown) => {
          upserts.push(payload)
          return Promise.resolve({ error: null })
        }),
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: { consecutive_failures: 0 } })),
          })),
        })),
      }
    }
    return {}
  })
  const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = []
  const rpc = vi.fn((fn: string, args: Record<string, unknown>) => {
    rpcCalls.push({ fn, args })
    return Promise.resolve({ data: true, error: null })
  })
  return { from, rpc, _upserts: upserts, _rpcCalls: rpcCalls }
}

function req() {
  return new Request('http://localhost/api/cron/uptime-probe', {
    method: 'GET',
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  })
}

function unauthedReq() {
  return new Request('http://localhost/api/cron/uptime-probe', { method: 'GET' })
}

/** Queue of return values consumed in order by successive performance.now() calls. */
function stubPerformanceNow(sequence: number[]) {
  let i = 0
  vi.spyOn(performance, 'now').mockImplementation(() => {
    const v = sequence[Math.min(i, sequence.length - 1)]
    i++
    return v as number
  })
}

/** fetch mock that answers the target probe and (optionally) an ntfy POST differently. */
function mockFetch(opts: {
  targetStatus?: number
  targetThrow?: Error
  ntfyThrow?: Error
}) {
  const ntfyCalls: Array<{ url: string; init: RequestInit }> = []
  const fn = vi.fn((url: string | URL, init?: RequestInit) => {
    const urlStr = String(url)
    if (urlStr.includes('/robots.txt')) {
      if (opts.targetThrow) return Promise.reject(opts.targetThrow)
      return Promise.resolve(new Response(null, { status: opts.targetStatus ?? 200 }))
    }
    // Anything else is the ntfy POST.
    ntfyCalls.push({ url: urlStr, init: init ?? {} })
    if (opts.ntfyThrow) return Promise.reject(opts.ntfyThrow)
    return Promise.resolve(new Response(null, { status: 200 }))
  })
  return { fn, ntfyCalls }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('CRON_SECRET', CRON_SECRET)
  vi.stubEnv('NTFY_URL', '')
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('GET /api/cron/uptime-probe — auth gate', () => {
  it('401 without Authorization header', async () => {
    const supabase = makeSupabase()
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)
    const { fn } = mockFetch({ targetStatus: 200 })
    vi.stubGlobal('fetch', fn)

    const res = await GET(unauthedReq())
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('unauthorized')
    expect(fn).not.toHaveBeenCalled()
  })
})

describe('GET /api/cron/uptime-probe — classification', () => {
  it('classifies ok: 2xx status under the 3s warn threshold', async () => {
    const supabase = makeSupabase()
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)
    stubPerformanceNow([0, 500])
    const { fn } = mockFetch({ targetStatus: 200 })
    vi.stubGlobal('fetch', fn)

    const res = await GET(req())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.httpCode).toBe(200)
    expect(body.elapsedMs).toBe(500)
    expect(body.alerted).toBe(false)
  })

  it('classifies degraded: elapsed between 3s and 10s with status < 500', async () => {
    const supabase = makeSupabase()
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)
    stubPerformanceNow([0, 5000])
    const { fn } = mockFetch({ targetStatus: 200 })
    vi.stubGlobal('fetch', fn)

    const res = await GET(req())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('degraded')
    expect(body.elapsedMs).toBe(5000)
  })

  it('classifies down: http 502', async () => {
    const supabase = makeSupabase()
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)
    stubPerformanceNow([0, 200])
    const { fn } = mockFetch({ targetStatus: 502 })
    vi.stubGlobal('fetch', fn)

    const res = await GET(req())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('down')
    expect(body.httpCode).toBe(502)
  })

  it('classifies down: fetch throws (timeout/AbortError)', async () => {
    const supabase = makeSupabase()
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)
    stubPerformanceNow([0, 20000])
    const abortErr = new Error('The operation was aborted')
    abortErr.name = 'AbortError'
    const { fn } = mockFetch({ targetThrow: abortErr })
    vi.stubGlobal('fetch', fn)

    const res = await GET(req())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('down')
    expect(body.httpCode).toBe(0)
  })

  it('the cron itself always responds 200 — a bad probe result is data, not a cron failure', async () => {
    const supabase = makeSupabase()
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)
    stubPerformanceNow([0, 200])
    const { fn } = mockFetch({ targetStatus: 500 })
    vi.stubGlobal('fetch', fn)

    const res = await GET(req())
    expect(res.status).toBe(200)
    expect(supabase._upserts).toHaveLength(1) // recordCronSuccess, not failure
  })
})

describe('GET /api/cron/uptime-probe — alerting', () => {
  it('POSTs to NTFY_URL with Priority urgent and Tags rotating_light on down', async () => {
    vi.stubEnv('NTFY_URL', 'https://ntfy.sh/my-topic')
    const supabase = makeSupabase()
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)
    stubPerformanceNow([0, 100])
    const { fn, ntfyCalls } = mockFetch({ targetStatus: 502 })
    vi.stubGlobal('fetch', fn)

    const res = await GET(req())
    const body = await res.json()
    expect(body.alerted).toBe(true)
    expect(ntfyCalls).toHaveLength(1)
    expect(ntfyCalls[0]?.url).toBe('https://ntfy.sh/my-topic')
    const headers = ntfyCalls[0]?.init.headers as Record<string, string>
    expect(headers.Priority).toBe('urgent')
    expect(headers.Tags).toBe('rotating_light')
    expect(headers.Title).toContain('down')
    expect(ntfyCalls[0]?.init.body).toContain('down')
    expect(ntfyCalls[0]?.init.body).toContain('502')
  })

  it('does not alert (and does not throw) when NTFY_URL is unset', async () => {
    const supabase = makeSupabase()
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)
    stubPerformanceNow([0, 100])
    const { fn, ntfyCalls } = mockFetch({ targetStatus: 502 })
    vi.stubGlobal('fetch', fn)

    const res = await GET(req())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.alerted).toBe(false)
    expect(body.reason).toBe('NTFY_URL unset')
    expect(ntfyCalls).toHaveLength(0)
  })

  it('an ntfy POST failure does not fail the cron response', async () => {
    vi.stubEnv('NTFY_URL', 'https://ntfy.sh/my-topic')
    const supabase = makeSupabase()
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)
    stubPerformanceNow([0, 100])
    const { fn } = mockFetch({ targetStatus: 502, ntfyThrow: new Error('ntfy down') })
    vi.stubGlobal('fetch', fn)

    const res = await GET(req())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('down')
    expect(body.alerted).toBe(false)
    expect(body.alertError).toContain('ntfy down')
  })
})

import * as Sentry from '@sentry/nextjs'

describe('GET /api/cron/uptime-probe — dedupe por status (C2)', () => {
  it('chave uptime:down com 14 minutes quando down', async () => {
    vi.stubEnv('NTFY_URL', 'https://ntfy.sh/my-topic')
    const supabase = makeSupabase()
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)
    stubPerformanceNow([0, 100])
    const { fn } = mockFetch({ targetStatus: 502 })
    vi.stubGlobal('fetch', fn)

    await GET(req())
    expect(supabase._rpcCalls).toContainEqual({
      fn: 'ops_alert_claim',
      args: { p_key: 'uptime:down', p_min_interval: '14 minutes' },
    })
  })

  it('chave uptime:degraded com 59 minutes quando degraded — chaves SEPARADAS', async () => {
    vi.stubEnv('NTFY_URL', 'https://ntfy.sh/my-topic')
    const supabase = makeSupabase()
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)
    stubPerformanceNow([0, 5000])
    const { fn } = mockFetch({ targetStatus: 200 })
    vi.stubGlobal('fetch', fn)

    await GET(req())
    expect(supabase._rpcCalls).toContainEqual({
      fn: 'ops_alert_claim',
      args: { p_key: 'uptime:degraded', p_min_interval: '59 minutes' },
    })
  })

  it('claim false => nenhum POST ao ntfy (o 2º degraded em 59 min é suprimido)', async () => {
    vi.stubEnv('NTFY_URL', 'https://ntfy.sh/my-topic')
    const supabase = makeSupabase()
    supabase.rpc.mockImplementation(() => Promise.resolve({ data: false, error: null }))
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)
    stubPerformanceNow([0, 5000])
    const { fn, ntfyCalls } = mockFetch({ targetStatus: 200 })
    vi.stubGlobal('fetch', fn)

    const body = await (await GET(req())).json()
    expect(ntfyCalls).toHaveLength(0)
    expect(body.alerted).toBe(false)
    expect(body.reason).toBe('deduped')
  })

  it('degraded e, 5 min depois, down => 2 pushes (a escalada nunca fica retida)', async () => {
    vi.stubEnv('NTFY_URL', 'https://ntfy.sh/my-topic')
    const supabase = makeSupabase()
    // simula ops_alert_state real: uma janela por chave
    const stamped = new Set<string>()
    supabase.rpc.mockImplementation((_fn: string, args: Record<string, unknown>) => {
      const key = String(args.p_key)
      const first = !stamped.has(key)
      stamped.add(key)
      return Promise.resolve({ data: first, error: null })
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    stubPerformanceNow([0, 5000])
    let mocked = mockFetch({ targetStatus: 200 })
    vi.stubGlobal('fetch', mocked.fn)
    await GET(req())
    expect(mocked.ntfyCalls).toHaveLength(1)

    stubPerformanceNow([0, 100])
    mocked = mockFetch({ targetStatus: 502 })
    vi.stubGlobal('fetch', mocked.fn)
    await GET(req())
    expect(mocked.ntfyCalls).toHaveLength(1)
  })

  it('claim lançando => FAIL-OPEN: alerta assim mesmo + captureMessage', async () => {
    vi.stubEnv('NTFY_URL', 'https://ntfy.sh/my-topic')
    const supabase = makeSupabase()
    supabase.rpc.mockImplementation(() => Promise.reject(new Error('pg down')))
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)
    stubPerformanceNow([0, 100])
    const { fn, ntfyCalls } = mockFetch({ targetStatus: 502 })
    vi.stubGlobal('fetch', fn)

    const body = await (await GET(req())).json()
    expect(ntfyCalls).toHaveLength(1)
    expect(body.alerted).toBe(true)
    expect(vi.mocked(Sentry.captureMessage)).toHaveBeenCalledWith(
      'uptime dedupe claim failed — alerting anyway', 'warning',
    )
  })

  it('claim devolvendo não-booleano também é fail-open', async () => {
    vi.stubEnv('NTFY_URL', 'https://ntfy.sh/my-topic')
    const supabase = makeSupabase()
    supabase.rpc.mockImplementation(() => Promise.resolve({ data: null, error: null }))
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)
    stubPerformanceNow([0, 100])
    const { fn, ntfyCalls } = mockFetch({ targetStatus: 502 })
    vi.stubGlobal('fetch', fn)

    await GET(req())
    expect(ntfyCalls).toHaveLength(1)
  })

  it('o POST ao ntfy leva AbortSignal (timeout de 4 s)', async () => {
    vi.stubEnv('NTFY_URL', 'https://ntfy.sh/my-topic')
    const supabase = makeSupabase()
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)
    stubPerformanceNow([0, 100])
    const { fn, ntfyCalls } = mockFetch({ targetStatus: 502 })
    vi.stubGlobal('fetch', fn)

    await GET(req())
    expect(ntfyCalls[0]?.init.signal).toBeInstanceOf(AbortSignal)
  })

  it('body.status continua "ok" | "degraded" | "down" (nunca sombreado por ntfyStatus)', async () => {
    vi.stubEnv('NTFY_URL', 'https://ntfy.sh/my-topic')
    const supabase = makeSupabase()
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)
    stubPerformanceNow([0, 100])
    const { fn } = mockFetch({ targetStatus: 502 })
    vi.stubGlobal('fetch', fn)

    const body = await (await GET(req())).json()
    expect(body.status).toBe('down')
    expect(body.ntfyStatus).toBe(200)
  })
})

describe('GET /api/cron/uptime-probe — canal de alerta indisponível é visível (Achado 3, fix round C2)', () => {
  it('outage real + NTFY_URL não configurado => Sentry.captureException nomeando a causa', async () => {
    // NTFY_URL fica '' (default do beforeEach) — outage real (status "down")
    // cujo aviso não pode nem tentar sair.
    const supabase = makeSupabase()
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)
    stubPerformanceNow([0, 100])
    const { fn } = mockFetch({ targetStatus: 502 })
    vi.stubGlobal('fetch', fn)

    const res = await GET(req())
    expect(res.status).toBe(200) // o cron em si continua bem-sucedido
    expect(vi.mocked(Sentry.captureException)).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('NTFY_URL unset') }),
      expect.objectContaining({ tags: expect.objectContaining({ component: 'cron', job: 'uptime-probe' }) }),
    )
  })

  it('recusa TERMINAL do ntfy (403) => Sentry.captureException nomeando a causa', async () => {
    vi.stubEnv('NTFY_URL', 'https://ntfy.sh/my-topic')
    const supabase = makeSupabase()
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)
    stubPerformanceNow([0, 100])
    const fn = vi.fn((url: string | URL) => {
      if (String(url).includes('/robots.txt')) return Promise.resolve(new Response(null, { status: 502 }))
      return Promise.resolve(new Response(null, { status: 403 })) // terminal: sem retry
    })
    vi.stubGlobal('fetch', fn)

    await GET(req())
    expect(vi.mocked(Sentry.captureException)).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('403') }),
      expect.objectContaining({ tags: expect.objectContaining({ component: 'cron', job: 'uptime-probe' }) }),
    )
  })

  it('recusa TRANSITÓRIA (429, esgota as re-tentativas) NÃO dispara captureException — só a terminal e o URL ausente contam', async () => {
    vi.stubEnv('NTFY_URL', 'https://ntfy.sh/my-topic')
    const supabase = makeSupabase()
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)
    stubPerformanceNow([0, 100])
    const fn = vi.fn((url: string | URL) => {
      if (String(url).includes('/robots.txt')) return Promise.resolve(new Response(null, { status: 502 }))
      return Promise.resolve(new Response(null, { status: 429 }))
    })
    vi.stubGlobal('fetch', fn)

    await GET(req())
    expect(vi.mocked(Sentry.captureException)).not.toHaveBeenCalled()
  })

  it('deduped (claim recusa) NÃO dispara captureException — a supressão é intencional, não uma falha', async () => {
    vi.stubEnv('NTFY_URL', 'https://ntfy.sh/my-topic')
    const supabase = makeSupabase()
    supabase.rpc.mockImplementation(() => Promise.resolve({ data: false, error: null }))
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)
    stubPerformanceNow([0, 100])
    const { fn } = mockFetch({ targetStatus: 502 })
    vi.stubGlobal('fetch', fn)

    await GET(req())
    expect(vi.mocked(Sentry.captureException)).not.toHaveBeenCalled()
  })
})
