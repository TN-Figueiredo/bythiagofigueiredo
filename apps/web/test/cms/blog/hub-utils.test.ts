import { describe, it, expect } from 'vitest'
import {
  LANE_DEFS,
  SUBSTATUS_BADGES,
  buildUnifiedLanes,
  sortPipelineLane,
} from '@/app/cms/(authed)/blog/_hub/hub-utils'
import type { PipelineCardItem } from '@/app/cms/(authed)/blog/_hub/hub-types'

describe('LANE_DEFS', () => {
  it('has 5 lanes in workflow order', () => {
    expect(LANE_DEFS.map((l) => l.id)).toEqual([
      'idea', 'draft', 'ready', 'scheduled', 'published',
    ])
  })

  it('all lanes are pipeline data source', () => {
    expect(LANE_DEFS.every((l) => l.dataSource === 'pipeline')).toBe(true)
  })
})

describe('SUBSTATUS_BADGES', () => {
  it('maps all editing lane statuses', () => {
    expect(SUBSTATUS_BADGES.idea).toBeDefined()
    expect(SUBSTATUS_BADGES.draft).toBeDefined()
    expect(SUBSTATUS_BADGES.pending_review).toBeDefined()
    expect(SUBSTATUS_BADGES.ready).toBeDefined()
    expect(SUBSTATUS_BADGES.queued).toBeDefined()
  })

  it('each badge has color and label', () => {
    for (const badge of Object.values(SUBSTATUS_BADGES)) {
      expect(badge).toHaveProperty('color')
      expect(badge).toHaveProperty('labelKey')
    }
  })
})

describe('buildUnifiedLanes', () => {
  const makePipelineItem = (overrides: Partial<PipelineCardItem>): PipelineCardItem => ({
    id: 'p1', code: 'blog-test', title_pt: 'Test', title_en: null,
    format: 'blog_post', stage: 'idea', language: 'pt', priority: 3,
    hook: null, body_content: null, tags: [], production_checklist: [],
    updated_at: '2026-01-01', created_at: '2026-01-01', blog_post_id: null,
    cover_image_url: null, validation_score: 50, dependencies: [],
    sort_order: 1000, version: 1, is_archived: false,
    ...overrides,
  })

  it('routes pipeline items to correct lanes', () => {
    const items = [
      makePipelineItem({ id: 'p1', stage: 'idea' }),
      makePipelineItem({ id: 'p2', stage: 'draft' }),
      makePipelineItem({ id: 'p3', stage: 'ready' }),
    ]
    const lanes = buildUnifiedLanes(items)
    expect(lanes.idea).toHaveLength(1)
    expect(lanes.draft).toHaveLength(1)
    expect(lanes.ready).toHaveLength(1)
  })

  it('routes scheduled and published stages to their lanes', () => {
    const items = [
      makePipelineItem({ id: 'p1', stage: 'scheduled', blog_post_id: 'bp-1' }),
      makePipelineItem({ id: 'p2', stage: 'published', blog_post_id: 'bp-2' }),
    ]
    const lanes = buildUnifiedLanes(items)
    expect(lanes.scheduled).toHaveLength(1)
    expect(lanes.published).toHaveLength(1)
  })
})

describe('sortPipelineLane', () => {
  const makeItem = (id: string, priority: number, created_at: string, sort_order = 0) => ({
    id, code: '', title_pt: null, title_en: null, format: 'blog_post',
    stage: 'idea', language: 'pt', priority, hook: null, body_content: null,
    tags: [], production_checklist: [], updated_at: created_at, created_at,
    blog_post_id: null, cover_image_url: null, validation_score: 50,
    dependencies: [], sort_order, version: 1, is_archived: false,
  })

  it('sorts by sort_order when set, then priority DESC, created_at ASC', () => {
    const items = [
      makeItem('a', 1, '2026-01-03'),
      makeItem('b', 5, '2026-01-01'),
      makeItem('c', 3, '2026-01-02'),
    ]
    const sorted = sortPipelineLane(items, 'idea')
    expect(sorted[0]!.id).toBe('b') // highest priority
    expect(sorted[2]!.id).toBe('a') // lowest priority
  })
})

describe('sortPipelineLane — scheduled/published', () => {
  const makeItem = (id: string, priority: number, created_at: string, sort_order = 0) => ({
    id, code: '', title_pt: null, title_en: null, format: 'blog_post',
    stage: 'scheduled' as const, language: 'pt', priority, hook: null, body_content: null,
    tags: [], production_checklist: [], updated_at: created_at, created_at,
    blog_post_id: null, cover_image_url: null, validation_score: 50,
    dependencies: [], sort_order, version: 1, is_archived: false,
  })

  it('sorts scheduled items by priority then created_at', () => {
    const items = [
      makeItem('a', 3, '2026-02-01'),
      makeItem('b', 5, '2026-01-15'),
    ]
    const sorted = sortPipelineLane(items, 'scheduled')
    expect(sorted[0]!.id).toBe('b') // higher priority
  })

  it('sorts published items by priority then created_at', () => {
    const items = [
      makeItem('a', 3, '2026-01-01'),
      makeItem('b', 3, '2026-01-15'),
    ].map(i => ({ ...i, stage: 'published' as const }))
    const sorted = sortPipelineLane(items, 'published')
    expect(sorted[0]!.id).toBe('a') // earlier created_at
  })
})
