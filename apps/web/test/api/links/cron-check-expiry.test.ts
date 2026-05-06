import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRpc = vi.fn()
const mockUpdate = vi.fn()
const mockSelect = vi.fn()
const mockIn = vi.fn()

vi.mock('../../../lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: (table: string) => {
      if (table === 'tracked_links') {
        return {
          update: (payload: unknown) => {
            mockUpdate(payload)
            return {
              in: mockIn,
            }
          },
          select: () => ({
            eq: () => ({
              lt: () => ({
                not: () => mockSelect(),
              }),
            }),
          }),
        }
      }
      return {}
    },
    rpc: mockRpc,
  }),
}))

vi.mock('@/lib/links/cache', () => ({
  invalidateLink: vi.fn(),
  invalidateList: vi.fn(),
  invalidateAnalytics: vi.fn(),
}))

vi.stubEnv('CRON_SECRET', 'test-secret')

describe('GET /api/cron/links-check-expiry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRpc.mockResolvedValue({ data: true, error: null })
    mockSelect.mockResolvedValue({ data: [], error: null })
    mockIn.mockResolvedValue({ error: null })
  })

  it('returns 401 without valid CRON_SECRET', async () => {
    const { GET } = await import('../../../src/app/api/cron/links-check-expiry/route')
    const req = new Request('http://localhost/api/cron/links-check-expiry', {
      headers: { authorization: 'Bearer wrong' },
    })
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns 200 and reports expired count', async () => {
    const { GET } = await import('../../../src/app/api/cron/links-check-expiry/route')
    const req = new Request('http://localhost/api/cron/links-check-expiry', {
      headers: { authorization: 'Bearer test-secret' },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('expired')
  })

  it('updates status to expired for links past expires_at', async () => {
    mockSelect.mockResolvedValue({
      data: [
        { id: 'l1', site_id: 's1', short_code: 'abc' },
        { id: 'l2', site_id: 's1', short_code: 'def' },
      ],
      error: null,
    })
    const { GET } = await import('../../../src/app/api/cron/links-check-expiry/route')
    const req = new Request('http://localhost/api/cron/links-check-expiry', {
      headers: { authorization: 'Bearer test-secret' },
    })
    await GET(req)
    expect(mockUpdate).toHaveBeenCalledWith({ status: 'expired' })
  })

  it('acquires cron lock', async () => {
    const { GET } = await import('../../../src/app/api/cron/links-check-expiry/route')
    const req = new Request('http://localhost/api/cron/links-check-expiry', {
      headers: { authorization: 'Bearer test-secret' },
    })
    await GET(req)
    expect(mockRpc).toHaveBeenCalledWith('cron_try_lock', {
      p_job: 'cron:links-check-expiry',
    })
  })
})
