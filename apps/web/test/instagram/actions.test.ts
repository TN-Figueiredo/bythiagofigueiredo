import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn().mockResolvedValue({ siteId: 'site-1' }),
}))

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireSiteScope: vi.fn().mockResolvedValue({ ok: true }),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

vi.mock('@/lib/instagram/api-client', () => ({
  fetchInstagramProfile: vi.fn().mockResolvedValue({ id: 'ig-123', username: 'testuser' }),
}))

import { getSupabaseServiceClient } from '@/lib/supabase/service'

const mockGetClient = vi.mocked(getSupabaseServiceClient)

describe('Instagram server actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('addInstagramAccount inserts row with handle and locale', async () => {
    const insertFn = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'acc-1' }, error: null }),
      }),
    })
    mockGetClient.mockReturnValue({
      from: vi.fn().mockReturnValue({ insert: insertFn }),
    } as never)

    const { addInstagramAccount } = await import('@/app/cms/(authed)/settings/actions')
    const result = await addInstagramAccount({ handle: '@test', locale: 'pt' })
    expect(result.ok).toBe(true)
    expect(insertFn).toHaveBeenCalledTimes(1)
  })

  it('addInstagramAccount rejects invalid locale', async () => {
    const { addInstagramAccount } = await import('@/app/cms/(authed)/settings/actions')
    const result = await addInstagramAccount({ handle: '@test', locale: 'fr' as never })
    expect(result.ok).toBe(false)
  })

  it('updateInstagramSlots updates positions in batch', async () => {
    const upsertFn = vi.fn().mockReturnValue({ error: null })
    const deleteFn = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        gt: vi.fn().mockResolvedValue({ error: null }),
      }),
    })
    mockGetClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        upsert: upsertFn,
        delete: deleteFn,
      }),
    } as never)

    const { updateInstagramSlots } = await import('@/app/cms/(authed)/settings/actions')
    const result = await updateInstagramSlots({
      accountId: crypto.randomUUID(),
      slots: [
        { position: 1, postId: crypto.randomUUID() },
        { position: 2, postId: null },
      ],
    })
    expect(result.ok).toBe(true)
  })
})
