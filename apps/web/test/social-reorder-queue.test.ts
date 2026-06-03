import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockPost, mockQueued, mockUpdates } = vi.hoisted(() => ({
  mockPost: { data: null as any, error: null as any },
  mockQueued: { data: [] as any[], error: null as any },
  mockUpdates: [] as Array<{ data: any; id: string }>,
}))

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: () => ({
      select: () => ({
        eq: (col: string, val: string) => {
          if (col === 'id') {
            return { single: () => mockPost }
          }
          return {
            in: () => ({
              not: () => ({
                order: () => mockQueued,
              }),
            }),
          }
        },
      }),
      update: (data: any) => ({
        eq: (_col: string, id: string) => {
          mockUpdates.push({ data, id })
          return { error: null }
        },
      }),
    }),
  }),
}))

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  createServerClient: vi.fn().mockReturnValue({ auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1', email: 'test@test.com' } } }) } }),
  requireSiteScope: () => ({ ok: true, user: { id: 'u1' } }),
}))
vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: () => ({ siteId: 's1' }),
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

const POST_A = '00000000-0000-0000-0000-000000000001'
const POST_B = '00000000-0000-0000-0000-000000000002'
const POST_C = '00000000-0000-0000-0000-000000000003'

describe('reorderQueue', () => {
  beforeEach(() => {
    mockPost.data = { id: POST_A, site_id: 's1', queue_position: 0 }
    mockPost.error = null
    mockQueued.data = [
      { id: POST_A, queue_position: 0 },
      { id: POST_B, queue_position: 1 },
      { id: POST_C, queue_position: 2 },
    ]
    mockQueued.error = null
    mockUpdates.length = 0
  })

  it('reorders queue positions correctly', async () => {
    const { reorderQueue } = await import('@/lib/social/actions/posts')
    const result = await reorderQueue(POST_A, 2)
    expect(result.ok).toBe(true)
    expect(mockUpdates.length).toBe(3)
    // After moving A from position 0 to position 2:
    // New order should be: B(0), C(1), A(2)
    const positionMap = Object.fromEntries(mockUpdates.map(u => [u.id, u.data.queue_position]))
    expect(positionMap[POST_B]).toBe(0)
    expect(positionMap[POST_C]).toBe(1)
    expect(positionMap[POST_A]).toBe(2)
  })

  it('short-circuits when position unchanged', async () => {
    mockPost.data = { id: POST_A, site_id: 's1', queue_position: 0 }
    const { reorderQueue } = await import('@/lib/social/actions/posts')
    const result = await reorderQueue(POST_A, 0)
    expect(result.ok).toBe(true)
    expect(mockUpdates.length).toBe(0)
  })

  it('returns forbidden when post belongs to different site', async () => {
    mockPost.data = { id: POST_A, site_id: 'other-site', queue_position: 0 }
    const { reorderQueue } = await import('@/lib/social/actions/posts')
    const result = await reorderQueue(POST_A, 1)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('forbidden')
  })

  it('returns error when post not found', async () => {
    mockPost.data = null
    mockPost.error = { message: 'not found' }
    const { reorderQueue } = await import('@/lib/social/actions/posts')
    const result = await reorderQueue(POST_A, 1)
    expect(result.ok).toBe(false)
  })

  it('rejects invalid UUID', async () => {
    const { reorderQueue } = await import('@/lib/social/actions/posts')
    const result = await reorderQueue('not-a-uuid', 1)
    expect(result.ok).toBe(false)
  })

  it('rejects negative position', async () => {
    const { reorderQueue } = await import('@/lib/social/actions/posts')
    const result = await reorderQueue(POST_A, -1)
    expect(result.ok).toBe(false)
  })
})
