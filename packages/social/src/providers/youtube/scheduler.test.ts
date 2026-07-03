import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockUpdateVideoMetadata = vi.fn()
const mockSetPrivacyStatus = vi.fn()

vi.mock('./client.js', () => ({
  updateVideoMetadata: (...args: unknown[]) => mockUpdateVideoMetadata(...args),
  setPrivacyStatus: (...args: unknown[]) => mockSetPrivacyStatus(...args),
}))

import { isShort, scheduleYouTubePublish } from './scheduler.js'
import type { SocialConnection, SocialDelivery, SocialPost, SocialPostContent } from '../../core/types.js'

const decrypt = (enc: string) => enc.replace('enc-', '')

function makeConnection(): SocialConnection {
  return {
    id: 'conn-1',
    site_id: 'site-1',
    provider: 'youtube',
    account_id: 'CHANNEL1',
    account_name: 'Channel',
    access_token_enc: 'enc-yt-token',
    refresh_token_enc: null,
    page_token_enc: null,
    token_expires_at: null,
    scopes: [],
    metadata: {},
    connected_at: '2026-01-01T00:00:00Z',
    revoked_at: null,
    updated_at: '2026-01-01T00:00:00Z',
  }
}

function makePost(content: SocialPostContent): SocialPost {
  return {
    id: 'post-1',
    site_id: 'site-1',
    created_by: 'u',
    type: 'video',
    status: 'publishing',
    scheduled_at: null,
    user_timezone: 'America/Sao_Paulo',
    published_at: null,
    content,
    template_id: null,
    idempotency_key: 'k',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }
}

const delivery = {} as SocialDelivery

describe('isShort', () => {
  it('is true for a short, portrait clip (≤180s, height > width)', () => {
    expect(isShort({ duration: 45, width: 1080, height: 1920 })).toBe(true)
  })

  it('is false when longer than 180s', () => {
    expect(isShort({ duration: 200, width: 1080, height: 1920 })).toBe(false)
  })

  it('is false for landscape video', () => {
    expect(isShort({ duration: 30, width: 1920, height: 1080 })).toBe(false)
  })

  it('is false for a square video (height not greater than width)', () => {
    expect(isShort({ duration: 30, width: 1080, height: 1080 })).toBe(false)
  })

  it('is false when dimensions are unknown', () => {
    expect(isShort({ duration: 30 })).toBe(false)
  })

  it('is false when duration is missing', () => {
    expect(isShort({ width: 1080, height: 1920 })).toBe(false)
  })
})

describe('scheduleYouTubePublish', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdateVideoMetadata.mockResolvedValue({ id: 'v', url: 'u' })
    mockSetPrivacyStatus.mockResolvedValue(undefined)
  })

  it('throws when the post has no video_id', async () => {
    await expect(
      scheduleYouTubePublish(makePost({ title: 'x' }), makeConnection(), delivery, decrypt),
    ).rejects.toThrow(/requires video_id/)
  })

  it('updates metadata then flips privacy to public, returning the watch URL', async () => {
    const post = makePost({ video_id: 'VID9', title: 'T', description: 'D', hashtags: ['a'] })

    const result = await scheduleYouTubePublish(post, makeConnection(), delivery, decrypt)

    // uses the decrypted access token
    expect(mockUpdateVideoMetadata).toHaveBeenCalledWith(
      { accessToken: 'yt-token' },
      'VID9',
      { title: 'T', description: 'D', tags: ['a'] },
    )
    expect(mockSetPrivacyStatus).toHaveBeenCalledWith({ accessToken: 'yt-token' }, 'VID9', 'public')
    expect(result).toEqual({ id: 'VID9', url: 'https://youtube.com/watch?v=VID9' })
  })

  it('skips the metadata update when no title/description/hashtags are provided', async () => {
    const post = makePost({ video_id: 'VID1' })
    await scheduleYouTubePublish(post, makeConnection(), delivery, decrypt)
    expect(mockUpdateVideoMetadata).not.toHaveBeenCalled()
    expect(mockSetPrivacyStatus).toHaveBeenCalledOnce()
  })
})
