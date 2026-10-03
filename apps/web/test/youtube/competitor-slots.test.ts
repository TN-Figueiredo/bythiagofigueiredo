import { describe, it, expect, vi } from 'vitest'
import { computeSlots, DEFAULT_CHANNEL_LIMIT, UNLOCK_STEP } from '@/lib/youtube/competitor-slots'

describe('computeSlots', () => {
  it('defaults to 75', () => expect(computeSlots(14, null)).toEqual({ used: 14, limit: DEFAULT_CHANNEL_LIMIT, free: 61 }))
  it('never negative (the "-1 vagas" bug)', () => expect(computeSlots(16, 15)).toEqual({ used: 16, limit: 15, free: 0 }))
  it('full', () => expect(computeSlots(75, 75).free).toBe(0))
})

describe('unlockMoreChannels', () => {
  /** The admin check goes through can_admin_site_users on the SESSION client; the upsert uses the service client. */
  async function run(admin: { data: unknown; error: unknown }) {
    vi.resetModules()
    const rpc = vi.fn(async () => admin)
    const upsert = vi.fn(async () => ({ error: null }))
    vi.doMock('next/headers', () => ({ cookies: async () => ({ getAll: () => [], set: vi.fn() }) }))
    vi.doMock('@tn-figueiredo/auth-nextjs', () => ({ createServerClient: () => ({ rpc }) }))
    vi.doMock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 's1' }) }))
    vi.doMock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: async () => ({ ok: true, user: { id: 'u1' } }), createServerClient: () => ({ rpc }) }))
    vi.doMock('next/cache', () => ({ revalidatePath: vi.fn() }))
    vi.doMock('@/lib/supabase/service', () => ({
      getSupabaseServiceClient: () => ({
        from: (t: string) => t === 'competitor_settings'
          ? { upsert, select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { channel_limit: 75 } }) }) }) }
          : { select: () => ({ eq: async () => ({ count: 10, data: [] }) }) },
      }),
    }))
    const { unlockMoreChannels } = await import('@/app/cms/(authed)/youtube/competitors/actions')
    return { result: await unlockMoreChannels(), rpc, upsert }
  }

  it('refuses a non-admin (can_admin_site_users false) and writes nothing', async () => {
    const { result, rpc, upsert } = await run({ data: false, error: null })
    expect(result).toEqual({ ok: false, error: 'forbidden' })
    expect(rpc).toHaveBeenCalledWith('can_admin_site_users', { p_site_id: 's1' })
    expect(upsert).not.toHaveBeenCalled()
  })

  it('fails closed when the permission check errors or returns no data', async () => {
    expect((await run({ data: null, error: { message: 'boom' } })).result).toEqual({ ok: false, error: 'forbidden' })
    expect((await run({ data: null, error: null })).result).toEqual({ ok: false, error: 'forbidden' })
  })

  it('admin: raises the limit by UNLOCK_STEP', async () => {
    const { result, upsert } = await run({ data: true, error: null })
    expect(result.ok).toBe(true)
    expect(upsert).toHaveBeenCalledTimes(1)
    const [row] = upsert.mock.calls[0] as unknown as [{ site_id: string; channel_limit: number; updated_by: string }]
    expect(row).toMatchObject({ site_id: 's1', channel_limit: 75 + UNLOCK_STEP, updated_by: 'u1' })
  })
})
