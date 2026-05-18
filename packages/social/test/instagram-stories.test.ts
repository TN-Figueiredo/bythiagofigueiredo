import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the instagram module
vi.mock('../src/providers/meta/instagram.js', () => ({
  publishInstagramMedia: vi.fn().mockResolvedValue({ id: 'ig-media-123' }),
  deleteInstagramMedia: vi.fn().mockResolvedValue(undefined),
}))

import { InstagramProvider } from '../src/providers/meta/index.js'
import { publishInstagramMedia } from '../src/providers/meta/instagram.js'
import type { SocialPost, SocialConnection, SocialDelivery } from '../src/core/types.js'

function makePost(overrides?: Partial<SocialPost>): SocialPost {
  return {
    id: 'post-1',
    site_id: 'site-1',
    created_by: 'user-1',
    type: 'image',
    status: 'publishing',
    scheduled_at: null,
    user_timezone: 'America/Sao_Paulo',
    published_at: null,
    content: {
      title: 'Test Post',
      media_urls: ['https://blob.vercel.com/stories/test-story.png'],
    },
    template_id: null,
    idempotency_key: 'key-1',
    created_at: '2026-05-17T00:00:00Z',
    updated_at: '2026-05-17T00:00:00Z',
    ...overrides,
  }
}

function makeConnection(): SocialConnection {
  return {
    id: 'conn-1',
    site_id: 'site-1',
    provider: 'instagram',
    account_id: 'ig-user-123',
    account_name: 'testaccount',
    access_token_enc: 'enc-token',
    refresh_token_enc: null,
    page_token_enc: 'enc-page-token',
    token_expires_at: null,
    scopes: [],
    metadata: { ig_user_id: '17841400000000' },
    connected_at: '2026-05-17T00:00:00Z',
    revoked_at: null,
    updated_at: '2026-05-17T00:00:00Z',
  }
}

function makeDelivery(overrides?: Partial<SocialDelivery>): SocialDelivery {
  return {
    id: 'del-1',
    post_id: 'post-1',
    connection_id: 'conn-1',
    provider: 'instagram',
    status: 'pending',
    platform_post_id: null,
    platform_url: null,
    content_override: null,
    attempt: 0,
    max_attempts: 3,
    last_error: null,
    error_type: null,
    published_at: null,
    created_at: '2026-05-17T00:00:00Z',
    ...overrides,
  }
}

describe('InstagramProvider', () => {
  let provider: InstagramProvider

  beforeEach(() => {
    vi.clearAllMocks()
    provider = new InstagramProvider((enc: string) => enc.replace('enc-', ''))
  })

  it('publishes a story with media_type=STORIES when delivery format is story', async () => {
    const post = makePost()
    const conn = makeConnection()
    const delivery = makeDelivery({ format: 'story' })

    await provider.publish(post, conn, delivery)

    expect(publishInstagramMedia).toHaveBeenCalledWith(
      '17841400000000',
      'page-token',
      expect.objectContaining({
        media_type: 'STORIES',
        image_url: 'https://blob.vercel.com/stories/test-story.png',
      }),
    )
  })

  it('publishes a regular image post when delivery format is not story', async () => {
    const post = makePost()
    const conn = makeConnection()
    const delivery = makeDelivery({ format: 'image_post' })

    await provider.publish(post, conn, delivery)

    expect(publishInstagramMedia).toHaveBeenCalledWith(
      '17841400000000',
      'page-token',
      expect.objectContaining({
        image_url: 'https://blob.vercel.com/stories/test-story.png',
      }),
    )
    // media_type should be undefined for regular image posts
    const call = vi.mocked(publishInstagramMedia).mock.calls[0]!
    expect(call[2].media_type).toBeUndefined()
  })

  it('publishes a reel when media is video regardless of format', async () => {
    const post = makePost({
      content: {
        title: 'Video Post',
        media_urls: ['https://blob.vercel.com/videos/reel.mp4'],
      },
    })
    const conn = makeConnection()
    const delivery = makeDelivery({ format: 'reel' })

    await provider.publish(post, conn, delivery)

    expect(publishInstagramMedia).toHaveBeenCalledWith(
      '17841400000000',
      'page-token',
      expect.objectContaining({
        video_url: 'https://blob.vercel.com/videos/reel.mp4',
        media_type: 'REELS',
      }),
    )
  })

  it('defaults to STORIES for story format even with unknown file extension', async () => {
    const post = makePost({
      content: {
        title: 'Story Post',
        media_urls: ['https://blob.vercel.com/stories/generated-image'],
      },
    })
    const conn = makeConnection()
    const delivery = makeDelivery({ format: 'story' })

    await provider.publish(post, conn, delivery)

    expect(publishInstagramMedia).toHaveBeenCalledWith(
      '17841400000000',
      'page-token',
      expect.objectContaining({
        media_type: 'STORIES',
        image_url: 'https://blob.vercel.com/stories/generated-image',
      }),
    )
  })
})
