import { describe, it, expect, vi, afterEach } from 'vitest'
import { parseNiche } from '@/lib/youtube/observatorio/niche'

describe('parseNiche', () => {
  it('accepts todos|viagem|ia', () => {
    expect(parseNiche('ia')).toBe('ia')
    expect(parseNiche('todos')).toBe('todos')
  })
  it('rejects anything else', () => {
    expect(parseNiche('culinaria')).toBeNull()
    expect(parseNiche(undefined)).toBeNull()
  })
})

describe('getUserNiche', () => {
  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('defaults to todos when there is no row', async () => {
    vi.resetModules()
    vi.doMock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 's1' }) }))
    vi.doMock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: async () => ({ ok: true, user: { id: 'u1' } }) }))
    vi.doMock('next/cache', () => ({ revalidatePath: vi.fn() }))
    vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) }) }) }))
    const { getUserNiche } = await import('@/app/cms/(authed)/youtube/competitors/niche-actions')
    expect(await getUserNiche()).toBe('todos')
  })

  it('returns todos when requireSiteScope fails', async () => {
    vi.resetModules()
    vi.doMock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 's1' }) }))
    vi.doMock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: async () => ({ ok: false }) }))
    vi.doMock('next/cache', () => ({ revalidatePath: vi.fn() }))
    const getSupabaseServiceClientMock = vi.fn()
    vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: getSupabaseServiceClientMock }))
    const { getUserNiche } = await import('@/app/cms/(authed)/youtube/competitors/niche-actions')
    expect(await getUserNiche()).toBe('todos')
    expect(getSupabaseServiceClientMock).not.toHaveBeenCalled()
  })
})

describe('setUserNiche', () => {
  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('rejects invalid niche values and does not call getSupabaseServiceClient', async () => {
    vi.resetModules()
    vi.doMock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 's1' }) }))
    vi.doMock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: async () => ({ ok: true, user: { id: 'u1' } }) }))
    vi.doMock('next/cache', () => ({ revalidatePath: vi.fn() }))
    const getSupabaseServiceClientMock = vi.fn()
    vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: getSupabaseServiceClientMock }))
    const { setUserNiche } = await import('@/app/cms/(authed)/youtube/competitors/niche-actions')
    // @ts-expect-error testing invalid input
    const result = await setUserNiche('culinaria')
    expect(result).toEqual({ ok: false })
    expect(getSupabaseServiceClientMock).not.toHaveBeenCalled()
  })

  it('upserts with correct user_id and site_id from auth and context', async () => {
    vi.resetModules()
    vi.doMock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 's1' }) }))
    vi.doMock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: async () => ({ ok: true, user: { id: 'u1' } }) }))
    vi.doMock('next/cache', () => ({ revalidatePath: vi.fn() }))
    const upsertMock = vi.fn(async () => ({ error: null }))
    const fromMock = vi.fn(() => ({ upsert: upsertMock }))
    vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({ from: fromMock }) }))
    const { setUserNiche } = await import('@/app/cms/(authed)/youtube/competitors/niche-actions')
    const result = await setUserNiche('ia')
    expect(result).toEqual({ ok: true })
    expect(fromMock).toHaveBeenCalledWith('competitor_user_prefs')
    const upsertCall = upsertMock.mock.calls[0]
    expect(upsertCall[0].user_id).toBe('u1')
    expect(upsertCall[0].site_id).toBe('s1')
    expect(upsertCall[0].niche).toBe('ia')
  })

  it('returns ok:false when requireSiteScope fails', async () => {
    vi.resetModules()
    vi.doMock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 's1' }) }))
    vi.doMock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: async () => ({ ok: false }) }))
    vi.doMock('next/cache', () => ({ revalidatePath: vi.fn() }))
    const getSupabaseServiceClientMock = vi.fn()
    vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: getSupabaseServiceClientMock }))
    const { setUserNiche } = await import('@/app/cms/(authed)/youtube/competitors/niche-actions')
    const result = await setUserNiche('viagem')
    expect(result).toEqual({ ok: false })
    expect(getSupabaseServiceClientMock).not.toHaveBeenCalled()
  })
})

describe('setChannelNiche', () => {
  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('rejects invalid niche values without making a DB call', async () => {
    vi.resetModules()
    vi.doMock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 's1' }) }))
    vi.doMock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: async () => ({ ok: true, user: { id: 'u1' } }) }))
    const revalidatePathMock = vi.fn()
    vi.doMock('next/cache', () => ({ revalidatePath: revalidatePathMock }))
    const getSupabaseServiceClientMock = vi.fn()
    vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: getSupabaseServiceClientMock }))
    const { setChannelNiche } = await import('@/app/cms/(authed)/youtube/competitors/niche-actions')
    // @ts-expect-error testing invalid input
    const result = await setChannelNiche('ch1', 'culinaria')
    expect(result).toEqual({ ok: false })
    expect(getSupabaseServiceClientMock).not.toHaveBeenCalled()
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })

  it('returns ok:false and does not revalidate when DB error occurs', async () => {
    vi.resetModules()
    vi.doMock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 's1' }) }))
    vi.doMock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: async () => ({ ok: true, user: { id: 'u1' } }) }))
    const revalidatePathMock = vi.fn()
    vi.doMock('next/cache', () => ({ revalidatePath: revalidatePathMock }))
    const selectMock = vi.fn(async () => ({ error: new Error('DB error'), data: null }))
    const secondEqMock = vi.fn(() => ({ select: selectMock }))
    const firstEqMock = vi.fn(() => ({ eq: secondEqMock }))
    const updateMock = vi.fn(() => ({ eq: firstEqMock }))
    const fromMock = vi.fn(() => ({ update: updateMock }))
    vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({ from: fromMock }) }))
    const { setChannelNiche } = await import('@/app/cms/(authed)/youtube/competitors/niche-actions')
    const result = await setChannelNiche('ch1', 'viagem')
    expect(result).toEqual({ ok: false })
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })

  it('returns ok:false and does not revalidate when zero rows matched', async () => {
    vi.resetModules()
    vi.doMock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 's1' }) }))
    vi.doMock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: async () => ({ ok: true, user: { id: 'u1' } }) }))
    const revalidatePathMock = vi.fn()
    vi.doMock('next/cache', () => ({ revalidatePath: revalidatePathMock }))
    const selectMock = vi.fn(async () => ({ error: null, data: [] }))
    const secondEqMock = vi.fn(() => ({ select: selectMock }))
    const firstEqMock = vi.fn(() => ({ eq: secondEqMock }))
    const updateMock = vi.fn(() => ({ eq: firstEqMock }))
    const fromMock = vi.fn(() => ({ update: updateMock }))
    vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({ from: fromMock }) }))
    const { setChannelNiche } = await import('@/app/cms/(authed)/youtube/competitors/niche-actions')
    const result = await setChannelNiche('ch1', 'ia')
    expect(result).toEqual({ ok: false })
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })
})

describe('setOwnChannelNiche', () => {
  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  function setup(opts: { auth?: { ok: boolean; user?: { id: string } }; result?: { error: Error | null; data: unknown[] | null } } = {}) {
    vi.resetModules()
    vi.doMock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 's1' }) }))
    vi.doMock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: async () => opts.auth ?? { ok: true, user: { id: 'u1' } } }))
    const revalidatePathMock = vi.fn()
    vi.doMock('next/cache', () => ({ revalidatePath: revalidatePathMock }))
    const selectMock = vi.fn(async () => opts.result ?? { error: null, data: [{ id: 'ch1' }] })
    const secondEqMock = vi.fn(() => ({ select: selectMock }))
    const firstEqMock = vi.fn(() => ({ eq: secondEqMock }))
    const updateMock = vi.fn(() => ({ eq: firstEqMock }))
    const fromMock = vi.fn(() => ({ update: updateMock }))
    const clientMock = vi.fn(() => ({ from: fromMock }))
    vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: clientMock }))
    return { revalidatePathMock, fromMock, updateMock, firstEqMock, secondEqMock, clientMock }
  }
  const load = async () => (await import('@/app/cms/(authed)/youtube/competitors/niche-actions')).setOwnChannelNiche

  it('rejects invalid niche values without touching the DB or revalidating', async () => {
    const m = setup()
    // @ts-expect-error testing invalid input
    expect(await (await load())('ch1', 'culinaria')).toEqual({ ok: false })
    expect(m.clientMock).not.toHaveBeenCalled()
    expect(m.revalidatePathMock).not.toHaveBeenCalled()
  })

  it('without edit permission: refused, the service client is never created', async () => {
    const m = setup({ auth: { ok: false } })
    expect(await (await load())('ch1', 'ia')).toEqual({ ok: false })
    expect(m.clientMock).not.toHaveBeenCalled()
    expect(m.updateMock).not.toHaveBeenCalled()
    expect(m.revalidatePathMock).not.toHaveBeenCalled()
  })

  it('DB error (also: column does not exist yet) -> ok:false, no revalidate', async () => {
    const m = setup({ result: { error: new Error('42703'), data: null } })
    expect(await (await load())('ch1', 'viagem')).toEqual({ ok: false })
    expect(m.revalidatePathMock).not.toHaveBeenCalled()
  })

  it('a channel id of another site matches zero rows -> ok:false, no revalidate, filtered by site_id', async () => {
    const m = setup({ result: { error: null, data: [] } })
    expect(await (await load())('other-site-ch', 'ia')).toEqual({ ok: false })
    expect(m.secondEqMock).toHaveBeenCalledWith('site_id', 's1')
    expect(m.revalidatePathMock).not.toHaveBeenCalled()
  })

  it('success: updates youtube_channels filtered by id and site_id, then revalidates', async () => {
    const m = setup()
    expect(await (await load())('ch1', 'ia')).toEqual({ ok: true })
    expect(m.fromMock).toHaveBeenCalledWith('youtube_channels')
    expect(m.updateMock).toHaveBeenCalledWith({ niche: 'ia' })
    expect(m.firstEqMock).toHaveBeenCalledWith('id', 'ch1')
    expect(m.secondEqMock).toHaveBeenCalledWith('site_id', 's1')
    expect(m.revalidatePathMock).toHaveBeenCalledWith('/cms/youtube/competitors', 'layout')
  })

  it('null clears the niche', async () => {
    const m = setup()
    expect(await (await load())('ch1', null)).toEqual({ ok: true })
    expect(m.updateMock).toHaveBeenCalledWith({ niche: null })
  })
})
