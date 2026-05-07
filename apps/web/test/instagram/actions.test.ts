import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: vi.fn().mockResolvedValue({ siteId: 'site-1' }) }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: vi.fn().mockResolvedValue({ ok: true }) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

import { getSupabaseServiceClient } from '@/lib/supabase/service'
const mockGetClient = vi.mocked(getSupabaseServiceClient)

describe('Instagram server actions', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('addInstagramAccount inserts row with handle and locale', async () => {
    const insertFn = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'acc-1' }, error: null }) }),
    })
    mockGetClient.mockReturnValue({ from: vi.fn().mockReturnValue({ insert: insertFn }) } as never)
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
    mockGetClient.mockReturnValue({ from: vi.fn().mockReturnValue({ upsert: upsertFn }) } as never)
    const { updateInstagramSlots } = await import('@/app/cms/(authed)/settings/actions')
    const result = await updateInstagramSlots({
      accountId: '00000000-0000-0000-0000-000000000001',
      slots: [{ position: 1, postId: '00000000-0000-0000-0000-000000000010' }, { position: 2, postId: null }],
    })
    expect(result.ok).toBe(true)
  })
})
