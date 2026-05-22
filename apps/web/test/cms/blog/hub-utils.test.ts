import { describe, it, expect } from 'vitest'
import {
  LANE_DEFS,
  SUBSTATUS_BADGES,
  buildUnifiedLanes,
  sortPipelineLane,
  sortBlogLane,
} from '@/app/cms/(authed)/blog/_hub/hub-utils'
import type { PipelineCardItem, PostCard } from '@/app/cms/(authed)/blog/_hub/hub-types'

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

  const makePostCard = (overrides: Partial<PostCard>): PostCard => ({
    id: 'b1', displayId: '#BP-001', title: 'Test Post',
    status: 'idea', tagId: null, tagName: null, tagColor: null,
    tagNameTranslations: null, locales: ['pt-BR'], readingTimeMin: null,
    createdAt: '2026-01-01', updatedAt: '2026-01-01', publishedAt: null,
    scheduledFor: null, slotDate: null, snippet: null, coverImageUrl: null,
    excerpt: null,
    ...overrides,
  })

  it('routes pipeline items to correct lanes', () => {
    const items = [
      makePipelineItem({ id: 'p1', stage: 'idea' }),
      makePipelineItem({ id: 'p2', stage: 'draft' }),
      makePipelineItem({ id: 'p3', stage: 'ready' }),
    ]
    const lanes = buildUnifiedLanes(items, [])
    expect(lanes.idea).toHaveLength(1)
    expect(lanes.draft).toHaveLength(1)
    expect(lanes.ready).toHaveLength(1)
  })

  it('routes pipeline items with blog_post_id to scheduled/published lanes', () => {
    const items = [
      makePipelineItem({ id: 'p1', stage: 'ready', blog_post_id: 'bp-1' }),
      makePipelineItem({ id: 'p2', stage: 'idea', blog_post_id: 'bp-2' }),
    ]
    const lanes = buildUnifiedLanes(items, [])
    expect(lanes.scheduled).toHaveLength(1)
    expect(lanes.published).toHaveLength(2)
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

describe('sortBlogLane', () => {
  const makePost = (id: string, fields: Partial<PostCard>) => ({
    id, displayId: '#BP-001', title: 'Test', status: 'scheduled' as const,
    tagId: null, tagName: null, tagColor: null, tagNameTranslations: null,
    locales: ['pt-BR'], readingTimeMin: null, createdAt: '2026-01-01',
    updatedAt: '2026-01-01', publishedAt: null, scheduledFor: null,
    slotDate: null, snippet: null, coverImageUrl: null, excerpt: null,
    ...fields,
  })

  it('sorts scheduled lane by scheduledFor ASC', () => {
    const posts = [
      makePost('a', { scheduledFor: '2026-02-01' }),
      makePost('b', { scheduledFor: '2026-01-15' }),
    ]
    const sorted = sortBlogLane(posts, 'scheduled')
    expect(sorted[0]!.id).toBe('b')
  })

  it('sorts published lane by publishedAt DESC', () => {
    const posts = [
      makePost('a', { status: 'published', publishedAt: '2026-01-01' }),
      makePost('b', { status: 'published', publishedAt: '2026-01-15' }),
    ]
    const sorted = sortBlogLane(posts, 'published')
    expect(sorted[0]!.id).toBe('b')
  })
})
