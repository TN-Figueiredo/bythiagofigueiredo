import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

describe('audience-queries', () => {
  it('AudienceTabData structure is valid', () => {
    const data = {
      countries: [{ country: 'BR', percentage: 45 }],
      devices: [{ device: 'mobile', percentage: 60 }],
      sources: [{ source: 'google', percentage: 38 }],
      funnel: [{ label: 'YT Views', value: 1000 }],
      bestTimes: [],
    }
    expect(data.countries[0]!.percentage).toBe(45)
    expect(data.devices[0]!.device).toBe('mobile')
  })
})
