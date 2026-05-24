import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const CRON_SECRET = 'test-secret'
process.env.CRON_SECRET = CRON_SECRET

vi.mock('../../../lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))

import { GET } from '../../../src/app/api/cron/anonymize-linktree-events/route'
import { getSupabaseServiceClient } from '../../../lib/supabase/service'
import { setLogger, resetLogger } from '../../../lib/logger'

function makeSupabase(updateResult: { count: number | null; error: unknown } = { count: 5, error: null }) {
  const limitFn = vi.fn().mockResolvedValue(updateResult)
  const notFn = vi.fn(() => ({ limit: limitFn }))
  const ltFn = vi.fn(() => ({ not: notFn }))
  const updateFn = vi.fn(() => ({ lt: ltFn }))
  const rpcMock = vi.fn().mockImplementation((name: string) => {
    if (name === 'cron_try_lock') return Promise.resolve({ data: true, error: null })
    if (name === 'cron_unlock') return Promise.resolve({ data: null, error: null })
    return Promise.resolve({ data: null, error: null })
  })
  const cronInsert = vi.fn().mockResolvedValue({ error: null })
  return {
    rpc: rpcMock,
    from: vi.fn((table: string) => {
      if (table === 'linktree_events') return { update: updateFn }
      return { insert: cronInsert }
    }),
    _updateFn: updateFn,
    _limitFn: limitFn,
  }
}

function req(secret = CRON_SECRET) {
  return new Request('http://localhost/api/cron/anonymize-linktree-events', {
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

describe('GET /api/cron/anonymize-linktree-events', () => {
  it('401 without bearer', async () => {
    const res = await GET(new Request('http://localhost/api/cron/anonymize-linktree-events'))
    expect(res.status).toBe(401)
  })

  it('401 with wrong secret', async () => {
    const res = await GET(req('wrong'))
    expect(res.status).toBe(401)
  })

  it('200 + anonymized count on success', async () => {
    const supabase = makeSupabase({ count: 12, error: null })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    const res = await GET(req())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.anonymized).toBe(12)
  })

  it('nullifies ip, user_agent, referrer_url, city, region', async () => {
    const supabase = makeSupabase({ count: 3, error: null })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    await GET(req())

    expect(supabase.from).toHaveBeenCalledWith('linktree_events')
    expect(supabase._updateFn).toHaveBeenCalledWith({
      ip: null,
      user_agent: null,
      referrer_url: null,
      city: null,
      region: null,
    })
  })

  it('500 on DB failure', async () => {
    const supabase = makeSupabase({ count: null, error: { message: 'db error' } })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    const res = await GET(req())
    expect(res.status).toBe(500)
  })
})
