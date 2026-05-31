import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { YouTubeChannelRow } from '@/lib/youtube/types'

vi.mock('@/lib/youtube/api-client', () => ({
  fetchRecentVideoIds: vi.fn(),
  fetchVideoDetails: vi.fn(),
  fetchChannelStats: vi.fn(),
  lookupChannelByHandle: vi.fn(),
  YouTubeQuotaError: class YouTubeQuotaError extends Error {
    constructor() { super('quotaExceeded') }
  },
}))

vi.mock('@/lib/youtube/auto-categorize', () => ({
  autoCategorize: vi.fn(() => null),
}))

import { syncChannel } from '@/lib/youtube/sync'
import { fetchRecentVideoIds, fetchVideoDetails, fetchChannelStats, lookupChannelByHandle } from '@/lib/youtube/api-client'
import { autoCategorize } from '@/lib/youtube/auto-categorize'

const mockFetchRecent = vi.mocked(fetchRecentVideoIds)
const mockFetchDetails = vi.mocked(fetchVideoDetails)
const mockFetchStats = vi.mocked(fetchChannelStats)
const mockLookup = vi.mocked(lookupChannelByHandle)
const mockAutoCategorize = vi.mocked(autoCategorize)

function makeChannel(overrides: Partial<YouTubeChannelRow> = {}): YouTubeChannelRow {
  return {
    id: 'ch-1',
    site_id: 'site-1',
    channel_id: 'UC_xyz',
    locale: 'pt',
    handle: '@canal',
    name: 'Meu Canal',
    description: null,
    uploads_playlist_id: 'UU_xyz',
    subscriber_count: 1000,
    video_count: 50,
    thumbnail_url: null,
    banner_url: null,
    custom_url: null,
    sync_enabled: true,
    sync_schedules: [],
    last_synced_at: null,
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

function mockSupabase() {
  const insertFn = vi.fn().mockReturnValue({ data: null, error: null })
  const upsertFn = vi.fn().mockReturnValue({ data: null, error: null, count: 1 })
  const updateFn = vi.fn()
  const selectFn = vi.fn()

  const supabase = {
    from: vi.fn((table: string) => {
      if (table === 'youtube_videos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
              gte: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
          upsert: upsertFn,
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }
      }
      if (table === 'youtube_categories') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }
      }
      if (table === 'youtube_channels') {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }
      }
      return { insert: insertFn, select: selectFn }
    }),
  }

  return { supabase: supabase as unknown as Parameters<typeof syncChannel>[0], upsertFn }
}

describe('syncChannel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns early with 0 inserts when no new videos found', async () => {
    const { supabase } = mockSupabase()
    const channel = makeChannel()

    mockFetchRecent.mockResolvedValue(['vid-1', 'vid-2'])
    mockFetchStats.mockResolvedValue({ subscriberCount: 1000, videoCount: 50, thumbnailUrl: null, bannerUrl: null })
    supabase.from = vi.fn((table: string) => {
      if (table === 'youtube_videos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [{ youtube_video_id: 'vid-1' }, { youtube_video_id: 'vid-2' }],
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'youtube_channels') {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }
      }
      return { select: vi.fn() }
    }) as typeof supabase.from

    const result = await syncChannel(supabase, channel, 'key', 'catchall')

    expect(result.videosFound).toBe(2)
    expect(result.videosInserted).toBe(0)
    expect(result.quotaUsed).toBe(2)
    expect(mockFetchDetails).not.toHaveBeenCalled()
    expect(mockFetchStats).toHaveBeenCalledWith('UC_xyz', 'key')
  })

  it('handles channel with 0 videos without crashing', async () => {
    const { supabase } = mockSupabase()
    const channel = makeChannel()

    mockFetchRecent.mockResolvedValue([])
    mockFetchStats.mockResolvedValue({ subscriberCount: 2, videoCount: 0, thumbnailUrl: null, bannerUrl: null })

    const result = await syncChannel(supabase, channel, 'key', 'manual')

    expect(result.videosFound).toBe(0)
    expect(result.videosInserted).toBe(0)
    expect(result.quotaUsed).toBe(2)
    expect(mockFetchDetails).not.toHaveBeenCalled()
    expect(mockFetchStats).toHaveBeenCalledWith('UC_xyz', 'key')
  })

  it('inserts new videos and updates channel stats', async () => {
    const { supabase, upsertFn } = mockSupabase()
    const channel = makeChannel()

    mockFetchRecent.mockResolvedValue(['vid-new'])
    mockFetchDetails.mockResolvedValue([{
      youtubeVideoId: 'vid-new',
      title: 'New Video',
      description: 'desc',
      publishedAt: '2026-05-01T00:00:00Z',
      tags: ['dev'],
      thumbnailUrl: 'https://img.youtube.com/vi/vid-new/mqdefault.jpg',
      thumbnailHqUrl: 'https://img.youtube.com/vi/vid-new/hqdefault.jpg',
      duration: '12:30',
      durationSeconds: 750,
      viewCount: 100,
      likeCount: 10,
      commentCount: 5,
    }])
    mockFetchStats.mockResolvedValue({ subscriberCount: 1200, videoCount: 51, thumbnailUrl: 'https://yt3.ggpht.com/new-thumb', bannerUrl: null })

    const result = await syncChannel(supabase, channel, 'key', 'catchall')

    expect(result.videosFound).toBe(1)
    expect(result.videosInserted).toBe(1)
    expect(result.quotaUsed).toBe(3)
    expect(upsertFn).toHaveBeenCalledWith(
      [expect.objectContaining({
        youtube_video_id: 'vid-new',
        title: 'New Video',
        site_id: 'site-1',
        channel_id: 'ch-1',
      })],
      { onConflict: 'site_id,youtube_video_id' },
    )
  })

  it('auto-categorizes with auto_approve populating category_id', async () => {
    const { supabase, upsertFn } = mockSupabase()
    const channel = makeChannel()

    mockFetchRecent.mockResolvedValue(['vid-cat'])
    mockFetchDetails.mockResolvedValue([{
      youtubeVideoId: 'vid-cat',
      title: 'Build in Public',
      description: '',
      publishedAt: '2026-05-01T00:00:00Z',
      tags: [],
      thumbnailUrl: null,
      thumbnailHqUrl: null,
      duration: '5:00',
      durationSeconds: 300,
      viewCount: 50,
      likeCount: 5,
      commentCount: 1,
    }])
    mockFetchStats.mockResolvedValue({ subscriberCount: 100, videoCount: 10, thumbnailUrl: null, bannerUrl: null })
    mockAutoCategorize.mockReturnValue({ categoryId: 'cat-bip', autoApprove: true })

    await syncChannel(supabase, channel, 'key', 'catchall')

    expect(upsertFn).toHaveBeenCalledWith(
      [expect.objectContaining({
        auto_suggested_category_id: 'cat-bip',
        category_id: 'cat-bip',
      })],
      { onConflict: 'site_id,youtube_video_id' },
    )
  })

  it('auto-categorize without auto_approve only sets suggestion', async () => {
    const { supabase, upsertFn } = mockSupabase()
    const channel = makeChannel()

    mockFetchRecent.mockResolvedValue(['vid-suggest'])
    mockFetchDetails.mockResolvedValue([{
      youtubeVideoId: 'vid-suggest',
      title: 'Debug Session',
      description: '',
      publishedAt: '2026-05-01T00:00:00Z',
      tags: [],
      thumbnailUrl: null,
      thumbnailHqUrl: null,
      duration: '10:00',
      durationSeconds: 600,
      viewCount: 30,
      likeCount: 3,
      commentCount: 0,
    }])
    mockFetchStats.mockResolvedValue({ subscriberCount: 100, videoCount: 10, thumbnailUrl: null, bannerUrl: null })
    mockAutoCategorize.mockReturnValue({ categoryId: 'cat-debug', autoApprove: false })

    await syncChannel(supabase, channel, 'key', 'catchall')

    expect(upsertFn).toHaveBeenCalledWith(
      [expect.objectContaining({
        auto_suggested_category_id: 'cat-debug',
        category_id: null,
      })],
      { onConflict: 'site_id,youtube_video_id' },
    )
  })

  it('metrics mode refreshes view/like/comment counts via batch upsert', async () => {
    const upsertFn = vi.fn().mockReturnValue({ error: null })

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'youtube_videos') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                gte: vi.fn().mockResolvedValue({
                  data: [{ youtube_video_id: 'vid-1' }, { youtube_video_id: 'vid-2' }],
                  error: null,
                }),
              }),
            }),
            upsert: upsertFn,
          }
        }
        return {}
      }),
    } as unknown as Parameters<typeof syncChannel>[0]

    mockFetchDetails.mockResolvedValue([
      { youtubeVideoId: 'vid-1', title: '', description: '', publishedAt: '', tags: [], thumbnailUrl: null, thumbnailHqUrl: null, duration: '', durationSeconds: 0, viewCount: 500, likeCount: 50, commentCount: 10 },
      { youtubeVideoId: 'vid-2', title: '', description: '', publishedAt: '', tags: [], thumbnailUrl: null, thumbnailHqUrl: null, duration: '', durationSeconds: 0, viewCount: 200, likeCount: 20, commentCount: 5 },
    ])

    const result = await syncChannel(supabase, makeChannel(), 'key', 'metrics')

    expect(result.videosUpdated).toBe(2)
    expect(result.quotaUsed).toBe(1)
    expect(upsertFn).toHaveBeenCalledTimes(1)
    expect(upsertFn).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ youtube_video_id: 'vid-1', view_count: 500, like_count: 50, comment_count: 10 }),
        expect.objectContaining({ youtube_video_id: 'vid-2', view_count: 200, like_count: 20, comment_count: 5 }),
      ]),
      { onConflict: 'site_id,youtube_video_id' },
    )
  })

  it('metrics mode returns early when no recent videos', async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      })),
    } as unknown as Parameters<typeof syncChannel>[0]

    const result = await syncChannel(supabase, makeChannel(), 'key', 'metrics')

    expect(result.videosUpdated).toBe(0)
    expect(result.quotaUsed).toBe(0)
    expect(mockFetchDetails).not.toHaveBeenCalled()
  })

  it('throws when existing videos query fails', async () => {
    const channel = makeChannel()

    mockFetchRecent.mockResolvedValue(['vid-1', 'vid-2'])

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'youtube_videos') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'connection timeout' },
                }),
              }),
            }),
          }
        }
        return {}
      }),
    } as unknown as Parameters<typeof syncChannel>[0]

    await expect(syncChannel(supabase, channel, 'key', 'catchall')).rejects.toThrow(
      'Failed to query existing videos: connection timeout',
    )
  })

  it('throws when categories query fails', async () => {
    const channel = makeChannel()

    mockFetchRecent.mockResolvedValue(['vid-new'])
    mockFetchDetails.mockResolvedValue([{
      youtubeVideoId: 'vid-new',
      title: 'Test',
      description: '',
      publishedAt: '2026-05-01T00:00:00Z',
      tags: [],
      thumbnailUrl: null,
      thumbnailHqUrl: null,
      duration: '5:00',
      durationSeconds: 300,
      viewCount: 10,
      likeCount: 1,
      commentCount: 0,
    }])

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'youtube_videos') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }
        }
        if (table === 'youtube_categories') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'relation does not exist' },
                }),
              }),
            }),
          }
        }
        return {}
      }),
    } as unknown as Parameters<typeof syncChannel>[0]

    await expect(syncChannel(supabase, channel, 'key', 'catchall')).rejects.toThrow(
      'Failed to query categories: relation does not exist',
    )
  })

  it('throws when batch upsert fails', async () => {
    const channel = makeChannel()

    mockFetchRecent.mockResolvedValue(['vid-new'])
    mockFetchDetails.mockResolvedValue([{
      youtubeVideoId: 'vid-new',
      title: 'Test',
      description: '',
      publishedAt: '2026-05-01T00:00:00Z',
      tags: [],
      thumbnailUrl: null,
      thumbnailHqUrl: null,
      duration: '5:00',
      durationSeconds: 300,
      viewCount: 10,
      likeCount: 1,
      commentCount: 0,
    }])
    mockAutoCategorize.mockReturnValue(null)

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'youtube_videos') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
            upsert: vi.fn().mockReturnValue({
              error: { message: 'constraint violation' },
              count: 0,
            }),
          }
        }
        if (table === 'youtube_categories') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }
        }
        return {}
      }),
    } as unknown as Parameters<typeof syncChannel>[0]

    await expect(syncChannel(supabase, channel, 'key', 'catchall')).rejects.toThrow(
      'Video upsert failed: constraint violation',
    )
  })

  it('throws when channel metadata update fails', async () => {
    const channel = makeChannel()

    mockFetchRecent.mockResolvedValue([])
    mockFetchStats.mockResolvedValue({ subscriberCount: 500, videoCount: 25, thumbnailUrl: null, bannerUrl: null })

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'youtube_channels') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'permission denied' },
              }),
            }),
          }
        }
        return {}
      }),
    } as unknown as Parameters<typeof syncChannel>[0]

    await expect(syncChannel(supabase, channel, 'key', 'manual')).rejects.toThrow(
      'Failed to update channel metadata: permission denied',
    )
  })

  it('handles channel with 0 videos and updates metadata', async () => {
    const channelUpdateEq = vi.fn().mockResolvedValue({ data: null, error: null })
    const channelUpdateFn = vi.fn().mockReturnValue({ eq: channelUpdateEq })

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'youtube_channels') {
          return { update: channelUpdateFn }
        }
        return {}
      }),
    } as unknown as Parameters<typeof syncChannel>[0]

    const channel = makeChannel()
    mockFetchRecent.mockResolvedValue([])
    mockFetchStats.mockResolvedValue({ subscriberCount: 2, videoCount: 0, thumbnailUrl: 'https://yt3.ggpht.com/thumb', bannerUrl: 'https://yt3.ggpht.com/banner' })

    const result = await syncChannel(supabase, channel, 'key', 'catchall')

    expect(result.videosFound).toBe(0)
    expect(result.videosInserted).toBe(0)
    expect(mockFetchStats).toHaveBeenCalledWith('UC_xyz', 'key')
    expect(channelUpdateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriber_count: 2,
        video_count: 0,
        thumbnail_url: 'https://yt3.ggpht.com/thumb',
        banner_url: 'https://yt3.ggpht.com/banner',
      }),
    )
  })

  it('omits thumbnail_url and banner_url from update when API returns null', async () => {
    const channelUpdateEq = vi.fn().mockResolvedValue({ data: null, error: null })
    const channelUpdateFn = vi.fn().mockReturnValue({ eq: channelUpdateEq })

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'youtube_channels') {
          return { update: channelUpdateFn }
        }
        return {}
      }),
    } as unknown as Parameters<typeof syncChannel>[0]

    const channel = makeChannel({ thumbnail_url: 'https://old.jpg', banner_url: 'https://old-banner.jpg' })
    mockFetchRecent.mockResolvedValue([])
    mockFetchStats.mockResolvedValue({ subscriberCount: 5, videoCount: 1, thumbnailUrl: null, bannerUrl: null })

    await syncChannel(supabase, channel, 'key', 'catchall')

    const payload = channelUpdateFn.mock.calls[0][0]
    expect(payload).toHaveProperty('subscriber_count', 5)
    expect(payload).toHaveProperty('video_count', 1)
    expect(payload).not.toHaveProperty('thumbnail_url')
    expect(payload).not.toHaveProperty('banner_url')
  })

  it('metrics mode throws on video update error', async () => {
    const upsertFn = vi.fn().mockReturnValue({ error: { message: 'disk full' } })

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'youtube_videos') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                gte: vi.fn().mockResolvedValue({
                  data: [
                    { youtube_video_id: 'vid-1' },
                    { youtube_video_id: 'vid-2' },
                  ],
                  error: null,
                }),
              }),
            }),
            upsert: upsertFn,
          }
        }
        return {}
      }),
    } as unknown as Parameters<typeof syncChannel>[0]

    mockFetchDetails.mockResolvedValue([
      { youtubeVideoId: 'vid-1', title: '', description: '', publishedAt: '', tags: [], thumbnailUrl: null, thumbnailHqUrl: null, duration: '', durationSeconds: 0, viewCount: 100, likeCount: 10, commentCount: 1 },
      { youtubeVideoId: 'vid-2', title: '', description: '', publishedAt: '', tags: [], thumbnailUrl: null, thumbnailHqUrl: null, duration: '', durationSeconds: 0, viewCount: 200, likeCount: 20, commentCount: 2 },
    ])

    await expect(syncChannel(supabase, makeChannel(), 'key', 'metrics')).rejects.toThrow(
      'Failed to update video metrics: disk full',
    )
  })

  it('self-heals on 404 by re-looking up channel by handle', async () => {
    const channelUpdateFn = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    })

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'youtube_channels') {
          return { update: channelUpdateFn }
        }
        return {}
      }),
    } as unknown as Parameters<typeof syncChannel>[0]

    const channel = makeChannel({ channel_id: 'UC_old_bad_id', uploads_playlist_id: 'UU_old_bad_id' })

    mockFetchRecent
      .mockRejectedValueOnce(new Error('YouTube API 404'))
      .mockResolvedValueOnce([])

    mockLookup.mockResolvedValue({
      channelId: 'UC_correct_id',
      handle: '@canal',
      name: 'Meu Canal',
      description: null,
      uploadsPlaylistId: 'UU_correct_id',
      subscriberCount: 100,
      videoCount: 5,
      thumbnailUrl: 'https://yt3.ggpht.com/new-thumb',
      bannerUrl: null,
      customUrl: '@canal',
    })
    mockFetchStats.mockResolvedValue({ subscriberCount: 100, videoCount: 5, thumbnailUrl: 'https://yt3.ggpht.com/new-thumb', bannerUrl: null })

    const result = await syncChannel(supabase, channel, 'key', 'catchall')

    expect(mockLookup).toHaveBeenCalledWith('@canal', 'key')
    expect(channelUpdateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        channel_id: 'UC_correct_id',
        uploads_playlist_id: 'UU_correct_id',
        thumbnail_url: 'https://yt3.ggpht.com/new-thumb',
      }),
    )
    expect(mockFetchRecent).toHaveBeenCalledTimes(2)
    expect(mockFetchRecent).toHaveBeenLastCalledWith('UU_correct_id', 'key')
    expect(result.quotaUsed).toBeGreaterThan(0)
  })

  it('throws descriptive error when 404 and handle lookup finds nothing', async () => {
    const supabase = { from: vi.fn() } as unknown as Parameters<typeof syncChannel>[0]
    const channel = makeChannel({ handle: '@nonexistent' })

    mockFetchRecent.mockRejectedValueOnce(new Error('YouTube API 404'))
    mockLookup.mockResolvedValue(null)

    await expect(syncChannel(supabase, channel, 'key', 'catchall')).rejects.toThrow(
      'Channel not found on YouTube: @nonexistent',
    )
  })
})
