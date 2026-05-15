import { describe, it, expect } from 'vitest'
import { SITE_AD_SLOTS } from '../../src/config/ad-slots.js'
import type { AdSlotDefinition } from '../../src/index.js'

describe('SITE_AD_SLOTS (shared@0.9.0)', () => {
  it('exports exactly 10 slots (5 post + 5 archive)', () => {
    expect(SITE_AD_SLOTS).toHaveLength(10)
  })

  it('does not contain deprecated inline_end', () => {
    const keys = SITE_AD_SLOTS.map((s) => s.key)
    expect(keys).not.toContain('inline_end')
  })

  it('contains all expected slot keys', () => {
    const keys = SITE_AD_SLOTS.map((s) => s.key)
    expect(keys).toEqual(
      expect.arrayContaining([
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
      ]),
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

  it('post:top:banner has correct IAB dimensions', () => {
    const slot = SITE_AD_SLOTS.find((s) => s.key === 'post:top:banner')
    expect(slot?.aspectRatio).toBe('8:1')
    expect(slot?.iabSize).toBe('728x90')
  })

  it('post:rail:anchor-left has correct IAB dimensions', () => {
    const slot = SITE_AD_SLOTS.find((s) => s.key === 'post:rail:anchor-left')
    expect(slot?.aspectRatio).toBe('1:4')
    expect(slot?.iabSize).toBe('160x600')
  })

  it('post:rail:anchor has correct IAB dimensions', () => {
    const slot = SITE_AD_SLOTS.find((s) => s.key === 'post:rail:anchor')
    expect(slot?.aspectRatio).toBe('6:5')
    expect(slot?.iabSize).toBe('300x250')
  })

  it('post:body:bookmark has correct IAB dimensions', () => {
    const slot = SITE_AD_SLOTS.find((s) => s.key === 'post:body:bookmark')
    expect(slot?.aspectRatio).toBe('6:5')
    expect(slot?.iabSize).toBe('300x250')
  })

  it('post:footer:coda has correct IAB dimensions', () => {
    const slot = SITE_AD_SLOTS.find((s) => s.key === 'post:footer:coda')
    expect(slot?.aspectRatio).toBe('4:1')
    expect(slot?.iabSize).toBe('970x250')
  })

  it('AdSlotDefinition type is exported from index', () => {
    const _typeCheck: AdSlotDefinition = SITE_AD_SLOTS[0] as AdSlotDefinition
    expect(_typeCheck).toBeDefined()
  })
})
