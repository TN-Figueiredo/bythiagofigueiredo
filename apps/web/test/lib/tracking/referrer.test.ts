import { describe, it, expect } from 'vitest'
import { classifyReferrer } from '../../../lib/tracking/referrer'

describe('classifyReferrer', () => {
  it('returns direct for null referrer', () => {
    expect(classifyReferrer(null, '')).toBe('direct')
  })
  it('returns direct for empty string', () => {
    expect(classifyReferrer('', '')).toBe('direct')
  })
  it('returns google for Google search', () => {
    expect(classifyReferrer('https://www.google.com/search?q=test', '')).toBe('google')
  })
  it('returns google for Bing search', () => {
    expect(classifyReferrer('https://www.bing.com/search?q=test', '')).toBe('google')
  })
  it('returns google for DuckDuckGo', () => {
    expect(classifyReferrer('https://duckduckgo.com/?q=test', '')).toBe('google')
  })
  it('returns newsletter for newsletter domain', () => {
    expect(classifyReferrer('https://bythiagofigueiredo.com/newsletter/archive/1', '')).toBe('newsletter')
  })
  it('returns newsletter for utm_source=newsletter', () => {
    expect(classifyReferrer('https://other.com', 'https://bythiagofigueiredo.com/blog/test?utm_source=newsletter')).toBe('newsletter')
  })
  it('returns social for twitter.com', () => {
    expect(classifyReferrer('https://twitter.com/someone/status/123', '')).toBe('social')
  })
  it('returns social for x.com', () => {
    expect(classifyReferrer('https://x.com/someone/status/123', '')).toBe('social')
  })
  it('returns social for linkedin.com', () => {
    expect(classifyReferrer('https://www.linkedin.com/feed', '')).toBe('social')
  })
  it('returns social for reddit.com', () => {
    expect(classifyReferrer('https://www.reddit.com/r/nextjs', '')).toBe('social')
  })
  it('returns other for unknown domain', () => {
    expect(classifyReferrer('https://someotherblog.com/article', '')).toBe('other')
  })
  it('handles malformed URLs gracefully', () => {
    expect(classifyReferrer('not-a-url', '')).toBe('other')
  })
  it('does not match newsletter for spoofed subdomain', () => {
    expect(classifyReferrer('https://bythiagofigueiredo.com.evil.com/phish', '')).toBe('other')
  })
  it('matches newsletter for legitimate subdomain', () => {
    expect(classifyReferrer('https://mail.bythiagofigueiredo.com/archive/1', '')).toBe('newsletter')
  })
})
