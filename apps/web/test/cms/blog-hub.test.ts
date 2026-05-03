import { describe, it, expect } from 'vitest'
import { isValidTransition, getValidTargets, computeDisplayId, mapStatusToColumn, formatRelativeDate, BLOG_TRANSITIONS } from '../../src/app/cms/(authed)/blog/_hub/hub-utils'
import type { PostCard } from '../../src/app/cms/(authed)/blog/_hub/hub-types'

describe('blog-hub utils', () => {
  describe('BLOG_TRANSITIONS', () => {
    it('allows idea → draft', () => {
      expect(isValidTransition('idea', 'draft')).toBe(true)
    })

    it('allows idea → archived', () => {
      expect(isValidTransition('idea', 'archived')).toBe(true)
    })

    it('blocks idea → published', () => {
      expect(isValidTransition('idea', 'published')).toBe(false)
    })

    it('allows draft → ready', () => {
      expect(isValidTransition('draft', 'ready')).toBe(true)
    })

    it('allows draft → idea (revert)', () => {
      expect(isValidTransition('draft', 'idea')).toBe(true)
    })

    it('blocks draft → published (skip ready)', () => {
      expect(isValidTransition('draft', 'published')).toBe(false)
    })

    it('allows ready → published', () => {
      expect(isValidTransition('ready', 'published')).toBe(true)
    })

    it('allows published → archived only', () => {
      expect(isValidTransition('published', 'archived')).toBe(true)
      expect(isValidTransition('published', 'draft')).toBe(false)
    })

    it('allows archived → idea or draft', () => {
      expect(isValidTransition('archived', 'idea')).toBe(true)
      expect(isValidTransition('archived', 'draft')).toBe(true)
      expect(isValidTransition('archived', 'published')).toBe(false)
    })

    it('returns valid targets for ready', () => {
      expect(getValidTargets('ready')).toEqual(['draft', 'scheduled', 'queued', 'published', 'archived'])
    })

    it('returns empty for unknown status', () => {
      expect(getValidTargets('unknown')).toEqual([])
    })
  })

  describe('computeDisplayId', () => {
    it('formats with BP prefix and zero-padded number', () => {
      expect(computeDisplayId(1)).toBe('#BP-001')
      expect(computeDisplayId(42)).toBe('#BP-042')
      expect(computeDisplayId(999)).toBe('#BP-999')
      expect(computeDisplayId(1000)).toBe('#BP-1000')
    })
  })

  describe('mapStatusToColumn', () => {
    it('maps idea to idea column', () => {
      expect(mapStatusToColumn('idea')).toBe('idea')
    })

    it('maps draft and pending_review to draft column', () => {
      expect(mapStatusToColumn('draft')).toBe('draft')
      expect(mapStatusToColumn('pending_review')).toBe('draft')
    })

    it('maps ready and queued to ready column', () => {
      expect(mapStatusToColumn('ready')).toBe('ready')
      expect(mapStatusToColumn('queued')).toBe('ready')
    })

    it('maps scheduled to scheduled column', () => {
      expect(mapStatusToColumn('scheduled')).toBe('scheduled')
    })

    it('maps published to published column', () => {
      expect(mapStatusToColumn('published')).toBe('published')
    })

    it('maps archived to archived', () => {
      expect(mapStatusToColumn('archived')).toBe('archived')
    })
  })
})

describe('blog-hub action status matrix', () => {
  const validMoves: Array<[string, string]> = [
    ['idea', 'draft'],
    ['idea', 'archived'],
    ['draft', 'idea'],
    ['draft', 'ready'],
    ['draft', 'pending_review'],
    ['draft', 'archived'],
    ['pending_review', 'draft'],
    ['pending_review', 'ready'],
    ['pending_review', 'archived'],
    ['ready', 'draft'],
    ['ready', 'scheduled'],
    ['ready', 'queued'],
    ['ready', 'published'],
    ['ready', 'archived'],
    ['queued', 'ready'],
    ['queued', 'scheduled'],
    ['queued', 'archived'],
    ['scheduled', 'ready'],
    ['scheduled', 'draft'],
    ['scheduled', 'archived'],
    ['published', 'archived'],
    ['archived', 'idea'],
    ['archived', 'draft'],
  ]

  const invalidMoves: Array<[string, string]> = [
    ['idea', 'published'],
    ['idea', 'scheduled'],
    ['draft', 'published'],
    ['draft', 'scheduled'],
    ['published', 'draft'],
    ['published', 'idea'],
    ['archived', 'published'],
    ['archived', 'scheduled'],
  ]

  it.each(validMoves)('%s → %s should be valid', (from, to) => {
    expect(isValidTransition(from, to)).toBe(true)
  })

  it.each(invalidMoves)('%s → %s should be invalid', (from, to) => {
    expect(isValidTransition(from, to)).toBe(false)
  })
})

describe('mapStatusToColumn exhaustive', () => {
  it('maps all 8 statuses correctly', () => {
    const expected: Record<string, string> = {
      idea: 'idea',
      draft: 'draft',
      pending_review: 'draft',
      ready: 'ready',
      queued: 'ready',
      scheduled: 'scheduled',
      published: 'published',
      archived: 'archived',
    }
    for (const [status, column] of Object.entries(expected)) {
      expect(mapStatusToColumn(status as any)).toBe(column)
    }
  })
})

describe('formatRelativeDate', () => {
  it('returns "now" for dates within last minute', () => {
    expect(formatRelativeDate(new Date().toISOString())).toBe('now')
  })

  it('returns minutes for recent dates', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    expect(formatRelativeDate(fiveMinAgo)).toBe('5m')
  })

  it('returns hours for dates within a day', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
    expect(formatRelativeDate(threeHoursAgo)).toBe('3h')
  })

  it('returns days for dates within a month', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    expect(formatRelativeDate(twoDaysAgo)).toBe('2d')
  })
})
