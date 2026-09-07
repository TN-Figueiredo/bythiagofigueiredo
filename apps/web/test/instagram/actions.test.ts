// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: vi.fn().mockResolvedValue({ siteId: 'site-1' }) }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  createServerClient: vi.fn().mockReturnValue({ auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1', email: 'test@test.com' } } }) } }),
  requireSiteScope: vi.fn().mockResolvedValue({ ok: true }),
}))
vi.mock('next/cache', () => ({ updateTag: vi.fn(), revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock('@/lib/instagram/api-client', () => ({ fetchInstagramProfile: vi.fn().mockResolvedValue({ id: 'ig-1' }) }))

import { getSupabaseServiceClient } from '@/lib/supabase/service'
const mockGetClient = vi.mocked(getSupabaseServiceClient)

const ACCOUNT_ID = '00000000-0000-0000-0000-000000000001'
const POST_ID = '00000000-0000-0000-0000-000000000010'

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
    // Regressão A1: o insert carrega o site do contexto, nunca um site do input.
    expect(insertFn.mock.calls[0]![0]).toMatchObject({ site_id: 'site-1' })
  })

  it('addInstagramAccount rejects invalid locale', async () => {
    const { addInstagramAccount } = await import('@/app/cms/(authed)/settings/actions')
    const result = await addInstagramAccount({ handle: '@test', locale: 'fr' as never })
    expect(result.ok).toBe(false)
  })

  it('removeInstagramAccount scopes the delete to the session site', async () => {
    const eqSite = vi.fn().mockResolvedValue({ error: null })
    const eqId = vi.fn().mockReturnValue({ eq: eqSite })
    const deleteFn = vi.fn().mockReturnValue({ eq: eqId })
    mockGetClient.mockReturnValue({ from: vi.fn().mockReturnValue({ delete: deleteFn }) } as never)
    const { removeInstagramAccount } = await import('@/app/cms/(authed)/settings/actions')
    const result = await removeInstagramAccount({ accountId: ACCOUNT_ID })
    expect(result.ok).toBe(true)
    expect(eqId).toHaveBeenCalledWith('id', ACCOUNT_ID)
    expect(eqSite).toHaveBeenCalledWith('site_id', 'site-1')
  })

  it('updateInstagramSettings scopes the update to the session site', async () => {
    const selectFn = vi.fn().mockResolvedValue({ data: [{ id: ACCOUNT_ID }], error: null })
    const eqSite = vi.fn().mockReturnValue({ select: selectFn })
    const eqId = vi.fn().mockReturnValue({ eq: eqSite })
    const updateFn = vi.fn().mockReturnValue({ eq: eqId })
    mockGetClient.mockReturnValue({ from: vi.fn().mockReturnValue({ update: updateFn }) } as never)
    const { updateInstagramSettings } = await import('@/app/cms/(authed)/settings/actions')
    const result = await updateInstagramSettings({ accountId: ACCOUNT_ID, display_slots: 9 })
    expect(result.ok).toBe(true)
    expect(eqId).toHaveBeenCalledWith('id', ACCOUNT_ID)
    expect(eqSite).toHaveBeenCalledWith('site_id', 'site-1')
  })

  it('updateInstagramSettings reports not found when no row matches the site', async () => {
    const selectFn = vi.fn().mockResolvedValue({ data: [], error: null })
    const eqSite = vi.fn().mockReturnValue({ select: selectFn })
    const eqId = vi.fn().mockReturnValue({ eq: eqSite })
    mockGetClient.mockReturnValue({
      from: vi.fn().mockReturnValue({ update: vi.fn().mockReturnValue({ eq: eqId }) }),
    } as never)
    const { updateInstagramSettings } = await import('@/app/cms/(authed)/settings/actions')
    const result = await updateInstagramSettings({ accountId: ACCOUNT_ID, display_slots: 9 })
    expect(result).toEqual({ ok: false, error: 'Account not found' })
  })

  it('setInstagramToken scopes the update to the session site', async () => {
    const eqSite = vi.fn().mockResolvedValue({ error: null })
    const eqId = vi.fn().mockReturnValue({ eq: eqSite })
    const updateFn = vi.fn().mockReturnValue({ eq: eqId })
    mockGetClient.mockReturnValue({ from: vi.fn().mockReturnValue({ update: updateFn }) } as never)
    const { setInstagramToken } = await import('@/app/cms/(authed)/settings/actions')
    const result = await setInstagramToken({ accountId: ACCOUNT_ID, accessToken: 'tok-abc' })
    expect(result.ok).toBe(true)
    expect(eqId).toHaveBeenCalledWith('id', ACCOUNT_ID)
    expect(eqSite).toHaveBeenCalledWith('site_id', 'site-1')
  })

  it('updateInstagramSlots updates positions in batch when the account belongs to the site', async () => {
    const upsertFn = vi.fn().mockReturnValue({ error: null })
    const accountSingle = vi.fn().mockResolvedValue({ data: { site_id: 'site-1' }, error: null })
    const postsIn = vi.fn().mockResolvedValue({ data: [{ id: POST_ID }], error: null })
    mockGetClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'instagram_accounts') {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: accountSingle }) }) }
        }
        if (table === 'instagram_posts') {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ in: postsIn }) }) }
        }
        return { upsert: upsertFn }
      }),
    } as never)
    const { updateInstagramSlots } = await import('@/app/cms/(authed)/settings/actions')
    const result = await updateInstagramSlots({
      accountId: ACCOUNT_ID,
      slots: [{ position: 1, postId: POST_ID }, { position: 2, postId: null }],
    })
    expect(result.ok).toBe(true)
    expect(upsertFn).toHaveBeenCalledTimes(1)
  })

  it('updateInstagramSlots refuses an account owned by another site', async () => {
    const upsertFn = vi.fn().mockReturnValue({ error: null })
    const accountSingle = vi.fn().mockResolvedValue({ data: { site_id: 'site-2' }, error: null })
    mockGetClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'instagram_accounts') {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: accountSingle }) }) }
        }
        return { upsert: upsertFn }
      }),
    } as never)
    const { updateInstagramSlots } = await import('@/app/cms/(authed)/settings/actions')
    const result = await updateInstagramSlots({
      accountId: ACCOUNT_ID, slots: [{ position: 1, postId: null }],
    })
    expect(result).toEqual({ ok: false, error: 'Account not found' })
    expect(upsertFn).not.toHaveBeenCalled()
  })

  it('updateInstagramSlots refuses a postId that belongs to another account', async () => {
    const upsertFn = vi.fn().mockReturnValue({ error: null })
    const accountSingle = vi.fn().mockResolvedValue({ data: { site_id: 'site-1' }, error: null })
    const postsIn = vi.fn().mockResolvedValue({ data: [], error: null })
    mockGetClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'instagram_accounts') {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: accountSingle }) }) }
        }
        if (table === 'instagram_posts') {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ in: postsIn }) }) }
        }
        return { upsert: upsertFn }
      }),
    } as never)
    const { updateInstagramSlots } = await import('@/app/cms/(authed)/settings/actions')
    const result = await updateInstagramSlots({
      accountId: ACCOUNT_ID, slots: [{ position: 1, postId: POST_ID }],
    })
    expect(result).toEqual({ ok: false, error: 'Post not found for this account' })
    expect(upsertFn).not.toHaveBeenCalled()
  })

  it('updateInstagramSlots skips the post lookup when every slot is empty', async () => {
    const upsertFn = vi.fn().mockReturnValue({ error: null })
    const accountSingle = vi.fn().mockResolvedValue({ data: { site_id: 'site-1' }, error: null })
    const postsSelect = vi.fn()
    mockGetClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'instagram_accounts') {
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: accountSingle }) }) }
        }
        if (table === 'instagram_posts') return { select: postsSelect }
        return { upsert: upsertFn }
      }),
    } as never)
    const { updateInstagramSlots } = await import('@/app/cms/(authed)/settings/actions')
    const result = await updateInstagramSlots({
      accountId: ACCOUNT_ID, slots: [{ position: 1, postId: null }],
    })
    expect(result.ok).toBe(true)
    expect(postsSelect).not.toHaveBeenCalled()
  })
})
