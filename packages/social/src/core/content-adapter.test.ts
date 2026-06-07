import { describe, it, expect } from 'vitest'
import {
  truncateForPlatform,
  adaptHashtags,
  formatForPlatform,
} from './content-adapter'

describe('truncateForPlatform', () => {
  it('returns text unchanged when under the limit', () => {
    expect(truncateForPlatform('short', 'bluesky', 'text')).toBe('short')
  })

  it('truncates to limit-3 + ellipsis when over the limit', () => {
    const text = 'a'.repeat(400)
    const out = truncateForPlatform(text, 'bluesky', 'text') // bluesky text limit = 300
    expect(out.length).toBe(300)
    expect(out.endsWith('...')).toBe(true)
  })

  it('returns text unchanged for an unknown field', () => {
    expect(truncateForPlatform('whatever', 'bluesky', 'nope')).toBe('whatever')
  })
})

describe('adaptHashtags', () => {
  it('prefixes # when missing and leaves existing # alone', () => {
    expect(adaptHashtags(['foo', '#bar'], 'facebook')).toEqual(['#foo', '#bar'])
  })

  it('caps instagram hashtags at 30', () => {
    const tags = Array.from({ length: 40 }, (_, i) => `t${i}`)
    expect(adaptHashtags(tags, 'instagram')).toHaveLength(30)
  })

  it('does not cap hashtags for non-instagram providers', () => {
    const tags = Array.from({ length: 40 }, (_, i) => `t${i}`)
    expect(adaptHashtags(tags, 'facebook')).toHaveLength(40)
  })
})

describe('formatForPlatform', () => {
  const content = {
    title: 'My Title',
    description: 'A description',
    url: 'https://example.com',
    hashtags: ['news', '#tech'],
  }

  it('instagram appends hashtags as a separate block', () => {
    const out = formatForPlatform(content, 'instagram')
    expect(out).toContain('My Title')
    expect(out).toContain('https://example.com')
    expect(out).toContain('#news #tech')
    // body and hashtag block separated by a blank line
    expect(out).toMatch(/\n\n#news/)
  })

  it('instagram truncates to the 2200-char caption limit', () => {
    const big = { ...content, description: 'd'.repeat(3000) }
    expect(formatForPlatform(big, 'instagram').length).toBeLessThanOrEqual(2200)
  })

  it('bluesky truncates to the 300-char limit', () => {
    const big = { title: 't'.repeat(500), url: 'https://x.io' }
    expect(formatForPlatform(big, 'bluesky').length).toBeLessThanOrEqual(300)
  })

  it('youtube applies the link-share template by default', () => {
    const out = formatForPlatform(content, 'youtube')
    expect(out).toContain('My Title')
    expect(out).toContain('https://example.com')
  })

  it('applies a named template when provided', () => {
    const out = formatForPlatform(content, 'facebook', 'blog-post')
    expect(out).toContain('My Title')
    expect(out).toContain('A description')
  })
})
