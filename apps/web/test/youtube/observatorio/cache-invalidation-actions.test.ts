// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const revalidateTag = vi.fn()
/** Any chain of supabase calls resolves to `result`. */
const chain = (result: unknown): unknown => new Proxy(function () {}, {
  get: (_t, k) => (k === 'then' ? (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(result).then(ok, ko) : () => chain(result)),
})
async function load(o: { allowed?: boolean; sync?: () => Promise<unknown>; channel?: unknown } = {}) {
  vi.resetModules(); revalidateTag.mockClear()
  const syncFn = vi.fn(o.sync ?? (async () => ({ videosChecked: 1, changesDetected: 0, dailyRecorded: 0, unitsUsed: 1 })))
  vi.doMock('server-only', () => ({}))
  vi.doMock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 's1' }) }))
  vi.doMock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: async () => (o.allowed === false ? { ok: false, reason: 'insufficient_access' } : { ok: true, user: { id: 'u1' } }) }))
  vi.doMock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag }))
  vi.doMock('next/server', () => ({ after: () => {} }))
  vi.doMock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
  vi.doMock('@/lib/youtube/competitor-sync', () => ({ syncCompetitorChannel: syncFn }))
  const channel = 'channel' in o ? o.channel : { id: 'c1', channel_id: 'UC1', site_id: 's1' }
  vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({ from: () => chain({ data: channel, count: 0, error: null }) }) }))
  return { syncFn, ...(await import('@/app/cms/(authed)/youtube/competitors/actions')) }
}

describe('ações que sincronizam invalidam o cache do Observatório', () => {
  const env = process.env.YOUTUBE_API_KEY
  beforeEach(() => { process.env.YOUTUBE_API_KEY = 'k' })
  afterEach(() => { if (env === undefined) delete process.env.YOUTUBE_API_KEY; else process.env.YOUTUBE_API_KEY = env })

  it('syncCompetitorNow: invalida a tag do site depois de sincronizar', async () => {
    const { syncCompetitorNow, syncFn } = await load()
    expect((await syncCompetitorNow('c1')).ok).toBe(true)
    expect(syncFn).toHaveBeenCalledTimes(1)
    expect(revalidateTag.mock.calls).toEqual([['observatorio:s1', { expire: 0 }]])
  })
  it('syncCompetitorNow: a sincronização lançou no meio (dado parcial): invalida mesmo assim', async () => {
    const { syncCompetitorNow } = await load({ sync: async () => { throw new Error('YouTube API 500') } })
    await expect(syncCompetitorNow('c1')).rejects.toThrow('YouTube API 500')
    expect(revalidateTag.mock.calls).toEqual([['observatorio:s1', { expire: 0 }]])
  })
  it('syncCompetitorNow: sem permissão ou canal de outro site: não sincroniza nem invalida', async () => {
    expect((await (await load({ allowed: false })).syncCompetitorNow('c1')).ok).toBe(false)
    expect(revalidateTag).not.toHaveBeenCalled()
    expect((await (await load({ channel: null })).syncCompetitorNow('c1')).ok).toBe(false)
    expect(revalidateTag).not.toHaveBeenCalled()
  })
  it('syncCompetitorNow: sem a chave do YouTube (variável apagada): nada sincroniza, nada invalida', async () => {
    delete process.env.YOUTUBE_API_KEY
    const { syncCompetitorNow, syncFn } = await load()
    expect((await syncCompetitorNow('c1')).ok).toBe(false)
    expect(syncFn).not.toHaveBeenCalled()
    expect(revalidateTag).not.toHaveBeenCalled()
  })
  it('syncFullHistory: invalida no sucesso e na falha', async () => {
    expect((await (await load()).syncFullHistory('c1')).ok).toBe(true)
    expect(revalidateTag.mock.calls).toEqual([['observatorio:s1', { expire: 0 }]])
    const failing = await load({ sync: async () => { throw new Error('quota') } })
    expect(await failing.syncFullHistory('c1')).toEqual({ ok: false, error: 'quota' })
    expect(revalidateTag.mock.calls).toEqual([['observatorio:s1', { expire: 0 }]])
  })
  it('syncFullHistory: sem permissão: nada', async () => {
    expect((await (await load({ allowed: false })).syncFullHistory('c1')).ok).toBe(false)
    expect(revalidateTag).not.toHaveBeenCalled()
  })
})
