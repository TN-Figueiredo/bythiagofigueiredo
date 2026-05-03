import { describe, it, expect } from 'vitest'
import {
  filterByLocale,
  computeSuggestionScore,
  rankSuggestions,
  type SuggestionCandidate,
} from '@/lib/newsletter/suggestions'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeCandidate(overrides: Partial<SuggestionCandidate> = {}): SuggestionCandidate {
  return {
    id: 'type-1',
    slug: 'test-newsletter',
    name: 'Test Newsletter',
    tagline: 'A test tagline',
    cadence_label: 'Weekly',
    cadence_days: 7,
    cadence_start_date: null,
    color: '#C14513',
    color_dark: null,
    locale: 'en',
    created_at: '2025-01-01T00:00:00Z',
    subscriber_count: 100,
    last_sent_at: null,
    ...overrides,
  }
}

const NOW = new Date('2026-05-03T12:00:00Z').getTime()

// ── filterByLocale ───────────────────────────────────────────────────────────

describe('filterByLocale', () => {
  const enType = makeCandidate({ id: 'en-1', locale: 'en' })
  const ptType = makeCandidate({ id: 'pt-1', locale: 'pt-BR' })
  const all = [enType, ptType]

  it('EN visitor sees only EN newsletters', () => {
    const result = filterByLocale(all, 'en')
    expect(result).toHaveLength(1)
    expect(result[0]!.id).toBe('en-1')
  })

  it('PT-BR visitor sees both PT-BR and EN newsletters', () => {
    const result = filterByLocale(all, 'pt-BR')
    expect(result).toHaveLength(2)
    expect(result.map((r) => r.id).sort()).toEqual(['en-1', 'pt-1'])
  })

  it('unknown locale sees nothing', () => {
    const result = filterByLocale(all, 'fr')
    expect(result).toHaveLength(0)
  })

  it('empty input returns empty', () => {
    expect(filterByLocale([], 'en')).toHaveLength(0)
  })
})

// ── computeSuggestionScore ───────────────────────────────────────────────────

describe('computeSuggestionScore', () => {
  it('returns 0 for candidate with 0 subs, no editions, old creation', () => {
    const candidate = makeCandidate({
      subscriber_count: 0,
      last_sent_at: null,
      created_at: '2024-01-01T00:00:00Z',
    })
    expect(computeSuggestionScore(candidate, 100, NOW)).toBe(0)
  })

  it('gives full subscriber weight when candidate is the max', () => {
    const candidate = makeCandidate({
      subscriber_count: 100,
      last_sent_at: null,
      created_at: '2024-01-01T00:00:00Z',
    })
    // normalizedSubs = 100/100 = 1, recency = 0, newness = 0
    // score = 1 * 0.6 + 0 + 0 = 0.6
    expect(computeSuggestionScore(candidate, 100, NOW)).toBeCloseTo(0.6)
  })

  it('gives full recency bonus for edition sent within 14 days', () => {
    const candidate = makeCandidate({
      subscriber_count: 0,
      last_sent_at: new Date(NOW - 5 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: '2024-01-01T00:00:00Z',
    })
    // normalizedSubs = 0, recency = 1.0, newness = 0
    // score = 0 + 1.0 * 0.3 + 0 = 0.3
    expect(computeSuggestionScore(candidate, 100, NOW)).toBeCloseTo(0.3)
  })

  it('gives 0.7 recency bonus for edition sent 15-30 days ago', () => {
    const candidate = makeCandidate({
      subscriber_count: 0,
      last_sent_at: new Date(NOW - 20 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: '2024-01-01T00:00:00Z',
    })
    // score = 0 + 0.7 * 0.3 + 0 = 0.21
    expect(computeSuggestionScore(candidate, 100, NOW)).toBeCloseTo(0.21)
  })

  it('gives 0.3 recency bonus for edition sent 31-90 days ago', () => {
    const candidate = makeCandidate({
      subscriber_count: 0,
      last_sent_at: new Date(NOW - 60 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: '2024-01-01T00:00:00Z',
    })
    // score = 0 + 0.3 * 0.3 + 0 = 0.09
    expect(computeSuggestionScore(candidate, 100, NOW)).toBeCloseTo(0.09)
  })

  it('gives 0 recency for edition sent > 90 days ago', () => {
    const candidate = makeCandidate({
      subscriber_count: 0,
      last_sent_at: new Date(NOW - 100 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: '2024-01-01T00:00:00Z',
    })
    expect(computeSuggestionScore(candidate, 100, NOW)).toBe(0)
  })

  it('gives full newness bonus for type created within 30 days', () => {
    const candidate = makeCandidate({
      subscriber_count: 0,
      last_sent_at: null,
      created_at: new Date(NOW - 10 * 24 * 60 * 60 * 1000).toISOString(),
    })
    // score = 0 + 0 + 1.0 * 0.1 = 0.1
    expect(computeSuggestionScore(candidate, 100, NOW)).toBeCloseTo(0.1)
  })

  it('gives 0.5 newness bonus for type created 31-60 days ago', () => {
    const candidate = makeCandidate({
      subscriber_count: 0,
      last_sent_at: null,
      created_at: new Date(NOW - 45 * 24 * 60 * 60 * 1000).toISOString(),
    })
    // score = 0 + 0 + 0.5 * 0.1 = 0.05
    expect(computeSuggestionScore(candidate, 100, NOW)).toBeCloseTo(0.05)
  })

  it('combines all three factors', () => {
    const candidate = makeCandidate({
      subscriber_count: 50,
      last_sent_at: new Date(NOW - 5 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(NOW - 10 * 24 * 60 * 60 * 1000).toISOString(),
    })
    // normalizedSubs = 50/100 = 0.5, recency = 1.0, newness = 1.0
    // score = 0.5*0.6 + 1.0*0.3 + 1.0*0.1 = 0.3 + 0.3 + 0.1 = 0.7
    expect(computeSuggestionScore(candidate, 100, NOW)).toBeCloseTo(0.7)
  })

  it('handles maxSubscriberCount of 0 gracefully', () => {
    const candidate = makeCandidate({ subscriber_count: 0 })
    expect(computeSuggestionScore(candidate, 0, NOW)).toBeGreaterThanOrEqual(0)
  })
})

// ── rankSuggestions ──────────────────────────────────────────────────────────

describe('rankSuggestions', () => {
  it('returns empty array for empty candidates', () => {
    expect(rankSuggestions([], 3, NOW)).toEqual([])
  })

  it('sorts by score descending', () => {
    const high = makeCandidate({
      id: 'high',
      subscriber_count: 100,
      last_sent_at: new Date(NOW - 5 * 24 * 60 * 60 * 1000).toISOString(),
    })
    const low = makeCandidate({
      id: 'low',
      subscriber_count: 10,
      last_sent_at: null,
      created_at: '2024-01-01T00:00:00Z',
    })
    const result = rankSuggestions([low, high], 3, NOW)
    expect(result[0]!.id).toBe('high')
    expect(result[1]!.id).toBe('low')
  })

  it('respects limit', () => {
    const candidates = Array.from({ length: 5 }, (_, i) =>
      makeCandidate({ id: `type-${i}`, subscriber_count: i * 10 }),
    )
    expect(rankSuggestions(candidates, 2, NOW)).toHaveLength(2)
  })

  it('returns all when fewer than limit', () => {
    const candidates = [makeCandidate({ id: 'only' })]
    expect(rankSuggestions(candidates, 3, NOW)).toHaveLength(1)
  })

  it('includes score property on returned items', () => {
    const result = rankSuggestions([makeCandidate()], 3, NOW)
    expect(result[0]).toHaveProperty('score')
    expect(typeof result[0]!.score).toBe('number')
  })

  it('handles candidate with 0 subscribers and 0 editions (still shown)', () => {
    const lonely = makeCandidate({
      subscriber_count: 0,
      last_sent_at: null,
      created_at: '2024-01-01T00:00:00Z',
    })
    const result = rankSuggestions([lonely], 3, NOW)
    expect(result).toHaveLength(1)
    expect(result[0]!.score).toBe(0)
  })
})
