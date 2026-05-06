import { describe, it, expect } from 'vitest'
import { classifyReferrer } from './referrer-classifier.js'

describe('ReferrerClassifier', () => {
  it('classifies empty/null referrer as direct', () => {
    expect(classifyReferrer(null)).toBe('direct')
    expect(classifyReferrer('')).toBe('direct')
    expect(classifyReferrer(undefined as unknown as string)).toBe('direct')
  })

  it('classifies google domains as google', () => {
    expect(classifyReferrer('https://www.google.com/search?q=test')).toBe('google')
    expect(classifyReferrer('https://google.com.br/')).toBe('google')
    expect(classifyReferrer('https://www.google.co.uk/')).toBe('google')
  })

  it('classifies social platforms', () => {
    expect(classifyReferrer('https://www.facebook.com/some-post')).toBe('social')
    expect(classifyReferrer('https://t.co/abc123')).toBe('social')
    expect(classifyReferrer('https://twitter.com/user/status/123')).toBe('social')
    expect(classifyReferrer('https://x.com/user/status/123')).toBe('social')
    expect(classifyReferrer('https://www.instagram.com/')).toBe('social')
    expect(classifyReferrer('https://www.linkedin.com/feed')).toBe('social')
    expect(classifyReferrer('https://www.reddit.com/r/test')).toBe('social')
    expect(classifyReferrer('https://www.tiktok.com/@user')).toBe('social')
    expect(classifyReferrer('https://www.youtube.com/watch?v=abc')).toBe('social')
    expect(classifyReferrer('https://www.threads.net/')).toBe('social')
    expect(classifyReferrer('https://bsky.app/profile/user')).toBe('social')
    expect(classifyReferrer('https://mastodon.social/@user')).toBe('social')
  })

  it('classifies email providers as email', () => {
    expect(classifyReferrer('https://mail.google.com/')).toBe('email')
    expect(classifyReferrer('https://outlook.live.com/')).toBe('email')
    expect(classifyReferrer('https://mail.yahoo.com/')).toBe('email')
    expect(classifyReferrer('https://mail.protonmail.com/')).toBe('email')
  })

  it('classifies newsletter/utm_medium=email as newsletter', () => {
    expect(classifyReferrer('https://example.com?utm_medium=email')).toBe('newsletter')
  })

  it('classifies qr referrer', () => {
    expect(classifyReferrer('https://example.com?ref=qr')).toBe('qr')
    expect(classifyReferrer('https://example.com?utm_source=qr')).toBe('qr')
    expect(classifyReferrer('https://example.com?utm_medium=qr')).toBe('qr')
  })

  it('classifies unknown referrer as other', () => {
    expect(classifyReferrer('https://some-random-site.com/page')).toBe('other')
  })
})
