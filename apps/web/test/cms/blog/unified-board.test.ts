import { describe, it, expect } from 'vitest'
import {
  isEditableLane,
  isReadOnlyLane,
  resolveLaneFromOver,
  computeNewSortOrder,
} from '@/app/cms/(authed)/blog/_hub/hub-utils'
import type { LaneId, UnifiedLanes } from '@/app/cms/(authed)/blog/_hub/hub-types'

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

function makeLanes(partial: Partial<Record<LaneId, string[]>>): UnifiedLanes {
  const lane = (ids: string[] = []) =>
    ids.map((id) => ({ id }) as UnifiedLanes['idea'][number])
  return {
    idea: lane(partial.idea),
    draft: lane(partial.draft),
    ready: lane(partial.ready),
    scheduled: lane(partial.scheduled),
    published: lane(partial.published),
  }
}

describe('resolveLaneFromOver', () => {
  const lanes = makeLanes({ idea: ['a', 'b'], draft: ['c'] })

  it('resolves a lane id directly to that lane', () => {
    expect(resolveLaneFromOver('draft', lanes)).toBe('draft')
    expect(resolveLaneFromOver('idea', lanes)).toBe('idea')
  })

  it('resolves an item id to the lane that contains it', () => {
    expect(resolveLaneFromOver('a', lanes)).toBe('idea')
    expect(resolveLaneFromOver('c', lanes)).toBe('draft')
  })

  it('returns null for an unknown id', () => {
    expect(resolveLaneFromOver('zzz', lanes)).toBeNull()
  })
})

describe('computeNewSortOrder', () => {
  const items = (orders: number[]) =>
    orders.map((o, idx) => ({ id: `i${idx}`, sort_order: o }))

  it('returns 1000 for an empty target lane', () => {
    expect(computeNewSortOrder([], 'x', 'lane-idea')).toBe(1000)
  })

  it('appends after the last item when dropped on the lane container (over is not an item)', () => {
    expect(computeNewSortOrder(items([1000, 2000, 3000]), 'new', 'lane-draft')).toBe(4000)
  })

  it('appends after last when a cross-lane item is dropped and not yet in the list', () => {
    // active 'new' not present, over 'i2' (last) -> still lands after last
    expect(computeNewSortOrder(items([1000, 2000, 3000]), 'new', 'i2')).toBe(3000)
  })

  it('places between neighbors when moved into the middle', () => {
    // move i0 over i1 -> [i1, i0, i2]; neighbors 2000 & 3000 -> 2500
    expect(computeNewSortOrder(items([1000, 2000, 3000]), 'i0', 'i1')).toBe(2500)
  })

  it('places below the top when moved to the first slot', () => {
    // move i2 over i0 -> [i2, i0, i1]; no prev, next=1000 -> 0
    expect(computeNewSortOrder(items([1000, 2000, 3000]), 'i2', 'i0')).toBe(0)
  })

  it('places after the last when moved to the bottom slot', () => {
    // move i0 over i2 -> [i1, i2, i0]; no next, prev=3000 -> 4000
    expect(computeNewSortOrder(items([1000, 2000, 3000]), 'i0', 'i2')).toBe(4000)
  })
})
