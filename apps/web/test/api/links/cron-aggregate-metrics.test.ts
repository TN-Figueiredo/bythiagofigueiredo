import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRpc = vi.fn()
const mockFrom = vi.fn()
const mockSelect = vi.fn()
const mockInsert = vi.fn()

vi.mock('../../../lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: (table: string) => {
      mockFrom(table)
      if (table === 'link_aggregation_watermark') {
        return {
          select: () => ({
            single: mockSelect,
          }),
          upsert: mockInsert,
        }
      }
      if (table === 'link_clicks') {
        return {
          select: () => ({
            gt: () => ({
              lte: () => ({
                order: () => ({ data: [], error: null }),
              }),
            }),
          }),
        }
      }
      if (table === 'link_daily_metrics') {
        return { upsert: mockInsert }
      }
      return {}
    },
    rpc: mockRpc,
  }),
}))

vi.stubEnv('CRON_SECRET', 'test-secret')

describe('GET /api/cron/links-aggregate-metrics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRpc.mockResolvedValue({ data: true, error: null })
    mockSelect.mockResolvedValue({
      data: { last_processed_at: '2026-05-05T00:00:00Z' },
      error: null,
    })
    mockInsert.mockResolvedValue({ error: null })
  })

  it('returns 401 without valid CRON_SECRET', async () => {
    const { GET } = await import(
      '../../../src/app/api/cron/links-aggregate-metrics/route'
    )
    const req = new Request('http://localhost/api/cron/links-aggregate-metrics', {
      headers: { authorization: 'Bearer wrong' },
    })
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns 200 with aggregation result on valid auth', async () => {
    const { GET } = await import(
      '../../../src/app/api/cron/links-aggregate-metrics/route'
    )
    const req = new Request('http://localhost/api/cron/links-aggregate-metrics', {
      headers: { authorization: 'Bearer test-secret' },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('aggregated')
  })

  it('acquires cron lock before processing', async () => {
    const { GET } = await import(
      '../../../src/app/api/cron/links-aggregate-metrics/route'
    )
    const req = new Request('http://localhost/api/cron/links-aggregate-metrics', {
      headers: { authorization: 'Bearer test-secret' },
    })
    await GET(req)
    expect(mockRpc).toHaveBeenCalledWith('cron_try_lock', expect.any(Object))
  })
})
