import { describe, it, expect } from 'vitest'
import { rewriteLinksForTracking } from '@/lib/newsletter/link-tracking'

describe('rewriteLinksForTracking', () => {
  const baseUrl = 'https://bythiagofigueiredo.com'

  it('rewrites regular href URLs to tracking redirect', () => {
    const html = '<a href="https://example.com/page">Click</a>'
    const result = rewriteLinksForTracking(html, 'send-123', baseUrl)
    expect(result).toContain('/api/newsletters/track/click?s=send-123&u=')
    expect(result).not.toContain('href="https://example.com/page"')
  })

  it('skips mailto: links', () => {
    const html = '<a href="mailto:user@example.com">Email</a>'
    const result = rewriteLinksForTracking(html, 'send-123', baseUrl)
    expect(result).toContain('href="mailto:user@example.com"')
  })

  it('skips anchor (#) links', () => {
    const html = '<a href="#section">Jump</a>'
    const result = rewriteLinksForTracking(html, 'send-123', baseUrl)
    expect(result).toContain('href="#section"')
  })

  it('skips unsubscribe URLs (RFC 8058)', () => {
    const html = '<a href="https://bythiagofigueiredo.com/newsletter/unsubscribe?token=abc">Unsub</a>'
    const result = rewriteLinksForTracking(html, 'send-123', baseUrl)
    expect(result).toContain('/newsletter/unsubscribe?token=abc')
    expect(result).not.toContain('/api/newsletters/track/click')
  })

  it('encodes target URL in base64url', () => {
    const html = '<a href="https://example.com">Test</a>'
    const result = rewriteLinksForTracking(html, 'send-1', baseUrl)
    const match = result.match(/u=([^"&]+)/)
    expect(match).toBeTruthy()
    const decoded = Buffer.from(match![1], 'base64url').toString()
    expect(decoded).toBe('https://example.com')
  })

  it('returns input unchanged for empty html', () => {
    expect(rewriteLinksForTracking('', 'send-1', baseUrl)).toBe('')
  })
})
