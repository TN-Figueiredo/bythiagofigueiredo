import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  fetchRecentVideoIds,
  fetchVideoDetails,
  fetchChannelStats,
  parseDuration,
} from '@/lib/youtube/api-client'

describe('parseDuration', () => {
  it('parses PT14M32S', () => {
    expect(parseDuration('PT14M32S')).toEqual({ text: '14:32', seconds: 872 })
  })
  it('parses PT1H2M3S', () => {
    expect(parseDuration('PT1H2M3S')).toEqual({ text: '1:02:03', seconds: 3723 })
  })
  it('parses PT5M', () => {
    expect(parseDuration('PT5M')).toEqual({ text: '5:00', seconds: 300 })
  })
  it('parses PT30S', () => {
    expect(parseDuration('PT30S')).toEqual({ text: '0:30', seconds: 30 })
  })
  it('handles empty string', () => {
    expect(parseDuration('')).toEqual({ text: '0:00', seconds: 0 })
  })
})

describe('fetchRecentVideoIds', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('returns video IDs from playlistItems response', async () => {
    const mockResponse = {
      items: [
        { contentDetails: { videoId: 'vid1' } },
        { contentDetails: { videoId: 'vid2' } },
      ],
    }
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    )

    const ids = await fetchRecentVideoIds('PLtest123', 'test-key')
    expect(ids).toEqual(['vid1', 'vid2'])
  })

  it('throws on quota exceeded', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { errors: [{ reason: 'quotaExceeded' }] } }), { status: 403 }),
    )

    await expect(fetchRecentVideoIds('PLtest', 'test-key')).rejects.toThrow('quotaExceeded')
  })
})

describe('fetchVideoDetails', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('parses video metadata correctly', async () => {
    const mockResponse = {
      items: [{
        id: 'vid1',
        snippet: {
          title: 'Test Video',
          description: 'Test desc',
          publishedAt: '2026-05-01T10:00:00Z',
          tags: ['nextjs', 'typescript'],
          thumbnails: {
            medium: { url: 'https://i.ytimg.com/vi/vid1/mqdefault.jpg' },
            high: { url: 'https://i.ytimg.com/vi/vid1/hqdefault.jpg' },
          },
        },
        contentDetails: { duration: 'PT14M32S' },
        statistics: { viewCount: '8200', likeCount: '412', commentCount: '38' },
      }],
    }
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    )

    const videos = await fetchVideoDetails(['vid1'], 'test-key')
    expect(videos).toHaveLength(1)
    expect(videos[0]).toMatchObject({
      youtubeVideoId: 'vid1',
      title: 'Test Video',
      description: 'Test desc',
      duration: '14:32',
      durationSeconds: 872,
      tags: ['nextjs', 'typescript'],
      viewCount: 8200,
      likeCount: 412,
      commentCount: 38,
    })
  })
})

describe('fetchChannelStats', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('returns stats with null thumbnail/banner when only statistics present', async () => {
    const mockResponse = {
      items: [{
        statistics: { subscriberCount: '4200', videoCount: '48' },
      }],
    }
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    )

    const stats = await fetchChannelStats('UCtest', 'test-key')
    expect(stats).toEqual({ subscriberCount: 4200, videoCount: 48, thumbnailUrl: null, bannerUrl: null })
  })

  it('extracts thumbnail and banner when present', async () => {
    const mockResponse = {
      items: [{
        snippet: { thumbnails: { medium: { url: 'https://yt3.ggpht.com/avatar' } } },
        statistics: { subscriberCount: '100', videoCount: '10' },
        brandingSettings: { image: { bannerExternalUrl: 'https://yt3.ggpht.com/banner' } },
      }],
    }
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    )

    const stats = await fetchChannelStats('UCtest', 'test-key')
    expect(stats).toEqual({
      subscriberCount: 100,
      videoCount: 10,
      thumbnailUrl: 'https://yt3.ggpht.com/avatar',
      bannerUrl: 'https://yt3.ggpht.com/banner',
    })
  })

  it('returns zeroed defaults when items array is empty', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ items: [] }), { status: 200 }),
    )
    const stats = await fetchChannelStats('UCgone', 'test-key')
    expect(stats).toEqual({ subscriberCount: 0, videoCount: 0, thumbnailUrl: null, bannerUrl: null })
  })

  it('returns zeroed defaults when items is undefined', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 200 }),
    )
    const stats = await fetchChannelStats('UCgone', 'test-key')
    expect(stats).toEqual({ subscriberCount: 0, videoCount: 0, thumbnailUrl: null, bannerUrl: null })
  })

  it('returns null thumbnailUrl when snippet exists but thumbnails.medium is missing', async () => {
    const mockResponse = {
      items: [{
        snippet: { thumbnails: {} },
        statistics: { subscriberCount: '50', videoCount: '3' },
      }],
    }
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    )
    const stats = await fetchChannelStats('UCtest', 'test-key')
    expect(stats.thumbnailUrl).toBeNull()
    expect(stats.subscriberCount).toBe(50)
  })

  it('requests snippet, statistics, and brandingSettings parts', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ items: [{ statistics: {} }] }), { status: 200 }),
    )

    await fetchChannelStats('UCtest', 'test-key')

    const url = new URL(fetchSpy.mock.calls[0][0] as string)
    expect(url.searchParams.get('part')).toBe('snippet,statistics,brandingSettings')
  })
})

describe('ytFetch retry behavior', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  /** Drive pending setTimeout timers forward until the promise settles. */
  async function drainTimers<T>(promise: Promise<T>): Promise<T> {
    let settled = false
    const wrapped = promise.finally(() => { settled = true })
    while (!settled) {
      await vi.advanceTimersByTimeAsync(5_000)
    }
    return wrapped
  }

  it('retries on 429 and succeeds', async () => {
    const okResponse = { items: [{ contentDetails: { videoId: 'v1' } }] }
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(okResponse), { status: 200 }))

    const ids = await drainTimers(fetchRecentVideoIds('PLtest', 'test-key'))
    expect(ids).toEqual(['v1'])
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('retries on 500 and succeeds', async () => {
    const okResponse = { items: [{ statistics: { subscriberCount: '100', videoCount: '5' } }] }
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(okResponse), { status: 200 }))

    const stats = await drainTimers(fetchChannelStats('UCtest', 'test-key'))
    expect(stats).toEqual({ subscriberCount: 100, videoCount: 5, thumbnailUrl: null, bannerUrl: null })
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('throws after max retries exceeded', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('', { status: 503 }))

    const promise = fetchChannelStats('UCtest', 'test-key')
    // Catch immediately to prevent unhandled rejection warning
    const caught = promise.catch((e: Error) => e)

    // Advance through all retry delays (1s + 2s + 4s)
    await vi.advanceTimersByTimeAsync(1_000)
    await vi.advanceTimersByTimeAsync(2_000)
    await vi.advanceTimersByTimeAsync(4_000)

    const error = await caught
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toBe('YouTube API 503')
    // Initial attempt (0) + 3 retries (1,2,3) = 4 calls
    expect(fetchSpy).toHaveBeenCalledTimes(4)
  })

  it('paginates and stops when no nextPageToken', async () => {
    const page1 = { items: [{ contentDetails: { videoId: 'a' } }], nextPageToken: 'page2' }
    const page2 = { items: [{ contentDetails: { videoId: 'b' } }], nextPageToken: 'page3' }
    const page3 = { items: [{ contentDetails: { videoId: 'c' } }] }

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(page1), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(page2), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(page3), { status: 200 }))

    const ids = await drainTimers(fetchRecentVideoIds('PLtest', 'test-key'))
    expect(ids).toEqual(['a', 'b', 'c'])
  })
})
