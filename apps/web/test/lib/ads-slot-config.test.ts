import { describe, it, expect } from 'vitest'
import { SITE_AD_SLOTS, AD_AREAS, getSlotsByArea } from '@app/shared'

describe('SITE_AD_SLOTS', () => {
  it('includes all 10 active slots', () => {
    const keys = SITE_AD_SLOTS.map((s) => s.key)
    expect(keys).toEqual([
      'post:top:banner',
      'post:rail:anchor-left',
      'post:rail:anchor',
      'post:body:bookmark',
      'post:footer:coda',
      'archive:top:doorman',
      'archive:break:anchor',
      'archive:grid:bookmark',
      'archive:footer:marginalia',
      'archive:footer:bowtie',
    ])
  })

  it('every slot has an area field', () => {
    for (const slot of SITE_AD_SLOTS) {
      expect(slot).toHaveProperty('area')
      expect(['post', 'archive', 'home', 'youtube']).toContain(slot.area)
    }
  })

  it('getSlotsByArea returns correct groupings', () => {
    expect(getSlotsByArea('post')).toHaveLength(5)
    expect(getSlotsByArea('archive')).toHaveLength(5)
    expect(getSlotsByArea('home')).toHaveLength(0)
    expect(getSlotsByArea('youtube')).toHaveLength(0)
  })

  it('AD_AREAS defines 4 areas', () => {
    expect(AD_AREAS).toHaveLength(4)
    expect(AD_AREAS.map((a) => a.key)).toEqual(['post', 'archive', 'home', 'youtube'])
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
