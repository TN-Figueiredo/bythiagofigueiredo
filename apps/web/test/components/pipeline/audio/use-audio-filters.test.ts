import { describe, it, expect } from 'vitest'
import { serializeFilters, deserializeFilters } from
  '@/app/cms/(authed)/pipeline/audio/_helpers/use-audio-filters'

describe('serializeFilters', () => {
  it('serializes type filter', () => {
    const params = serializeFilters({ type: 'music' })
    expect(params.get('type')).toBe('music')
  })

  it('serializes energy range', () => {
    const params = serializeFilters({ energy_min: 3, energy_max: 5 })
    expect(params.get('energy_min')).toBe('3')
    expect(params.get('energy_max')).toBe('5')
  })

  it('omits null values', () => {
    const params = serializeFilters({ type: null, q: null })
    expect(params.toString()).toBe('')
  })

  it('omits empty string', () => {
    const params = serializeFilters({ q: '' })
    expect(params.toString()).toBe('')
  })

  it('omits empty arrays', () => {
    const params = serializeFilters({ mood: [] })
    expect(params.toString()).toBe('')
  })

  it('serializes arrays as CSV', () => {
    const params = serializeFilters({ mood: ['epic', 'dramatic'] })
    expect(params.get('mood')).toBe('epic,dramatic')
  })

  it('omits sort when default (newest)', () => {
    const params = serializeFilters({ sort: 'newest' })
    expect(params.toString()).toBe('')
  })

  it('includes sort when non-default', () => {
    const params = serializeFilters({ sort: 'bpm_asc' })
    expect(params.get('sort')).toBe('bpm_asc')
  })
})

describe('deserializeFilters', () => {
  it('parses type from URL params', () => {
    const params = new URLSearchParams('type=sfx&bpm_min=100')
    const filters = deserializeFilters(params)
    expect(filters.type).toBe('sfx')
    expect(filters.bpm_min).toBe(100)
  })

  it('returns defaults for empty params', () => {
    const filters = deserializeFilters(new URLSearchParams())
    expect(filters.type).toBeNull()
    expect(filters.sort).toBe('newest')
    expect(filters.energy_min).toBeNull()
  })

  it('parses CSV arrays', () => {
    const params = new URLSearchParams('mood=epic,dramatic&instruments=piano,strings')
    const filters = deserializeFilters(params)
    expect(filters.mood).toEqual(['epic', 'dramatic'])
    expect(filters.instruments).toEqual(['piano', 'strings'])
  })

  it('parses numeric values', () => {
    const params = new URLSearchParams('energy_min=2&energy_max=4&bpm_min=80&bpm_max=140')
    const filters = deserializeFilters(params)
    expect(filters.energy_min).toBe(2)
    expect(filters.energy_max).toBe(4)
    expect(filters.bpm_min).toBe(80)
    expect(filters.bpm_max).toBe(140)
  })

  it('handles mode and key', () => {
    const params = new URLSearchParams('key=D&mode=major')
    const filters = deserializeFilters(params)
    expect(filters.key).toBe('D')
    expect(filters.mode).toBe('major')
  })
})
