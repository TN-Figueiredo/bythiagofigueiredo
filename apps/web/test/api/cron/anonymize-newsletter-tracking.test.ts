import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setLogger, resetLogger } from '../../../lib/logger'

const CRON_SECRET = 'test-secret'
process.env.CRON_SECRET = CRON_SECRET

const rpcMock = vi.fn()
const fromMock = vi.fn()

vi.mock('../../../lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    rpc: rpcMock,
    from: fromMock,
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

    fromMock.mockImplementation((table: string) => {
      if (table === 'newsletter_sends') {
        return {
          update: vi.fn().mockReturnValue({
            lt: vi.fn().mockReturnValue({
              not: vi.fn().mockResolvedValue({ data: null, error: null, count: 5 }),
            }),
          }),
        }
      }
      if (table === 'tracked_links') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ id: 'link-1' }, { id: 'link-2' }],
              error: null,
            }),
          }),
        }
      }
      if (table === 'link_clicks') {
        return {
          update: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              lt: vi.fn().mockReturnValue({
                not: vi.fn().mockResolvedValue({ data: null, error: null, count: 3 }),
              }),
            }),
          }),
        }
      }
      return {
        update: vi.fn().mockReturnValue({
          lt: vi.fn().mockReturnValue({
            not: vi.fn().mockResolvedValue({ data: null, error: null, count: 0 }),
          }),
        }),
      }
    })
  })
  afterEach(() => { resetLogger() })

  it('returns 401 without auth', async () => {
    const res = await POST(req())
    expect(res.status).toBe(401)
  })

  it('returns 200 on success', async () => {
    const res = await POST(req(CRON_SECRET))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sends_anonymized).toBe(5)
    expect(body.clicks_anonymized).toBe(3)
  })

  it('handles no newsletter links gracefully', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'newsletter_sends') {
        return {
          update: vi.fn().mockReturnValue({
            lt: vi.fn().mockReturnValue({
              not: vi.fn().mockResolvedValue({ data: null, error: null, count: 2 }),
            }),
          }),
        }
      }
      if (table === 'tracked_links') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }
      }
      return { update: vi.fn().mockReturnValue({ lt: vi.fn().mockReturnValue({ not: vi.fn().mockResolvedValue({ data: null, error: null, count: 0 }) }) }) }
    })

    const res = await POST(req(CRON_SECRET))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sends_anonymized).toBe(2)
    expect(body.clicks_anonymized).toBe(0)
  })
})
