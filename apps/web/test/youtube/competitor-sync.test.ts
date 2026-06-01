import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

import { syncCompetitorChannel } from '@/lib/youtube/competitor-sync'

describe('syncCompetitorChannel', () => {
  it('returns 0 when channel API fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false })
    const result = await syncCompetitorChannel(
      { id: 'cc-1', channel_id: 'UC_test', site_id: 'site-1' },
      'api-key',
    )
    expect(result).toEqual({ videosChecked: 0, changesDetected: 0 })
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
})
