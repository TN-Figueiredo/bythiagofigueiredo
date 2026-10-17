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

const sentryCalls = vi.hoisted(() => [] as Array<{ msg: string; ctx: unknown }>)
vi.mock('@sentry/nextjs', () => ({
  captureMessage: (msg: string, ctx: unknown) => { sentryCalls.push({ msg, ctx }); return '' },
  captureException: vi.fn(),
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

const RAW_VAZIO = { subscriberCountRaw: null, viewCountRaw: null, videoCountRaw: null, hidden: false } as const

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
    mockFetchStats.mockResolvedValue({ subscriberCount: 1000, videoCount: 50, thumbnailUrl: null, bannerUrl: null, ...RAW_VAZIO })
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
    mockFetchStats.mockResolvedValue({ subscriberCount: 2, videoCount: 0, thumbnailUrl: null, bannerUrl: null, ...RAW_VAZIO })

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
    mockFetchStats.mockResolvedValue({ subscriberCount: 1200, videoCount: 51, thumbnailUrl: 'https://yt3.ggpht.com/new-thumb', bannerUrl: null, ...RAW_VAZIO })

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
    mockFetchStats.mockResolvedValue({ subscriberCount: 100, videoCount: 10, thumbnailUrl: null, bannerUrl: null, ...RAW_VAZIO })
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
    mockFetchStats.mockResolvedValue({ subscriberCount: 100, videoCount: 10, thumbnailUrl: null, bannerUrl: null, ...RAW_VAZIO })
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
    mockFetchStats.mockResolvedValue({ subscriberCount: 500, videoCount: 25, thumbnailUrl: null, bannerUrl: null, ...RAW_VAZIO })

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
    mockFetchStats.mockResolvedValue({ subscriberCount: 2, videoCount: 0, thumbnailUrl: 'https://yt3.ggpht.com/thumb', bannerUrl: 'https://yt3.ggpht.com/banner', ...RAW_VAZIO })

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
    mockFetchStats.mockResolvedValue({ subscriberCount: 5, videoCount: 1, thumbnailUrl: null, bannerUrl: null, ...RAW_VAZIO })

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
    mockFetchStats.mockResolvedValue({ subscriberCount: 100, videoCount: 5, thumbnailUrl: 'https://yt3.ggpht.com/new-thumb', bannerUrl: null, ...RAW_VAZIO })

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


// A5 R9a: retrato público diário do canal próprio (yt_own_channel_snapshots)
describe('syncChannel: retrato do canal próprio (MG20)', () => {
  const TABELA = 'yt_own_channel_snapshots'
  beforeEach(() => { vi.clearAllMocks(); sentryCalls.length = 0; vi.useRealTimers(); diaCoberto = { count: 0, error: null } })

  let diaCoberto: unknown = { count: 0, error: null }
  function montar(retrato: () => unknown, estado: () => unknown = () => ({ data: 1, error: null })) {
    const retratoUpsert = vi.fn(retrato)
    const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = []
    const supabase = {
      rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
        rpcCalls.push({ fn, args })
        return fn === 'yt_own_channel_state_record' ? estado() : { data: 1, error: null }
      }),
      from: vi.fn((table: string) => {
        if (table === 'youtube_videos') {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [{ youtube_video_id: 'vid-1' }], error: null }) }) }) }
        }
        if (table === 'youtube_channels') {
          return { update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }) }
        }
        if (table === TABELA) return { upsert: retratoUpsert, select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue(diaCoberto) }) }) }
        return { select: vi.fn() }
      }),
    }
    const tentativas = (kind: string) => rpcCalls.filter(c => c.fn === 'yt_own_attempt_record' && c.args.p_kind === kind).map(c => c.args)
    return { supabase: supabase as unknown as Parameters<typeof syncChannel>[0], retratoUpsert, rpcCalls, tentativas }
  }
  const base = { subscriberCount: 0, videoCount: 5, thumbnailUrl: null, bannerUrl: null } as const
  const rodar = (sb: Parameters<typeof syncChannel>[0]) => { mockFetchRecent.mockResolvedValue(['vid-1']); return syncChannel(sb, makeChannel(), 'key', 'catchall') }

  it('stats sem número nenhum: nenhum upsert de retrato, mas tentativa com motivo, aviso e Sentry (G-1)', async () => {
    const { supabase, retratoUpsert, tentativas } = montar(() => ({ error: null }))
    mockFetchStats.mockResolvedValue({ ...base, ...RAW_VAZIO })
    const r = await rodar(supabase)
    expect(retratoUpsert).not.toHaveBeenCalled()
    expect(tentativas('retrato_canal')).toHaveLength(1)
    expect(tentativas('retrato_canal')[0]).toMatchObject({ p_outcome: 'sem_dado_na_janela', p_scope_type: 'canal', p_scope_id: 'ch-1', p_site_id: 'site-1' })
    expect(String(tentativas('retrato_canal')[0]!.p_error)).toContain('subscriberCount ausente')
    expect(r.avisos?.some(a => a.startsWith('retrato do canal não gravado'))).toBe(true)
    expect(sentryCalls).toHaveLength(1)
    expect(sentryCalls[0]!.ctx).toMatchObject({ level: 'error', fingerprint: ['sync-youtube', 'retrato-proprio'] })
  })

  it('leitura ruim num dia que JÁ tem retrato: tentativa ok, sem aviso e sem Sentry (portão I-3)', async () => {
    diaCoberto = { count: 1, error: null }
    const { supabase, tentativas } = montar(() => ({ error: null }))
    mockFetchStats.mockResolvedValue({ ...base, ...RAW_VAZIO })
    const r = await rodar(supabase)
    expect(tentativas('retrato_canal')).toHaveLength(1)
    expect(tentativas('retrato_canal')[0]).toMatchObject({ p_outcome: 'ok' })
    expect(r.avisos?.some(a => a.startsWith('retrato do canal'))).toBeFalsy()
    expect(sentryCalls).toHaveLength(0)
  })

  it('a conferência do dia falha: segue o caminho da falha (desconhecido não é ok)', async () => {
    diaCoberto = { count: null, error: { message: 'x' } }
    const { supabase, tentativas } = montar(() => ({ error: null }))
    mockFetchStats.mockResolvedValue({ ...base, ...RAW_VAZIO })
    await rodar(supabase)
    expect(tentativas('retrato_canal')[0]).toMatchObject({ p_outcome: 'sem_dado_na_janela' })
    expect(sentryCalls).toHaveLength(1)
  })

  it('a tentativa que não grava vira aviso (M-4 do portão)', async () => {
    const { supabase, rpcCalls } = montar(() => ({ error: null }))
    const orig = (supabase as unknown as { rpc: (fn: string, a: Record<string, unknown>) => Promise<unknown> }).rpc
    ;(supabase as unknown as { rpc: unknown }).rpc = vi.fn(async (fn: string, a: Record<string, unknown>) =>
      fn === 'yt_own_attempt_record' ? { data: null, error: { code: '42883', message: 'boom' } } : orig(fn, a))
    mockFetchStats.mockResolvedValue({ ...base, subscriberCountRaw: 10, viewCountRaw: 1, videoCountRaw: 5, hidden: false })
    const r = await rodar(supabase)
    expect(rpcCalls.length).toBeGreaterThanOrEqual(0)
    expect(r.avisos?.some(a => a.includes('não anotada'))).toBe(true)
  })

  it('stats só com views (subscriberCountRaw nulo, hidden false): nenhum upsert de retrato', async () => {
    const { supabase, retratoUpsert } = montar(() => ({ error: null }))
    mockFetchStats.mockResolvedValue({ ...base, subscriberCountRaw: null, viewCountRaw: 900, videoCountRaw: 5, hidden: false })
    await rodar(supabase)
    expect(retratoUpsert).not.toHaveBeenCalled()
    expect(sentryCalls).toHaveLength(1)
  })

  it('hidden true sem contagem: upsert com subscriber_count nulo e subscribers_hidden true', async () => {
    const { supabase, retratoUpsert } = montar(() => ({ error: null }))
    mockFetchStats.mockResolvedValue({ ...base, subscriberCountRaw: null, viewCountRaw: 10, videoCountRaw: 5, hidden: true })
    await rodar(supabase)
    expect(retratoUpsert).toHaveBeenCalledTimes(1)
    expect(retratoUpsert.mock.calls[0]![0]).toMatchObject({ youtube_channel_id: 'ch-1', subscriber_count: null, subscribers_hidden: true, view_count: 10, video_count: 5 })
  })

  it('upsert recebe onConflict youtube_channel_id,snapshot_date e ignoreDuplicates true', async () => {
    const { supabase, retratoUpsert } = montar(() => ({ error: null }))
    mockFetchStats.mockResolvedValue({ ...base, subscriberCountRaw: 1234, viewCountRaw: 99, videoCountRaw: 5, hidden: false })
    await rodar(supabase)
    expect(retratoUpsert.mock.calls[0]![0]).toMatchObject({ subscriber_count: 1234, subscribers_hidden: false, view_count: 99, video_count: 5 })
    expect(retratoUpsert.mock.calls[0]![1]).toEqual({ onConflict: 'youtube_channel_id,snapshot_date', ignoreDuplicates: true })
  })

  it('upsert do retrato devolve erro: Sentry e a sincronização termina ok', async () => {
    const { supabase, tentativas } = montar(() => ({ error: { message: 'relation does not exist', code: '42P01' } }))
    mockFetchStats.mockResolvedValue({ ...base, subscriberCountRaw: 10, viewCountRaw: 1, videoCountRaw: 5, hidden: false })
    const r = await rodar(supabase)
    expect(r.videosFound).toBe(1)
    expect(tentativas('retrato_canal')[0]).toMatchObject({ p_outcome: 'erro_http', p_error: '42P01' })
    expect(r.avisos).toContain('retrato do canal não gravado: 42P01')
    expect(sentryCalls).toHaveLength(1)
    expect(sentryCalls[0]!.msg).toBe('sync-youtube: retrato do canal próprio não gravado')
    expect(sentryCalls[0]!.ctx).toMatchObject({ level: 'error', fingerprint: ['sync-youtube', 'retrato-proprio'], extra: { channelId: 'ch-1', code: '42P01' } })
  })

  it('upsert do retrato LANÇA: Sentry e a sincronização termina ok', async () => {
    const { supabase } = montar(() => { throw new Error('rede caiu') })
    mockFetchStats.mockResolvedValue({ ...base, subscriberCountRaw: 10, viewCountRaw: 1, videoCountRaw: 5, hidden: false })
    const r = await rodar(supabase)
    expect(r.videosFound).toBe(1)
    expect(sentryCalls).toHaveLength(1)
    expect(sentryCalls[0]!.ctx).toMatchObject({ fingerprint: ['sync-youtube', 'retrato-proprio'], extra: { channelId: 'ch-1' } })
  })

  it('fake timers em 02:30 UTC: snapshot_date é o dia anterior (São Paulo)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-03-10T02:30:00Z'))
    try {
      const { supabase, retratoUpsert } = montar(() => ({ error: null }))
      mockFetchStats.mockResolvedValue({ ...base, subscriberCountRaw: 10, viewCountRaw: 1, videoCountRaw: 5, hidden: false })
      await rodar(supabase)
      expect(retratoUpsert.mock.calls[0]![0]).toMatchObject({ snapshot_date: '2026-03-09' })
    } finally { vi.useRealTimers() }
  })
})

// A5 X2: estado do canal próprio como série (yt_own_channel_state_record)
describe('syncChannel: estado do canal próprio (X2)', () => {
  beforeEach(() => { vi.clearAllMocks(); sentryCalls.length = 0 })
  function montar(estado: () => unknown) {
    const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = []
    const supabase = {
      rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
        rpcCalls.push({ fn, args })
        return fn === 'yt_own_channel_state_record' ? estado() : { data: 1, error: null }
      }),
      from: vi.fn((table: string) => {
        if (table === 'youtube_videos') return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [{ youtube_video_id: 'vid-1' }], error: null }) }) }) }
        if (table === 'youtube_channels') return { update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }) }
        if (table === 'yt_own_channel_snapshots') return { upsert: vi.fn(() => ({ error: null })) }
        return { select: vi.fn() }
      }),
    }
    const tent = () => rpcCalls.filter(c => c.fn === 'yt_own_attempt_record' && c.args.p_kind === 'estado_canal').map(c => c.args)
    return { supabase: supabase as unknown as Parameters<typeof syncChannel>[0], rpcCalls, tent }
  }
  const stats = { subscriberCount: 0, videoCount: 5, thumbnailUrl: null, bannerUrl: null, subscriberCountRaw: 10, viewCountRaw: 1, videoCountRaw: 5, hidden: false } as const
  const rodar = (sb: Parameters<typeof syncChannel>[0]) => { mockFetchRecent.mockResolvedValue(['vid-1']); return syncChannel(sb, makeChannel(), 'key', 'catchall') }

  it('estado presente: chama a função com o hash e o bruto, tentativa ok', async () => {
    const { supabase, rpcCalls, tent } = montar(() => ({ data: 1, error: null }))
    mockFetchStats.mockResolvedValue({ ...stats, estado: { sha: 'abc', raw: { status: { privacyStatus: 'public' } } }, estadoAusentes: [] })
    const r = await rodar(supabase)
    const c = rpcCalls.find(x => x.fn === 'yt_own_channel_state_record')!
    expect(c.args).toEqual({ p_rows: [{ channel_id: 'ch-1', site_id: 'site-1', state_sha256: 'abc', raw: { status: { privacyStatus: 'public' } } }] })
    expect(tent()[0]).toMatchObject({ p_outcome: 'ok' })
    expect(r.avisos ?? []).toEqual([])
  })

  it('parte ausente (estado nulo): nada é gravado, tentativa sem_dado_na_janela com o motivo e aviso, nunca ok', async () => {
    const { supabase, rpcCalls, tent } = montar(() => ({ data: 1, error: null }))
    mockFetchStats.mockResolvedValue({ ...stats, estado: null, estadoAusentes: ['status'] })
    const r = await rodar(supabase)
    expect(rpcCalls.some(x => x.fn === 'yt_own_channel_state_record')).toBe(false)
    expect(tent()[0]).toMatchObject({ p_outcome: 'sem_dado_na_janela' })
    expect(String(tent()[0]!.p_error)).toContain('status')
    expect(r.avisos?.some(a => a.includes('parte ausente (status)'))).toBe(true)
  })

  it('a função do banco falha: aviso, Sentry de erro e tentativa erro_http; a sincronização termina', async () => {
    const { supabase, tent } = montar(() => ({ data: null, error: { code: '42883', message: 'x' } }))
    mockFetchStats.mockResolvedValue({ ...stats, estado: { sha: 'abc', raw: {} }, estadoAusentes: [] })
    const r = await rodar(supabase)
    expect(r.videosFound).toBe(1)
    expect(tent()[0]).toMatchObject({ p_outcome: 'erro_http' })
    expect(sentryCalls.some(c => (c.ctx as { fingerprint?: string[] }).fingerprint?.[1] === 'estado-proprio')).toBe(true)
  })
})
