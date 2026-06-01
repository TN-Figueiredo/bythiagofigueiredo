import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

import { syncCompetitorChannel } from '@/lib/youtube/competitor-sync'

describe('syncCompetitorChannel', () => {
  it('throws when channel API fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 })
    await expect(
      syncCompetitorChannel({ id: 'cc-1', channel_id: 'UC_test', site_id: 'site-1' }, 'api-key'),
    ).rejects.toThrow('YouTube API 500 for channel UC_test')
  })

  it('detects title change on existing video', async () => {
    const insertCalls: Record<string, unknown>[] = []
    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'competitor_channels') {
          return { update: () => ({ eq: () => Promise.resolve({}) }) }
        }
        if (table === 'competitor_videos') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: {
                      id: 'v-1',
                      title: 'Old Title',
                      description_hash: '97864e878fe129a3',
                      thumbnail_url: 'http://old.jpg',
                      view_count: 100,
                    },
                  }),
              }),
            }),
            insert: vi.fn((data: Record<string, unknown>) => {
              insertCalls.push(data)
              return Promise.resolve({})
            }),
            update: () => ({ eq: () => Promise.resolve({}) }),
          }
        }
        if (table === 'competitor_changes') {
          return {
            insert: vi.fn((data: Record<string, unknown>) => {
              insertCalls.push({ table: 'changes', ...data })
              return Promise.resolve({})
            }),
          }
        }
        return { update: () => ({ eq: () => Promise.resolve({}) }) }
      }),
    }

    const { getSupabaseServiceClient } = await import('@/lib/supabase/service')
    ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase)

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            items: [
              {
                contentDetails: { relatedPlaylists: { uploads: 'UU_test' } },
                snippet: { title: 'Channel' },
                statistics: { subscriberCount: '1000' },
              },
            ],
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            items: [{ snippet: { resourceId: { videoId: 'vid-1' } } }],
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            items: [
              {
                id: 'vid-1',
                snippet: {
                  title: 'New Title',
                  description: 'desc',
                  thumbnails: { high: { url: 'http://old.jpg' } },
                  publishedAt: '2026-01-01T00:00:00Z',
                },
                statistics: { viewCount: '200' },
              },
            ],
          }),
      })

    const result = await syncCompetitorChannel({ id: 'cc-1', channel_id: 'UC_test', site_id: 'site-1' }, 'key')
    expect(result.videosChecked).toBe(1)
    expect(result.changesDetected).toBe(1)
    expect(insertCalls.some((c) => c.table === 'changes' && c.change_type === 'title')).toBe(true)
  })

  it('inserts new video when not in database', async () => {
    const insertCalls: Record<string, unknown>[] = []
    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'competitor_channels') {
          return { update: () => ({ eq: () => Promise.resolve({}) }) }
        }
        if (table === 'competitor_videos') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: null }),
              }),
            }),
            insert: vi.fn((data: Record<string, unknown>) => {
              insertCalls.push({ table: 'videos', ...data })
              return Promise.resolve({})
            }),
            update: () => ({ eq: () => Promise.resolve({}) }),
          }
        }
        if (table === 'competitor_changes') {
          return {
            insert: vi.fn((data: Record<string, unknown>) => {
              insertCalls.push({ table: 'changes', ...data })
              return Promise.resolve({})
            }),
          }
        }
        return { update: () => ({ eq: () => Promise.resolve({}) }) }
      }),
    }

    const { getSupabaseServiceClient } = await import('@/lib/supabase/service')
    ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase)

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            items: [
              {
                contentDetails: { relatedPlaylists: { uploads: 'UU_test' } },
                snippet: { title: 'Channel' },
                statistics: { subscriberCount: '500' },
              },
            ],
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            items: [{ snippet: { resourceId: { videoId: 'vid-new' } } }],
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            items: [
              {
                id: 'vid-new',
                snippet: {
                  title: 'Brand New Video',
                  description: 'new desc',
                  thumbnails: { high: { url: 'http://thumb.jpg' } },
                  publishedAt: '2026-05-01T00:00:00Z',
                },
                statistics: { viewCount: '42' },
              },
            ],
          }),
      })

    const result = await syncCompetitorChannel({ id: 'cc-1', channel_id: 'UC_test', site_id: 'site-1' }, 'key')
    expect(result.videosChecked).toBe(1)
    expect(result.changesDetected).toBe(0)
    const videoInsert = insertCalls.find((c) => c.table === 'videos')
    expect(videoInsert).toBeDefined()
    expect(videoInsert!.video_id).toBe('vid-new')
    expect(videoInsert!.title).toBe('Brand New Video')
    expect(videoInsert!.competitor_channel_id).toBe('cc-1')
    expect(videoInsert!.published_at).toBe('2026-05-01T00:00:00Z')
    // No changes should be recorded for a new video
    expect(insertCalls.filter((c) => c.table === 'changes')).toHaveLength(0)
  })

  it('detects thumbnail change', async () => {
    const insertCalls: Record<string, unknown>[] = []
    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'competitor_channels') {
          return { update: () => ({ eq: () => Promise.resolve({}) }) }
        }
        if (table === 'competitor_videos') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: {
                      id: 'v-1',
                      title: 'Same Title',
                      description_hash: 'abc123',
                      thumbnail_url: 'http://old.jpg',
                      view_count: 100,
                    },
                  }),
              }),
            }),
            insert: vi.fn((data: Record<string, unknown>) => {
              insertCalls.push({ table: 'videos', ...data })
              return Promise.resolve({})
            }),
            update: () => ({ eq: () => Promise.resolve({}) }),
          }
        }
        if (table === 'competitor_changes') {
          return {
            insert: vi.fn((data: Record<string, unknown>) => {
              insertCalls.push({ table: 'changes', ...data })
              return Promise.resolve({})
            }),
          }
        }
        return { update: () => ({ eq: () => Promise.resolve({}) }) }
      }),
    }

    const { getSupabaseServiceClient } = await import('@/lib/supabase/service')
    ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase)

    // Need description to produce hash 'abc123' — we just use a description whose hash starts with abc123
    // Actually, we just need the hash to MATCH so no description change is detected.
    // The implementation hashes with sha256 and takes first 16 chars, so we mock fetch to return
    // a description that produces the same hash as what's stored.
    // Simpler approach: set the stored hash to match what the implementation will compute.
    const crypto = await import('crypto')
    const desc = 'same description'
    const expectedHash = crypto.createHash('sha256').update(desc).digest('hex').slice(0, 16)

    // Re-mock supabase with correct hash
    const mockSupabase2 = {
      from: vi.fn((table: string) => {
        if (table === 'competitor_channels') {
          return { update: () => ({ eq: () => Promise.resolve({}) }) }
        }
        if (table === 'competitor_videos') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: {
                      id: 'v-1',
                      title: 'Same Title',
                      description_hash: expectedHash,
                      thumbnail_url: 'http://old.jpg',
                      view_count: 100,
                    },
                  }),
              }),
            }),
            insert: vi.fn((data: Record<string, unknown>) => {
              insertCalls.push({ table: 'videos', ...data })
              return Promise.resolve({})
            }),
            update: () => ({ eq: () => Promise.resolve({}) }),
          }
        }
        if (table === 'competitor_changes') {
          return {
            insert: vi.fn((data: Record<string, unknown>) => {
              insertCalls.push({ table: 'changes', ...data })
              return Promise.resolve({})
            }),
          }
        }
        return { update: () => ({ eq: () => Promise.resolve({}) }) }
      }),
    }
    ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase2)

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            items: [
              {
                contentDetails: { relatedPlaylists: { uploads: 'UU_test' } },
                snippet: { title: 'Channel' },
                statistics: { subscriberCount: '1000' },
              },
            ],
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            items: [{ snippet: { resourceId: { videoId: 'vid-1' } } }],
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            items: [
              {
                id: 'vid-1',
                snippet: {
                  title: 'Same Title',
                  description: desc,
                  thumbnails: { high: { url: 'http://new.jpg' } },
                  publishedAt: '2026-01-01T00:00:00Z',
                },
                statistics: { viewCount: '200' },
              },
            ],
          }),
      })

    const result = await syncCompetitorChannel({ id: 'cc-1', channel_id: 'UC_test', site_id: 'site-1' }, 'key')
    expect(result.videosChecked).toBe(1)
    expect(result.changesDetected).toBe(1)
    const thumbChange = insertCalls.find((c) => c.table === 'changes' && c.change_type === 'thumbnail')
    expect(thumbChange).toBeDefined()
    expect(thumbChange!.old_thumbnail_url).toBe('http://old.jpg')
    expect(thumbChange!.new_thumbnail_url).toBe('http://new.jpg')
  })

  it('detects multiple changes on same video (title + thumbnail)', async () => {
    const insertCalls: Record<string, unknown>[] = []

    const crypto = await import('crypto')
    const desc = 'unchanged desc'
    const matchingHash = crypto.createHash('sha256').update(desc).digest('hex').slice(0, 16)

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'competitor_channels') {
          return { update: () => ({ eq: () => Promise.resolve({}) }) }
        }
        if (table === 'competitor_videos') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: {
                      id: 'v-1',
                      title: 'Old Title',
                      description_hash: matchingHash,
                      thumbnail_url: 'http://old-thumb.jpg',
                      view_count: 50,
                    },
                  }),
              }),
            }),
            insert: vi.fn((data: Record<string, unknown>) => {
              insertCalls.push({ table: 'videos', ...data })
              return Promise.resolve({})
            }),
            update: () => ({ eq: () => Promise.resolve({}) }),
          }
        }
        if (table === 'competitor_changes') {
          return {
            insert: vi.fn((data: Record<string, unknown>) => {
              insertCalls.push({ table: 'changes', ...data })
              return Promise.resolve({})
            }),
          }
        }
        return { update: () => ({ eq: () => Promise.resolve({}) }) }
      }),
    }

    const { getSupabaseServiceClient } = await import('@/lib/supabase/service')
    ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase)

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            items: [
              {
                contentDetails: { relatedPlaylists: { uploads: 'UU_test' } },
                snippet: { title: 'Channel' },
                statistics: { subscriberCount: '2000' },
              },
            ],
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            items: [{ snippet: { resourceId: { videoId: 'vid-1' } } }],
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            items: [
              {
                id: 'vid-1',
                snippet: {
                  title: 'New Title',
                  description: desc,
                  thumbnails: { high: { url: 'http://new-thumb.jpg' } },
                  publishedAt: '2026-01-01T00:00:00Z',
                },
                statistics: { viewCount: '300' },
              },
            ],
          }),
      })

    const result = await syncCompetitorChannel({ id: 'cc-1', channel_id: 'UC_test', site_id: 'site-1' }, 'key')
    expect(result.videosChecked).toBe(1)
    expect(result.changesDetected).toBe(2)
    const changes = insertCalls.filter((c) => c.table === 'changes')
    expect(changes).toHaveLength(2)
    expect(changes.some((c) => c.change_type === 'title')).toBe(true)
    expect(changes.some((c) => c.change_type === 'thumbnail')).toBe(true)
  })

  it('throws when channel API returns non-OK (403)', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403 })
    await expect(
      syncCompetitorChannel({ id: 'cc-1', channel_id: 'UC_test', site_id: 'site-1' }, 'api-key'),
    ).rejects.toThrow('YouTube API 403 for channel UC_test')
  })

  it('handles empty video list gracefully', async () => {
    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'competitor_channels') {
          return { update: () => ({ eq: () => Promise.resolve({}) }) }
        }
        return { update: () => ({ eq: () => Promise.resolve({}) }) }
      }),
    }

    const { getSupabaseServiceClient } = await import('@/lib/supabase/service')
    ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase)

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            items: [
              {
                contentDetails: { relatedPlaylists: { uploads: 'UU_test' } },
                snippet: { title: 'Channel' },
                statistics: { subscriberCount: '100' },
              },
            ],
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            items: [],
          }),
      })

    const result = await syncCompetitorChannel({ id: 'cc-1', channel_id: 'UC_test', site_id: 'site-1' }, 'key')
    expect(result).toEqual({ videosChecked: 0, changesDetected: 0 })
  })
})
