/**
 * Tests for GET/POST /api/cron/youtube-intelligence-watchdog.
 *
 * Root cause under test (F15, WP-E): tasks in `youtube_intelligence_tasks` can get stuck in
 * `running` forever (crashed worker, timed-out request) — `idx_yt_intel_task_active` only
 * covers `pending`/`running`, so a stuck row blocks the channel from ever being analyzed
 * again. The `stale` status already exists in the CHECK constraint but nothing ever wrote it.
 * This watchdog releases tasks that have been `running` past a threshold.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const CRON_SECRET = 'test-secret'
process.env.CRON_SECRET = CRON_SECRET

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}))

import { GET } from '../../src/app/api/cron/youtube-intelligence-watchdog/route'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

function req(secret?: string) {
  return new Request('http://localhost/api/cron/youtube-intelligence-watchdog', {
    method: 'GET',
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  })
}

interface ICall {
  patch: Record<string, unknown>
  eq: Array<[string, unknown]>
  neq: Array<[string, unknown]>
  gte: Array<[string, unknown]>
  lt: Array<[string, unknown]>
}

/** Records every update statement; `rowsFor` decides what each one "matches". */
function makeSupabase(rowsFor: (c: ICall) => Array<{ id: string }> = () => []) {
  const calls: ICall[] = []
  const from = vi.fn((table: string) => {
    if (table !== 'youtube_intelligence_tasks') throw new Error(`unexpected table in test: ${table}`)
    return {
      update: vi.fn((patch: Record<string, unknown>) => {
        const c: ICall = { patch, eq: [], neq: [], gte: [], lt: [] }
        calls.push(c)
        const chain = {
          eq: vi.fn((k: string, v: unknown) => { c.eq.push([k, v]); return chain }),
          neq: vi.fn((k: string, v: unknown) => { c.neq.push([k, v]); return chain }),
          gte: vi.fn((k: string, v: unknown) => { c.gte.push([k, v]); return chain }),
          lt: vi.fn((k: string, v: unknown) => { c.lt.push([k, v]); return chain }),
          select: vi.fn(() => Promise.resolve({ data: rowsFor(c), error: null })),
        }
        return chain
      }),
    }
  })
  const diag = () => calls.find((c) => c.patch.status === 'stale')!
  const requeues = () => calls.filter((c) => c.patch.status === 'pending')
  const failures = () => calls.filter((c) => c.patch.status === 'failed')
  return { from, calls, diag, requeues, failures }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/cron/youtube-intelligence-watchdog — auth gate', () => {
  it('401 without a valid CRON_SECRET', async () => {
    const res = await GET(req() as never)
    expect(res.status).toBe(401)
  })

  it('401 with the wrong secret', async () => {
    const res = await GET(req('nope') as never)
    expect(res.status).toBe(401)
  })
})

describe('GET /api/cron/youtube-intelligence-watchdog — releases stale tasks', () => {
  const now = Date.UTC(2026, 8, 19, 15, 0, 0)

  beforeEach(() => { vi.useFakeTimers({ now, toFake: ['Date'] }) })
  afterEach(() => { vi.useRealTimers() })

  it('diagnostico: running past the threshold becomes stale, exactly as before', async () => {
    const supabase = makeSupabase((c) => (c.patch.status === 'stale' ? [{ id: 'task-1' }] : []))
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    const res = await GET(req(CRON_SECRET) as never)
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.released).toBe(1)
    const d = supabase.diag()
    expect(d.patch).toEqual({ status: 'stale', error_message: 'auto-released: running past 30min' })
    expect(d.eq).toEqual([['status', 'running'], ['task_type', 'diagnostico']])
    expect(d.lt).toEqual([['started_at', new Date(now - 30 * 60_000).toISOString()]])
  })

  it('observatory row with retry 0 goes back to pending with retry 1 and released_at', async () => {
    const supabase = makeSupabase((c) => (c.patch.retry_count === 1 ? [{ id: 'obs-1' }] : []))
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    const body = await (await GET(req(CRON_SECRET) as never)).json()

    expect(body).toEqual({ released: 0, requeued: 1, failed: 0 })
    const r = supabase.requeues().find((c) => c.patch.retry_count === 1)!
    expect(r.patch).toEqual({
      status: 'pending', retry_count: 1, released_at: new Date(now).toISOString(), started_at: null,
    })
    expect(r.eq).toContainEqual(['retry_count', 0])
    expect(r.eq).toContainEqual(['status', 'running'])
    expect(r.neq).toEqual([['task_type', 'diagnostico']])
    expect(r.lt).toEqual([['started_at', new Date(now - 30 * 60_000).toISOString()]])
    expect(supabase.requeues().map((c) => c.patch.retry_count)).toEqual([1, 2])
  })

  it('observatory row with retry 2 fails as travou-3x', async () => {
    const supabase = makeSupabase((c) => (c.patch.status === 'failed' ? [{ id: 'obs-2' }] : []))
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    const body = await (await GET(req(CRON_SECRET) as never)).json()

    expect(body).toEqual({ released: 0, requeued: 0, failed: 1 })
    const [f] = supabase.failures()
    expect(f!.patch).toEqual({ status: 'failed', error_message: 'travou-3x', failed_at: new Date(now).toISOString() })
    expect(f!.gte).toEqual([['retry_count', 2]])
    expect(f!.neq).toEqual([['task_type', 'diagnostico']])
    expect(f!.lt).toEqual([['started_at', new Date(now - 30 * 60_000).toISOString()]])
  })

  it('reports zeros when nothing is stale', async () => {
    const supabase = makeSupabase()
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    const body = await (await GET(req(CRON_SECRET) as never)).json()

    expect(body).toEqual({ released: 0, requeued: 0, failed: 0 })
  })
})

describe('env without a default', () => {
  const saved = process.env.CRON_SECRET
  afterEach(() => { process.env.CRON_SECRET = saved })

  it('with CRON_SECRET deleted there is no fallback: a request without auth is 401', async () => {
    delete process.env.CRON_SECRET
    const res = await GET(req() as never)
    expect(res.status).toBe(401)
  })
})
