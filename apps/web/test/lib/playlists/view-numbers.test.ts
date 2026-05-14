import { describe, it, expect } from 'vitest'
import { computeViewNumbers, matchesFilter } from '@/lib/playlists/canvas/view-numbers'
import type { PlaylistItemEnriched, FilterState } from '@/lib/playlists/types'

function makeItem(overrides: Partial<PlaylistItemEnriched> & { id: string; sort_order: number }): PlaylistItemEnriched {
  return {
    playlist_id: 'p1', blog_post_id: null, newsletter_edition_id: null,
    pipeline_id: null, position_x: 0, position_y: 0, created_at: '',
    content_type: 'blog_post', title: 'Test', status: null,
    category: null, metadata: null, is_ghost: false,
    other_playlist_count: 0, language: null,
    ...overrides,
  }
}

const ALL_FILTER: FilterState = { types: new Set(), languages: new Set(), mode: 'all', search: '' }

describe('matchesFilter', () => {
  it('matches everything when filter is empty (all mode)', () => {
    const item = makeItem({ id: '1', sort_order: 1 })
    expect(matchesFilter(item, ALL_FILTER)).toBe(true)
  })

  it('filters by content type', () => {
    const filter: FilterState = { types: new Set(['video']), languages: new Set(), mode: 'dim', search: '' }
    const blogItem = makeItem({ id: '1', sort_order: 1, content_type: 'blog_post' })
    const videoItem = makeItem({ id: '2', sort_order: 2, content_type: 'video' })
    expect(matchesFilter(blogItem, filter)).toBe(false)
    expect(matchesFilter(videoItem, filter)).toBe(true)
  })

  it('filters by language', () => {
    const filter: FilterState = { types: new Set(), languages: new Set(['pt-br']), mode: 'dim', search: '' }
    const ptItem = makeItem({ id: '1', sort_order: 1, language: 'pt-br' })
    const enItem = makeItem({ id: '2', sort_order: 2, language: 'en' })
    const noLangItem = makeItem({ id: '3', sort_order: 3, language: null })
    expect(matchesFilter(ptItem, filter)).toBe(true)
    expect(matchesFilter(enItem, filter)).toBe(false)
    expect(matchesFilter(noLangItem, filter)).toBe(false)
  })

  it('combines type and language filters (AND logic)', () => {
    const filter: FilterState = { types: new Set(['video']), languages: new Set(['pt-br']), mode: 'dim', search: '' }
    const match = makeItem({ id: '1', sort_order: 1, content_type: 'video', language: 'pt-br' })
    const wrongType = makeItem({ id: '2', sort_order: 2, content_type: 'blog_post', language: 'pt-br' })
    const wrongLang = makeItem({ id: '3', sort_order: 3, content_type: 'video', language: 'en' })
    expect(matchesFilter(match, filter)).toBe(true)
    expect(matchesFilter(wrongType, filter)).toBe(false)
    expect(matchesFilter(wrongLang, filter)).toBe(false)
  })

  it('filters by search term (case-insensitive)', () => {
    const filter: FilterState = { types: new Set(), languages: new Set(), mode: 'dim', search: 'react' }
    const match = makeItem({ id: '1', sort_order: 1, title: 'Learn React Hooks' })
    const noMatch = makeItem({ id: '2', sort_order: 2, title: 'Vue Composition API' })
    expect(matchesFilter(match, filter)).toBe(true)
    expect(matchesFilter(noMatch, filter)).toBe(false)
  })

  it('ghost items never match', () => {
    const item = makeItem({ id: '1', sort_order: 1, is_ghost: true })
    expect(matchesFilter(item, ALL_FILTER)).toBe(false)
  })
})

describe('computeViewNumbers', () => {
  it('returns sequential numbers for all items when no filter', () => {
    const items = [
      makeItem({ id: 'a', sort_order: 1000 }),
      makeItem({ id: 'b', sort_order: 2000 }),
      makeItem({ id: 'c', sort_order: 3000 }),
    ]
    const result = computeViewNumbers(items, ALL_FILTER)
    expect(result.get('a')).toBe(1)
    expect(result.get('b')).toBe(2)
    expect(result.get('c')).toBe(3)
  })

  it('renumbers based on filtered subset', () => {
    const items = [
      makeItem({ id: 'a', sort_order: 1000, content_type: 'video', language: 'pt-br' }),
      makeItem({ id: 'b', sort_order: 2000, content_type: 'blog_post', language: 'en' }),
      makeItem({ id: 'c', sort_order: 3000, content_type: 'video', language: 'pt-br' }),
    ]
    const filter: FilterState = { types: new Set(['video']), languages: new Set(), mode: 'dim', search: '' }
    const result = computeViewNumbers(items, filter)
    expect(result.get('a')).toBe(1)
    expect(result.get('b')).toBeNull()
    expect(result.get('c')).toBe(2)
  })

  it('respects sort_order for numbering, not array order', () => {
    const items = [
      makeItem({ id: 'c', sort_order: 3000, content_type: 'video' }),
      makeItem({ id: 'a', sort_order: 1000, content_type: 'video' }),
    ]
    const result = computeViewNumbers(items, ALL_FILTER)
    expect(result.get('a')).toBe(1)
    expect(result.get('c')).toBe(2)
  })

  it('returns empty map for empty items', () => {
    const result = computeViewNumbers([], ALL_FILTER)
    expect(result.size).toBe(0)
  })

  it('ghost items get null', () => {
    const items = [
      makeItem({ id: 'a', sort_order: 1000 }),
      makeItem({ id: 'b', sort_order: 2000, is_ghost: true }),
    ]
    const result = computeViewNumbers(items, ALL_FILTER)
    expect(result.get('a')).toBe(1)
    expect(result.get('b')).toBeNull()
  })
})
