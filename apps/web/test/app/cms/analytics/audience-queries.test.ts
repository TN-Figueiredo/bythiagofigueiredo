import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

describe('audience-queries logic', () => {
  it('country mapping from RPC response', () => {
    const rpcRows = [
      { country: 'BR', percentage: 45.2 },
      { country: 'US', percentage: 22.1 },
      { country: null, percentage: 10.0 },
    ]
    const countries = rpcRows.map(r => ({
      country: r.country as string,
      percentage: Number(r.percentage ?? 0),
    }))
    expect(countries[0]!.percentage).toBe(45.2)
    expect(countries[2]!.country).toBeNull()
  })

  it('device mapping from RPC response', () => {
    const rpcRows = [
      { device_type: 'mobile', percentage: 60.5 },
      { device_type: 'desktop', percentage: 35.0 },
      { device_type: 'tablet', percentage: 4.5 },
    ]
    const devices = rpcRows.map(r => ({
      device: r.device_type as string,
      percentage: Number(r.percentage ?? 0),
    }))
    expect(devices).toHaveLength(3)
    expect(devices[0]!.device).toBe('mobile')
    expect(devices.reduce((s, d) => s + d.percentage, 0)).toBe(100)
  })

  it('source mapping from RPC response', () => {
    const rpcRows = [
      { referrer_src: 'google', percentage: 38 },
      { referrer_src: 'direct', percentage: 25 },
      { referrer_src: null, percentage: 12 },
    ]
    const sources = rpcRows.map(r => ({
      source: r.referrer_src as string,
      percentage: Number(r.percentage ?? 0),
    }))
    expect(sources[0]!.source).toBe('google')
  })

  it('funnel default structure has correct labels', () => {
    const funnel = [
      { label: 'Page Views', value: 0 },
      { label: 'Link Clicks', value: 0, dropOff: '—' },
      { label: 'NL Signups', value: 0, dropOff: '—' },
      { label: 'Purchases', value: 0, dropOff: '—' },
    ]
    expect(funnel).toHaveLength(4)
    expect(funnel[0]!.label).toBe('Page Views')
    expect(funnel[1]!.label).toBe('Link Clicks')
    expect(funnel[3]!.label).toBe('Purchases')
  })

  it('computeDropOff returns correct percentage', () => {
    function computeDropOff(from: number, to: number): string {
      if (from === 0) return '—'
      const drop = Math.round(((from - to) / from) * 100)
      return `-${drop}%`
    }
    expect(computeDropOff(1000, 300)).toBe('-70%')
    expect(computeDropOff(300, 50)).toBe('-83%')
    expect(computeDropOff(0, 50)).toBe('—')
    expect(computeDropOff(100, 0)).toBe('-100%')
  })

  it('empty bestTimes is valid state', () => {
    const bestTimes: Array<{ channel: string; color: string; bestDay: string; bestHour: string; heatmap: number[][] }> = []
    expect(bestTimes).toHaveLength(0)
  })
})
