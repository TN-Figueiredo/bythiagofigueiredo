import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

import { checkLongevity } from '@/lib/youtube/thumbnail-library'

describe('checkLongevity', () => {
  it('returns holding for ±20% change', async () => {
    const result = await checkLongevity('lib-1', 7, 1100, 1000)
    expect(result.status).toBe('holding')
    expect(result.changePercent).toBe(10)
  })

  it('returns fading for >20% drop', async () => {
    const result = await checkLongevity('lib-1', 30, 700, 1000)
    expect(result.status).toBe('fading')
    expect(result.changePercent).toBe(-30)
  })

  it('returns growing for >20% gain', async () => {
    const result = await checkLongevity('lib-1', 7, 1500, 1000)
    expect(result.status).toBe('growing')
    expect(result.changePercent).toBe(50)
  })

  it('returns holding when viewsAtWin is 0', async () => {
    const result = await checkLongevity('lib-1', 7, 100, 0)
    expect(result.status).toBe('holding')
    expect(result.changePercent).toBe(0)
  })
})
