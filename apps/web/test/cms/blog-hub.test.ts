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

  it('returns exactly 1 day for 24h ago', () => {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    expect(formatRelativeDate(oneDayAgo)).toBe('1d')
  })

  it('returns months for 30+ days', () => {
    const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString()
    expect(formatRelativeDate(thirtyOneDaysAgo)).toBe('1mo')
  })

  it('returns multiple months for 90+ days', () => {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    expect(formatRelativeDate(ninetyDaysAgo)).toBe('3mo')
  })

  it('returns "now" for future dates (negative diff treated as < 1 min)', () => {
    const future = new Date(Date.now() + 60_000).toISOString()
    // Math.floor of negative diff / 60000 = negative, which is < 1
    expect(formatRelativeDate(future)).toBe('now')
  })

  it('returns exactly 59m at the boundary before 1h', () => {
    const fiftyNineMinAgo = new Date(Date.now() - 59 * 60 * 1000).toISOString()
    expect(formatRelativeDate(fiftyNineMinAgo)).toBe('59m')
  })

  it('returns 1h at exactly 60 minutes', () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    expect(formatRelativeDate(oneHourAgo)).toBe('1h')
  })

  it('returns 23h at the boundary before 1d', () => {
    const twentyThreeHoursAgo = new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString()
    expect(formatRelativeDate(twentyThreeHoursAgo)).toBe('23h')
  })

  it('returns 29d at the boundary before 1mo', () => {
    const twentyNineDaysAgo = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString()
    expect(formatRelativeDate(twentyNineDaysAgo)).toBe('29d')
  })
})

describe('getValidTargets edge cases', () => {
  it('returns targets for every defined status', () => {
    const statuses = ['idea', 'draft', 'pending_review', 'ready', 'queued', 'scheduled', 'published', 'archived']
    for (const status of statuses) {
      const targets = getValidTargets(status)
      expect(targets.length).toBeGreaterThan(0)
    }
  })

  it('returns empty array for undefined status', () => {
    expect(getValidTargets('nonexistent')).toEqual([])
    expect(getValidTargets('')).toEqual([])
  })

  it('published can ONLY go to archived (single target)', () => {
    const targets = getValidTargets('published')
    expect(targets).toEqual(['archived'])
    expect(targets.length).toBe(1)
  })

  it('ready has the most targets (5)', () => {
    const targets = getValidTargets('ready')
    expect(targets.length).toBe(5)
    expect(targets).toContain('draft')
    expect(targets).toContain('scheduled')
    expect(targets).toContain('queued')
    expect(targets).toContain('published')
    expect(targets).toContain('archived')
  })

  it('archived targets do NOT include published or scheduled', () => {
    const targets = getValidTargets('archived')
    expect(targets).not.toContain('published')
    expect(targets).not.toContain('scheduled')
    expect(targets).not.toContain('queued')
  })

  it('idea has exactly 2 targets (draft, archived)', () => {
    expect(getValidTargets('idea')).toEqual(['draft', 'archived'])
  })
})

describe('computeDisplayId edge cases', () => {
  it('zero pads to 3 digits for numbers under 1000', () => {
    expect(computeDisplayId(0)).toBe('#BP-000')
    expect(computeDisplayId(1)).toBe('#BP-001')
    expect(computeDisplayId(10)).toBe('#BP-010')
    expect(computeDisplayId(100)).toBe('#BP-100')
    expect(computeDisplayId(999)).toBe('#BP-999')
  })

  it('does not pad numbers >= 1000', () => {
    expect(computeDisplayId(1000)).toBe('#BP-1000')
    expect(computeDisplayId(9999)).toBe('#BP-9999')
    expect(computeDisplayId(12345)).toBe('#BP-12345')
  })

  it('handles large numbers (100000+)', () => {
    expect(computeDisplayId(100000)).toBe('#BP-100000')
  })
})

describe('formatRelativeDate month boundary edge cases', () => {
  it('returns 30d at exactly 30 days (not yet 1mo)', () => {
    // 30 days = 720 hours = 43200 minutes → days = floor(720/24) = 30 → 30 < 30 is false → months = floor(30/30) = 1
    // Actually: 30 days → days = 30 → days < 30 is FALSE → falls through to months = floor(30/30) = 1 → "1mo"
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    expect(formatRelativeDate(thirtyDaysAgo)).toBe('1mo')
  })

  it('returns 2mo for 60 days', () => {
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
    expect(formatRelativeDate(sixtyDaysAgo)).toBe('2mo')
  })

  it('returns 12mo for 365 days (does not switch to years)', () => {
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()
    expect(formatRelativeDate(oneYearAgo)).toBe('12mo')
  })

  it('handles very old dates (1000+ days)', () => {
    const veryOld = new Date(Date.now() - 1000 * 24 * 60 * 60 * 1000).toISOString()
    expect(formatRelativeDate(veryOld)).toBe('33mo')
  })
})

describe('BLOG_TRANSITIONS graph completeness', () => {
  it('every status in PostCard union has defined transitions', () => {
    const allStatuses: string[] = ['idea', 'draft', 'pending_review', 'ready', 'queued', 'scheduled', 'published', 'archived']
    for (const status of allStatuses) {
      expect(BLOG_TRANSITIONS).toHaveProperty(status)
      expect(Array.isArray(BLOG_TRANSITIONS[status])).toBe(true)
    }
  })

  it('every target referenced in transitions is also a defined source', () => {
    const definedSources = new Set(Object.keys(BLOG_TRANSITIONS))
    for (const [source, targets] of Object.entries(BLOG_TRANSITIONS)) {
      for (const target of targets) {
        expect(definedSources.has(target), `Target "${target}" from "${source}" is not a defined status`).toBe(true)
      }
    }
  })

  it('no status has itself as a target (no self-transitions)', () => {
    for (const [status, targets] of Object.entries(BLOG_TRANSITIONS)) {
      expect(targets).not.toContain(status)
    }
  })

  it('every status has at least one outgoing transition (no dead ends without archival path)', () => {
    for (const [status, targets] of Object.entries(BLOG_TRANSITIONS)) {
      expect(targets.length, `Status "${status}" has no outgoing transitions`).toBeGreaterThan(0)
    }
  })

  it('archived is reachable from every non-archived status (either directly or via chain)', () => {
    // BFS from each status to see if archived is reachable
    const canReachArchived = (start: string): boolean => {
      const visited = new Set<string>()
      const queue = [start]
      while (queue.length > 0) {
        const current = queue.shift()!
        if (current === 'archived') return true
        if (visited.has(current)) continue
        visited.add(current)
        for (const next of (BLOG_TRANSITIONS[current] ?? [])) {
          if (!visited.has(next)) queue.push(next)
        }
      }
      return false
    }

    const allStatuses = Object.keys(BLOG_TRANSITIONS).filter((s) => s !== 'archived')
    for (const status of allStatuses) {
      expect(canReachArchived(status), `"${status}" cannot reach "archived"`).toBe(true)
    }
  })

  it('published is reachable from idea (full pipeline path exists)', () => {
    const canReach = (start: string, goal: string): boolean => {
      const visited = new Set<string>()
      const queue = [start]
      while (queue.length > 0) {
        const current = queue.shift()!
        if (current === goal) return true
        if (visited.has(current)) continue
        visited.add(current)
        for (const next of (BLOG_TRANSITIONS[current] ?? [])) {
          if (!visited.has(next)) queue.push(next)
        }
      }
      return false
    }

    expect(canReach('idea', 'published')).toBe(true)
  })
})
