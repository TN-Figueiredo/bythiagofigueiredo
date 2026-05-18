import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock infrastructure
// ---------------------------------------------------------------------------
const mockUpdate = vi.fn().mockReturnValue({
  eq: vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({ error: null, count: 1 }),
    }),
    in: vi.fn().mockResolvedValue({ error: null, count: 1 }),
  }),
})

function chainableEq(resolvedValue = { error: null }): ReturnType<typeof vi.fn> {
  const fn: ReturnType<typeof vi.fn> = vi.fn().mockImplementation(() => {
    const result = Promise.resolve(resolvedValue)
    ;(result as Record<string, unknown>).eq = chainableEq(resolvedValue)
    return result
  })
  return fn
}

const mockDelete = vi.fn().mockReturnValue({
  eq: chainableEq(),
})

const mockSelect = vi.fn()

const mockFrom = vi.fn((table: string) => ({
  select: (...args: unknown[]) => {
    mockSelect(table, ...args)
    if (table === 'social_posts') {
      return {
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: 'p1' }, error: null }),
          }),
          single: vi.fn().mockResolvedValue({ data: { id: 'p1' }, error: null }),
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }
    }
    return {
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
        single: vi.fn().mockResolvedValue({ data: { post_id: 'p1' }, error: null }),
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    }
  },
  update: mockUpdate,
  delete: mockDelete,
}))

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({ from: mockFrom }),
}))

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: () => Promise.resolve({ siteId: 's1', orgId: 'o1', defaultLocale: 'pt-br' }),
}))

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireSiteScope: () => Promise.resolve({ ok: true, user: { id: 'u1' } }),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

vi.mock('@tn-figueiredo/social', async () => {
  const actual = await vi.importActual('@tn-figueiredo/social')
  return {
    ...actual,
    decrypt: (enc: string) => `decrypted-${enc}`,
    encrypt: (val: string) => `encrypted-${val}`,
    getMasterKey: () => 'test-key-32-chars-for-testing!!!',
  }
})

import { cancelSocialPost, deleteSocialPost, retrySocialDelivery } from '@/lib/social/actions'

// ---------------------------------------------------------------------------
// cancelSocialPost
// ---------------------------------------------------------------------------
describe('cancelSocialPost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects invalid UUID', async () => {
    const result = await cancelSocialPost('not-a-uuid')
    expect(result).toEqual({ ok: false, error: 'Invalid post ID' })
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('updates post status to cancelled and deliveries to skipped', async () => {
    const postId = '00000000-0000-0000-0000-000000000001'
    const result = await cancelSocialPost(postId)

    expect(result.ok).toBe(true)
    expect(mockFrom).toHaveBeenCalledWith('social_posts')
    expect(mockFrom).toHaveBeenCalledWith('social_deliveries')
    expect(mockUpdate).toHaveBeenCalled()
  })

  it('returns error when post update fails', async () => {
    mockUpdate.mockReturnValueOnce({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ error: { message: 'update failed' } }),
        }),
      }),
    })

    const postId = '00000000-0000-0000-0000-000000000001'
    const result = await cancelSocialPost(postId)

    expect(result).toEqual({ ok: false, error: 'update failed' })
  })
})

// ---------------------------------------------------------------------------
// deleteSocialPost
// ---------------------------------------------------------------------------
describe('deleteSocialPost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects invalid UUID', async () => {
    const result = await deleteSocialPost('bad')
    expect(result).toEqual({ ok: false, error: 'Invalid post ID' })
  })

  it('deletes deliveries then post', async () => {
    const postId = '00000000-0000-0000-0000-000000000002'
    const result = await deleteSocialPost(postId)

    expect(result.ok).toBe(true)
    expect(mockFrom).toHaveBeenCalledWith('social_deliveries')
    expect(mockFrom).toHaveBeenCalledWith('social_posts')
    expect(mockDelete).toHaveBeenCalled()
  })

  it('returns error when deliveries delete fails', async () => {
    mockDelete.mockReturnValueOnce({
      eq: chainableEq({ error: { message: 'FK violation' } }),
    })

    const postId = '00000000-0000-0000-0000-000000000002'
    const result = await deleteSocialPost(postId)

    expect(result).toEqual({ ok: false, error: 'FK violation' })
  })
})

// ---------------------------------------------------------------------------
// retrySocialDelivery
// ---------------------------------------------------------------------------
describe('retrySocialDelivery', () => {
  const deliveryId = '00000000-0000-0000-0000-000000000003'

  beforeEach(() => {
    vi.clearAllMocks()

    // Default: delivery fetch returns failed delivery owned by post p1
    // Post fetch returns post owned by site s1
    mockFrom.mockImplementation((table: string) => {
      if (table === 'social_deliveries') {
        return {
          select: () => ({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: deliveryId, post_id: 'p1', status: 'failed' },
                error: null,
              }),
            }),
          }),
          update: mockUpdate,
        }
      }
      if (table === 'social_posts') {
        return {
          select: () => ({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'p1' },
                  error: null,
                }),
              }),
            }),
          }),
          update: mockUpdate,
        }
      }
      return { select: vi.fn(), update: mockUpdate, delete: mockDelete }
    })
  })

  it('rejects invalid UUID', async () => {
    const result = await retrySocialDelivery('xyz')
    expect(result).toEqual({ ok: false, error: 'Invalid delivery ID' })
  })

  it('resets delivery to pending with attempt 0', async () => {
    const result = await retrySocialDelivery(deliveryId)

    expect(result.ok).toBe(true)
    expect(mockFrom).toHaveBeenCalledWith('social_deliveries')
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'pending',
        attempt: 0,
        last_error: null,
        error_type: null,
      }),
    )
  })

  it('updates post status from failed to scheduled', async () => {
    await retrySocialDelivery(deliveryId)

    expect(mockFrom).toHaveBeenCalledWith('social_posts')
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'scheduled' }),
    )
  })

  it('returns forbidden when delivery belongs to another site', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'social_deliveries') {
        return {
          select: () => ({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: deliveryId, post_id: 'p1', status: 'failed' },
                error: null,
              }),
            }),
          }),
          update: mockUpdate,
        }
      }
      if (table === 'social_posts') {
        return {
          select: () => ({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
          update: mockUpdate,
        }
      }
      return { select: vi.fn(), update: mockUpdate, delete: mockDelete }
    })

    const result = await retrySocialDelivery(deliveryId)
    expect(result).toEqual({ ok: false, error: 'forbidden' })
  })

  it('rejects retry for non-retryable delivery status', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'social_deliveries') {
        return {
          select: () => ({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: deliveryId, post_id: 'p1', status: 'published' },
                error: null,
              }),
            }),
          }),
          update: mockUpdate,
        }
      }
      if (table === 'social_posts') {
        return {
          select: () => ({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'p1' },
                  error: null,
                }),
              }),
            }),
          }),
          update: mockUpdate,
        }
      }
      return { select: vi.fn(), update: mockUpdate, delete: mockDelete }
    })

    const result = await retrySocialDelivery(deliveryId)
    expect(result).toEqual({ ok: false, error: 'Cannot retry delivery with status "published"' })
  })
})
