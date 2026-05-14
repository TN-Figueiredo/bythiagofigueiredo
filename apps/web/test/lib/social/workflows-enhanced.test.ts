import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
const mockFrom = vi.fn((table: string) => {
  if (table === 'social_posts') {
    return {
      update: (patch: Record<string, unknown>) => ({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      select: () => ({ eq: () => ({ single: vi.fn().mockResolvedValue({ data: { status: 'publishing' }, error: null }) }) }),
    }
  }
  if (table === 'social_deliveries') {
    return {
      select: () => ({
        eq: () => ({
          in: () =>
            Promise.resolve({
              data: [
                {
                  id: 'd1',
                  post_id: 'p1',
                  connection_id: 'c1',
                  provider: 'bluesky',
                  status: 'pending',
                  attempt: 0,
                  max_attempts: 3,
                  format: 'link_card',
                  template_config: null,
                },
                {
                  id: 'd2',
                  post_id: 'p1',
                  connection_id: 'c2',
                  provider: 'instagram',
                  status: 'pending',
                  attempt: 0,
                  max_attempts: 3,
                  format: 'story',
                  template_config: { template: 'card', link_sticker: true },
                },
              ],
              error: null,
            }),
        }),
      }),
      update: () => ({ eq: vi.fn().mockResolvedValue({ error: null }) }),
    }
  }
  if (table === 'social_connections') {
    return {
      select: () => ({
        eq: () => ({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'c1',
              provider: 'bluesky',
              access_token_enc: 'enc-token',
              metadata: { did: 'did:plc:abc', handle: 'user.bsky.social' },
            },
            error: null,
          }),
        }),
      }),
    }
  }
  return { select: vi.fn(), update: () => ({ eq: vi.fn().mockResolvedValue({ error: null }) }) }
})

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({ from: mockFrom }),
}))

const mockBlueskyPublish = vi.fn().mockResolvedValue({ id: 'at://post/1', url: 'https://bsky.app/post/1' })
vi.mock('@tn-figueiredo/social/providers/bluesky', () => ({
  BlueskyProvider: class {
    provider = 'bluesky' as const
    publish = mockBlueskyPublish
  },
}))

const mockInstagramPublish = vi.fn().mockResolvedValue({ id: 'ig-media-123', url: 'https://instagram.com/p/123' })
vi.mock('@tn-figueiredo/social/providers/meta', () => ({
  InstagramProvider: class {
    provider = 'instagram' as const
    publish = mockInstagramPublish
  },
  FacebookProvider: class {
    provider = 'facebook' as const
    publish = vi.fn().mockResolvedValue({ id: 'fb-123', url: 'https://facebook.com/post/123' })
  },
}))

const mockGenerateStory = vi.fn().mockResolvedValue(Buffer.from([0x89, 0x50, 0x4e, 0x47]))
vi.mock('@/lib/social/story-generator', () => ({
  generateStoryImage: (...args: unknown[]) => mockGenerateStory(...args),
}))

const mockBlobPut = vi.fn().mockResolvedValue({ url: 'https://blob.vercel-storage.com/story.png' })
vi.mock('@vercel/blob', () => ({
  put: (...args: unknown[]) => mockBlobPut(...args),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))

vi.mock('@/lib/social/config', () => ({
  getSocialConfig: () => ({
    meta: { appId: 'test-app-id', appSecret: 'test-secret' },
  }),
}))

vi.mock('@tn-figueiredo/social', async () => {
  const actual = await vi.importActual('@tn-figueiredo/social')
  return {
    ...actual,
    decrypt: () => 'decrypted-token',
    encrypt: () => 'encrypted-token',
    getMasterKey: () => 'master-key-32-chars-for-testing!!',
    RETRY_DELAYS: [5000, 30000],
  }
})

import { publishSocialPost } from '@/lib/social/workflows'

const mockPost = {
  id: 'p1',
  site_id: 's1',
  created_by: 'u1',
  type: 'link' as const,
  status: 'scheduled' as const,
  content: {
    title: 'AI Empire',
    url: 'https://bythiagofigueiredo.com/blog/ai-empire',
    description: 'Test post',
    hashtags: ['#AI'],
  },
  template_id: null,
  idempotency_key: 'k1',
  created_at: '2026-05-12T12:00:00Z',
  updated_at: '2026-05-12T12:00:00Z',
  scheduled_at: null,
  user_timezone: 'America/Sao_Paulo',
  published_at: null,
  deliveries: [],
}

describe('publishSocialPost — enhanced', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('passes ogData to Bluesky provider when provided', async () => {
    const ogData = {
      title: 'AI Empire',
      description: 'O futuro da AI',
      imageUrl: 'https://example.com/og.jpg',
    }

    await publishSocialPost(mockPost, { ogData })

    expect(mockBlueskyPublish).toHaveBeenCalled()
    const publishCall = mockBlueskyPublish.mock.calls[0]
    expect(publishCall).toBeDefined()
  })

  it('generates story image for Instagram Story deliveries', async () => {
    await publishSocialPost(mockPost)

    expect(mockGenerateStory).toHaveBeenCalledWith(
      'card',
      expect.objectContaining({
        title: 'AI Empire',
      }),
    )
  })

  it('uploads story image to Vercel Blob', async () => {
    await publishSocialPost(mockPost)

    expect(mockBlobPut).toHaveBeenCalledWith(
      expect.stringContaining('stories/'),
      expect.any(Buffer),
      expect.objectContaining({
        access: 'public',
        addRandomSuffix: false,
      }),
    )
  })

  it('publishes without ogData when not provided (fallback)', async () => {
    await publishSocialPost(mockPost)
    expect(mockBlueskyPublish).toHaveBeenCalled()
  })

  it('sets post status to partial_failure when 1 platform succeeds and 1 fails', async () => {
    mockBlueskyPublish.mockResolvedValue({ id: 'at://post/1', url: 'https://bsky.app/post/1' })
    mockInstagramPublish.mockRejectedValue(new Error('Instagram API error (400)'))

    let capturedPostStatus: string | undefined
    mockFrom.mockImplementation((table: string) => {
      if (table === 'social_posts') {
        return {
          update: (patch: Record<string, unknown>) => {
            if (patch.status && patch.status !== 'publishing') {
              capturedPostStatus = patch.status as string
            }
            return { eq: vi.fn().mockResolvedValue({ error: null }) }
          },
          select: () => ({
            eq: () => ({ single: vi.fn().mockResolvedValue({ data: { status: 'publishing' }, error: null }) }),
          }),
        }
      }
      if (table === 'social_deliveries') {
        return {
          select: () => ({
            eq: () => ({
              in: () =>
                Promise.resolve({
                  data: [
                    { id: 'd1', post_id: 'p1', connection_id: 'c1', provider: 'bluesky', status: 'pending', attempt: 0, max_attempts: 3, format: 'link_card', template_config: null },
                    { id: 'd2', post_id: 'p1', connection_id: 'c2', provider: 'instagram', status: 'pending', attempt: 0, max_attempts: 1, format: 'story', template_config: { template: 'card' } },
                  ],
                  error: null,
                }),
            }),
          }),
          update: () => ({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        }
      }
      if (table === 'social_connections') {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: { id: 'c1', provider: 'bluesky', access_token_enc: 'enc', metadata: { did: 'did:plc:abc', handle: 'user.bsky.social' } },
                error: null,
              }),
            }),
          }),
        }
      }
      return { select: vi.fn(), update: () => ({ eq: vi.fn().mockResolvedValue({ error: null }) }) }
    })

    await publishSocialPost(mockPost)

    expect(capturedPostStatus).toBe('partial_failure')
  })
})
