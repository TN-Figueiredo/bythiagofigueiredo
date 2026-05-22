import { describe, it, expect } from 'vitest'
import { isEditableLane, isReadOnlyLane } from '@/app/cms/(authed)/blog/_hub/hub-utils'
import type { LaneId } from '@/app/cms/(authed)/blog/_hub/hub-types'

describe('card delegation rules', () => {
  it('pipeline lanes render PipelineCard', () => {
    const pipelineLanes: LaneId[] = ['idea', 'draft', 'ready']
    for (const lane of pipelineLanes) {
      expect(isEditableLane(lane)).toBe(true)
      expect(isReadOnlyLane(lane)).toBe(false)
    }
  })

  it('blog lanes render PostCard', () => {
    const blogLanes: LaneId[] = ['scheduled', 'published']
    for (const lane of blogLanes) {
      expect(isReadOnlyLane(lane)).toBe(true)
      expect(isEditableLane(lane)).toBe(false)
    }
  })
})

describe('DnD rules', () => {
  it('pipeline-to-pipeline drag is allowed', () => {
    const from: LaneId = 'idea'
    const to: LaneId = 'draft'
    expect(isEditableLane(from) && isEditableLane(to)).toBe(true)
  })

  it('pipeline-to-blog drag is blocked', () => {
    const from: LaneId = 'ready'
    const to: LaneId = 'scheduled'
    expect(isEditableLane(from) && isReadOnlyLane(to)).toBe(true)
  })

  it('blog-to-pipeline drag is blocked', () => {
    const from: LaneId = 'scheduled'
    const to: LaneId = 'idea'
    expect(isReadOnlyLane(from) && isEditableLane(to)).toBe(true)
  })
})
