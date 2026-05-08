import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { InstagramAccountRow } from '@/lib/instagram/types'

vi.mock('@/lib/instagram/api-client', () => ({
  fetchInstagramMedia: vi.fn(),
  InstagramApiError: class InstagramApiError extends Error {
    code: number; type: string
    constructor(msg: string, code: number, type: string) { super(msg); this.code = code; this.type = type }
  },
}))

vi.mock('@vercel/blob', () => ({
  put: vi.fn().mockResolvedValue({ url: 'https://blob.vercel-storage.com/cached.jpg' }),
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { syncInstagramAccount } from '@/lib/instagram/sync'
import { fetchInstagramMedia } from '@/lib/instagram/api-client'
import { put } from '@vercel/blob'

const mockFetchMedia = vi.mocked(fetchInstagramMedia)
const mockBlobPut = vi.mocked(put)

function makeAccount(overrides: Partial<InstagramAccountRow> = {}): InstagramAccountRow {
  return {
    id: 'acc-1', site_id: 'site-1', locale: 'pt', handle: '@test',
    ig_user_id: 'ig-user-1', access_token: 'tok-abc',
    token_expires_at: '2026-07-01T00:00:00Z', sync_enabled: true,
    display_slots: 6, layout_type: 'grid', last_synced_at: null,
    created_at: '', updated_at: '', ...overrides,
  }
}

function mockSupabase() {
  const upsertFn = vi.fn().mockReturnValue({ data: null, error: null, count: null })
  const updateEqFn = vi.fn().mockReturnValue({ data: null, error: null })
  const updateFn = vi.fn().mockReturnValue({ eq: updateEqFn })
  const selectFn = vi.fn()
  const supabase = {
    from: vi.fn((table: string) => {
      if (table === 'instagram_posts') {
        return {
          select: selectFn.mockReturnValue({
            eq: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }),
          }),
          upsert: upsertFn,
        }
      }
      if (table === 'instagram_accounts') { return { update: updateFn } }
      return { insert: vi.fn().mockReturnValue({ data: null, error: null }) }
    }),
  }
  return { supabase, upsertFn, updateFn, updateEqFn }
}

describe('syncInstagramAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
      headers: new Headers({ 'content-type': 'image/jpeg' }),
    })
  })

  it('inserts new posts and caches media to Blob in batch', async () => {
    mockFetchMedia.mockResolvedValueOnce([{
      id: 'media-1', media_type: 'IMAGE',
      media_url: 'https://scontent.cdninstagram.com/img.jpg',
      caption: 'Post 1', permalink: 'https://instagram.com/p/1/',
      like_count: 10, comments_count: 2, timestamp: '2026-05-01T12:00:00+0000',
    }])
    const { supabase, upsertFn } = mockSupabase()
    const result = await syncInstagramAccount(supabase as never, makeAccount())
    expect(result.postsFound).toBe(1)
    expect(result.postsInserted).toBe(1)
    expect(upsertFn).toHaveBeenCalledTimes(1)
    expect(mockBlobPut).toHaveBeenCalledTimes(1)
    expect(result.mediaCached).toBe(1)
  })

  it('skips media cache for existing posts', async () => {
    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({
          data: [{ ig_media_id: 'media-1', cached_image_url: 'https://blob/existing.jpg' }], error: null,
        }),
      }),
    })
    mockFetchMedia.mockResolvedValueOnce([{
      id: 'media-1', media_type: 'IMAGE',
      media_url: 'https://scontent.cdninstagram.com/img.jpg',
      caption: 'Updated caption', permalink: 'https://instagram.com/p/1/',
      like_count: 20, comments_count: 5, timestamp: '2026-05-01T12:00:00+0000',
    }])
    const { supabase, upsertFn } = mockSupabase()
    supabase.from = vi.fn((table: string) => {
      if (table === 'instagram_posts') { return { select: selectMock, upsert: upsertFn } }
      if (table === 'instagram_accounts') { return { update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ data: null, error: null }) }) } }
      return {} as never
    })
    const result = await syncInstagramAccount(supabase as never, makeAccount())
    expect(result.postsUpdated).toBe(1)
    expect(mockBlobPut).not.toHaveBeenCalled()
    expect(result.mediaCached).toBe(0)
  })

  it('throws when account has no access token', async () => {
    const { supabase } = mockSupabase()
    await expect(syncInstagramAccount(supabase as never, makeAccount({ access_token: null }))).rejects.toThrow('No access token')
  })

  it('throws when account has no ig_user_id', async () => {
    const { supabase } = mockSupabase()
    await expect(syncInstagramAccount(supabase as never, makeAccount({ ig_user_id: null }))).rejects.toThrow('No Instagram user ID')
  })

  it('caches thumbnail_url for VIDEO posts', async () => {
    mockFetchMedia.mockResolvedValueOnce([{
      id: 'vid-1', media_type: 'VIDEO',
      media_url: 'https://video.cdninstagram.com/vid.mp4',
      thumbnail_url: 'https://scontent.cdninstagram.com/thumb.jpg',
      caption: 'Video', permalink: 'https://instagram.com/p/vid/',
      like_count: 5, comments_count: 1, timestamp: '2026-05-02T12:00:00+0000',
    }])
    const { supabase } = mockSupabase()
    const result = await syncInstagramAccount(supabase as never, makeAccount())
    expect(result.mediaCached).toBe(1)
    expect(mockBlobPut.mock.calls[0]![0]).toContain('vid-1')
  })

  it('performs a single batch upsert for all posts', async () => {
    mockFetchMedia.mockResolvedValueOnce([
      { id: 'm1', media_type: 'IMAGE', media_url: 'u1', caption: 'c1', permalink: 'p1', like_count: 1, comments_count: 0, timestamp: '2026-05-01T00:00:00+0000' },
      { id: 'm2', media_type: 'IMAGE', media_url: 'u2', caption: 'c2', permalink: 'p2', like_count: 2, comments_count: 0, timestamp: '2026-05-02T00:00:00+0000' },
      { id: 'm3', media_type: 'IMAGE', media_url: 'u3', caption: 'c3', permalink: 'p3', like_count: 3, comments_count: 0, timestamp: '2026-05-03T00:00:00+0000' },
    ])
    const { supabase, upsertFn } = mockSupabase()
    await syncInstagramAccount(supabase as never, makeAccount())
    expect(upsertFn).toHaveBeenCalledTimes(1)
    const upsertedRows = upsertFn.mock.calls[0]![0]
    expect(upsertedRows).toHaveLength(3)
  })
})
