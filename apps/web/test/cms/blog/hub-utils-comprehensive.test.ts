import { describe, it, expect, vi } from 'vitest'
import {
  isValidTransition,
  getValidTargets,
  getKanbanMoveTargets,
  computeDisplayId,
  mapStatusToColumn,
  formatRelativeDate,
  sortPipelineLane,
  sortBlogLane,
  buildUnifiedLanes,
  isPipelineLane,
  isBlogLane,
  BLOG_TRANSITIONS,
} from '@/app/cms/(authed)/blog/_hub/hub-utils'
import type { PipelineCardItem, PostCard, LaneId } from '@/app/cms/(authed)/blog/_hub/hub-types'

/* ------------------------------------------------------------------ */
/*  Factory helpers                                                    */
/* ------------------------------------------------------------------ */

const makePipelineItem = (overrides: Partial<PipelineCardItem> = {}): PipelineCardItem => ({
  id: 'p1', code: 'blog-test', title_pt: 'Test', title_en: null,
  format: 'blog_post', stage: 'idea', language: 'pt', priority: 3,
  hook: null, body_content: null, tags: [], production_checklist: [],
  updated_at: '2026-01-01', created_at: '2026-01-01', blog_post_id: null,
  cover_image_url: null, validation_score: 50, dependencies: [],
  sort_order: 0, version: 1, is_archived: false,
  ...overrides,
})

const makePostCard = (overrides: Partial<PostCard> = {}): PostCard => ({
  id: 'b1', displayId: '#BP-001', title: 'Test Post',
  status: 'draft', tagId: null, tagName: null, tagColor: null,
  tagNameTranslations: null, locales: ['pt-BR'], readingTimeMin: null,
  createdAt: '2026-01-01', updatedAt: '2026-01-01', publishedAt: null,
  scheduledFor: null, slotDate: null, snippet: null, coverImageUrl: null,
  excerpt: null,
  ...overrides,
})

/* ------------------------------------------------------------------ */
/*  isValidTransition                                                  */
/* ------------------------------------------------------------------ */

describe('isValidTransition', () => {
  it('accepts valid transitions', () => {
    expect(isValidTransition('draft', 'ready')).toBe(true)
    expect(isValidTransition('ready', 'published')).toBe(true)
    expect(isValidTransition('published', 'archived')).toBe(true)
  })

  it('rejects invalid transitions', () => {
    expect(isValidTransition('idea', 'published')).toBe(false)
    expect(isValidTransition('published', 'idea')).toBe(false)
    expect(isValidTransition('draft', 'published')).toBe(false)
  })

  it('returns false for unknown statuses', () => {
    expect(isValidTransition('nonexistent', 'draft')).toBe(false)
    expect(isValidTransition('draft', 'nonexistent')).toBe(false)
  })
})

/* ------------------------------------------------------------------ */
/*  getValidTargets                                                    */
/* ------------------------------------------------------------------ */

describe('getValidTargets', () => {
  it('returns correct targets for known statuses', () => {
    expect(getValidTargets('idea')).toEqual(['draft', 'archived'])
    expect(getValidTargets('ready')).toContain('published')
    expect(getValidTargets('published')).toEqual(['archived'])
  })

  it('returns empty array for unknown status', () => {
    expect(getValidTargets('nonexistent')).toEqual([])
  })
})

/* ------------------------------------------------------------------ */
/*  getKanbanMoveTargets                                               */
/* ------------------------------------------------------------------ */

describe('getKanbanMoveTargets', () => {
  it('filters to kanban-visible columns only (ready, scheduled, published)', () => {
    // ready -> [draft, scheduled, queued, published, archived]
    // kanban-visible: scheduled, published
    const targets = getKanbanMoveTargets('ready')
    expect(targets).toContain('scheduled')
    expect(targets).toContain('published')
    expect(targets).not.toContain('draft')
    expect(targets).not.toContain('archived')
  })

  it('returns empty for statuses with no kanban targets', () => {
    // idea -> [draft, archived] — none are kanban columns
    expect(getKanbanMoveTargets('idea')).toEqual([])
  })

  it('returns empty for unknown status', () => {
    expect(getKanbanMoveTargets('nonexistent')).toEqual([])
  })
})

/* ------------------------------------------------------------------ */
/*  computeDisplayId                                                   */
/* ------------------------------------------------------------------ */

describe('computeDisplayId', () => {
  it('pads single-digit numbers to 3 digits', () => {
    expect(computeDisplayId(0)).toBe('#BP-000')
    expect(computeDisplayId(1)).toBe('#BP-001')
  })

  it('pads 3-digit numbers', () => {
    expect(computeDisplayId(999)).toBe('#BP-999')
  })

  it('does not pad 4+ digit numbers', () => {
    expect(computeDisplayId(1000)).toBe('#BP-1000')
    expect(computeDisplayId(1001)).toBe('#BP-1001')
  })
})

/* ------------------------------------------------------------------ */
/*  mapStatusToColumn                                                  */
/* ------------------------------------------------------------------ */

describe('mapStatusToColumn', () => {
  it('maps editing statuses to ready column', () => {
    expect(mapStatusToColumn('idea')).toBe('ready')
    expect(mapStatusToColumn('draft')).toBe('ready')
    expect(mapStatusToColumn('pending_review')).toBe('ready')
    expect(mapStatusToColumn('ready')).toBe('ready')
    expect(mapStatusToColumn('queued')).toBe('ready')
  })

  it('maps scheduled to scheduled', () => {
    expect(mapStatusToColumn('scheduled')).toBe('scheduled')
  })

  it('maps published and archived to published', () => {
    expect(mapStatusToColumn('published')).toBe('published')
    expect(mapStatusToColumn('archived')).toBe('published')
  })
})

/* ------------------------------------------------------------------ */
/*  formatRelativeDate                                                 */
/* ------------------------------------------------------------------ */

describe('formatRelativeDate', () => {
  it('returns "now" for less than 1 minute ago', () => {
    const recent = new Date(Date.now() - 30_000).toISOString()
    expect(formatRelativeDate(recent)).toBe('now')
  })

  it('returns minutes for < 60 min', () => {
    const thirtyMin = new Date(Date.now() - 30 * 60_000).toISOString()
    expect(formatRelativeDate(thirtyMin)).toBe('30m')
  })

  it('returns hours for < 24h', () => {
    const fiveHours = new Date(Date.now() - 5 * 3600_000).toISOString()
    expect(formatRelativeDate(fiveHours)).toBe('5h')
  })

  it('returns days for < 30d', () => {
    const tenDays = new Date(Date.now() - 10 * 86_400_000).toISOString()
    expect(formatRelativeDate(tenDays)).toBe('10d')
  })

  it('returns months for >= 30d', () => {
    const sixtyDays = new Date(Date.now() - 60 * 86_400_000).toISOString()
    expect(formatRelativeDate(sixtyDays)).toBe('2mo')
  })

  it('returns "now" for future dates', () => {
    const future = new Date(Date.now() + 86_400_000).toISOString()
    expect(formatRelativeDate(future)).toBe('now')
  })

  it('returns a string for invalid date input', () => {
    const result = formatRelativeDate('not-a-date')
    expect(typeof result).toBe('string')
  })
})

/* ------------------------------------------------------------------ */
/*  sortPipelineLane                                                   */
/* ------------------------------------------------------------------ */

describe('sortPipelineLane', () => {
  it('sorts by sort_order when both items have it set', () => {
    const items = [
      makePipelineItem({ id: 'a', sort_order: 200, priority: 1 }),
      makePipelineItem({ id: 'b', sort_order: 100, priority: 5 }),
    ]
    const sorted = sortPipelineLane(items, 'idea')
    expect(sorted.map(i => i.id)).toEqual(['b', 'a'])
  })

  it('items with sort_order set group separately from those without', () => {
    const items = [
      makePipelineItem({ id: 'c', sort_order: 0, priority: 1, created_at: '2026-01-03' }),
      makePipelineItem({ id: 'a', sort_order: 50, priority: 1, created_at: '2026-01-01' }),
      makePipelineItem({ id: 'b', sort_order: 200, priority: 5, created_at: '2026-01-02' }),
    ]
    const sorted = sortPipelineLane(items, 'draft')
    // Items with sort_order (a=50, b=200) should sort by sort_order between themselves
    const idxA = sorted.findIndex(i => i.id === 'a')
    const idxB = sorted.findIndex(i => i.id === 'b')
    expect(idxA).toBeLessThan(idxB)
  })

  it('falls back to priority DESC then created_at ASC when no sort_order', () => {
    const items = [
      makePipelineItem({ id: 'a', sort_order: 0, priority: 3, created_at: '2026-01-02' }),
      makePipelineItem({ id: 'b', sort_order: 0, priority: 3, created_at: '2026-01-01' }),
      makePipelineItem({ id: 'c', sort_order: 0, priority: 5, created_at: '2026-01-03' }),
    ]
    const sorted = sortPipelineLane(items, 'ready')
    expect(sorted.map(i => i.id)).toEqual(['c', 'b', 'a'])
  })
})

/* ------------------------------------------------------------------ */
/*  sortBlogLane                                                       */
/* ------------------------------------------------------------------ */

describe('sortBlogLane — extended', () => {
  it('editing lane: sorts by updatedAt DESC', () => {
    const posts = [
      makePostCard({ id: 'a', status: 'draft', updatedAt: '2026-01-01' }),
      makePostCard({ id: 'b', status: 'draft', updatedAt: '2026-01-03' }),
      makePostCard({ id: 'c', status: 'draft', updatedAt: '2026-01-02' }),
    ]
    const sorted = sortBlogLane(posts, 'editing')
    expect(sorted.map(p => p.id)).toEqual(['b', 'c', 'a'])
  })

  it('scheduled lane: sorts by scheduledFor ASC, falls back to createdAt', () => {
    const posts = [
      makePostCard({ id: 'a', scheduledFor: '2026-03-01', createdAt: '2026-01-01' }),
      makePostCard({ id: 'b', scheduledFor: null, createdAt: '2026-01-15' }),
      makePostCard({ id: 'c', scheduledFor: '2026-02-01', createdAt: '2026-01-01' }),
    ]
    const sorted = sortBlogLane(posts, 'scheduled')
    // b uses createdAt 01-15, c uses scheduledFor 02-01, a uses scheduledFor 03-01
    expect(sorted.map(p => p.id)).toEqual(['b', 'c', 'a'])
  })

  it('published lane: sorts by publishedAt DESC, falls back to createdAt', () => {
    const posts = [
      makePostCard({ id: 'a', status: 'published', publishedAt: '2026-01-01', createdAt: '2026-01-01' }),
      makePostCard({ id: 'b', status: 'published', publishedAt: null, createdAt: '2026-02-01' }),
      makePostCard({ id: 'c', status: 'published', publishedAt: '2026-03-01', createdAt: '2026-01-01' }),
    ]
    const sorted = sortBlogLane(posts, 'published')
    // c published 03-01, b falls back to createdAt 02-01, a published 01-01
    expect(sorted.map(p => p.id)).toEqual(['c', 'b', 'a'])
  })
})

/* ------------------------------------------------------------------ */
/*  buildUnifiedLanes                                                  */
/* ------------------------------------------------------------------ */

describe('buildUnifiedLanes — extended', () => {
  it('assigns all editing sub-statuses to editing lane', () => {
    const posts = [
      makePostCard({ id: 'b1', status: 'idea' }),
      makePostCard({ id: 'b2', status: 'draft' }),
      makePostCard({ id: 'b3', status: 'pending_review' }),
      makePostCard({ id: 'b4', status: 'ready' }),
      makePostCard({ id: 'b5', status: 'queued' }),
    ]
    const lanes = buildUnifiedLanes([], posts)
    expect(lanes.editing).toHaveLength(5)
    expect(lanes.editing.map(p => p.id).sort()).toEqual(['b1', 'b2', 'b3', 'b4', 'b5'])
  })

  it('excludes archived posts from all lanes', () => {
    const posts = [
      makePostCard({ id: 'b1', status: 'archived' }),
    ]
    const lanes = buildUnifiedLanes([], posts)
    expect(lanes.editing).toHaveLength(0)
    expect(lanes.scheduled).toHaveLength(0)
    expect(lanes.published).toHaveLength(0)
  })

  it('excludes archived pipeline items from visible lanes', () => {
    const items = [
      makePipelineItem({ id: 'p1', stage: 'archived' }),
    ]
    const lanes = buildUnifiedLanes(items, [])
    expect(lanes.idea).toHaveLength(0)
    expect(lanes.draft).toHaveLength(0)
    expect(lanes.ready).toHaveLength(0)
  })

  it('keeps pipeline and blog items in their respective lane groups', () => {
    const items = [makePipelineItem({ id: 'p1', stage: 'idea' })]
    const posts = [makePostCard({ id: 'b1', status: 'published' })]
    const lanes = buildUnifiedLanes(items, posts)
    expect(lanes.idea).toHaveLength(1)
    expect(lanes.published).toHaveLength(1)
    expect(lanes.editing).toHaveLength(0)
  })
})

/* ------------------------------------------------------------------ */
/*  isPipelineLane / isBlogLane                                        */
/* ------------------------------------------------------------------ */

describe('isPipelineLane', () => {
  it('returns true for pipeline lanes', () => {
    expect(isPipelineLane('idea')).toBe(true)
    expect(isPipelineLane('draft')).toBe(true)
    expect(isPipelineLane('ready')).toBe(true)
  })

  it('returns false for blog lanes', () => {
    expect(isPipelineLane('editing')).toBe(false)
    expect(isPipelineLane('scheduled')).toBe(false)
    expect(isPipelineLane('published')).toBe(false)
  })
})

describe('isBlogLane', () => {
  it('returns true for blog lanes', () => {
    expect(isBlogLane('editing')).toBe(true)
    expect(isBlogLane('scheduled')).toBe(true)
    expect(isBlogLane('published')).toBe(true)
  })

  it('returns false for pipeline lanes', () => {
    expect(isBlogLane('idea')).toBe(false)
    expect(isBlogLane('draft')).toBe(false)
    expect(isBlogLane('ready')).toBe(false)
  })
})
