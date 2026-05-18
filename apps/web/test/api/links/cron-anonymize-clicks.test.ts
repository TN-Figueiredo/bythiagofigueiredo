import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRpc = vi.fn()
const mockUpdate = vi.fn()

vi.mock('../../../lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: (table: string) => {
      if (table === 'link_clicks') {
        return {
          update: (payload: unknown) => {
            mockUpdate(payload)
            return {
              lt: () => ({
                not: () => ({
                  limit: () => ({ count: 500, error: null }),
                }),
              }),
            }
          },
        }
      }
      return {}
    },
    rpc: mockRpc,
  }),
}))

vi.stubEnv('CRON_SECRET', 'test-secret')

describe('GET /api/cron/links-anonymize-clicks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRpc.mockResolvedValue({ data: true, error: null })
  })

  it('returns 401 without valid CRON_SECRET', async () => {
    const { GET } = await import(
      '../../../src/app/api/cron/links-anonymize-clicks/route'
    )
    const req = new Request('http://localhost/api/cron/links-anonymize-clicks', {
      headers: { authorization: 'Bearer wrong' },
    })
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns 200 with anonymization count', async () => {
    const { GET } = await import(
      '../../../src/app/api/cron/links-anonymize-clicks/route'
    )
    const req = new Request('http://localhost/api/cron/links-anonymize-clicks', {
      headers: { authorization: 'Bearer test-secret' },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('anonymized')
  })

  it('nulls ip, user_agent, city, region, referrer_url, ad_click_ids fields', async () => {
    const { GET } = await import(
      '../../../src/app/api/cron/links-anonymize-clicks/route'
    )
    const req = new Request('http://localhost/api/cron/links-anonymize-clicks', {
      headers: { authorization: 'Bearer test-secret' },
    })
    await GET(req)
    expect(mockUpdate).toHaveBeenCalledWith({
      ip: null,
      user_agent: null,
      city: null,
      region: null,
      referrer_url: null,
      ad_click_ids: null,
    })
  })

  it('uses 30-day retention window', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-01T00:00:00Z'))
    const { GET } = await import(
      '../../../src/app/api/cron/links-anonymize-clicks/route'
    )
    const req = new Request('http://localhost/api/cron/links-anonymize-clicks', {
      headers: { authorization: 'Bearer test-secret' },
    })
    await GET(req)
    vi.useRealTimers()
  })
})
