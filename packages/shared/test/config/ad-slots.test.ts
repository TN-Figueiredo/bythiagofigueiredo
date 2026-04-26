import { describe, it, expect } from 'vitest'
import { SITE_AD_SLOTS } from '../../src/config/ad-slots.js'
import type { AdSlotDefinition } from '../../src/index.js'

describe('SITE_AD_SLOTS (shared@0.9.0)', () => {
  it('exports exactly 5 slots (inline_end removed)', () => {
    expect(SITE_AD_SLOTS).toHaveLength(5)
  })

  it('does not contain inline_end', () => {
    const keys = SITE_AD_SLOTS.map((s) => s.key)
    expect(keys).not.toContain('inline_end')
  })

  it('contains all expected slot keys', () => {
    const keys = SITE_AD_SLOTS.map((s) => s.key)
    expect(keys).toEqual(
      expect.arrayContaining(['banner_top', 'rail_left', 'rail_right', 'inline_mid', 'block_bottom']),
    )
  })

  it('every slot has a non-empty aspectRatio string', () => {
    for (const slot of SITE_AD_SLOTS) {
      expect(typeof slot.aspectRatio).toBe('string')
      expect(slot.aspectRatio.length).toBeGreaterThan(0)
    }
  })

  it('every slot has a non-empty iabSize string', () => {
    for (const slot of SITE_AD_SLOTS) {
      expect(typeof slot.iabSize).toBe('string')
      expect(slot.iabSize.length).toBeGreaterThan(0)
    }
  })

  it('banner_top has correct IAB dimensions', () => {
    const slot = SITE_AD_SLOTS.find((s) => s.key === 'banner_top')
    expect(slot?.aspectRatio).toBe('8:1')
    expect(slot?.iabSize).toBe('728x90')
  })

  it('rail_left has correct IAB dimensions', () => {
    const slot = SITE_AD_SLOTS.find((s) => s.key === 'rail_left')
    expect(slot?.aspectRatio).toBe('1:4')
    expect(slot?.iabSize).toBe('160x600')
  })

  it('rail_right has correct IAB dimensions', () => {
    const slot = SITE_AD_SLOTS.find((s) => s.key === 'rail_right')
    expect(slot?.aspectRatio).toBe('6:5')
    expect(slot?.iabSize).toBe('300x250')
  })

  it('inline_mid has correct IAB dimensions', () => {
    const slot = SITE_AD_SLOTS.find((s) => s.key === 'inline_mid')
    expect(slot?.aspectRatio).toBe('6:5')
    expect(slot?.iabSize).toBe('300x250')
  })

  it('block_bottom has correct IAB dimensions', () => {
    const slot = SITE_AD_SLOTS.find((s) => s.key === 'block_bottom')
    expect(slot?.aspectRatio).toBe('4:1')
    expect(slot?.iabSize).toBe('970x250')
  })

  it('AdSlotDefinition type is exported from index', () => {
    const _typeCheck: AdSlotDefinition = SITE_AD_SLOTS[0] as AdSlotDefinition
    expect(_typeCheck).toBeDefined()
  })
})
