import { describe, it, expect } from 'vitest'
import { PostExtrasSchema, type PostExtras } from '../../../src/components/blog/post-extras-schema'

describe('PostExtrasSchema', () => {
  it('parses full valid extras', () => {
    const input = {
      key_points: ['Point 1', 'Point 2'],
      tags: ['meta', 'manifesto'],
      pull_quote: 'a notebook, not a product',
      pull_quote_attribution: 'PROMISE 3',
      series_title: 'Building in public',
      series_part: 1,
      series_total: 3,
      series_next_slug: 'cms-for-all',
      series_next_title: 'A CMS to rule them all',
      series_next_excerpt: 'The architecture behind cross-site publishing...',
      colophon: 'Written in iA Writer on a MacBook Air M2.',
    }
    const result = PostExtrasSchema.safeParse(input)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.key_points).toHaveLength(2)
      expect(result.data.tags).toHaveLength(2)
      expect(result.data.pull_quote).toBe('a notebook, not a product')
      expect(result.data.series_part).toBe(1)
    }
  })

  it('allows all fields to be absent (empty object)', () => {
    const result = PostExtrasSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.key_points).toBeUndefined()
      expect(result.data.tags).toBeUndefined()
      expect(result.data.colophon).toBeUndefined()
    }
  })

  it('rejects key_points that is not string array', () => {
    const result = PostExtrasSchema.safeParse({ key_points: 'not-array' })
    expect(result.success).toBe(false)
  })

  it('rejects series_part without series_title', () => {
    const result = PostExtrasSchema.safeParse({ series_part: 2 })
    expect(result.success).toBe(false)
  })

  it('rejects series_part greater than series_total', () => {
    const result = PostExtrasSchema.safeParse({
      series_title: 'My series',
      series_part: 5,
      series_total: 3,
    })
    expect(result.success).toBe(false)
  })

  it('accepts partial series (title only, no next)', () => {
    const result = PostExtrasSchema.safeParse({
      series_title: 'My series',
      series_part: 1,
      series_total: 2,
    })
    expect(result.success).toBe(true)
  })
})
