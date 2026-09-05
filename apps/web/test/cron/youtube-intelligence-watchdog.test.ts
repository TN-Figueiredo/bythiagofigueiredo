/**
 * Tests for GET/POST /api/cron/youtube-intelligence-watchdog.
 *
 * Root cause under test (F15, WP-E): tasks in `youtube_intelligence_tasks` can get stuck in
 * `running` forever (crashed worker, timed-out request) — `idx_yt_intel_task_active` only
 * covers `pending`/`running`, so a stuck row blocks the channel from ever being analyzed
 * again. The `stale` status already exists in the CHECK constraint but nothing ever wrote it.
 * This watchdog releases tasks that have been `running` past a threshold.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

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

function makeSupabase(releasedRows: Array<{ id: string; channel_id: string }>) {
  const eqCalls: Array<[string, unknown]> = []
  const ltCalls: Array<[string, unknown]> = []

  const chain = {
    eq: vi.fn((col: string, val: unknown) => {
      eqCalls.push([col, val])
      return chain
    }),
    lt: vi.fn((col: string, val: unknown) => {
      ltCalls.push([col, val])
      return chain
    }),
    select: vi.fn(() => Promise.resolve({ data: releasedRows, error: null })),
  }

  const from = vi.fn((table: string) => {
    if (table === 'youtube_intelligence_tasks') {
      return { update: vi.fn(() => chain) }
    }
    throw new Error(`unexpected table in test: ${table}`)
  })

  return { from, eqCalls, ltCalls }
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
  it('filters on status=running and releases only tasks past the threshold', async () => {
    const supabase = makeSupabase([{ id: 'task-1', channel_id: 'ch-1' }])
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    const res = await GET(req(CRON_SECRET) as never)
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.released).toBe(1)
    expect(supabase.eqCalls).toContainEqual(['status', 'running'])
    expect(supabase.ltCalls).toHaveLength(1)
    expect(supabase.ltCalls[0]![0]).toBe('started_at')
  })

  it('reports 0 released when nothing is stale', async () => {
    const supabase = makeSupabase([])
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    const res = await GET(req(CRON_SECRET) as never)
    const body = await res.json()

    expect(body.released).toBe(0)
  })
})
