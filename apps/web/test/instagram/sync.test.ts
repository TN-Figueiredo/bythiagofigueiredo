// @vitest-environment node
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

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { syncInstagramAccount, checkImageCacheHealth } from '@/lib/instagram/sync'
import { fetchInstagramMedia, type InstagramMediaItem } from '@/lib/instagram/api-client'
import { put } from '@vercel/blob'
import * as Sentry from '@sentry/nextjs'

const mockFetchMedia = vi.mocked(fetchInstagramMedia)
const mockBlobPut = vi.mocked(put)

function makeAccount(overrides: Partial<InstagramAccountRow> = {}): InstagramAccountRow {
  return {
    id: 'acc-1', site_id: 'site-1', locale: 'pt', handle: '@test',
    ig_user_id: 'ig-user-1', access_token: 'tok-abc',
    token_expires_at: '2026-07-01T00:00:00Z', sync_enabled: true,
    display_slots: 6, layout_type: 'grid',
    section_title_pt: null, section_title_en: null,
    section_subtitle_pt: null, section_subtitle_en: null,
    last_synced_at: null, created_at: '', updated_at: '',
    ig_user_id_source: 'legacy', ...overrides,
  }
}

function mockSupabase() {
  let existingRows: Array<{ ig_media_id: string; cached_image_url: string | null }> = []
  const upsertFn = vi.fn().mockReturnValue({ data: null, error: null, count: null })
  const updateEqFn = vi.fn().mockReturnValue({ data: null, error: null })
  const updateFn = vi.fn().mockReturnValue({ eq: updateEqFn })
  const selectFn = vi.fn()
  const supabase = {
    from: vi.fn((table: string) => {
      if (table === 'instagram_posts') {
        return {
          select: selectFn.mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockImplementation(() => Promise.resolve({ data: existingRows, error: null })),
            }),
          }),
          upsert: upsertFn,
        }
      }
      if (table === 'instagram_accounts') { return { update: updateFn } }
      return { insert: vi.fn().mockReturnValue({ data: null, error: null }) }
    }),
  }
  return {
    supabase, upsertFn, updateFn, updateEqFn,
    setExisting: (rows: Array<{ ig_media_id: string; cached_image_url: string | null }>) => {
      existingRows = rows
    },
  }
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
      // Deviation (documented in the block report): id changed from 'media-1'
      // to a numeric-only string — C2's MEDIA_ID_RE gate rejects any id that
      // isn't purely digits (real Instagram media ids always are), and the
      // plan's "sete testes de A" list didn't anticipate this pre-A fixture.
      id: '10000000000001', media_type: 'IMAGE',
      media_url: 'https://scontent.cdninstagram.com/img.jpg',
      caption: 'Post 1', permalink: 'https://instagram.com/p/1/',
      like_count: 10, comments_count: 2, timestamp: '2026-05-01T12:00:00+0000',
    }])
    const { supabase, upsertFn } = mockSupabase()
    // Deviation from the plan's Step 1 list (documented in the block report):
    // this test predates commit A and was not in the plan's "sete testes"
    // enumeration, but accessToken is now mandatory — omitting it here would
    // make syncInstagramAccount throw immediately instead of running.
    const result = await syncInstagramAccount(supabase as never, makeAccount(), 'tok')
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
    const result = await syncInstagramAccount(supabase as never, makeAccount(), 'tok')
    expect(result.postsUpdated).toBe(1)
    expect(mockBlobPut).not.toHaveBeenCalled()
    expect(result.mediaCached).toBe(0)
  })

  it('reports a human message when the account has no token', async () => {
    const { supabase } = mockSupabase()
    await expect(
      syncInstagramAccount(supabase as never, makeAccount({ access_token: null })),
    ).rejects.toThrow("This account isn't connected — use Connect with Instagram")
  })

  it('reports a human message when the account has no ig_user_id', async () => {
    const { supabase } = mockSupabase()
    await expect(
      syncInstagramAccount(supabase as never, makeAccount({ ig_user_id: null })),
    ).rejects.toThrow("This account isn't connected — use Connect with Instagram")
  })

  it('caches thumbnail_url for VIDEO posts', async () => {
    mockFetchMedia.mockResolvedValueOnce([{
      // Deviation (documented in the block report): id changed from 'vid-1'
      // to numeric-only — see the note on the first test in this file.
      id: '20000000000001', media_type: 'VIDEO',
      media_url: 'https://video.cdninstagram.com/vid.mp4',
      thumbnail_url: 'https://scontent.cdninstagram.com/thumb.jpg',
      caption: 'Video', permalink: 'https://instagram.com/p/vid/',
      like_count: 5, comments_count: 1, timestamp: '2026-05-02T12:00:00+0000',
    }])
    const { supabase } = mockSupabase()
    const result = await syncInstagramAccount(supabase as never, makeAccount(), 'tok')
    expect(result.mediaCached).toBe(1)
    expect(mockBlobPut.mock.calls[0]![0]).toContain('20000000000001')
  })

  it('performs a single batch upsert for all posts', async () => {
    mockFetchMedia.mockResolvedValueOnce([
      { id: 'm1', media_type: 'IMAGE', media_url: 'u1', caption: 'c1', permalink: 'p1', like_count: 1, comments_count: 0, timestamp: '2026-05-01T00:00:00+0000' },
      { id: 'm2', media_type: 'IMAGE', media_url: 'u2', caption: 'c2', permalink: 'p2', like_count: 2, comments_count: 0, timestamp: '2026-05-02T00:00:00+0000' },
      { id: 'm3', media_type: 'IMAGE', media_url: 'u3', caption: 'c3', permalink: 'p3', like_count: 3, comments_count: 0, timestamp: '2026-05-03T00:00:00+0000' },
    ])
    const { supabase, upsertFn } = mockSupabase()
    await syncInstagramAccount(supabase as never, makeAccount(), 'tok')
    expect(upsertFn).toHaveBeenCalledTimes(1)
    const upsertedRows = upsertFn.mock.calls[0]![0]
    expect(upsertedRows).toHaveLength(3)
  })

  it('prefers the explicit accessToken over the row value', async () => {
    mockFetchMedia.mockResolvedValueOnce([])
    const { supabase } = mockSupabase()
    await syncInstagramAccount(supabase as never, makeAccount(), 'explicit-token')
    expect(mockFetchMedia).toHaveBeenCalledWith('ig-user-1', 'explicit-token')
  })

  it('reports partial: false and mediaFailed: 0 on a clean run', async () => {
    mockFetchMedia.mockResolvedValueOnce([{
      // Deviation (documented in the block report): numeric-only id.
      id: '10000000000002', media_type: 'IMAGE',
      media_url: 'https://scontent.cdninstagram.com/img.jpg',
      caption: null, permalink: 'https://instagram.com/p/1/',
      like_count: 0, comments_count: 0, timestamp: '2026-05-01T12:00:00+0000',
    }])
    const { supabase } = mockSupabase()
    const result = await syncInstagramAccount(supabase as never, makeAccount(), 'tok')
    expect(result.partial).toBe(false)
    expect(result.mediaFailed).toBe(0)
  })

  it('passes an AbortSignal to every image download', async () => {
    mockFetchMedia.mockResolvedValueOnce([{
      // Deviation (documented in the block report): numeric-only id.
      id: '10000000000003', media_type: 'IMAGE',
      media_url: 'https://scontent.cdninstagram.com/img.jpg',
      caption: null, permalink: 'https://instagram.com/p/1/',
      like_count: 0, comments_count: 0, timestamp: '2026-05-01T12:00:00+0000',
    }])
    const { supabase } = mockSupabase()
    await syncInstagramAccount(supabase as never, makeAccount(), 'tok')
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const init = mockFetch.mock.calls[0]![1] as { signal: AbortSignal }
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('starts no batch after the deadline and reports partial with mediaFailed', async () => {
    mockFetchMedia.mockResolvedValueOnce([
      { id: 'm1', media_type: 'IMAGE', media_url: 'https://scontent.cdninstagram.com/1.jpg', caption: null, permalink: 'p1', like_count: 0, comments_count: 0, timestamp: '2026-05-01T00:00:00+0000' },
      { id: 'm2', media_type: 'IMAGE', media_url: 'https://scontent.cdninstagram.com/2.jpg', caption: null, permalink: 'p2', like_count: 0, comments_count: 0, timestamp: '2026-05-02T00:00:00+0000' },
    ])
    const { supabase } = mockSupabase()
    const result = await syncInstagramAccount(
      supabase as never, makeAccount(), 'tok', { deadlineAt: Date.now() - 1 },
    )
    expect(mockFetch).not.toHaveBeenCalled()
    expect(mockBlobPut).not.toHaveBeenCalled()
    expect(result.partial).toBe(true)
    expect(result.mediaCached).toBe(0)
    expect(result.mediaFailed).toBe(2)
    expect(result.postsFound).toBe(2)
  })

  it('aborts a hung download and closes the batch on the remaining deadline', async () => {
    // Prova que o prazo limita o LOTE, não só o intervalo entre lotes: o fetch
    // nunca resolve e só termina pelo próprio AbortSignal.timeout.
    mockFetch.mockImplementation((_url: string, init?: { signal?: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('TimeoutError')))
      }),
    )
    mockFetchMedia.mockResolvedValueOnce([{
      // Deviation (documented in the block report): numeric-only id.
      id: '10000000000004', media_type: 'IMAGE', media_url: 'https://scontent.cdninstagram.com/1.jpg',
      caption: null, permalink: 'p1', like_count: 0, comments_count: 0,
      timestamp: '2026-05-01T00:00:00+0000',
    }])
    const { supabase } = mockSupabase()
    const result = await syncInstagramAccount(
      supabase as never, makeAccount(), 'tok', { deadlineAt: Date.now() + 1_000 },
    )
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockBlobPut).not.toHaveBeenCalled()
    expect(result.partial).toBe(true)
    expect(result.mediaFailed).toBe(1)
  }, 10_000)

  it('throws when the posts upsert fails', async () => {
    mockFetchMedia.mockResolvedValueOnce([{
      id: 'm1', media_type: 'IMAGE', media_url: 'https://scontent.cdninstagram.com/1.jpg',
      caption: null, permalink: 'p1', like_count: 0, comments_count: 0,
      timestamp: '2026-05-01T00:00:00+0000',
    }])
    const { supabase, upsertFn, updateFn } = mockSupabase()
    upsertFn.mockReturnValue({ data: null, error: { message: 'duplicate key value', code: '23505' }, count: null })
    await expect(syncInstagramAccount(supabase as never, makeAccount(), 'tok'))
      .rejects.toThrow('duplicate key value')
    // (iv): last_synced_at só em upsert sem erro.
    expect(updateFn).not.toHaveBeenCalled()
  })

  it('keeps the postgres code on the thrown upsert error', async () => {
    mockFetchMedia.mockResolvedValueOnce([{
      id: 'm1', media_type: 'IMAGE', media_url: 'https://scontent.cdninstagram.com/1.jpg',
      caption: null, permalink: 'p1', like_count: 0, comments_count: 0,
      timestamp: '2026-05-01T00:00:00+0000',
    }])
    const { supabase, upsertFn } = mockSupabase()
    upsertFn.mockReturnValue({ data: null, error: { message: 'duplicate key value', code: '23505' }, count: null })
    await expect(syncInstagramAccount(supabase as never, makeAccount(), 'tok'))
      .rejects.toMatchObject({ code: '23505' })
  })

  it('retries caching for an existing post whose cached image url is null', async () => {
    // Fix round 1: a post row can already exist (inserted on a prior run)
    // while its cached_image_url is still null — either the image cache
    // failed, or the run's deadline cut the caching pass short before this
    // item was reached. Keying the retry set on row *presence* alone would
    // never revisit it, so the feed keeps serving the Meta CDN URL forever
    // (and that URL expires). It must be retried.
    // Deviation (documented in the block report): numeric-only id ('media-1'
    // fails C2's MEDIA_ID_RE gate) — kept identical between the existing-row
    // fixture and the fetched item so the retry-by-null-cache path is real.
    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({
          data: [{ ig_media_id: '10000000000005', cached_image_url: null }], error: null,
        }),
      }),
    })
    mockFetchMedia.mockResolvedValueOnce([{
      id: '10000000000005', media_type: 'IMAGE',
      media_url: 'https://scontent.cdninstagram.com/img.jpg',
      caption: null, permalink: 'https://instagram.com/p/1/',
      like_count: 0, comments_count: 0, timestamp: '2026-05-01T12:00:00+0000',
    }])
    const { supabase, upsertFn } = mockSupabase()
    supabase.from = vi.fn((table: string) => {
      if (table === 'instagram_posts') { return { select: selectMock, upsert: upsertFn } }
      if (table === 'instagram_accounts') { return { update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ data: null, error: null }) }) } }
      return {} as never
    })
    const result = await syncInstagramAccount(supabase as never, makeAccount(), 'tok')
    expect(mockBlobPut).toHaveBeenCalledTimes(1)
    expect(result.mediaCached).toBe(1)
    expect(result.mediaFailed).toBe(0)
    const upsertedRows = upsertFn.mock.calls[0]![0] as Array<{ cached_image_url: string | null }>
    expect(upsertedRows[0]!.cached_image_url).toBe('https://blob.vercel-storage.com/cached.jpg')
  })
})

// ── C2 ───────────────────────────────────────────────────────────────────────

function mediaItem(over: Partial<InstagramMediaItem> = {}): InstagramMediaItem {
  return {
    id: '17890123456789',
    media_type: 'IMAGE',
    media_url: 'https://scontent.cdninstagram.com/a.jpg',
    thumbnail_url: null,
    caption: null,
    permalink: 'https://www.instagram.com/p/abc/',
    like_count: 0,
    comments_count: 0,
    timestamp: '2026-05-01T12:00:00+0000',
    ...over,
  }
}

function imageResponse(opts: { contentType?: string; contentLength?: string | null; bytes?: number } = {}) {
  const headers = new Headers()
  headers.set('content-type', opts.contentType ?? 'image/jpeg')
  if (opts.contentLength !== null) headers.set('content-length', opts.contentLength ?? '1000')
  return {
    ok: true,
    headers,
    arrayBuffer: async () => new ArrayBuffer(opts.bytes ?? 1000),
    body: null,
  }
}

describe('cacheImage — portão de forma do item.id (MUST, antes de qualquer put)', () => {
  beforeEach(() => { vi.clearAllMocks(); mockFetch.mockReset() })

  it.each(['../x', 'a1', '9'.repeat(33)])('id %s => nenhum fetch e nenhum put', async (badId) => {
    mockFetchMedia.mockResolvedValue([mediaItem({ id: badId })])
    await syncInstagramAccount(mockSupabase().supabase, makeAccount(), 'tok')
    expect(mockFetch).not.toHaveBeenCalled()
    expect(mockBlobPut).not.toHaveBeenCalled()
  })
})

describe('cacheImage — portão de destino de rede (SSRF de leitura)', () => {
  beforeEach(() => { vi.clearAllMocks(); mockFetch.mockReset() })

  it('media_url em 169.254.169.254 => nenhum fetch, nenhum put, mediaFailed++', async () => {
    mockFetchMedia.mockResolvedValue([
      mediaItem({ media_url: 'http://169.254.169.254/latest/meta-data/' }),
    ])
    const r = await syncInstagramAccount(mockSupabase().supabase, makeAccount(), 'tok')
    expect(mockFetch).not.toHaveBeenCalled()
    expect(mockBlobPut).not.toHaveBeenCalled()
    expect(r.mediaFailed).toBe(1)
  })

  it.each([
    'https://evil.com/a.jpg',
    'https://cdninstagram.com.evil.com/a.jpg',
    'http://scontent.cdninstagram.com/a.jpg',
  ])('host/protocolo fora da allow-list (%s) => null sem fetch', async (url) => {
    mockFetchMedia.mockResolvedValue([mediaItem({ media_url: url })])
    const r = await syncInstagramAccount(mockSupabase().supabase, makeAccount(), 'tok')
    expect(mockFetch).not.toHaveBeenCalled()
    expect(r.mediaCached).toBe(0)
  })

  it('thumbnail_url hostil num VIDEO cai na mesma recusa', async () => {
    mockFetchMedia.mockResolvedValue([
      mediaItem({ media_type: 'VIDEO', thumbnail_url: 'https://evil.com/t.jpg',
                  media_url: 'https://scontent.cdninstagram.com/v.mp4' }),
    ])
    await syncInstagramAccount(mockSupabase().supabase, makeAccount(), 'tok')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('URL legítima => fetch com redirect:"error"', async () => {
    mockFetchMedia.mockResolvedValue([mediaItem()])
    mockFetch.mockResolvedValue(imageResponse())
    await syncInstagramAccount(mockSupabase().supabase, makeAccount(), 'tok')
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect((mockFetch.mock.calls[0]![1] as RequestInit).redirect).toBe('error')
  })

  it('rejeição de redirect vira null (nenhum put)', async () => {
    mockFetchMedia.mockResolvedValue([mediaItem()])
    mockFetch.mockRejectedValue(new TypeError('unexpected redirect'))
    const r = await syncInstagramAccount(mockSupabase().supabase, makeAccount(), 'tok')
    expect(mockBlobPut).not.toHaveBeenCalled()
    expect(r.mediaFailed).toBe(1)
  })

  it('3 URLs recusadas no MESMO run => exatamente 1 captureMessage', async () => {
    mockFetchMedia.mockResolvedValue([
      mediaItem({ id: '1', media_url: 'https://evil.com/1.jpg' }),
      mediaItem({ id: '2', media_url: 'https://evil.com/2.jpg' }),
      mediaItem({ id: '3', media_url: 'https://evil.com/3.jpg' }),
    ])
    await syncInstagramAccount(mockSupabase().supabase, makeAccount(), 'tok')
    const calls = vi.mocked(Sentry.captureMessage).mock.calls
      .filter(([m]) => m === 'instagram media url rejected')
    expect(calls).toHaveLength(1)
  })
})

describe('cacheImage — teto de tamanho e content-type', () => {
  beforeEach(() => { vi.clearAllMocks(); mockFetch.mockReset() })

  it('content-length 20 MB => null SEM ler o corpo', async () => {
    mockFetchMedia.mockResolvedValue([mediaItem()])
    const res = imageResponse({ contentLength: '20000000' })
    const spy = vi.spyOn(res, 'arrayBuffer')
    mockFetch.mockResolvedValue(res)
    await syncInstagramAccount(mockSupabase().supabase, makeAccount(), 'tok')
    expect(spy).not.toHaveBeenCalled()
    expect(mockBlobPut).not.toHaveBeenCalled()
  })

  it('sem content-length e corpo acima de 10 MB => leitura abortada e null', async () => {
    mockFetchMedia.mockResolvedValue([mediaItem()])
    const cancel = vi.fn(() => Promise.resolve())
    let served = 0
    const headers = new Headers({ 'content-type': 'image/jpeg' })
    mockFetch.mockResolvedValue({
      ok: true,
      headers,
      body: {
        getReader: () => ({
          read: () => {
            served++
            return Promise.resolve({ done: false, value: new Uint8Array(6 * 1024 * 1024) })
          },
          cancel,
        }),
      },
      arrayBuffer: async () => new ArrayBuffer(0),
    })
    await syncInstagramAccount(mockSupabase().supabase, makeAccount(), 'tok')
    expect(cancel).toHaveBeenCalled()
    expect(served).toBeLessThanOrEqual(3)
    expect(mockBlobPut).not.toHaveBeenCalled()
  })

  it('content-type text/html => null (ext fora da allow-list)', async () => {
    mockFetchMedia.mockResolvedValue([mediaItem()])
    mockFetch.mockResolvedValue(imageResponse({ contentType: 'text/html' }))
    await syncInstagramAccount(mockSupabase().supabase, makeAccount(), 'tok')
    expect(mockBlobPut).not.toHaveBeenCalled()
  })

  it('content-type image/webp => put com contentType derivado do ext, nunca o header cru', async () => {
    mockFetchMedia.mockResolvedValue([mediaItem()])
    mockFetch.mockResolvedValue(imageResponse({ contentType: 'image/webp; charset=binary' }))
    await syncInstagramAccount(mockSupabase().supabase, makeAccount(), 'tok')
    expect(mockBlobPut).toHaveBeenCalledWith(
      'instagram/acc-1/17890123456789.webp',
      expect.anything(),
      expect.objectContaining({ contentType: 'image/webp', addRandomSuffix: false, access: 'public' }),
    )
  })
})

describe('C2 — contrato do sync', () => {
  beforeEach(() => { vi.clearAllMocks(); mockFetch.mockReset() })

  it('accessToken é obrigatório: o token vem do 3º argumento, nunca de account.access_token', async () => {
    mockFetchMedia.mockResolvedValue([])
    await syncInstagramAccount(
      mockSupabase().supabase,
      makeAccount({ access_token: 'v1:cifrado' }),
      'PLAIN-TOKEN',
    )
    expect(mockFetchMedia).toHaveBeenCalledWith('ig-user-1', 'PLAIN-TOKEN')
  })

  it('upsert usa onConflict composto account_id,ig_media_id', async () => {
    const { supabase, upsertFn } = mockSupabase()
    mockFetchMedia.mockResolvedValue([mediaItem()])
    mockFetch.mockResolvedValue(imageResponse())
    await syncInstagramAccount(supabase, makeAccount(), 'tok')
    expect(upsertFn).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ onConflict: 'account_id,ig_media_id' }),
    )
  })

  it('re-tentativa: post existente com cached_image_url NULL volta para newItems', async () => {
    const { supabase, setExisting } = mockSupabase()
    setExisting([{ ig_media_id: '17890123456789', cached_image_url: null }])
    mockFetchMedia.mockResolvedValue([mediaItem()])
    mockFetch.mockResolvedValue(imageResponse())
    const r = await syncInstagramAccount(supabase, makeAccount(), 'tok')
    expect(mockBlobPut).toHaveBeenCalledTimes(1)
    expect(r.mediaCached).toBe(1)
    // já existia => não conta como inserção
    expect(r.postsInserted).toBe(0)
  })

  it('post existente COM cached_image_url não é re-baixado', async () => {
    const { supabase, setExisting } = mockSupabase()
    setExisting([{ ig_media_id: '17890123456789', cached_image_url: 'https://blob/x.jpg' }])
    mockFetchMedia.mockResolvedValue([mediaItem()])
    const r = await syncInstagramAccount(supabase, makeAccount(), 'tok')
    expect(mockFetch).not.toHaveBeenCalled()
    expect(r.mediaFailed).toBe(0)
  })

  it("conta sem ig_user_id lança a frase humana, nunca 'No Instagram user ID'", async () => {
    await expect(
      syncInstagramAccount(mockSupabase().supabase, makeAccount({ ig_user_id: null }), 'tok'),
    ).rejects.toThrow("This account isn't connected — use Connect with Instagram")
  })
})

describe('checkImageCacheHealth — 3 execuções consecutivas com mediaFailed > 0', () => {
  function logSupabase(rows: Array<{ error_message: string | null }>) {
    const rpc = vi.fn(() => Promise.resolve({ data: true, error: null }))
    const limit = vi.fn(() => Promise.resolve({ data: rows, error: null }))
    const order = vi.fn(() => ({ limit }))
    const eqStatus = vi.fn(() => ({ order }))
    const inMode = vi.fn(() => ({ eq: eqStatus }))
    const eqAccount = vi.fn(() => ({ in: inMode }))
    const select = vi.fn(() => ({ eq: eqAccount }))
    return { from: vi.fn(() => ({ select })), rpc } as never
  }

  beforeEach(() => { vi.clearAllMocks() })

  it('as 3 linhas mais recentes com mediaFailed > 0 => 1 captureMessage/dia', async () => {
    await checkImageCacheHealth(
      logSupabase([
        { error_message: 'detail: x mediaFailed:2' },
        { error_message: ' mediaFailed:1' },
        { error_message: ' partial mediaFailed:3' },
      ]),
      'acc-1',
    )
    expect(vi.mocked(Sentry.captureMessage))
      .toHaveBeenCalledWith('instagram image cache persistently failing', 'warning')
  })

  it('a mais recente SEM mediaFailed => nenhum captureMessage', async () => {
    await checkImageCacheHealth(
      logSupabase([
        { error_message: null },
        { error_message: ' mediaFailed:1' },
        { error_message: ' mediaFailed:3' },
      ]),
      'acc-1',
    )
    expect(vi.mocked(Sentry.captureMessage)).not.toHaveBeenCalled()
  })

  it('menos de 3 linhas => nenhum captureMessage', async () => {
    await checkImageCacheHealth(logSupabase([{ error_message: ' mediaFailed:1' }]), 'acc-1')
    expect(vi.mocked(Sentry.captureMessage)).not.toHaveBeenCalled()
  })
})
