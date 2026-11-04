// @vitest-environment node
// F3-cache T2a: as medidas servem a entrada velha até 6 h e recalculam por trás; acima disso relêem bloqueando. Falha do recálculo vai ao Sentry com limitador.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createFakeNextCache } from '../../helpers/fake-next-cache'
import { falsoPostgrest, type Linha } from './medidas-fixture'

const H = 3_600_000
const D = 24 * H
const T0 = Date.UTC(2026, 9, 14, 15, 0, 0)
const LAST = Date.UTC(2026, 9, 14, 10, 0, 0)
const iso = (ms: number): string => new Date(ms).toISOString()
const canal = (id: string): Linha => ({ id, site_id: 's1', collection_paused_at: null, missing_since: null, subscribers_hidden: false, last_ok_synced_at: iso(LAST) })
const video = (id: string, c: string, publicadoEm: number): Linha => ({ id, competitor_channel_id: c, video_id: 'yt' + id, published_at: iso(publicadoEm), is_short: false, view_count: 1000 })
const obs = { channels: [{ id: 'a', own: false, sync: { last: LAST } }], videos: [] } as never

function tabelas(videos: Linha[] = [video('av', 'a', T0 - 10 * D)]): Record<string, Linha[]> {
  return { competitor_channels: [canal('a')], competitor_videos: videos, competitor_channel_snapshots: [], competitor_video_daily: [], competitor_video_early: [], competitor_video_marks: [], competitor_video_mark_misses: [] }
}

const captureMessage = vi.fn()
type Op = NonNullable<Parameters<typeof falsoPostgrest>[1]>
async function montar(t: Record<string, Linha[]>, op: Op = {}) {
  vi.resetModules()
  captureMessage.mockReset()
  const cache = createFakeNextCache()
  vi.doMock('next/cache', () => cache.module)
  vi.doMock('@sentry/nextjs', () => ({ captureMessage, captureException: vi.fn() }))
  const mod = await import('@/lib/youtube/observatorio/medidas-telas/carregar-do-site')
  const med = await import('@/lib/youtube/observatorio/medicao-abertura')
  const f = falsoPostgrest(t, op)
  const abrir = (agoraMs: number) => mod.carregarMedidasDoSite(f.sb, { siteId: 's1', obs, canais: ['a'], agoraMs })
  const entrada = () => [...cache.entries.keys()].find(k => k.startsWith('medidas-telas:'))!
  return { cache, f, abrir, mod, med, entrada }
}
const consultasDeCanal = (f: { consultas: Array<{ tabela: string; filtros: Array<{ coluna: string }> }> }): number => f.consultas.filter(c => c.tabela === 'competitor_channels' && c.filtros.some(x => x.coluna === 'id')).length
beforeEach(() => { vi.resetModules() })
afterEach(() => { vi.useRealTimers() })

describe('T2a: servir velho com teto de 6 h', () => {
  it('(1) entrada de 7 h e leitor que lança: a tela recebe naoCarregou e o Sentry é chamado, não a velha', async () => {
    const op: Op = {}
    const { abrir } = await montar(tabelas(), op)
    const ok = await abrir(T0 - 7 * H)
    expect(ok.porCanal.get('a')).not.toHaveProperty('naoCarregou')
    op.lancam = ['competitor_channels']
    const r = await abrir(T0)
    expect(r.porCanal.get('a')).toEqual({ naoCarregou: 'erro_do_banco' })
    expect(captureMessage.mock.calls.some(c => String(c[0]).includes('recálculo'))).toBe(true)
  })
  it('(2) entrada de 2 h e leitor que funciona: serve a velha sem esperar e, passado o prazo do cache, recalcula por trás', async () => {
    const { abrir, cache, f, entrada } = await montar(tabelas())
    await abrir(T0 - 2 * H)
    const lidas = consultasDeCanal(f)
    const r = await abrir(T0)
    expect(r.porCanal.get('a')).not.toHaveProperty('naoCarregou')
    expect(consultasDeCanal(f)).toBe(lidas) // não releu
    cache.envelhecer(entrada(), 21_601)
    await abrir(T0)
    await cache.aguardarRecalculos()
    expect(consultasDeCanal(f)).toBeGreaterThan(lidas) // recalculou por trás
  })
  it('(2b) o prazo do unstable_cache das medidas é 21.600 s', async () => {
    const { abrir, cache, entrada } = await montar(tabelas())
    await abrir(T0)
    expect(cache.entries.get(entrada())!.revalidate).toBe(21_600)
  })
  it('(3) na borda das janelas: a entrada velha dá o mesmo número que a leitura nova', async () => {
    const velho = T0 - 5 * H
    // 119,9 dias e 23,5 h na abertura velha; já fora de 120 d / 24 h na nova
    const vs = [video('v1', 'a', velho - 119.9 * D), video('v2', 'a', velho - 23.5 * H), video('v3', 'a', T0 - 2 * D)]
    const a = await montar(tabelas(vs))
    await a.abrir(velho)
    const servida = await a.abrir(T0)
    const b = await montar(tabelas(vs))
    const nova = await b.abrir(T0)
    expect(servida.porCanal.get('a')).toEqual(nova.porCanal.get('a'))
  })
  it('(4) as horas não mudaram: entrada de 10 min ainda é relida', async () => {
    vi.resetModules()
    const cache = createFakeNextCache()
    vi.doMock('next/cache', () => cache.module)
    vi.doMock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
    const { carregarMedidasDoCanalInteiro } = await import('@/lib/youtube/observatorio/medidas-telas/carregar-do-canal')
    const f = falsoPostgrest({ ...tabelas(), competitor_video_hourly: [], competitor_agenda_runs: [] })
    const pedido = (agoraMs: number) => ({ siteId: 's1', obs, channelId: 'a', agoraMs, pedir: { serie: false, mudancas: false, horas: true } }) as never
    await carregarMedidasDoCanalInteiro(f.sb, pedido(T0))
    const n0 = f.consultas.filter(c => c.tabela === 'competitor_agenda_runs').length
    await carregarMedidasDoCanalInteiro(f.sb, pedido(T0 + 10 * 60_000))
    expect(f.consultas.filter(c => c.tabela === 'competitor_agenda_runs').length).toBeGreaterThan(n0)
  })
  it('(5) limitador: 34 falhas seguidas da mesma causa geram 1 captura; 15 min depois a próxima leva vezes = 34; causa diferente gera outra', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(T0)
    const op: Op = { lancam: ['competitor_channels'] }
    const { f, mod } = await montar(tabelas(), op)
    const sb = f.sb
    const ler = (id: string) => mod.lerPlanosDoCanal(sb, { siteId: 's1', channelId: id, agoraMs: T0 }, null, mod.novosAvisos()).catch(() => undefined)
    for (let i = 0; i < 34; i++) await ler('a' + i)
    const rec = () => captureMessage.mock.calls.filter(c => String(c[0]).includes('recálculo'))
    expect(rec()).toHaveLength(1)
    vi.setSystemTime(T0 + 15 * 60_000 + 1)
    await ler('z')
    expect(rec()).toHaveLength(2)
    expect((rec()[1]![1] as { extra: { vezes: number } }).extra.vezes).toBe(34)
    // outra causa: coluna ausente
    delete op.lancam
    op.colunasAusentes = { competitor_channels: ['collection_paused_at'] }
    await ler('y')
    expect(rec()).toHaveLength(3)
    expect((rec()[2]![1] as { fingerprint: string[] }).fingerprint).toEqual(['medidas-telas', 'recalculo', 'schema_ausente'])
  })
  it('(6) a abertura registra idade_max_s da entrada servida (2 h = 7.200)', async () => {
    const { abrir, med } = await montar(tabelas())
    await abrir(T0 - 2 * H)
    const m = med.novaMedicao('canais')
    await med.comMedicao(m, () => abrir(T0))
    expect(JSON.parse(med.linhaDaMedicao(m)).idade_max_s).toBe(7200)
    expect(m.frios.medidas ?? 0).toBe(0)
  })
})
