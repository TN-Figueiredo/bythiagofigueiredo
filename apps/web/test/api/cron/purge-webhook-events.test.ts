import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setLogger, resetLogger } from '../../../lib/logger'

const CRON_SECRET = 'test-secret'
process.env.CRON_SECRET = CRON_SECRET

const deleteLtMock = vi.fn().mockResolvedValue({ count: 3, error: null })
const deleteMock = vi.fn().mockReturnValue({ lt: deleteLtMock })
const rpcMock = vi.fn()

vi.mock('../../../lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    rpc: rpcMock,
    from: () => ({ delete: deleteMock }),
  }),
}))

import { POST } from '../../../src/app/api/cron/purge-webhook-events/route'

function req(secret?: string) {
  return new Request('http://localhost/api/cron/purge-webhook-events', {
    method: 'POST',
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  })
}

describe('POST /api/cron/purge-webhook-events', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setLogger({ info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never)
    rpcMock.mockResolvedValue({ data: true, error: null })
    deleteLtMock.mockResolvedValue({ count: 3, error: null })
  })
  afterEach(() => { resetLogger() })

  it('returns 401 without auth', async () => {
    const res = await POST(req())
    expect(res.status).toBe(401)
  })

  it('returns 401 with wrong token', async () => {
    const res = await POST(req('Bearer wrong'))
    expect(res.status).toBe(401)
  })

  it('returns 200 on success', async () => {
    const res = await POST(req(CRON_SECRET))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.purged).toBe(3)
  })
})
