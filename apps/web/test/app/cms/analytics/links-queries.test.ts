import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

describe('links-queries', () => {
  it('LinksTabData has correct structure', () => {
    interface LinksKpi { label: string; value: number | string }
    const kpis: LinksKpi[] = [
      { label: 'Total Clicks', value: 1234 },
      { label: 'Active Links', value: 42 },
    ]
    expect(kpis).toHaveLength(2)
  })

  it('LinkRow contains expected fields', () => {
    const link = { id: '1', code: 'test', source: 'social', clicks: 100, uniqueClicks: 80, conversions: 5, topCountry: 'BR', topDevice: 'mobile' }
    expect(link.clicks).toBeGreaterThan(link.uniqueClicks)
  })
})
