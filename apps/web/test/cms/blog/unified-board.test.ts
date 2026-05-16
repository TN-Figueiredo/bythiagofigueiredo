import { describe, it, expect } from 'vitest'
import { isPipelineLane, isBlogLane } from '@/app/cms/(authed)/blog/_hub/hub-utils'
import type { LaneId } from '@/app/cms/(authed)/blog/_hub/hub-types'

describe('card delegation rules', () => {
  it('pipeline lanes render PipelineCard', () => {
    const pipelineLanes: LaneId[] = ['idea', 'draft', 'ready']
    for (const lane of pipelineLanes) {
      expect(isPipelineLane(lane)).toBe(true)
      expect(isBlogLane(lane)).toBe(false)
    }
  })

  it('blog lanes render PostCard', () => {
    const blogLanes: LaneId[] = ['editing', 'scheduled', 'published']
    for (const lane of blogLanes) {
      expect(isBlogLane(lane)).toBe(true)
      expect(isPipelineLane(lane)).toBe(false)
    }
  })
})

describe('DnD rules', () => {
  it('pipeline-to-pipeline drag is allowed', () => {
    const from: LaneId = 'idea'
    const to: LaneId = 'draft'
    expect(isPipelineLane(from) && isPipelineLane(to)).toBe(true)
  })

  it('pipeline-to-blog drag is blocked', () => {
    const from: LaneId = 'ready'
    const to: LaneId = 'editing'
    expect(isPipelineLane(from) && isBlogLane(to)).toBe(true)
  })

  it('blog-to-pipeline drag is blocked', () => {
    const from: LaneId = 'editing'
    const to: LaneId = 'idea'
    expect(isBlogLane(from) && isPipelineLane(to)).toBe(true)
  })
})
