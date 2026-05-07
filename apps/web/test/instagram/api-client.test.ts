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
