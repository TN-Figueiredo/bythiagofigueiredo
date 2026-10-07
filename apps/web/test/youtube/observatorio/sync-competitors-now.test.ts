// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Degrau "administrar o site": estes testes rodam como quem administra (o dono).
// A recusa da editora e o erro da RPC ficam em test/cms/site-admin-step-*.test.ts.
vi.mock('@/lib/cms/auth-guards', () => ({
  requireSiteAdminScope: async () => ({ ok: true, user: { id: 'user-1' } }),
  denyUnlessSiteAdmin: async () => null,
  siteAdminOnlyMessage: (acao: string) => `Só quem administra o site pode ${acao}.`,
  requireSiteAdminForRow: async () => ({ siteId: 'site-1' }),
}))
import { loadOracle, datasetFromOracle } from './oracle'

const ds = datasetFromOracle(loadOracle())
const comps = ds.channels.filter(c => !c.own)
const okIds = comps.filter(c => c.sync.state === 'ok').map(c => c.id)
const badIds = comps.filter(c => c.sync.state === 'erro' || c.sync.state === 'atrasado').map(c => c.id)
const backfillIds = comps.filter(c => c.sync.state === 'backfill').map(c => c.id)
const revalidateTag = vi.fn()

async function load(o: { allowed?: boolean; noYtId?: string; loadMs?: number; sync?: (row: { id: string; channel_id: string; site_id: string }) => Promise<{ skipped?: boolean }> } = {}) {
  vi.resetModules()
  revalidateTag.mockClear()
  const syncFn = vi.fn(o.sync ?? (async () => ({ videosChecked: 1, changesDetected: 0, dailyRecorded: 0, unitsUsed: 1 })))
  vi.doMock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 's1' }) }))
  vi.doMock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: async () => (o.allowed === false ? { ok: false, reason: 'forbidden' } : { ok: true, user: { id: 'u1' } }) }))
  vi.doMock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag }))
  vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => { throw new Error('no db in this test') } }))
  vi.doMock('@/lib/youtube/competitor-sync', () => ({ syncCompetitorChannel: syncFn }))
  vi.doMock('@/lib/youtube/observatorio/load', () => ({
    loadRows: async () => { if (o.loadMs) vi.setSystemTime(Date.now() + o.loadMs); return { channels: comps.map(c => ({ id: c.id, channel_id: c.id === o.noYtId ? '' : 'UC-' + c.id })) } },
    rowsToDataset: () => structuredClone(ds),
  }))
  const { syncCompetitorsNow } = await import('@/app/cms/(authed)/youtube/competitors/actions')
  return { syncCompetitorsNow, syncFn }
}

describe('syncCompetitorsNow', () => {
  beforeEach(() => { process.env.YOUTUBE_API_KEY = 'k' })
  afterEach(() => { vi.useRealTimers(); vi.doUnmock('@/lib/youtube/observatorio/load'); vi.doUnmock('@/lib/youtube/competitor-sync') })

  it('the fixture has ok, problem and backfill competitors', () => {
    expect(okIds.length).toBeGreaterThan(0); expect(badIds.length).toBeGreaterThan(0); expect(backfillIds.length).toBeGreaterThan(0)
  })
  it('syncs only the ok channels, sequentially, and lists problems and the out-of-round channels untouched', async () => {
    const { syncCompetitorsNow, syncFn } = await load()
    const r = await syncCompetitorsNow()
    expect(syncFn.mock.calls.map(c => c[0].id)).toEqual(okIds)
    expect(syncFn.mock.calls[0]![0]).toEqual({ id: okIds[0], channel_id: 'UC-' + okIds[0], site_id: 's1' })
    expect(r.ok).toBe(true)
    expect(r.problems.map(p => p.id)).toEqual(badIds)
    expect(r.outOfRound.map(p => p.id)).toEqual(backfillIds)
    expect(r.outOfRound.every(p => p.label === 'buscando vídeos')).toBe(true)
    const n = okIds.length, t = n + badIds.length
    expect(r.text.startsWith(`${n} de ${t} canais sincronizados agora; ${badIds.length} com problema · Fora da rodada: `)).toBe(true)
    expect(r.toast?.kind).toBe('warn')
  })
  it('a failing channel becomes a problem with the humanized reason (count from the run, not the plan)', async () => {
    const { syncCompetitorsNow } = await load({ sync: async row => { if (row.id === okIds[0]) throw new Error('YouTube API 404 for channel x'); return {} } })
    const r = await syncCompetitorsNow()
    expect(r.problems).toContainEqual({ id: okIds[0], label: 'não encontrado no YouTube (404)' })
    expect(r.text.startsWith(`${okIds.length - 1} de `)).toBe(true)
  })
  it('invalida o cache do Observatório quando algum canal foi tentado, e só então', async () => {
    const { syncCompetitorsNow } = await load()
    await syncCompetitorsNow()
    expect(revalidateTag.mock.calls).toEqual([['observatorio:s1', { expire: 0 }]])
    const denied = await load({ allowed: false })
    await denied.syncCompetitorsNow()
    expect(revalidateTag).not.toHaveBeenCalled()
  })
  it('todo canal tentado falhou (dado parcial gravado): invalida mesmo assim', async () => {
    const { syncCompetitorsNow } = await load({ sync: async () => { throw new Error('YouTube API 500') } })
    expect((await syncCompetitorsNow()).ok).toBe(false)
    expect(revalidateTag.mock.calls).toEqual([['observatorio:s1', { expire: 0 }]])
  })
  it('a channel locked by another sync is not counted as synced', async () => {
    const { syncCompetitorsNow } = await load({ sync: async () => ({ skipped: true }) })
    const r = await syncCompetitorsNow()
    expect(r.ok).toBe(false)
    expect(r.toast?.kind).toBe('warn')
    expect(r.text.startsWith('0 de ')).toBe(true)
  })
  it('no channel STARTS after 30 s from the top of the action; the rest is reported honestly', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: Date.parse('2026-10-03T12:00:00Z') })
    // each channel takes 20 s: starts at 0 s and 20 s; at 40 s nothing else starts
    const { syncCompetitorsNow, syncFn } = await load({ sync: async () => { vi.setSystemTime(Date.now() + 20_000); return {} } })
    const r = await syncCompetitorsNow()
    expect(syncFn).toHaveBeenCalledTimes(2)
    const late = okIds.slice(2)
    expect(late.length).toBeGreaterThan(0)
    for (const id of late) expect(r.problems).toContainEqual({ id, label: 'não coube no tempo desta rodada' })
    expect(r.text.startsWith(`2 de ${okIds.length + badIds.length} `)).toBe(true)
  })
  it('the clock includes loading the rows: a slow load leaves no time to start', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: Date.parse('2026-10-03T12:00:00Z') })
    const { syncCompetitorsNow, syncFn } = await load({ loadMs: 31_000 })
    const r = await syncCompetitorsNow()
    expect(syncFn).not.toHaveBeenCalled()
    expect(r.ok).toBe(false)
    expect(r.toast?.kind).toBe('warn')
  })
  it('a channel without a YouTube id is skipped under its own label, never called with ""', async () => {
    const { syncCompetitorsNow, syncFn } = await load({ noYtId: okIds[0] })
    const r = await syncCompetitorsNow()
    expect(syncFn.mock.calls.map(c => c[0].id)).not.toContain(okIds[0])
    expect(r.problems).toContainEqual({ id: okIds[0], label: 'sem o id do canal no YouTube' })
  })
  it('refuses without edit access and touches nothing', async () => {
    const { syncCompetitorsNow, syncFn } = await load({ allowed: false })
    const r = await syncCompetitorsNow()
    expect(r.ok).toBe(false)
    expect(syncFn).not.toHaveBeenCalled()
  })
  it('without YOUTUBE_API_KEY nothing runs', async () => {
    delete process.env.YOUTUBE_API_KEY
    const { syncCompetitorsNow, syncFn } = await load()
    expect((await syncCompetitorsNow()).ok).toBe(false)
    expect(syncFn).not.toHaveBeenCalled()
  })
})
