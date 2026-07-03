import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockDeleteVideo = vi.fn()
const mockListVideos = vi.fn()
const mockSchedule = vi.fn()

vi.mock('./client.js', () => ({
  deleteVideo: (...a: unknown[]) => mockDeleteVideo(...a),
  listVideos: (...a: unknown[]) => mockListVideos(...a),
  createUploadSession: vi.fn(),
  updateVideoMetadata: vi.fn(),
  setThumbnail: vi.fn(),
  setPrivacyStatus: vi.fn(),
  getVideo: vi.fn(),
}))

vi.mock('./scheduler.js', () => ({
  scheduleYouTubePublish: (...a: unknown[]) => mockSchedule(...a),
  isShort: vi.fn(),
}))

import * as youtube from './index.js'
import { YouTubeProvider } from './index.js'
import type { SocialConnection, SocialDelivery, SocialPost } from '../../core/types.js'

const decrypt = (enc: string) => enc.replace('enc-', '')

function makeConnection(over?: Partial<SocialConnection>): SocialConnection {
  return {
    id: 'conn-1',
    site_id: 'site-1',
    provider: 'youtube',
    account_id: 'CHANNEL1',
    account_name: 'Channel',
    access_token_enc: 'enc-yt-token',
    refresh_token_enc: 'enc-refresh-token',
    page_token_enc: null,
    token_expires_at: null,
    scopes: [],
    metadata: { client_id: 'cid', client_secret: 'csecret' },
    connected_at: '2026-01-01T00:00:00Z',
    revoked_at: null,
    updated_at: '2026-01-01T00:00:00Z',
    ...over,
  }
}

const fetchMock = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('YouTubeProvider.publish', () => {
  it('delegates to the scheduler', async () => {
    mockSchedule.mockResolvedValue({ id: 'VID1', url: 'https://youtube.com/watch?v=VID1' })
    const provider = new YouTubeProvider(decrypt)
    const post = {} as SocialPost
    const delivery = {} as SocialDelivery
    const conn = makeConnection()

    const result = await provider.publish(post, conn, delivery)
    expect(result.id).toBe('VID1')
    expect(mockSchedule).toHaveBeenCalledWith(post, conn, delivery, decrypt)
  })
})

describe('YouTubeProvider.deletePost', () => {
  it('deletes the video with the decrypted access token', async () => {
    mockDeleteVideo.mockResolvedValue(undefined)
    const provider = new YouTubeProvider(decrypt)
    await provider.deletePost('VID1', makeConnection())
    expect(mockDeleteVideo).toHaveBeenCalledWith({ accessToken: 'yt-token' }, 'VID1')
  })
})

describe('YouTubeProvider.validateConnection', () => {
  it('returns true when listVideos succeeds', async () => {
    mockListVideos.mockResolvedValue([])
    const provider = new YouTubeProvider(decrypt)
    await expect(provider.validateConnection(makeConnection())).resolves.toBe(true)
    expect(mockListVideos).toHaveBeenCalledWith({ accessToken: 'yt-token' }, 'CHANNEL1', 1)
  })

  it('returns false when listVideos throws', async () => {
    mockListVideos.mockRejectedValue(new Error('401'))
    const provider = new YouTubeProvider(decrypt)
    await expect(provider.validateConnection(makeConnection())).resolves.toBe(false)
  })
})

describe('YouTubeProvider.refreshToken', () => {
  it('returns null when there is no stored refresh token', async () => {
    const provider = new YouTubeProvider(decrypt)
    await expect(provider.refreshToken(makeConnection({ refresh_token_enc: null }))).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns null when client credentials cannot be resolved', async () => {
    const prevId = process.env['GOOGLE_CLIENT_ID']
    const prevSecret = process.env['GOOGLE_CLIENT_SECRET']
    delete process.env['GOOGLE_CLIENT_ID']
    delete process.env['GOOGLE_CLIENT_SECRET']
    try {
      const provider = new YouTubeProvider(decrypt)
      await expect(provider.refreshToken(makeConnection({ metadata: {} }))).resolves.toBeNull()
      expect(fetchMock).not.toHaveBeenCalled()
    } finally {
      if (prevId !== undefined) process.env['GOOGLE_CLIENT_ID'] = prevId
      if (prevSecret !== undefined) process.env['GOOGLE_CLIENT_SECRET'] = prevSecret
    }
  })

  it('exchanges the refresh token and returns a new access token with expiry', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'fresh', expires_in: 3600, token_type: 'Bearer' }),
    } as unknown as Response)

    const provider = new YouTubeProvider(decrypt)
    const before = Date.now()
    const result = await provider.refreshToken(makeConnection())

    expect(result?.access_token).toBe('fresh')
    expect(result?.expires_at?.getTime()).toBeGreaterThan(before)

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://oauth2.googleapis.com/token')
    const sentBody = (init.body as URLSearchParams).toString()
    expect(sentBody).toContain('grant_type=refresh_token')
    expect(sentBody).toContain('refresh_token=refresh-token')
    expect(sentBody).toContain('client_id=cid')
  })

  it('returns null when the token endpoint responds non-ok', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400 } as unknown as Response)
    const provider = new YouTubeProvider(decrypt)
    await expect(provider.refreshToken(makeConnection())).resolves.toBeNull()
  })
})

describe('youtube barrel exports', () => {
  it('re-exports the client + scheduler surface', () => {
    for (const name of [
      'createUploadSession',
      'updateVideoMetadata',
      'setThumbnail',
      'setPrivacyStatus',
      'getVideo',
      'deleteVideo',
      'listVideos',
      'isShort',
    ] as const) {
      expect(typeof (youtube as Record<string, unknown>)[name]).toBe('function')
    }
    expect(typeof youtube.YouTubeProvider).toBe('function')
  })
})
