import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockResult } = vi.hoisted(() => ({
  mockResult: { data: [] as any[], error: null as any }
}))

const { mockSiteId } = vi.hoisted(() => ({ mockSiteId: { value: 's1' } }))

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            range: () => mockResult,
          }),
          // For status filter variants
          eq: () => ({
            order: () => ({
              range: () => mockResult,
            }),
          }),
        }),
      }),
    }),
  }),
}))

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  createServerClient: vi.fn().mockReturnValue({ auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1', email: 'test@test.com' } } }) } }),
  requireSiteScope: () => ({ ok: true, user: { id: 'u1' } }),
}))
vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: () => ({ siteId: mockSiteId.value }),
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))
vi.mock('next/server', () => ({ after: vi.fn() }))
vi.mock('@/lib/links/auto-link', () => ({
  ensureTrackedLink: vi.fn().mockResolvedValue(null),
}))
vi.mock('@/lib/links/short-url', () => ({
  buildShortUrl: (code: string) => `https://bythiagofigueiredo.com/go/${code}`,
}))
vi.mock('@tn-figueiredo/social', async () => {
  const zod = await import('zod')
  return {
    PROVIDERS: ['youtube', 'facebook', 'instagram', 'bluesky'],
    RETRY_DELAYS: [50, 100, 200],
    SocialPostContentSchema: zod.z.object({
      title: zod.z.string().optional(),
      description: zod.z.string().optional(),
      url: zod.z.string().url().optional(),
    }),
  }
})
vi.mock('@tn-figueiredo/social/vault', () => ({
  decrypt: vi.fn((v: string) => `dec-${v}`),
  getMasterKey: vi.fn(() => 'test-master-key'),
}))
vi.mock('@tn-figueiredo/links/qr', () => ({
  CardCompositionSchema: (async () => {
    const zod = await import('zod')
    return zod.z.object({})
  })(),
}))
vi.mock('../src/lib/social/workflows', () => ({
  publishSocialPost: vi.fn().mockResolvedValue(undefined),
}))

describe('listFeedPostsWithDeliveries', () => {
  beforeEach(() => {
    mockSiteId.value = 's1'
    mockResult.error = null
    mockResult.data = [
      {
        id: 'post-1', site_id: 's1', created_by: 'u1', type: 'text',
        status: 'completed', content: { title: 'Test Post' },
        idempotency_key: 'k1', created_at: '2026-01-01',
        updated_at: '2026-01-01', user_timezone: 'America/Sao_Paulo',
        social_deliveries: [
          { id: 'd1', provider: 'instagram', status: 'published', platform_post_id: 'ig-123', format: null },
          { id: 'd2', provider: 'facebook', status: 'failed', platform_post_id: null, format: 'link_share' },
        ],
      },
    ]
  })

  it('returns posts with deliveries', async () => {
    const { listFeedPostsWithDeliveries } = await import('@/lib/social/actions/posts')
    const result = await listFeedPostsWithDeliveries('s1')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data).toHaveLength(1)
    expect(result.data[0].post.id).toBe('post-1')
    expect(result.data[0].deliveries).toHaveLength(2)
    expect(result.data[0].deliveries[0].provider).toBe('instagram')
    expect(result.data[0].deliveries[0].status).toBe('published')
    expect(result.data[0].deliveries[1].provider).toBe('facebook')
    expect(result.data[0].deliveries[1].format).toBe('link_share')
  })

  it('returns empty array when no posts exist', async () => {
    mockResult.data = []
    const { listFeedPostsWithDeliveries } = await import('@/lib/social/actions/posts')
    const result = await listFeedPostsWithDeliveries('s1')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data).toHaveLength(0)
  })

  it('returns forbidden when site does not match', async () => {
    mockSiteId.value = 'other-site'
    const { listFeedPostsWithDeliveries } = await import('@/lib/social/actions/posts')
    const result = await listFeedPostsWithDeliveries('s1')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('forbidden')
  })

  it('returns error when DB query fails', async () => {
    mockResult.data = null as any
    mockResult.error = { message: 'connection refused' }
    const { listFeedPostsWithDeliveries } = await import('@/lib/social/actions/posts')
    const result = await listFeedPostsWithDeliveries('s1')
    expect(result.ok).toBe(false)
  })

  it('handles posts without deliveries', async () => {
    mockResult.data = [{
      id: 'post-2', site_id: 's1', created_by: 'u1', type: 'text',
      status: 'draft', content: {}, idempotency_key: 'k2',
      created_at: '2026-01-01', updated_at: '2026-01-01',
      user_timezone: 'America/Sao_Paulo',
      social_deliveries: [],
    }]
    const { listFeedPostsWithDeliveries } = await import('@/lib/social/actions/posts')
    const result = await listFeedPostsWithDeliveries('s1')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data[0].deliveries).toHaveLength(0)
  })
})
