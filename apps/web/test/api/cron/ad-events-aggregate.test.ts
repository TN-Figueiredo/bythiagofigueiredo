import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const CRON_SECRET = 'test-secret'
process.env.CRON_SECRET = CRON_SECRET

vi.mock('../../../lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))

import { POST } from '../../../src/app/api/cron/ad-events-aggregate/route'
import { getSupabaseServiceClient } from '../../../lib/supabase/service'
import { setLogger, resetLogger } from '../../../lib/logger'

function makeSupabase(opts: {
  rpcResult?: { data: unknown; error: unknown }
} = {}) {
  const cronInsert = vi.fn().mockResolvedValue({ error: null })
  const rpcMock = vi.fn().mockImplementation((name: string) => {
    if (name === 'cron_try_lock') return Promise.resolve({ data: true, error: null })
    if (name === 'cron_unlock') return Promise.resolve({ data: null, error: null })
    if (name === 'aggregate_ad_events_yesterday') {
      return Promise.resolve(opts.rpcResult ?? { data: 3, error: null })
    }
    return Promise.resolve({ data: null, error: null })
  })
  return {
    rpc: rpcMock,
    from: vi.fn(() => ({ insert: cronInsert })),
    _cronInsert: cronInsert,
    _rpcMock: rpcMock,
  }
}

function req(secret = CRON_SECRET) {
  return new Request('http://localhost/api/cron/ad-events-aggregate', {
    method: 'POST',
    headers: { authorization: `Bearer ${secret}` },
  })
}

beforeEach(() => {
  process.env.CRON_SECRET = CRON_SECRET
  process.env.AD_TRACKING_ENABLED = 'true'
  vi.clearAllMocks()
  setLogger({ warn: () => {}, error: () => {} })
})

afterEach(() => {
  delete process.env.AD_TRACKING_ENABLED
  vi.restoreAllMocks()
  resetLogger()
})

describe('POST /api/cron/ad-events-aggregate', () => {
  it('401 without bearer', async () => {
    const res = await POST(new Request('http://localhost/api/cron/ad-events-aggregate', { method: 'POST' }))
    expect(res.status).toBe(401)
  })

  it('401 with wrong secret', async () => {
    const res = await POST(req('wrong'))
    expect(res.status).toBe(401)
  })

  it('204 when AD_TRACKING_ENABLED is false', async () => {
    process.env.AD_TRACKING_ENABLED = 'false'
    const res = await POST(req())
    expect(res.status).toBe(204)
  })

  it('204 when AD_TRACKING_ENABLED is not set', async () => {
    delete process.env.AD_TRACKING_ENABLED
    const res = await POST(req())
    expect(res.status).toBe(204)
  })

  it('200 + rows_upserted when aggregation succeeds', async () => {
    const supabase = makeSupabase({ rpcResult: { data: 7, error: null } })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    const res = await POST(req())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.rows_upserted).toBe(7)
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
