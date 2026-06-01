import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ addBreadcrumb: vi.fn() }))

import * as Sentry from '@sentry/nextjs'
import { checkDrift } from '@/lib/youtube/ab-drift'

const mockAddBreadcrumb = vi.mocked(Sentry.addBreadcrumb)

beforeEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

describe('ab-drift detection', () => {
  it('returns no drift when YouTube URL matches expected', async () => {
    // Same base URL, different query params = no drift
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

  it('returns drift when YouTube URL differs from expected', async () => {
    // Different path = drift
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

  it('returns no drift when expectedUrl is null', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const result = await checkDrift('test-1', 'abc123', null, 'fake-key')

    expect(result.drifted).toBe(false)
    // Should not even call the API
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
})
