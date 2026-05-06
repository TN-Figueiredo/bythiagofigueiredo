import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRpc = vi.fn()

vi.mock('../../../lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    rpc: mockRpc,
  }),
}))

vi.stubEnv('CRON_SECRET', 'test-secret')

describe('POST /api/cron/links-partition-maintenance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRpc.mockResolvedValue({ data: true, error: null })
  })

  it('returns 401 without valid CRON_SECRET', async () => {
    const { POST } = await import(
      '../../../src/app/api/cron/links-partition-maintenance/route'
    )
    const req = new Request('http://localhost/api/cron/links-partition-maintenance', {
      method: 'POST',
      headers: { authorization: 'Bearer wrong' },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 200 and calls create_link_clicks_partition RPC', async () => {
    mockRpc
      .mockResolvedValueOnce({ data: true, error: null }) // cron_try_lock
      .mockResolvedValueOnce({ data: 'link_clicks_2026_06', error: null }) // create partition
      .mockResolvedValueOnce({ data: null, error: null }) // cron_unlock
    const { POST } = await import(
      '../../../src/app/api/cron/links-partition-maintenance/route'
    )
    const req = new Request('http://localhost/api/cron/links-partition-maintenance', {
      method: 'POST',
      headers: { authorization: 'Bearer test-secret' },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('partition')
  })

  it('computes next month correctly for partition name', async () => {
    const { getNextMonthRange } = await import(
      '../../../src/app/api/cron/links-partition-maintenance/route'
    )
    // Calling in May 2026 should produce June 2026 range
    const result = getNextMonthRange(new Date('2026-05-15'))
    expect(result.year).toBe(2026)
    expect(result.month).toBe(6)
    expect(result.startDate).toBe('2026-06-01')
    expect(result.endDate).toBe('2026-07-01')
  })

  it('handles December -> January year rollover', async () => {
    const { getNextMonthRange } = await import(
      '../../../src/app/api/cron/links-partition-maintenance/route'
    )
    const result = getNextMonthRange(new Date('2026-12-01'))
    expect(result.year).toBe(2027)
    expect(result.month).toBe(1)
    expect(result.startDate).toBe('2027-01-01')
    expect(result.endDate).toBe('2027-02-01')
  })

  it('acquires cron lock', async () => {
    mockRpc
      .mockResolvedValueOnce({ data: true, error: null }) // cron_try_lock
      .mockResolvedValueOnce({ data: 'link_clicks_2026_06', error: null }) // create partition
      .mockResolvedValueOnce({ data: null, error: null }) // cron_unlock
    const { POST } = await import(
      '../../../src/app/api/cron/links-partition-maintenance/route'
    )
    const req = new Request('http://localhost/api/cron/links-partition-maintenance', {
      method: 'POST',
      headers: { authorization: 'Bearer test-secret' },
    })
    await POST(req)
    expect(mockRpc).toHaveBeenCalledWith('cron_try_lock', {
      p_job: 'cron:links-partition-maintenance',
    })
  })
})
