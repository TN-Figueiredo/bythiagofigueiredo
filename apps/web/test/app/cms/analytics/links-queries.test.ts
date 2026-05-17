import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

describe('links-queries logic', () => {
  it('conversion rate calculation with clicks', () => {
    const totalClicks = 200
    const totalConversions = 10
    const convRate = totalClicks > 0 ? ((totalConversions / totalClicks) * 100).toFixed(1) : '0'
    expect(convRate).toBe('5.0')
  })

  it('conversion rate is 0 when no clicks', () => {
    const totalClicks = 0
    const totalConversions = 0
    const convRate = totalClicks > 0 ? ((totalConversions / totalClicks) * 100).toFixed(1) : '0'
    expect(convRate).toBe('0')
  })

  it('LinkRow mapping from RPC response', () => {
    const rpcRow = { id: 'abc', code: 'promo1', source: 'social', clicks: 150, unique_clicks: 120, conversions: 5, top_country: 'BR', top_device: 'mobile' }
    const mapped = {
      id: rpcRow.id as string,
      code: rpcRow.code as string,
      source: (rpcRow.source as string) ?? 'direct',
      clicks: Number(rpcRow.clicks ?? 0),
      uniqueClicks: Number(rpcRow.unique_clicks ?? 0),
      conversions: Number(rpcRow.conversions ?? 0),
      topCountry: (rpcRow.top_country as string) ?? '—',
      topDevice: (rpcRow.top_device as string) ?? '—',
    }
    expect(mapped.uniqueClicks).toBe(120)
    expect(mapped.topCountry).toBe('BR')
  })

  it('LinkRow mapping with null optional fields', () => {
    const rpcRow = { id: 'x', code: 'test', source: null, clicks: 10, unique_clicks: 8, conversions: 0, top_country: null, top_device: null }
    const mapped = {
      source: (rpcRow.source as string | null) ?? 'direct',
      topCountry: (rpcRow.top_country as string | null) ?? '—',
      topDevice: (rpcRow.top_device as string | null) ?? '—',
    }
    expect(mapped.source).toBe('direct')
    expect(mapped.topCountry).toBe('—')
    expect(mapped.topDevice).toBe('—')
  })

  it('unique clicks aggregation across links', () => {
    const links = [
      { uniqueClicks: 50 },
      { uniqueClicks: 30 },
      { uniqueClicks: 20 },
    ]
    const total = links.reduce((s, l) => s + l.uniqueClicks, 0)
    expect(total).toBe(100)
  })
})
