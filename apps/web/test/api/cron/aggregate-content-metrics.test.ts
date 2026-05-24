import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const CRON_SECRET = 'test-secret'
process.env.CRON_SECRET = CRON_SECRET

vi.mock('../../../lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}))

import { POST } from '../../../src/app/api/cron/aggregate-content-metrics/route'
import { getSupabaseServiceClient } from '../../../lib/supabase/service'
import { setLogger, resetLogger } from '../../../lib/logger'

function makeSupabase(opts: {
  rpcResult?: { data: unknown; error: unknown }
} = {}) {
  const cronInsert = vi.fn().mockResolvedValue({ error: null })
  const rpcMock = vi.fn().mockImplementation((name: string) => {
    if (name === 'cron_try_lock') return Promise.resolve({ data: true, error: null })
    if (name === 'cron_unlock') return Promise.resolve({ data: null, error: null })
    if (name === 'aggregate_content_events') {
      return Promise.resolve(
        opts.rpcResult ?? {
          data: { date: '2026-05-24', metrics_upserted: 5, posts_updated: 3 },
          error: null,
        },
      )
    }
    return Promise.resolve({ data: null, error: null })
  })
  return {
    rpc: rpcMock,
    from: vi.fn(() => ({ insert: cronInsert })),
    _rpcMock: rpcMock,
    _cronInsert: cronInsert,
  }
}

function req(secret = CRON_SECRET) {
  return new Request('http://localhost/api/cron/aggregate-content-metrics', {
    method: 'POST',
    headers: { authorization: `Bearer ${secret}` },
  })
}

beforeEach(() => {
  process.env.CRON_SECRET = CRON_SECRET
  vi.clearAllMocks()
  setLogger({ warn: () => {}, error: () => {} })
})

afterEach(() => {
  vi.restoreAllMocks()
  resetLogger()
})

describe('POST /api/cron/aggregate-content-metrics', () => {
  it('401 without bearer', async () => {
    const res = await POST(new Request('http://localhost/api/cron/aggregate-content-metrics', { method: 'POST' }))
    expect(res.status).toBe(401)
  })

  it('401 with wrong secret', async () => {
    const res = await POST(req('wrong'))
    expect(res.status).toBe(401)
  })

  it('200 + metrics on success', async () => {
    const supabase = makeSupabase({
      rpcResult: {
        data: { date: '2026-05-24', metrics_upserted: 12, posts_updated: 4 },
        error: null,
      },
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    const res = await POST(req())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.metrics_upserted).toBe(12)
    expect(body.posts_updated).toBe(4)
  })

  it('calls revalidateTag for most-read and content-analytics', async () => {
    const { revalidateTag } = await import('next/cache')
    const supabase = makeSupabase()
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    await POST(req())

    expect(revalidateTag).toHaveBeenCalledWith('most-read')
    expect(revalidateTag).toHaveBeenCalledWith('content-analytics')
  })

  it('500 when RPC returns an error', async () => {
    const supabase = makeSupabase({
      rpcResult: { data: null, error: { message: 'rpc boom' } },
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    const res = await POST(req())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.err_code).toBe('rpc_failed')
  })
})
