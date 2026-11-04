// @vitest-environment node
// F3-cache T3: o núcleo do aquecimento e a leitura estreita. O cache é o falso fiel (createFakeNextCache); o banco, o falso do carregador.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { fakeSupabaseNadaSaiu, type Row } from '../../helpers/fake-supabase'
import { createFakeNextCache } from '../../helpers/fake-next-cache'
import { buildTables, ids, heavyTrips } from './load-fixture'

const NOW = Date.now()
const captureMessage = vi.fn()
const ENV = { ...process.env }

async function montar(tables: Record<string, Row[]>, o: { failIf?: (t: string, eqs: Record<string, unknown>) => boolean; failOn?: string } = {}) {
  vi.resetModules()
  captureMessage.mockClear()
  const cache = createFakeNextCache(), db = fakeSupabaseNadaSaiu(tables, o)
  vi.doMock('next/cache', () => cache.module)
  vi.doMock('@sentry/nextjs', () => ({ captureMessage, captureException: vi.fn() }))
  vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => db.client }))
  const loadSpy = vi.fn()
  vi.doMock('@/lib/youtube/observatorio/load', async () => {
    const a = await vi.importActual<typeof import('@/lib/youtube/observatorio/load')>('@/lib/youtube/observatorio/load')
    return { ...a, loadLiveRows: (...x: Parameters<typeof a.loadLiveRows>) => { loadSpy(); return a.loadLiveRows(...x) } }
  })
  const site = await import('@/lib/youtube/observatorio/aquecer-site')
  const nucleo = await import('@/lib/youtube/observatorio/aquecer')
  const page = await import('@/lib/youtube/observatorio/load-page')
  const medidas = await import('@/lib/youtube/observatorio/medidas-telas/carregar-do-site')
  return { cache, db, loadSpy, ...site, ...nucleo, ...page, ...medidas }
}
const rapido = { dormir: async () => undefined, prazoMs: 90_000 }
afterEach(() => { process.env = { ...ENV }; vi.unstubAllEnvs() })

describe('aquecerSite: a mesma entrada que a tela lê', () => {
  it('1. aquecer e depois abrir a lista e as medidas: nenhum miss novo e nenhuma ida pesada ao banco', async () => {
    const m = await montar(buildTables({ siteId: 'a', now: NOW }))
    const lista = [ids.channel('a', 0), ids.channel('a', 1)]
    const r = await m.aquecerSite(m.db.client, { siteId: 'a', ids: lista }, rapido)
    expect(r).toMatchObject({ status: 'ok', N: 2, aquecidos: 2, regravados: 0, descartados: 0 })
    const misses = m.cache.misses.length, pesadas = heavyTrips(m.db)
    expect(misses).toBe(4) // um pacote e uma medida por canal
    await m.loadPageRows('a', NOW)
    const obs = { channels: lista.map(id => ({ id, own: false, sync: { last: Date.parse(m.db.tables.competitor_channels!.find(c => c.id === id)!.last_ok_synced_at as string) } })), videos: [] } as never
    await m.carregarMedidasDoSite(m.db.client, { siteId: 'a', obs, canais: lista, agoraMs: NOW })
    expect(m.cache.misses.length).toBe(misses)
    expect(heavyTrips(m.db)).toBe(pesadas)
  })
  it('1b. variante: a tela com outro texto de callback e o mesmo nome fixo (outro pacote) continua sem miss', async () => {
    const m = await montar(buildTables({ siteId: 'a', now: NOW, channels: 1 }))
    await m.aquecerSite(m.db.client, { siteId: 'a', ids: [ids.channel('a', 0)] }, rapido)
    const misses = m.cache.misses.length
    // o mesmo nome e o mesmo ambiente, outro corpo: a chave é o nome, não o texto
    const { comChaveFixa, ENTRADAS } = await import('@/lib/youtube/observatorio/cache-tag')
    const outro = comChaveFixa(ENTRADAS.pacote, async (..._a: unknown[]) => 'outro corpo inteiramente diferente')
    expect(outro.toString()).toBe('observatorio-pack:' + (process.env.VERCEL_ENV ?? 'local'))
    await m.loadPageRows('a', NOW)
    expect(m.cache.misses.length).toBe(misses)
  })
  it('2. a leitura estreita monta os mesmos 3 valores da chave que a tela (last com microssegundos, video_limit nulo) e não chama loadLiveRows', async () => {
    for (const limite of [null, 3]) {
      const t = buildTables({ siteId: 'a', now: NOW, channels: 1 })
      Object.assign(t.competitor_channels![0]!, { last_ok_synced_at: '2026-11-03T12:00:00.123456+00:00', video_limit: limite })
      const m = await montar(t)
      await m.aquecerSite(m.db.client, { siteId: 'a', ids: [ids.channel('a', 0)] }, rapido)
      const chavesDoAquecer = [...m.cache.misses]
      const ch = ids.channel('a', 0)
      const last = Date.parse('2026-11-03T12:00:00.123456+00:00')
      // a chave de medidas é a que a tela monta: ms do last_ok_synced_at (não o ISO)
      expect(chavesDoAquecer.some(k => k.startsWith('medidas-telas:') && k.includes(',' + ch + ',' + last + '-'))).toBe(true)
      expect(String(last)).not.toContain('.')
      // o pacote: a chave tem o texto cru do last_ok e o video_limit cru, como a tela passa
      // o pacote: os 5 argumentos da chave (inclui o início da série na meia-noite de SP e o texto cru do last_ok) são os que a tela monta
      expect(chavesDoAquecer.some(k => k.startsWith('observatorio-pack:') && k.includes('"' + ch + '",null,') === (limite === null) && k.endsWith(',"2026-11-03T12:00:00.123456+00:00"]'))).toBe(true)
      const antes = m.cache.misses.length
      expect(m.loadSpy).not.toHaveBeenCalled()
      await m.loadPageRows('a', NOW)
      expect(m.loadSpy).toHaveBeenCalled() // a tela chama; o aquecimento não
      expect(m.cache.misses.length).toBe(antes) // e acerta a entrada que o aquecimento gravou
    }
  })
})

describe('aquecerSite: o que conta como N, aquecido e falha', () => {
  it('3. last_ok_synced_at nulo: fora do cache (nem sucesso nem falha); canal próprio ou de fora: descartado', async () => {
    const t = buildTables({ siteId: 'a', now: NOW, channels: 3 })
    t.competitor_channels![1]!.last_ok_synced_at = null
    const m = await montar(t)
    const r = await m.aquecerSite(m.db.client, { siteId: 'a', ids: [ids.channel('a', 0), ids.channel('a', 1), ids.channel('a', 2), 'a-own'] }, rapido)
    expect(r).toMatchObject({ status: 'ok', N: 2, aquecidos: 2, fora_do_cache: 1, descartados: 1 })
  })
  it('4. LeituraParcial: não guarda as medidas e conta como não aquecido (leitura parcial)', async () => {
    const m = await montar(buildTables({ siteId: 'a', now: NOW, channels: 2 }), { failIf: t => t === 'competitor_video_marks' })
    const r = await m.aquecerSite(m.db.client, { siteId: 'a', ids: [ids.channel('a', 0), ids.channel('a', 1)] }, rapido)
    expect(r.status).toBe('falha')
    expect(r).toMatchObject({ N: 2, aquecidos: 0, nao_aquecidos: { leitura_parcial: 2 } })
    expect([...m.cache.entries.keys()].some(k => k.startsWith('medidas-telas:'))).toBe(false)
    expect(r.motivo).toContain('aqueceu 0 de 2')
  })
  it('6. a contagem por canal usa comMedicao (contarFrio), sem contador novo: o acerto da 2ª passada não conta', async () => {
    const m = await montar(buildTables({ siteId: 'a', now: NOW, channels: 2 }))
    const r = await m.aquecerSite(m.db.client, { siteId: 'a', ids: [ids.channel('a', 0), ids.channel('a', 1)] }, rapido)
    expect(r.regravados + r.regravados_ultimos6).toBe(0)
    expect(r.bytes_lidos).toBeGreaterThan(0)
  })
  it('7. verde falso: todos os ids de outro site, leitura estreita que lança, 0 de N e todos fora do cache', async () => {
    const outro = { ...buildTables({ siteId: 'a', now: NOW, channels: 2 }) }
    const b = buildTables({ siteId: 'b', now: NOW, channels: 2 })
    outro.competitor_channels = [...outro.competitor_channels!, ...b.competitor_channels!]
    const m1 = await montar(outro)
    const r1 = await m1.aquecerSite(m1.db.client, { siteId: 'a', ids: [ids.channel('b', 0), ids.channel('b', 1)] }, rapido)
    expect(r1).toMatchObject({ status: 'falha', N: 0, descartados: 2, motivo: 'todos os ids descartados (2)' })
    const m2 = await montar(buildTables({ siteId: 'a', now: NOW }), { failOn: 'competitor_settings' })
    expect((await m2.aquecerSite(m2.db.client, { siteId: 'a', ids: [ids.channel('a', 0)] }, rapido)).status).toBe('falha')
    const m3 = await montar(buildTables({ siteId: 'a', now: NOW, channels: 2 }), { failOn: 'competitor_video_versions' })
    const r3 = await m3.aquecerSite(m3.db.client, { siteId: 'a', ids: [ids.channel('a', 0), ids.channel('a', 1)] }, rapido)
    expect(r3).toMatchObject({ status: 'falha', N: 2, aquecidos: 0 })
    const t4 = buildTables({ siteId: 'a', now: NOW, channels: 2 })
    for (const c of t4.competitor_channels!) c.last_ok_synced_at = null
    const m4 = await montar(t4)
    const r4 = await m4.aquecerSite(m4.db.client, { siteId: 'a', ids: [ids.channel('a', 0), ids.channel('a', 1)] }, rapido)
    expect(r4).toMatchObject({ status: 'ok', N: 0, fora_do_cache: 2 })
    expect(r4.motivo).toContain('fora do cache')
  })
  it('sem lista (null): aquece o site inteiro', async () => {
    const m = await montar(buildTables({ siteId: 'a', now: NOW, channels: 3 }))
    expect(await m.aquecerSite(m.db.client, { siteId: 'a', ids: null }, rapido)).toMatchObject({ status: 'ok', N: 3, aquecidos: 3 })
  })
  it('a leitura estreita só lê settings e competitor_channels antes dos canais (nada de tabelas leves do site)', async () => {
    const m = await montar(buildTables({ siteId: 'a', now: NOW, channels: 1 }))
    await m.aquecerSite(m.db.client, { siteId: 'a', ids: [ids.channel('a', 0)] }, rapido)
    const leves = ['youtube_channels', 'youtube_videos', 'competitor_changes', 'competitor_readings', 'youtube_intelligence_tasks', 'forja_heartbeat', 'youtube_niches']
    expect(m.db.trips.filter(t => leves.includes(t))).toEqual([])
  })
})

describe('aquecerCanais (núcleo): espera, prazo e confirmação', () => {
  interface C { id: string; last: number | null }
  const canais = (n: number): C[] => Array.from({ length: n }, (_x, i) => ({ id: 'c' + i, last: 1 }))
  /** Um cache de brincadeira: o 1º acesso é frio (contarFrio) e grava; `descartar` perde a gravação; `pendentes` só gravam quando `soltar` roda. */
  async function nucleo(o: { n?: number; descartar?: Set<string>; adiar?: boolean; lanca2?: boolean; invalidadoEm?: number | null; avanco?: number; prazoMs?: number; vivas?: C[]; descartados?: number } = {}) {
    vi.resetModules()
    const mod = await import('@/lib/youtube/observatorio/aquecer')
    const med = await import('@/lib/youtube/observatorio/medicao-abertura')
    const quentes = new Set<string>(), pendentes: string[] = []
    const dormidas: number[] = []
    let relogio = NOW
    const inicios: number[] = []
    let lidas = 0
    const lerPacote = async (c: C) => {
      lidas++
      if (o.lanca2 && quentes.size >= 0 && lidas > (o.n ?? 3)) throw new Error('banco caiu')
      inicios.push(o.prazoMs! - (relogio - NOW))
      if (!quentes.has(c.id)) {
        med.contarFrio('pacotes')
        if (o.avanco) relogio += o.avanco
        if (o.adiar) { if (!pendentes.includes(c.id)) pendentes.push(c.id) }
        else if (!o.descartar?.has(c.id)) quentes.add(c.id)
        else o.descartar.delete(c.id)
      }
      return { id: c.id }
    }
    const deps = {
      lerVivas: async () => ({ canais: o.vivas ?? canais(o.n ?? 3), descartados: o.descartados ?? 0 }),
      lerPacote, lerMedidas: async () => ({ resposta: {}, parcial: null }),
      agora: () => relogio, prazoMs: o.prazoMs ?? 90_000, invalidadoEm: o.invalidadoEm,
      dormir: async (ms: number) => { dormidas.push(ms); relogio += ms; if (ms >= mod.PAUSA_ENTRE_PASSADAS_MS && o.adiar === true && pendentes.length > 0) { /* adiada: só solta se pedido abaixo */ } },
    }
    return { mod, deps, quentes, pendentes, dormidas, inicios, soltar: () => { for (const id of pendentes.splice(0)) quentes.add(id) } }
  }
  it('12. espera: ausente ou no futuro, no máximo 1,5 s; já passou, só o que falta', async () => {
    const a = await nucleo({ invalidadoEm: undefined })
    await a.mod.aquecerCanais(null, a.deps)
    expect(a.dormidas[0]).toBe(1500)
    const f = await nucleo({ invalidadoEm: NOW + 60_000 })
    await f.mod.aquecerCanais(null, f.deps)
    expect(f.dormidas[0]).toBe(1500)
    const p = await nucleo({ invalidadoEm: NOW - 1000 })
    await p.mod.aquecerCanais(null, p.deps)
    expect(p.dormidas[0]).toBe(500)
    const velho = await nucleo({ invalidadoEm: NOW - 10_000 })
    await velho.mod.aquecerCanais(null, velho.deps)
    expect(velho.dormidas[0]).toBe(2000) // sem espera da etiqueta: a 1ª dormida é a pausa entre as passadas
  })
  it('9. confirmação: gravação perdida na 1ª passada é regravada na 2ª e conta em regravados; os 6 últimos à parte', async () => {
    const x = await nucleo({ n: 8, descartar: new Set(['c0', 'c7']) })
    const r = await x.mod.aquecerCanais(null, x.deps)
    expect(r).toMatchObject({ status: 'ok', N: 8, aquecidos: 8, regravados: 1, regravados_ultimos6: 1 })
  })
  it('9b. 2ª passada que lança: não aquecido, falha', async () => {
    const x = await nucleo({ n: 3, lanca2: true })
    const r = await x.mod.aquecerCanais(null, x.deps)
    expect(r.status).toBe('falha')
    expect(r.aquecidos).toBe(0)
    expect(r.nao_aquecidos.leitura_falhou).toBe(3)
  })
  it('9c. gravação atrasada (Yannis I3): com a pausa e o set resolvido não conta; sem o set resolvido conta como regravado', async () => {
    const com = await nucleo({ n: 3, adiar: true })
    const dormirOriginal = com.deps.dormir
    com.deps.dormir = async ms => { await dormirOriginal(ms); if (ms >= com.mod.PAUSA_ENTRE_PASSADAS_MS) com.soltar() }
    expect(await com.mod.aquecerCanais(null, com.deps)).toMatchObject({ status: 'ok', regravados: 0, regravados_ultimos6: 0 })
    const sem = await nucleo({ n: 3, adiar: true })
    // a gravação nunca chega: a 2ª passada vê tudo frio, regrava (aqui, de novo adiada) e a conta aparece
    const rs = await sem.mod.aquecerCanais(null, sem.deps)
    expect(rs.regravados + rs.regravados_ultimos6).toBe(3)
  })
  it('8. prazo: nenhum canal começa com restante menor que AQUECER_CANAL_PIOR_MS; o resto vira sem_tempo', async () => {
    const x = await nucleo({ n: 14, avanco: 3000, prazoMs: 30_000 })
    const r = await x.mod.aquecerCanais(null, x.deps)
    expect(x.inicios.length).toBeGreaterThan(0)
    expect(Math.min(...x.inicios)).toBeGreaterThanOrEqual(x.mod.AQUECER_CANAL_PIOR_MS)
    expect(r.status).toBe('falha')
    expect(r.nao_aquecidos.sem_tempo).toBeGreaterThan(0)
    expect(r.aquecidos).toBeLessThan(14)
  })
  it('lista não vazia com descartados parciais: segue com os que são do site', async () => {
    const x = await nucleo({ n: 2, descartados: 1 })
    expect(await x.mod.aquecerCanais(['c0', 'c1', 'fora'], x.deps)).toMatchObject({ status: 'ok', N: 2, descartados: 1 })
  })
})

describe('M2: acima do orçamento conta como não aquecido', () => {
  it('pacote acima do orçamento: não aquecido (pacote_acima_do_orcamento), nunca aquecido/regravado', async () => {
    const mod = await import('@/lib/youtube/observatorio/aquecer')
    const r = await mod.aquecerCanais(null, {
      lerVivas: async () => ({ canais: [{ id: 'c0', last: 1 }], descartados: 0 }),
      lerPacote: async () => ({}), parcialDoPacote: () => 'pacote_acima_do_orcamento',
      lerMedidas: async () => ({ resposta: {}, parcial: null }),
      agora: () => NOW, prazoMs: 90_000, dormir: async () => undefined,
    })
    expect(r.status).toBe('falha')
    expect(r.aquecidos).toBe(0)
    expect(r.regravados).toBe(0)
    expect(r.nao_aquecidos).toEqual({ pacote_acima_do_orcamento: 1 })
  })
  it('medidas acima de 2 MB: não aquecido (medidas_acima_do_teto)', async () => {
    const mod = await import('@/lib/youtube/observatorio/aquecer')
    const r = await mod.aquecerCanais(null, {
      lerVivas: async () => ({ canais: [{ id: 'c0', last: 1 }], descartados: 0 }),
      lerPacote: async () => ({}),
      lerMedidas: async () => ({ resposta: 'x'.repeat(mod.TETO_MEDIDAS + 10), parcial: null }),
      agora: () => NOW, prazoMs: 90_000, dormir: async () => undefined,
    })
    expect(r.status).toBe('falha')
    expect(r.aquecidos).toBe(0)
    expect(r.nao_aquecidos).toEqual({ medidas_acima_do_teto: 1 })
  })
})
