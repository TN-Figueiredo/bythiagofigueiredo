import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import {
  fetchInstagramMedia,
  fetchInstagramProfile,
  refreshAccessToken,
  InstagramApiError,
} from '@/lib/instagram/api-client'

describe('fetchInstagramMedia', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns parsed media items on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{
          id: '17890123456789', media_type: 'IMAGE',
          media_url: 'https://scontent.cdninstagram.com/img.jpg',
          thumbnail_url: null, caption: 'Hello',
          permalink: 'https://www.instagram.com/p/abc123/',
          like_count: 42, comments_count: 5,
          timestamp: '2026-05-01T12:00:00+0000',
        }],
        paging: {},
      }),
    })
    const result = await fetchInstagramMedia('user-123', 'tok-abc')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('17890123456789')
    expect(result[0].like_count).toBe(42)
  })

  it('handles pagination (fetches next page)', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: '1', media_type: 'IMAGE', media_url: 'u', caption: null, permalink: 'p', like_count: 0, comments_count: 0, timestamp: '2026-01-01T00:00:00+0000' }],
          paging: { next: 'https://graph.instagram.com/next-page' },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: '2', media_type: 'VIDEO', media_url: 'u2', thumbnail_url: 'th', caption: 'cap', permalink: 'p2', like_count: 1, comments_count: 0, timestamp: '2026-01-02T00:00:00+0000' }],
          paging: {},
        }),
      })
    const result = await fetchInstagramMedia('user-123', 'tok', 100)
    expect(result).toHaveLength(2)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('throws InstagramApiError on API error response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false, status: 400,
      json: async () => ({ error: { message: 'Invalid OAuth access token', type: 'OAuthException', code: 190 } }),
    })
    await expect(fetchInstagramMedia('user-123', 'bad-tok')).rejects.toThrow(InstagramApiError)
  })

  it('throws on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))
    await expect(fetchInstagramMedia('user-123', 'tok')).rejects.toThrow()
  })
})

describe('fetchInstagramProfile', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns ig user id and username', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true, json: async () => ({ id: '17841400123456', username: 'testuser' }),
    })
    const result = await fetchInstagramProfile('tok-abc')
    expect(result.id).toBe('17841400123456')
    expect(result.username).toBe('testuser')
  })

  it('throws on invalid token', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false, status: 400,
      json: async () => ({ error: { message: 'Invalid token', type: 'OAuthException', code: 190 } }),
    })
    await expect(fetchInstagramProfile('bad-tok')).rejects.toThrow(InstagramApiError)
  })
})

describe('refreshAccessToken', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns new token and expiry on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true, json: async () => ({ access_token: 'new-tok', token_type: 'bearer', expires_in: 5184000 }),
    })
    const result = await refreshAccessToken('old-tok')
    expect(result.accessToken).toBe('new-tok')
    expect(result.expiresIn).toBe(5184000)
  })

  it('throws on revoked token', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false, status: 400,
      json: async () => ({ error: { message: 'Error validating access token', type: 'OAuthException', code: 190 } }),
    })
    await expect(refreshAccessToken('revoked-tok')).rejects.toThrow(InstagramApiError)
  })
})

// ── C2 ───────────────────────────────────────────────────────────────────────
import { GRAPH_API_BASE } from '@/lib/instagram/api-client'
import { probeToken } from '@/lib/instagram/token'

describe('C2 — versão e transporte', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('GRAPH_API_BASE é v25.0', () => {
    expect(GRAPH_API_BASE).toBe('https://graph.instagram.com/v25.0')
  })

  it('todo fetch leva AbortSignal.timeout(10_000)', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ data: [], paging: {} }) })
    await fetchInstagramMedia('123', 'tok')
    const init = mockFetch.mock.calls[0]![1] as RequestInit
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('InstagramApiError carrega httpStatus além de code/type', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false, status: 400,
      json: async () => ({ error: { message: 'Invalid OAuth access token', code: 190, type: 'OAuthException' } }),
    })
    await expect(fetchInstagramMedia('123', 'tok')).rejects.toMatchObject({
      code: 190, type: 'OAuthException', httpStatus: 400,
    })
  })

  it('paging.next fora de graph.instagram.com é IGNORADO (nenhum 2º fetch)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{ id: '1', media_type: 'IMAGE', media_url: null, thumbnail_url: null, caption: null,
                 permalink: 'p', like_count: 0, comments_count: 0, timestamp: 't' }],
        paging: { next: 'https://evil.com/steal?access_token=tok' },
      }),
    })
    const out = await fetchInstagramMedia('123', 'tok', 50)
    expect(out).toHaveLength(1)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('paging.next em graph.instagram.com é seguido', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({
        data: [{ id: '1', media_type: 'IMAGE', media_url: null, thumbnail_url: null, caption: null,
                 permalink: 'p', like_count: 0, comments_count: 0, timestamp: 't' }],
        paging: { next: 'https://graph.instagram.com/v25.0/123/media?after=x' },
      }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [], paging: {} }) })
    await fetchInstagramMedia('123', 'tok', 50)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })
})

describe('fetchInstagramProfile — 3 campos, duas formas', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('pede fields=id,user_id,username', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ id: '1', user_id: '2', username: 'a' }) })
    await fetchInstagramProfile('tok')
    expect(String(mockFetch.mock.calls[0]![0])).toContain('fields=id,user_id,username')
  })

  it('desembrulha a forma data-wrapped', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true, json: async () => ({ data: [{ id: '178', user_id: '17841', username: 'thiago.figueiredo' }] }),
    })
    expect(await fetchInstagramProfile('tok'))
      .toEqual({ id: '178', userId: '17841', username: 'thiago.figueiredo' })
  })

  it('desembrulha a forma plana', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true, json: async () => ({ id: '178', user_id: '17841', username: 'thiago.figueiredo' }),
    })
    expect(await fetchInstagramProfile('tok'))
      .toEqual({ id: '178', userId: '17841', username: 'thiago.figueiredo' })
  })

  it('sem id => id null; sem user_id => userId null', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ user_id: '17841', username: 'a' }) })
    expect(await fetchInstagramProfile('tok')).toEqual({ id: null, userId: '17841', username: 'a' })
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ id: '178', username: 'a' }) })
    expect(await fetchInstagramProfile('tok')).toEqual({ id: '178', userId: null, username: 'a' })
  })
})

describe('probeToken', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('chama /me?fields=id com timeout de 10 s', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: '1' }) })
    expect(await probeToken('tok')).toEqual({ ok: true })
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(String(url)).toContain('/me?fields=id')
    expect(String(url)).not.toContain('username')
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('4xx devolve { ok:false, error } com httpStatus e NÃO lança', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false, status: 400,
      json: async () => ({ error: { message: 'Invalid OAuth access token', code: 190, type: 'OAuthException' } }),
    })
    const out = await probeToken('tok')
    expect(out.ok).toBe(false)
    expect(out).toMatchObject({ error: expect.objectContaining({ code: 190, httpStatus: 400 }) })
  })

  it('5xx devolve { ok:false } e nunca lança', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) })
    await expect(probeToken('tok')).resolves.toMatchObject({ ok: false })
  })

  it('fetch lançando devolve { ok:false, error } em vez de propagar', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'))
    const out = await probeToken('tok')
    expect(out).toMatchObject({ ok: false, error: expect.any(TypeError) })
  })
})
