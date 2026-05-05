import { describe, it, expect, vi, beforeEach } from 'vitest'
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

  it('returns subscriber and video counts', async () => {
    const mockResponse = {
      items: [{
        statistics: { subscriberCount: '4200', videoCount: '48' },
      }],
    }
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    )

    const stats = await fetchChannelStats('UCtest', 'test-key')
    expect(stats).toEqual({ subscriberCount: 4200, videoCount: 48 })
  })
})
