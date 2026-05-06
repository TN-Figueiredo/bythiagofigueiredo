import { describe, it, expect, vi } from 'vitest'
import {
  rewriteLinksForTracking,
  rewriteLinksUnified,
} from '../../../lib/newsletter/link-tracking'

// ---------------------------------------------------------------------------
// Legacy rewriter (unchanged behaviour)
// ---------------------------------------------------------------------------
describe('rewriteLinksForTracking (legacy)', () => {
  it('rewrites a plain href', () => {
    const html = '<a href="https://example.com">click</a>'
    const result = rewriteLinksForTracking(html, 'send-1', 'https://app.test')
    expect(result).toContain('/api/newsletters/track/click?s=send-1')
    expect(result).toContain('u=')
    expect(result).not.toContain('href="https://example.com"')
  })

  it('skips mailto links', () => {
    const html = '<a href="mailto:a@b.com">mail</a>'
    expect(rewriteLinksForTracking(html, 's', 'https://app')).toContain('href="mailto:a@b.com"')
  })

  it('skips anchor links', () => {
    const html = '<a href="#section">jump</a>'
    expect(rewriteLinksForTracking(html, 's', 'https://app')).toContain('href="#section"')
  })

  it('skips unsubscribe links', () => {
    const html = '<a href="https://app/newsletter/unsubscribe?token=abc">unsub</a>'
    expect(rewriteLinksForTracking(html, 's', 'https://app')).toContain('/newsletter/unsubscribe')
  })

  it('returns empty string for empty html', () => {
    expect(rewriteLinksForTracking('', 's', 'https://app')).toBe('')
  })

  it('rewrites multiple links independently', () => {
    const html =
      '<a href="https://a.com">A</a> and <a href="https://b.com">B</a>'
    const result = rewriteLinksForTracking(html, 's', 'https://app')
    const matches = [...result.matchAll(/track\/click/g)]
    expect(matches.length).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// Unified rewriter (new path)
// ---------------------------------------------------------------------------

function makeSupabaseMock(codeMap: Record<string, string>) {
  const upsert = vi.fn().mockResolvedValue({ data: null, error: null })
  const inFn = vi.fn().mockResolvedValue({
    data: Object.entries(codeMap).map(([destination_url, code]) => ({
      destination_url,
      code,
    })),
    error: null,
  })

  // Chain: from().upsert() and from().select().eq().in()
  const from = vi.fn(() => ({
    upsert,
    select: () => ({
      eq: () => ({
        in: inFn,
      }),
    }),
  }))

  return { from, _upsert: upsert, _in: inFn }
}

describe('rewriteLinksUnified', () => {
  const baseOpts = {
    siteId: 'site-1',
    editionId: 'ed-1',
    shortDomain: 'go.example.com',
    campaignSlug: 'my-newsletter',
  }

  it('returns original html + linkCount=0 for empty html', async () => {
    const sb = makeSupabaseMock({})
    const result = await rewriteLinksUnified({
      ...baseOpts,
      html: '',
      supabase: sb as never,
    })
    expect(result.html).toBe('')
    expect(result.linkCount).toBe(0)
  })

  it('rewrites hrefs to short domain with utm params', async () => {
    const sb = makeSupabaseMock({ 'https://example.com': 'abc123' })
    const html = '<a href="https://example.com">click</a>'
    const result = await rewriteLinksUnified({
      ...baseOpts,
      html,
      supabase: sb as never,
    })
    expect(result.html).toContain('href="https://go.example.com/abc123')
    expect(result.html).toContain('utm_source=newsletter')
    expect(result.html).toContain('utm_medium=email')
    expect(result.html).toContain('utm_campaign=my-newsletter')
    expect(result.linkCount).toBe(1)
  })

  it('does not double-add utm_source when already present', async () => {
    const dest = 'https://example.com?utm_source=existing'
    const sb = makeSupabaseMock({ [dest]: 'xyz' })
    const html = `<a href="${dest}">x</a>`
    const result = await rewriteLinksUnified({
      ...baseOpts,
      html,
      supabase: sb as never,
    })
    // The short url itself has no utm suffix appended
    expect(result.html).toContain('href="https://go.example.com/xyz"')
  })

  it('skips mailto links and counts them out', async () => {
    const sb = makeSupabaseMock({})
    const html = '<a href="mailto:a@b.com">mail</a>'
    const result = await rewriteLinksUnified({
      ...baseOpts,
      html,
      supabase: sb as never,
    })
    expect(result.html).toContain('href="mailto:a@b.com"')
    expect(result.linkCount).toBe(0)
  })

  it('skips anchor and unsubscribe links', async () => {
    const sb = makeSupabaseMock({})
    const html =
      '<a href="#section">jump</a><a href="/newsletter/unsubscribe?t=1">unsub</a>'
    const result = await rewriteLinksUnified({
      ...baseOpts,
      html,
      supabase: sb as never,
    })
    expect(result.html).toContain('href="#section"')
    expect(result.html).toContain('href="/newsletter/unsubscribe')
    expect(result.linkCount).toBe(0)
  })

  it('deduplicates identical hrefs before upsert', async () => {
    const sb = makeSupabaseMock({ 'https://example.com': 'dedup' })
    // Same URL appears twice
    const html =
      '<a href="https://example.com">A</a><a href="https://example.com">B</a>'
    const result = await rewriteLinksUnified({
      ...baseOpts,
      html,
      supabase: sb as never,
    })
    // upsert should have been called with exactly 1 unique row
    const upsertCall = sb._upsert.mock.calls[0][0] as Array<unknown>
    expect(upsertCall.length).toBe(1)
    // Both links rewritten
    expect(result.linkCount).toBe(2)
  })

  it('falls back to original href when code is missing from DB response', async () => {
    // DB returns no codes — simulates a transient DB error
    const from = vi.fn(() => ({
      upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
      select: () => ({
        eq: () => ({
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    }))
    const html = '<a href="https://example.com">click</a>'
    const result = await rewriteLinksUnified({
      ...baseOpts,
      html,
      supabase: { from } as never,
    })
    // Graceful fallback: original href preserved, linkCount=0
    expect(result.html).toContain('href="https://example.com"')
    expect(result.linkCount).toBe(0)
  })
})
