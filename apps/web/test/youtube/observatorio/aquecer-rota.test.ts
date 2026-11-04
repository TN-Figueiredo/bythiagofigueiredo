// @vitest-environment node
// F3-cache T3, teste 11: a rota api/cron/observatorio-aquecer. Segredo, corpo, 202 sem tocar o banco e o aquecimento no after().
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { fakeSupabaseNadaSaiu } from '../../helpers/fake-supabase'
import { createFakeNextCache } from '../../helpers/fake-next-cache'
import { buildTables } from './load-fixture'

const U = (n: number): string => '00000000-0000-4000-8000-' + String(n).padStart(12, '0')

const afters: Array<() => Promise<void>> = []
const captureException = vi.fn()
const logCron = vi.fn()
const saude = { ok: vi.fn(async () => undefined), falha: vi.fn(async () => undefined) }
const NOW = Date.now()
const ENV = { ...process.env }

async function montar(tables = {} as ReturnType<typeof buildTables>) {
  vi.resetModules()
  afters.length = 0
  const cache = createFakeNextCache(), db = fakeSupabaseNadaSaiu(tables)
  const trips0 = () => db.trips.length
  vi.doUnmock('@/lib/youtube/observatorio/aquecer-site')
  vi.doMock('next/server', async (orig) => ({ ...(await orig<typeof import('next/server')>()), after: (f: () => Promise<void>) => { afters.push(f) } }))
  vi.doMock('next/cache', () => cache.module)
  vi.doMock('@sentry/nextjs', () => ({ captureException, captureMessage: vi.fn() }))
  vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => db.client }))
  vi.doMock('@/lib/cron-health', () => ({ recordCronSuccess: saude.ok, recordCronFailure: saude.falha }))
  vi.doMock('../../../lib/logger', () => ({ logCron, newRunId: () => 'run-t3' }))
  const rota = await import('@/app/api/cron/observatorio-aquecer/route')
  const nucleo = await import('@/lib/youtube/observatorio/aquecer')
  return { rota, db, cache, trips0, nucleo }
}
const pedido = (corpo: unknown, auth: string | null = 'Bearer seg') => new NextRequest('http://localhost/api/cron/observatorio-aquecer', {
  method: 'POST', headers: { ...(auth ? { authorization: auth } : {}), 'content-type': 'application/json' }, body: typeof corpo === 'string' ? corpo : JSON.stringify(corpo),
})

beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('CRON_SECRET', 'seg') })
afterEach(() => { process.env = { ...ENV }; vi.unstubAllEnvs() })

describe('11. rota api/cron/observatorio-aquecer', () => {
  it('sem segredo ou com segredo errado: 401', async () => {
    const { rota } = await montar()
    expect((await rota.POST(pedido({ alvos: [{ siteId: 'a' }] }, null))).status).toBe(401)
    expect((await rota.POST(pedido({ alvos: [{ siteId: 'a' }] }, 'Bearer outro'))).status).toBe(401)
    delete process.env.CRON_SECRET
    expect((await rota.POST(pedido({ alvos: [{ siteId: 'a' }] }))).status).toBe(401)
    expect(afters).toHaveLength(0)
  })
  it('corpo torto: 400 (não é JSON, corpo antigo, sem alvos, alvos demais, sem siteId, ids demais, ids vazio, ids não uuid, invalidadoEm texto)', async () => {
    const { rota } = await montar()
    const cases = ['não json', {}, { siteId: 'a' }, { alvos: [] }, { alvos: Array.from({ length: 51 }, (_x, i) => ({ siteId: 's' + i })) }, { alvos: [{}] },
      { alvos: [{ siteId: 'a', ids: Array.from({ length: 501 }, (_x, i) => U(i)) }] }, { alvos: [{ siteId: 'a', ids: [] }] }, { alvos: [{ siteId: 'a', ids: ['a-ch0'] }] },
      { alvos: [{ siteId: 'a', ids: [1] }] }, { alvos: [{ siteId: 'a' }], invalidadoEm: 'ontem' }]
    for (const c of cases) {
      expect((await rota.POST(pedido(c))).status).toBe(400)
    }
    expect(afters).toHaveLength(0)
  })
  it('responde 202 sem tocar o banco; o aquecimento roda no after()', async () => {
    const { rota, db, cache } = await montar(buildTables({ siteId: 'a', now: NOW, channels: 2 }))
    const r = await rota.POST(pedido({ alvos: [{ siteId: 'a' }], invalidadoEm: Date.now() - 60_000 }))
    expect(r.status).toBe(202)
    expect(db.trips).toHaveLength(0)
    expect(cache.misses).toHaveLength(0)
    expect(afters).toHaveLength(1)
  })
  it('canal de outro site é descartado e contado no after(); o log traz os números e o cron_health fica verde', async () => {
    const t = buildTables({ siteId: 'a', now: NOW, channels: 1 })
    const b = buildTables({ siteId: 'b', now: NOW, channels: 1 })
    b.competitor_channels![0]!.id = U(7) // canal de OUTRO site, com id válido
    t.competitor_channels = [...t.competitor_channels!, ...b.competitor_channels!]
    for (const rows of Object.values(t)) for (const r of rows ?? []) { const x = r as Record<string, unknown>; if (x.channel_id === 'a-ch0') x.channel_id = U(1); if (x.id === 'a-ch0') x.id = U(1) }
    const { rota, nucleo } = await montar(t)
    vi.spyOn(globalThis, 'setTimeout')
    await rota.POST(pedido({ alvos: [{ siteId: 'a', ids: [U(1), U(7)] }], invalidadoEm: Date.now() - 60_000 }))
    // a pausa entre passadas é real (2 s): o teste espera o after() inteiro
    await afters[0]!()
    expect(logCron).toHaveBeenCalledTimes(2) // o do site e o resumo por site
    expect(logCron.mock.calls[1]![0]).toMatchObject({ job: 'observatorio-aquecer', status: 'ok', sites: 1, sites_com_falha: 0 })
    expect(logCron.mock.calls[0]![0]).toMatchObject({ job: 'observatorio-aquecer', run_id: 'run-t3', status: 'ok', N: 1, aquecidos: 1, descartados: 1, regravados: 0, regravados_ultimos6: 0, fora_do_cache: 0 })
    expect(Object.keys(logCron.mock.calls[0]![0] as object)).toEqual(expect.arrayContaining(['bytes_lidos', 'duracao_ms']))
    expect(saude.ok).toHaveBeenCalledWith('observatorio-aquecer', 'info')
    expect(saude.falha).not.toHaveBeenCalled()
    expect(nucleo.PAUSA_ENTRE_PASSADAS_MS).toBe(2000)
  }, 15_000)
  it('aquecimento incompleto grava falha com o resumo; exceção inesperada vai ao Sentry e também grava falha', async () => {
    const { rota } = await montar(buildTables({ siteId: 'a', now: NOW, channels: 1 }))
    await rota.POST(pedido({ alvos: [{ siteId: 'a', ids: [U(9)] }], invalidadoEm: Date.now() - 60_000 }))
    await afters[0]!()
    expect(saude.falha).toHaveBeenCalledWith('observatorio-aquecer', 'a: todos os ids descartados (1)', 'info')
    expect(saude.ok).not.toHaveBeenCalled()
    saude.falha.mockClear()
    await montar()
    vi.doMock('@/lib/youtube/observatorio/aquecer-site', () => ({ aquecerSite: async () => { throw new Error('explodiu') } }))
    vi.resetModules() // o módulo da rota já foi importado dentro de montar() com o aquecerSite de verdade
    const y = await import('@/app/api/cron/observatorio-aquecer/route')
    await y.POST(pedido({ alvos: [{ siteId: 'a' }] }))
    await afters[afters.length - 1]!()
    expect(captureException).toHaveBeenCalled()
    expect(saude.falha).toHaveBeenCalled()
  }, 15_000)
  it('dois sites no mesmo corpo: UMA linha no fim; falha de um não some no sucesso do outro e o resumo traz os dois', async () => {
    const t = buildTables({ siteId: 'a', now: NOW, channels: 1 })
    const { rota } = await montar(t)
    await rota.POST(pedido({ alvos: [{ siteId: 'b', ids: [U(9)] }, { siteId: 'a' }], invalidadoEm: Date.now() - 60_000 }))
    await afters[0]!()
    expect(saude.ok).not.toHaveBeenCalled()
    expect(saude.falha).toHaveBeenCalledTimes(1)
    expect(saude.falha.mock.calls[0]![1]).toContain('b: todos os ids descartados')
    expect(saude.falha.mock.calls[0]![1]).not.toContain('a:')
    expect(logCron.mock.calls.at(-1)![0]).toMatchObject({ status: 'error', sites: 2, sites_com_falha: 1 })
    expect(String((logCron.mock.calls.at(-1)![0] as { por_site: string }).por_site)).toContain('a: ok')
  }, 15_000)
  it('OBS_E2E=1 fora de produção: responde 202 e não aquece', async () => {
    vi.stubEnv('OBS_E2E', '1'); vi.stubEnv('NODE_ENV', 'development')
    const { rota } = await montar(buildTables({ siteId: 'a', now: NOW, channels: 1 }))
    expect((await rota.POST(pedido({ alvos: [{ siteId: 'a' }] }))).status).toBe(202)
    expect(afters).toHaveLength(0)
  })
})
