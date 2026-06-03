import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ addBreadcrumb: vi.fn() }))

import * as Sentry from '@sentry/nextjs'
import { checkDrift, normalizeYouTubeThumbnailUrl } from '@/lib/youtube/ab-drift'

const mockAddBreadcrumb = vi.mocked(Sentry.addBreadcrumb)

beforeEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

describe('normalizeYouTubeThumbnailUrl', () => {
  it('canonicalizes CDN subdomains to i.ytimg.com', () => {
    expect(normalizeYouTubeThumbnailUrl('https://i1.ytimg.com/vi/abc123/hqdefault.jpg'))
      .toBe('https://i.ytimg.com/vi/abc123/hqdefault.jpg')
    expect(normalizeYouTubeThumbnailUrl('https://i2.ytimg.com/vi/abc123/hqdefault.jpg'))
      .toBe('https://i.ytimg.com/vi/abc123/hqdefault.jpg')
    expect(normalizeYouTubeThumbnailUrl('https://i9.ytimg.com/vi/abc123/hqdefault.jpg'))
      .toBe('https://i.ytimg.com/vi/abc123/hqdefault.jpg')
    expect(normalizeYouTubeThumbnailUrl('https://i.ytimg.com/vi/abc123/hqdefault.jpg'))
      .toBe('https://i.ytimg.com/vi/abc123/hqdefault.jpg')
  })

  it('strips query parameters', () => {
    expect(normalizeYouTubeThumbnailUrl('https://i.ytimg.com/vi/abc123/hqdefault.jpg?sqp=-oaymwE&rs=AOn4CLDabc'))
      .toBe('https://i.ytimg.com/vi/abc123/hqdefault.jpg')
  })

  it('strips query parameters AND normalizes CDN subdomain together', () => {
    expect(normalizeYouTubeThumbnailUrl('https://i4.ytimg.com/vi/abc123/hqdefault.jpg?sqp=-oaymwE'))
      .toBe('https://i.ytimg.com/vi/abc123/hqdefault.jpg')
  })

  it('preserves path for non-ytimg URLs (e.g. Vercel Blob)', () => {
    const blobUrl = 'https://xxx.public.blob.vercel-storage.com/ab-originals/uuid/original.jpg'
    expect(normalizeYouTubeThumbnailUrl(blobUrl)).toBe(blobUrl)
  })

  it('strips trailing slash', () => {
    expect(normalizeYouTubeThumbnailUrl('https://i.ytimg.com/vi/abc123/hqdefault.jpg/'))
      .toBe('https://i.ytimg.com/vi/abc123/hqdefault.jpg')
  })

  it('falls back to split on invalid URL', () => {
    expect(normalizeYouTubeThumbnailUrl('not-a-url?foo=bar')).toBe('not-a-url')
  })

  it('preserves non-ytimg YouTube hosts (ggpht.com)', () => {
    const url = 'https://yt3.ggpht.com/ytc/abcdef123?sqp=test'
    expect(normalizeYouTubeThumbnailUrl(url)).toBe('https://yt3.ggpht.com/ytc/abcdef123')
  })

  it('preserves non-ytimg YouTube hosts (googleusercontent.com)', () => {
    const url = 'https://lh3.googleusercontent.com/a/abcdef?param=1'
    expect(normalizeYouTubeThumbnailUrl(url)).toBe('https://lh3.googleusercontent.com/a/abcdef')
  })

  it('handles webp paths', () => {
    expect(normalizeYouTubeThumbnailUrl('https://i3.ytimg.com/vi_webp/abc123/hqdefault.webp'))
      .toBe('https://i.ytimg.com/vi_webp/abc123/hqdefault.webp')
  })

  it('handles empty string gracefully', () => {
    expect(normalizeYouTubeThumbnailUrl('')).toBe('')
  })
})

describe('checkDrift', () => {
  it('returns no drift when YouTube URL matches expected', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              snippet: {
                thumbnails: {
                  high: { url: 'https://i.ytimg.com/vi/abc123/hqdefault.jpg?sqp=-oaymwE' },
                },
              },
            },
          ],
        }),
      ),
    )

    const result = await checkDrift(
      'test-1',
      'abc123',
      'https://i.ytimg.com/vi/abc123/hqdefault.jpg?sqp=different',
      'fake-key',
    )

    expect(result.drifted).toBe(false)
  })

  it('returns no drift when same path but different CDN subdomain', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              snippet: {
                thumbnails: {
                  high: { url: 'https://i4.ytimg.com/vi/abc123/hqdefault.jpg' },
                },
              },
            },
          ],
        }),
      ),
    )

    const result = await checkDrift(
      'test-1',
      'abc123',
      'https://i.ytimg.com/vi/abc123/hqdefault.jpg',
      'fake-key',
    )

    expect(result.drifted).toBe(false)
  })

  it('returns no drift when same path but different CDN subdomain (i9 vs i1)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              snippet: {
                thumbnails: {
                  high: { url: 'https://i9.ytimg.com/vi/abc123/hqdefault.jpg?sqp=abc' },
                },
              },
            },
          ],
        }),
      ),
    )

    const result = await checkDrift(
      'test-1',
      'abc123',
      'https://i1.ytimg.com/vi/abc123/hqdefault.jpg?sqp=xyz',
      'fake-key',
    )

    expect(result.drifted).toBe(false)
  })

  it('returns drift when YouTube URL differs from expected', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              snippet: {
                thumbnails: {
                  high: { url: 'https://i.ytimg.com/vi/abc123/maxresdefault.jpg' },
                },
              },
            },
          ],
        }),
      ),
    )

    const result = await checkDrift(
      'test-1',
      'abc123',
      'https://i.ytimg.com/vi/abc123/hqdefault.jpg',
      'fake-key',
    )

    expect(result.drifted).toBe(true)
    expect(result.currentUrl).toBe('https://i.ytimg.com/vi/abc123/maxresdefault.jpg')
  })

  it('detects drift when video ID in URL path changes', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              snippet: {
                thumbnails: {
                  high: { url: 'https://i.ytimg.com/vi/DIFFERENT/hqdefault.jpg' },
                },
              },
            },
          ],
        }),
      ),
    )

    const result = await checkDrift(
      'test-1',
      'abc123',
      'https://i.ytimg.com/vi/abc123/hqdefault.jpg',
      'fake-key',
    )

    expect(result.drifted).toBe(true)
  })

  it('returns no drift when expectedUrl is null', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const result = await checkDrift('test-1', 'abc123', null, 'fake-key')

    expect(result.drifted).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('returns no drift when API fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'))

    const result = await checkDrift(
      'test-1',
      'abc123',
      'https://i.ytimg.com/vi/abc123/hqdefault.jpg',
      'fake-key',
    )

    expect(result.drifted).toBe(false)
  })

  it('returns no drift when API returns non-200', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('error', { status: 500 }),
    )

    const result = await checkDrift(
      'test-1',
      'abc123',
      'https://i.ytimg.com/vi/abc123/hqdefault.jpg',
      'fake-key',
    )

    expect(result.drifted).toBe(false)
  })

  it('returns no drift when API returns no items', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ items: [] })),
    )

    const result = await checkDrift(
      'test-1',
      'abc123',
      'https://i.ytimg.com/vi/abc123/hqdefault.jpg',
      'fake-key',
    )

    expect(result.drifted).toBe(false)
  })

  it('adds Sentry breadcrumb on check', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              snippet: {
                thumbnails: {
                  high: { url: 'https://i.ytimg.com/vi/abc123/hqdefault.jpg' },
                },
              },
            },
          ],
        }),
      ),
    )

    await checkDrift(
      'test-1',
      'abc123',
      'https://i.ytimg.com/vi/abc123/hqdefault.jpg',
      'fake-key',
    )

    expect(mockAddBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'ab-drift',
        level: 'info',
        message: expect.stringContaining('test=test-1'),
      }),
    )
  })

  it('adds warning-level breadcrumb when drift detected', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              snippet: {
                thumbnails: {
                  high: { url: 'https://i.ytimg.com/vi/abc123/maxresdefault.jpg' },
                },
              },
            },
          ],
        }),
      ),
    )

    await checkDrift(
      'test-1',
      'abc123',
      'https://i.ytimg.com/vi/abc123/hqdefault.jpg',
      'fake-key',
    )

    expect(mockAddBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'ab-drift',
        level: 'warning',
        message: expect.stringContaining('drifted=true'),
      }),
    )
  })
})
