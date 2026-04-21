import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setLogger, resetLogger } from '../../../lib/logger'

const CRON_SECRET = 'test-secret'
process.env.CRON_SECRET = CRON_SECRET

const fromMock = vi.fn()
const rpcMock = vi.fn()

vi.mock('../../../lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: fromMock,
    rpc: rpcMock,
  }),
}))

vi.mock('../../../lib/email/service', () => ({
  getEmailService: () => ({
    send: vi.fn().mockResolvedValue({ messageId: 'msg_1', provider: 'resend' }),
  }),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))

import { POST } from '../../../src/app/api/cron/send-scheduled-newsletters/route'

function req(secret?: string) {
  return new Request('http://localhost/api/cron/send-scheduled-newsletters', {
    method: 'POST',
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  })
}

describe('POST /api/cron/send-scheduled-newsletters', () => {
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

  it('returns 401 with wrong secret', async () => {
    const res = await POST(req('wrong'))
    expect(res.status).toBe(401)
  })

  it('returns 200 with no scheduled editions', async () => {
    fromMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          lte: vi.fn().mockReturnValue({
            data: [],
            error: null,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [{ id: 'ed1' }], error: null }),
        }),
      }),
    })
    const res = await POST(req(CRON_SECRET))
    expect(res.status).toBe(200)
  })
})
