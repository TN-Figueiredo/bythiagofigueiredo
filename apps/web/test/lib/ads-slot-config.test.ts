import { describe, it, expect } from 'vitest'
import { SITE_AD_SLOTS } from '@app/shared'

describe('SITE_AD_SLOTS', () => {
  it('does not include inline_end slot', () => {
    const keys = SITE_AD_SLOTS.map((s) => s.key)
    expect(keys).not.toContain('inline_end')
  })

  it('includes all 5 active slots', () => {
    const keys = SITE_AD_SLOTS.map((s) => s.key)
    expect(keys).toContain('banner_top')
    expect(keys).toContain('rail_left')
    expect(keys).toContain('rail_right')
    expect(keys).toContain('inline_mid')
    expect(keys).toContain('block_bottom')
    expect(keys.length).toBe(5)
  })
})

describe('ads index exports', () => {
  it('does not export BowtieAd', async () => {
    const mod = await import('../../src/components/blog/ads')
    expect((mod as Record<string, unknown>).BowtieAd).toBeUndefined()
  })

  it('exports all 5 remaining ad components', async () => {
    const mod = await import('../../src/components/blog/ads')
    expect(mod.DoormanAd).toBeDefined()
    expect(mod.MarginaliaAd).toBeDefined()
    expect(mod.AnchorAd).toBeDefined()
    expect(mod.BookmarkAd).toBeDefined()
    expect(mod.CodaAd).toBeDefined()
  })
})
