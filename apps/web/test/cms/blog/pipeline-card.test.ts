import { describe, it, expect } from 'vitest'
import { SUBSTATUS_BADGES, LANE_DEFS, isEditableLane, isReadOnlyLane } from '@/app/cms/(authed)/blog/_hub/hub-utils'
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

  it('isEditableLane returns true for editable lanes', () => {
    expect(isEditableLane('idea')).toBe(true)
    expect(isEditableLane('draft')).toBe(true)
    expect(isEditableLane('ready')).toBe(true)
  })

  it('isEditableLane returns false for read-only lanes', () => {
    expect(isEditableLane('scheduled' as LaneId)).toBe(false)
    expect(isEditableLane('published' as LaneId)).toBe(false)
  })

  it('isReadOnlyLane returns true for read-only lanes', () => {
    expect(isReadOnlyLane('scheduled')).toBe(true)
    expect(isReadOnlyLane('published')).toBe(true)
  })
})
