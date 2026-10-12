// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

// A5 E2: o sync lê e grava colunas e tabelas da MG2. As quatro ações do CMS que sincronizam (fora do cron) passam pela mesma guarda de
// schema (MG1 + MG2) ANTES de qualquer sincronização: reprovada, devolvem o texto da guarda, sem gravar nada e sem chamar o YouTube.
const h = vi.hoisted(() => ({ syncs: [] as string[], from: [] as string[], rpc: [] as string[], fetches: [] as string[], loads: 0, guard: [] as string[], mode: [] as string[] }))

vi.mock('@/lib/cms/auth-guards', () => ({
  requireSiteAdminScope: async () => ({ ok: true, user: { id: 'user-1' } }),
  denyUnlessSiteAdmin: async () => null,
  siteAdminOnlyMessage: (acao: string) => `Só quem administra o site pode ${acao}.`,
  requireSiteAdminForRow: async () => ({ siteId: 'site-1' }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), updateTag: vi.fn() }))
vi.mock('next/server', () => ({ after: (fn: () => unknown) => { void fn } }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: async () => ({ ok: true, user: { id: 'u1' } }) }))
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 'site-1' }) }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: (t: string) => { h.from.push(t); throw new Error('o banco não deveria ser lido: ' + t) },
    rpc: (n: string) => { h.rpc.push(n); throw new Error('o banco não deveria ser chamado: ' + n) },
  }),
}))
vi.mock('@/lib/youtube/competitor-sync', () => ({ syncCompetitorChannel: async (c: { id: string }) => { h.syncs.push(c.id); return { videosChecked: 1, changesDetected: 0, dailyRecorded: 0, unitsUsed: 1 } } }))
vi.mock('@/lib/youtube/observatorio/load', async (orig) => ({ ...(await orig<typeof import('@/lib/youtube/observatorio/load')>()), loadRows: async () => { h.loads++; throw new Error('loadRows não deveria rodar') } }))
const ready = vi.hoisted(() => ({ impl: (async () => null) as (sb: unknown, need: string) => Promise<unknown> }))
vi.mock('@/lib/youtube/competitor-health', () => ({ schemaReady: (sb: unknown, need: string) => { h.mode.push(need); return ready.impl(sb, need) }, readSiteHealth: vi.fn() }))

import { addCompetitorChannel, syncCompetitorNow, syncFullHistory, syncCompetitorsNow } from '@/app/cms/(authed)/youtube/competitors/actions'

const UC = 'UC' + 'a'.repeat(22)
const MG2 = 'migration MG2 não aplicada (competitor_videos): column competitor_videos.series_tier does not exist. Nada foi gravado.'

const calls: Array<[string, () => Promise<unknown>, (r: unknown) => string]> = [
  ['addCompetitorChannel', () => addCompetitorChannel('@canalteste'), r => (r as { error?: string }).error ?? ''],
  ['syncCompetitorNow', () => syncCompetitorNow('c1'), r => (r as { error?: string }).error ?? ''],
  ['syncFullHistory', () => syncFullHistory('c1'), r => (r as { error?: string }).error ?? ''],
  ['syncCompetitorsNow', () => syncCompetitorsNow(), r => (r as { text?: string }).text ?? ''],
]

describe('as quatro ações que sincronizam concorrentes passam pela guarda de schema', () => {
  beforeEach(() => {
    h.syncs.length = 0; h.from.length = 0; h.rpc.length = 0; h.fetches.length = 0; h.loads = 0; h.mode.length = 0
    process.env.YOUTUBE_API_KEY = 'k'
    vi.stubGlobal('fetch', vi.fn(async (u: unknown) => { h.fetches.push(String(u)); return Response.json({}) }))
    ready.impl = async () => null
  })
  for (const [name, run, textOf] of calls) {
    describe(name, () => {
      it('MG1 aplicada e MG2 não: devolve o texto da guarda, não sincroniza, não lê nem grava no banco, não chama o YouTube', async () => {
        ready.impl = async () => MG2
        const r = await run()
        expect(textOf(r)).toContain(MG2)
        expect((r as { ok: boolean }).ok).toBe(false)
        expect(h.mode).toEqual(['e1e2']) // confere as DUAS migrations
        expect(h.syncs).toEqual([]); expect(h.from).toEqual([]); expect(h.rpc).toEqual([]); expect(h.fetches).toEqual([]); expect(h.loads).toBe(0)
      })
      it('a guarda que lança: erro em português, não segue', async () => {
        ready.impl = async () => { throw new Error('rede caiu') }
        const r = await run()
        expect((r as { ok: boolean }).ok).toBe(false)
        expect(textOf(r)).toMatch(/não foi possível conferir o schema.*rede caiu/)
        expect(h.syncs).toEqual([]); expect(h.from).toEqual([]); expect(h.fetches).toEqual([]); expect(h.loads).toBe(0)
      })
      it('a guarda que não responde com texto nem com nulo (undefined): não é "pronto", não segue', async () => {
        ready.impl = async () => undefined
        const r = await run()
        expect((r as { ok: boolean }).ok).toBe(false)
        expect(textOf(r)).toMatch(/não foi possível conferir o schema/)
        expect(h.syncs).toEqual([]); expect(h.fetches).toEqual([]); expect(h.loads).toBe(0)
      })
    })
  }
  it('guarda pronta (nulo): syncCompetitorNow segue até ler o canal (o banco do teste lança lá, depois da guarda)', async () => {
    await expect(syncCompetitorNow('c1')).rejects.toThrow(/o banco não deveria ser lido: competitor_channels/)
    expect(h.mode).toEqual(['e1e2'])
  })
})
