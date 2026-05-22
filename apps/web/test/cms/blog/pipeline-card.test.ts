import { describe, it, expect } from 'vitest'
import { SUBSTATUS_BADGES, LANE_DEFS, isPipelineLane, isBlogLane } from '@/app/cms/(authed)/blog/_hub/hub-utils'
import type { LaneId } from '@/app/cms/(authed)/blog/_hub/hub-types'

describe('substatus badge mapping', () => {
  it('maps idea to gray', () => {
    expect(SUBSTATUS_BADGES.idea.color).toContain('gray')
  })

  it('maps draft to blue', () => {
    expect(SUBSTATUS_BADGES.draft.color).toContain('blue')
  })

  it('maps pending_review to amber', () => {
    expect(SUBSTATUS_BADGES.pending_review.color).toContain('amber')
  })

  it('maps ready to cyan', () => {
    expect(SUBSTATUS_BADGES.ready.color).toContain('cyan')
  })

  it('maps queued to purple', () => {
    expect(SUBSTATUS_BADGES.queued.color).toContain('purple')
  })
})

describe('lane type guards', () => {
  it('LANE_DEFS has exactly 5 lanes', () => {
    expect(LANE_DEFS).toHaveLength(5)
  })

  it('isPipelineLane returns true for pipeline lanes', () => {
    expect(isPipelineLane('idea')).toBe(true)
    expect(isPipelineLane('draft')).toBe(true)
    expect(isPipelineLane('ready')).toBe(true)
  })

  it('isPipelineLane returns false for blog lanes', () => {
    expect(isPipelineLane('scheduled' as LaneId)).toBe(false)
    expect(isPipelineLane('published' as LaneId)).toBe(false)
  })

  it('isBlogLane returns true for blog lanes', () => {
    expect(isBlogLane('scheduled')).toBe(true)
    expect(isBlogLane('published')).toBe(true)
  })
})
