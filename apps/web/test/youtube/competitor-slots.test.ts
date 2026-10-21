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
    vi.doMock('@tn-figueiredo/auth-nextjs', () => ({
      createServerClient: () => ({ rpc, auth: { getUser: async () => ({ data: { user: { id: 'u1' } }, error: null }) } }),
    }))
    vi.doMock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 's1' }) }))
    vi.doMock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: async () => ({ ok: true, user: { id: 'u1' } }),
      createServerClient: () => ({ rpc, auth: { getUser: async () => ({ data: { user: { id: 'u1' } }, error: null }) } }),
    }))
    vi.doMock('next/cache', () => ({ revalidatePath: vi.fn() }))
    vi.doMock('@/lib/supabase/service', () => ({
      getSupabaseServiceClient: () => ({
        from: (t: string) => t === 'competitor_settings'
          ? { upsert, select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { channel_limit: 75 } }) }) }) }
          : { select: () => ({ eq: () => ({ is: async () => ({ count: 10, data: [] }) }) }) },
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

describe('getChannelSlots (F1 Remover canal)', () => {
  it('S5.1 conta só canais sem pedido de remoção (filtra removal_requested_at is null)', async () => {
    vi.resetModules()
    const is = vi.fn(async () => ({ count: 7 }))
    const eq = vi.fn(() => ({ is }))
    vi.doMock('@/lib/supabase/service', () => ({
      getSupabaseServiceClient: () => ({ from: (t: string) => t === 'competitor_settings'
        ? { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }
        : { select: () => ({ eq }) } }),
    }))
    const { getChannelSlots } = await import('@/lib/youtube/competitor-slots')
    expect(await getChannelSlots('s1')).toEqual({ used: 7, limit: 75, free: 68 })
    expect(eq).toHaveBeenCalledWith('site_id', 's1')
    expect(is).toHaveBeenCalledWith('removal_requested_at', null)
  })
  it('S5.4 o 75 da migration (Desfazer checa vaga) é o mesmo de DEFAULT_CHANNEL_LIMIT e RULES.channelLimit', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const { RULES } = await import('@/lib/youtube/observatorio/rules')
    const sql = readFileSync(resolve(__dirname, '../../../../supabase/migrations/20261021000002_observatorio_a5_remover_canal_f1.sql'), 'utf8')
    const m = /s\.channel_limit from public\.competitor_settings s where s\.site_id = p_site\), (\d+)\)/.exec(sql)
    expect(Number(m?.[1])).toBe(DEFAULT_CHANNEL_LIMIT)
    expect(RULES.channelLimit).toBe(DEFAULT_CHANNEL_LIMIT)
  })
})
