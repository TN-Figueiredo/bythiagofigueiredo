import { describe, it, expect } from 'vitest'
import { autoCategorize } from '@/lib/youtube/auto-categorize'
import type { YouTubeCategoryRow } from '@/lib/youtube/types'

const makeCategory = (overrides: Partial<YouTubeCategoryRow> = {}): YouTubeCategoryRow => ({
  id: 'cat-1',
  site_id: 'site-1',
  slug: 'build-in-public',
  name_pt: 'Build in Public',
  name_en: 'Build in Public',
  description_pt: null,
  description_en: null,
  color: '#FF8240',
  sort_order: 0,
  match_keywords: ['build in public', 'live coding', 'building'],
  auto_approve: false,
  created_at: '',
  updated_at: '',
  ...overrides,
})

describe('autoCategorize', () => {
  const categories = [
    makeCategory({ id: 'cat-bip', slug: 'build-in-public', match_keywords: ['build in public', 'live coding'] }),
    makeCategory({ id: 'cat-setup', slug: 'dev-setup', match_keywords: ['setup', 'home office', 'desk tour'], auto_approve: true }),
    makeCategory({ id: 'cat-debug', slug: 'debugging', match_keywords: ['bug', 'debug', 'fix'] }),
  ]

  it('matches title case-insensitively', () => {
    const result = autoCategorize(
      { title: 'My LIVE CODING session', tags: [], description: '' },
      categories,
    )
    expect(result?.categoryId).toBe('cat-bip')
  })

  it('matches tags', () => {
    const result = autoCategorize(
      { title: 'Untitled', tags: ['home office', 'gear'], description: '' },
      categories,
    )
    expect(result?.categoryId).toBe('cat-setup')
  })

  it('matches description', () => {
    const result = autoCategorize(
      { title: 'Untitled', tags: [], description: 'How I fixed a nasty bug in production' },
      categories,
    )
    expect(result?.categoryId).toBe('cat-debug')
  })

  it('returns null when no match', () => {
    const result = autoCategorize(
      { title: 'Random vlog', tags: ['travel'], description: 'Some description' },
      categories,
    )
    expect(result).toBeNull()
  })

  it('returns first match by sort_order', () => {
    const overlapping = [
      makeCategory({ id: 'cat-a', slug: 'a', match_keywords: ['coding'], sort_order: 1 }),
      makeCategory({ id: 'cat-b', slug: 'b', match_keywords: ['coding'], sort_order: 0 }),
    ]
    const result = autoCategorize(
      { title: 'Live coding', tags: [], description: '' },
      overlapping,
    )
    expect(result?.categoryId).toBe('cat-b')
  })

  it('reports autoApprove flag from matched category', () => {
    const result = autoCategorize(
      { title: 'My desk tour and setup', tags: [], description: '' },
      categories,
    )
    expect(result?.categoryId).toBe('cat-setup')
    expect(result?.autoApprove).toBe(true)
  })
})
