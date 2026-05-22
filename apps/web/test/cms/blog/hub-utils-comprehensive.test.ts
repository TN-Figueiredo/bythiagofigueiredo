import { describe, it, expect } from 'vitest'
import {
  isValidTransition,
  getValidTargets,
  getPostMoveTargets,
  computeDisplayId,
  formatRelativeDate,
  sortPipelineLane,
  buildUnifiedLanes,
  isEditableLane,
  isReadOnlyLane,
  BLOG_TRANSITIONS,
} from '@/app/cms/(authed)/blog/_hub/hub-utils'
import type { PipelineCardItem, LaneId } from '@/app/cms/(authed)/blog/_hub/hub-types'

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
/*  getPostMoveTargets                                               */
/* ------------------------------------------------------------------ */

describe('getPostMoveTargets', () => {
  it('filters to kanban-visible columns only (ready, scheduled, published)', () => {
    // ready -> [draft, scheduled, queued, published, archived]
    // kanban-visible: scheduled, published
    const targets = getPostMoveTargets('ready')
    expect(targets).toContain('scheduled')
    expect(targets).toContain('published')
    expect(targets).not.toContain('draft')
    expect(targets).not.toContain('archived')
  })

  it('returns empty for statuses with no kanban targets', () => {
    // idea -> [draft, archived] — none are kanban columns
    expect(getPostMoveTargets('idea')).toEqual([])
  })

  it('returns empty for unknown status', () => {
    expect(getPostMoveTargets('nonexistent')).toEqual([])
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
/*  sortPipelineLane — scheduled/published                             */
/* ------------------------------------------------------------------ */

describe('sortPipelineLane — scheduled/published', () => {
  it('scheduled lane: uses standard pipeline sort (sort_order, priority, created_at)', () => {
    const items = [
      makePipelineItem({ id: 'a', stage: 'scheduled', sort_order: 0, priority: 3, created_at: '2026-03-01' }),
      makePipelineItem({ id: 'b', stage: 'scheduled', sort_order: 0, priority: 5, created_at: '2026-01-15' }),
      makePipelineItem({ id: 'c', stage: 'scheduled', sort_order: 0, priority: 3, created_at: '2026-01-01' }),
    ]
    const sorted = sortPipelineLane(items, 'scheduled')
    // b has highest priority, then c (earlier date), then a
    expect(sorted.map(i => i.id)).toEqual(['b', 'c', 'a'])
  })

  it('published lane: uses standard pipeline sort (sort_order, priority, created_at)', () => {
    const items = [
      makePipelineItem({ id: 'a', stage: 'published', sort_order: 0, priority: 3, created_at: '2026-01-01' }),
      makePipelineItem({ id: 'b', stage: 'published', sort_order: 0, priority: 3, created_at: '2026-02-01' }),
      makePipelineItem({ id: 'c', stage: 'published', sort_order: 0, priority: 5, created_at: '2026-03-01' }),
    ]
    const sorted = sortPipelineLane(items, 'published')
    // c highest priority, then a (earlier created_at), then b
    expect(sorted.map(i => i.id)).toEqual(['c', 'a', 'b'])
  })
})

/* ------------------------------------------------------------------ */
/*  buildUnifiedLanes                                                  */
/* ------------------------------------------------------------------ */

describe('buildUnifiedLanes — extended', () => {
  it('routes all pipeline stages to correct unified lanes', () => {
    const items = [
      makePipelineItem({ id: 'p1', stage: 'idea' }),
      makePipelineItem({ id: 'p2', stage: 'draft' }),
      makePipelineItem({ id: 'p3', stage: 'ready' }),
      makePipelineItem({ id: 'p4', stage: 'scheduled' }),
      makePipelineItem({ id: 'p5', stage: 'published' }),
    ]
    const lanes = buildUnifiedLanes(items)
    expect(lanes.idea).toHaveLength(1)
    expect(lanes.draft).toHaveLength(1)
    expect(lanes.ready).toHaveLength(1)
    expect(lanes.scheduled).toHaveLength(1)
    expect(lanes.published).toHaveLength(1)
  })

  it('excludes archived pipeline items from all lanes', () => {
    const items = [
      makePipelineItem({ id: 'p1', stage: 'archived' }),
    ]
    const lanes = buildUnifiedLanes(items)
    expect(lanes.idea).toHaveLength(0)
    expect(lanes.draft).toHaveLength(0)
    expect(lanes.ready).toHaveLength(0)
    expect(lanes.scheduled).toHaveLength(0)
    expect(lanes.published).toHaveLength(0)
  })

  it('does not duplicate items across lanes', () => {
    const items = [
      makePipelineItem({ id: 'p1', stage: 'ready', blog_post_id: 'bp-1' }),
      makePipelineItem({ id: 'p2', stage: 'scheduled', blog_post_id: 'bp-2' }),
      makePipelineItem({ id: 'p3', stage: 'published', blog_post_id: 'bp-3' }),
    ]
    const lanes = buildUnifiedLanes(items)
    expect(lanes.ready).toHaveLength(1)
    expect(lanes.scheduled).toHaveLength(1)
    expect(lanes.published).toHaveLength(1)
    // Each item appears in exactly one lane
    const allIds = [
      ...lanes.idea, ...lanes.draft, ...lanes.ready,
      ...lanes.scheduled, ...lanes.published,
    ].map(i => i.id)
    expect(new Set(allIds).size).toBe(allIds.length)
  })

  it('keeps pipeline items in their stage lanes', () => {
    const items = [
      makePipelineItem({ id: 'p1', stage: 'idea' }),
      makePipelineItem({ id: 'p2', stage: 'scheduled', blog_post_id: 'bp-1' }),
    ]
    const lanes = buildUnifiedLanes(items)
    expect(lanes.idea).toHaveLength(1)
    expect(lanes.scheduled).toHaveLength(1)
  })
})

/* ------------------------------------------------------------------ */
/*  isEditableLane / isReadOnlyLane                                    */
/* ------------------------------------------------------------------ */

describe('isEditableLane', () => {
  it('returns true for editable lanes (idea, draft, ready)', () => {
    expect(isEditableLane('idea')).toBe(true)
    expect(isEditableLane('draft')).toBe(true)
    expect(isEditableLane('ready')).toBe(true)
  })

  it('returns false for read-only lanes (scheduled, published)', () => {
    expect(isEditableLane('scheduled')).toBe(false)
    expect(isEditableLane('published')).toBe(false)
  })
})

describe('isReadOnlyLane', () => {
  it('returns true for read-only lanes (scheduled, published)', () => {
    expect(isReadOnlyLane('scheduled')).toBe(true)
    expect(isReadOnlyLane('published')).toBe(true)
  })

  it('returns false for editable lanes (idea, draft, ready)', () => {
    expect(isReadOnlyLane('idea')).toBe(false)
    expect(isReadOnlyLane('draft')).toBe(false)
    expect(isReadOnlyLane('ready')).toBe(false)
  })
})
