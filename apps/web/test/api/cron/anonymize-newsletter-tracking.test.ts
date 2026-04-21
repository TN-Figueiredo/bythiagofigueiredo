import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setLogger, resetLogger } from '../../../lib/logger'

const CRON_SECRET = 'test-secret'
process.env.CRON_SECRET = CRON_SECRET

const rpcMock = vi.fn()
vi.mock('../../../lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    rpc: rpcMock,
    from: vi.fn().mockReturnValue({
      update: vi.fn().mockReturnValue({
        lt: vi.fn().mockReturnValue({
          not: vi.fn().mockResolvedValue({ data: null, error: null, count: 5 }),
        }),
      }),
    }),
  }),
}))

import { POST } from '../../../src/app/api/cron/anonymize-newsletter-tracking/route'

function req(secret?: string) {
  return new Request('http://localhost/api/cron/anonymize-newsletter-tracking', {
    method: 'POST',
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  })
}

describe('POST /api/cron/anonymize-newsletter-tracking', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setLogger({ info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never)
    rpcMock.mockResolvedValue({ data: true, error: null })
  })
  afterEach(() => { resetLogger() })

  it('returns 401 without auth', async () => {
    const res = await POST(req())
    expect(res.status).toBe(401)
  })

  it('returns 200 on success', async () => {
    const res = await POST(req(CRON_SECRET))
    expect(res.status).toBe(200)
  })
})
