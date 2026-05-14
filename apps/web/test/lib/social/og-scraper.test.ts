import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('scrapeOg', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('returns ok with tag count and latency on success', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      json: () =>
        Promise.resolve({
          og_object: {
            title: 'Test',
            description: 'Desc',
            image: 'https://cdn.example.com/img.jpg',
            url: 'https://example.com',
            type: 'article',
            site_name: 'Example',
            locale: 'pt_BR',
          },
        }),
    })

    const { scrapeOg } = await import('@/lib/social/og-scraper')
    const result = await scrapeOg(
      'https://example.com/blog/test',
      'page-token-123',
    )

    expect(result.status).toBe('ok')
    expect(result.tags).toBe(7)
    expect(result.http_status).toBe(200)
    expect(result.latency_ms).toBeGreaterThanOrEqual(0)
    expect(result.error).toBeUndefined()

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('graph.facebook.com'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer page-token-123',
        }),
      }),
    )
  })

  it('returns timeout status when fetch is aborted', async () => {
    globalThis.fetch = vi.fn().mockImplementation(() => {
      const error = new Error('The operation was aborted')
      error.name = 'AbortError'
      return Promise.reject(error)
    })

    const { scrapeOg } = await import('@/lib/social/og-scraper')
    const result = await scrapeOg(
      'https://example.com/blog/slow',
      'page-token-123',
    )

    expect(result.status).toBe('timeout')
    expect(result.error).toBe('The operation was aborted')
    expect(result.tags).toBeUndefined()
    expect(result.http_status).toBeUndefined()
  })

  it('returns error status on HTTP failure', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 500,
      json: () => Promise.resolve({ error: { message: 'Internal error' } }),
    })

    const { scrapeOg } = await import('@/lib/social/og-scraper')
    const result = await scrapeOg(
      'https://example.com/blog/broken',
      'page-token-123',
    )

    expect(result.http_status).toBe(500)
    expect(result.latency_ms).toBeGreaterThanOrEqual(0)
  })

  it('returns error status on network failure', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))

    const { scrapeOg } = await import('@/lib/social/og-scraper')
    const result = await scrapeOg(
      'https://example.com/blog/offline',
      'page-token-123',
    )

    expect(result.status).toBe('error')
    expect(result.error).toBe('ECONNREFUSED')
  })

  it('handles empty og_object gracefully', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({}),
    })

    const { scrapeOg } = await import('@/lib/social/og-scraper')
    const result = await scrapeOg(
      'https://example.com/blog/no-og',
      'page-token-123',
    )

    expect(result.status).toBe('ok')
    expect(result.tags).toBe(0)
    expect(result.http_status).toBe(200)
  })
})
