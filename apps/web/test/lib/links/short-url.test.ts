import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { buildShortUrl } from '../../../src/lib/links/short-url'

describe('buildShortUrl', () => {
  const origShortDomain = process.env.LINKS_SHORT_DOMAIN
  const origAppUrl = process.env.NEXT_PUBLIC_APP_URL

  afterEach(() => {
    if (origShortDomain !== undefined) process.env.LINKS_SHORT_DOMAIN = origShortDomain
    else delete process.env.LINKS_SHORT_DOMAIN
    if (origAppUrl !== undefined) process.env.NEXT_PUBLIC_APP_URL = origAppUrl
    else delete process.env.NEXT_PUBLIC_APP_URL
  })

  it('uses LINKS_SHORT_DOMAIN when set', () => {
    process.env.LINKS_SHORT_DOMAIN = 'go.tff.com'
    expect(buildShortUrl('AbCd123')).toBe('https://go.tff.com/AbCd123')
  })

  it('falls back to APP_URL/go/{code} when no short domain', () => {
    delete process.env.LINKS_SHORT_DOMAIN
    process.env.NEXT_PUBLIC_APP_URL = 'https://mysite.com'
    expect(buildShortUrl('XyZ789')).toBe('https://mysite.com/go/XyZ789')
  })

  it('uses default domain when neither env is set', () => {
    delete process.env.LINKS_SHORT_DOMAIN
    delete process.env.NEXT_PUBLIC_APP_URL
    expect(buildShortUrl('test123')).toBe('https://bythiagofigueiredo.com/go/test123')
  })

  it('prefers LINKS_SHORT_DOMAIN over APP_URL', () => {
    process.env.LINKS_SHORT_DOMAIN = 'go.short.io'
    process.env.NEXT_PUBLIC_APP_URL = 'https://mysite.com'
    expect(buildShortUrl('abc')).toBe('https://go.short.io/abc')
  })
})
