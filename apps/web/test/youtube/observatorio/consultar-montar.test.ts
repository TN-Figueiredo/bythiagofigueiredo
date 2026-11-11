// @vitest-environment node
/**
 * A4 R5 T8: `montarConsulta`, o leitor da ação `consultar`. Banco falso (video_lugares, lugares), `next/cache` fiel, estado da aba e medidas dobrados:
 * o que se prova é o que o montador faz com o que as fontes devolvem.
 */
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeNextCache } from '../../helpers/fake-next-cache'
import { medidasDe, mundo, pedido, type Sobras } from './consulta-fixture'
import type { PedidoDaConsulta } from '@/lib/youtube/observatorio/consulta/tipos'
import type { Observatory } from '@/lib/youtube/observatorio'
import { montarConjunto } from '@/lib/youtube/observatorio/consulta/conjunto'
import { ordenar } from '@/lib/youtube/observatorio/consulta/ordem'

const m = vi.hoisted(() => ({
  db: null as unknown,
  medidas: vi.fn(),
  estado: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}))
vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => ({ captureMessage: m.captureMessage, captureException: m.captureException }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => m.db }))
vi.mock('@/lib/youtube/observatorio/medidas-telas/carregar-do-site', async (orig) => ({ ...(await orig<object>()), carregarMedidasDoSite: m.medidas }))
vi.mock('@/lib/youtube/observatorio/sinais/leitura', async (orig) => ({ ...(await orig<object>()), lerEstadoDaAba: m.estado }))

const SITE = 'ssssssss-ssss-4sss-8sss-ssssssssssss'
const ENV = { ...process.env }
const CALCULADO = '2026-10-24T10:00:00Z'
const ESTADO_OK = { calculado: true, velho: false, computado_em: CALCULADO }

interface Linha { video_id: string; chaves: string[]; semente_versao: number }

/** Cliente falso: `video_lugares` pagina por range; `lugares` responde por slug (a leitura de `lugares` pode falhar). */
function banco(linhas: Linha[], opc: { falhaLinhas?: boolean; falhaLugares?: boolean; slugs?: string[] } = {}) {
  const eqs: Array<[string, string, unknown]> = []
  const leituras = { video_lugares: 0, lugares: 0 }
  const db = {
    from(tabela: string) {
      const q: Record<string, unknown> = {}
      q.select = () => q
      q.eq = (c: string, v: unknown) => { eqs.push([tabela, c, v]); return q }
      q.order = () => q
      q.range = async (de: number, ate: number) => {
        leituras.video_lugares++
        if (opc.falhaLinhas) return { data: null, error: { message: 'boom', code: 'XX000' } }
        return { data: linhas.slice(de, ate + 1), error: null }
      }
      q.maybeSingle = async () => {
        leituras.lugares++
        if (opc.falhaLugares) return { data: null, error: { message: 'boom' } }
        const slug = eqs.filter((e) => e[0] === 'lugares' && e[1] === 'slug').pop()?.[2] as string
        return { data: (opc.slugs ?? ['local:vn-hanoi', 'pais:VN']).includes(slug) ? { slug } : null, error: null }
      }
      return q
    },
  }
  return { db, eqs, leituras }
}

type Mundo = ReturnType<typeof mundo>
interface Cenario { w: Mundo; sobras: Sobras; cache: ReturnType<typeof createFakeNextCache> }

async function preparar(o: { mut?: Parameters<typeof mundo>[0]; sobras?: Sobras | ((obs: Observatory) => Sobras); ped?: Partial<PedidoDaConsulta>; linhas?: Linha[]; db?: Parameters<typeof banco>[1]; estado?: unknown } = {}) {
  vi.resetModules()
  const cache = createFakeNextCache()
  vi.doMock('next/cache', () => cache.module)
  const w = mundo(o.mut, o.sobras ?? {}, o.ped)
  const sobras: Sobras = typeof o.sobras === 'function' ? o.sobras(w.obs) : (o.sobras ?? {})
  const b = banco(o.linhas ?? [], o.db)
  m.db = b.db
  m.estado.mockReset(); m.estado.mockResolvedValue(o.estado === undefined ? ESTADO_OK : o.estado)
  m.medidas.mockReset()
  m.medidas.mockImplementation(async (_db: unknown, p: { obs: Observatory; canais: string[] }) => {
    const cheio = medidasDe(p.obs, sobras)
    const pedidos = new Set(p.canais)
    return { ...cheio, porCanal: new Map([...cheio.porCanal].filter(([id]) => pedidos.has(id))), lidoEmMaisAntigo: '2026-10-24T12:00:00.000Z' }
  })
  m.captureException.mockReset(); m.captureMessage.mockReset()
  const { montarConsulta } = await import('@/app/cms/(authed)/youtube/competitors/_consultar/montar')
  const abrir = { observatorio: async () => ({ siteId: SITE, now: w.obs.NOW, obs: w.obs }) } as never
  const rodar = (p: Partial<PedidoDaConsulta> = {}) => montarConsulta(abrir, { ...w.p, ...p } as PedidoDaConsulta, w.obs.NOW)
  return { w, b, cache, rodar, montarConsulta, abrir }
}
afterEach(() => { process.env = { ...ENV }; vi.resetModules(); vi.doUnmock('next/cache') })
beforeEach(() => { process.env.OBS_SINAIS_NICHO = 'on' })

const ehResultado = (r: unknown): r is import('@/app/cms/(authed)/youtube/competitors/_contexto-ia/empacotar-consulta').ResultadoDaConsulta => typeof r === 'object' && r !== null && 'blocos' in r
const resultado = async (r: Promise<unknown> | unknown) => { const x = await r; if (!ehResultado(x)) throw new Error('esperava resultado, veio ' + JSON.stringify(x)); return x }
const todas = (r: import('@/app/cms/(authed)/youtube/competitors/_contexto-ia/empacotar-consulta').ResultadoDaConsulta) => r.blocos.flatMap((b) => b.linhas)

describe('montarConsulta: medidas só dos canais do conjunto (N-5)', () => {
  it('(a) canal_ids com 2 canais: carregarMedidasDoSite recebe só esses 2, não os do site inteiro', async () => {
    const { w, rodar } = await preparar()
    const doSite = w.obs.channels.filter((c) => !c.own)
    expect(doSite.length).toBeGreaterThan(3)
    const [A, B] = [doSite[0]!.id, doSite[1]!.id]
    const r = await resultado(rodar({ canalIds: [A, B] }))
    expect(m.medidas).toHaveBeenCalledTimes(1)
    expect([...m.medidas.mock.calls[0]![1].canais].sort()).toEqual([A, B].sort())
    expect(new Set(todas(r).map((l) => l.canalId))).toEqual(new Set([A, B]))
  })
  it('com lugar, os canais são os dos vídeos marcados (depois do filtro), não os do conjunto antes dele', async () => {
    const { w, rodar } = await preparar({ linhas: [] })
    const longos = w.obs.videos.filter((v) => v.fmt === 'long' && !w.obs.channel(v.ch)!.own)
    const doCanal = longos[0]!.ch
    const marcado = longos.find((v) => v.ch === doCanal)!
    const linhas: Linha[] = [{ video_id: marcado.id, chaves: ['local:vn-hanoi'], semente_versao: 2 }]
    const c = await preparar({ linhas })
    const r = await resultado(c.rodar({ lugar: 'local:vn-hanoi', janelaIdade: 'todas' }))
    expect([...m.medidas.mock.calls[0]![1].canais]).toEqual([doCanal])
    expect(todas(r).map((l) => l.id)).toEqual([marcado.id])
    void w; void rodar
  })
})

describe('montarConsulta: canal sem medida e leitura que lança (§7 teste 17, Foco 5)', () => {
  it('(b) canal com naoCarregou: "não medido: <causa>", "sem os canais X", desfecho ok (resultado, não recusa)', async () => {
    const { w, rodar } = await preparar({ sobras: (obs) => ({ naoCarregou: { [obs.channels.find((c) => !c.own)!.id]: 'tempo_esgotado' } }) })
    const X = w.obs.channels.find((c) => !c.own)!
    const r = await resultado(rodar({ formato: 'longos' }))
    const doX = todas(r).filter((l) => l.canalId === X.id)
    expect(doX.length).toBeGreaterThan(0)
    for (const l of doX) {
      expect(l.celulas.likes).toMatchObject({ estado: 'nao_medido', causa: 'medidas do canal indisponíveis: tempo_esgotado' })
      expect(l.celulas.views?.estado).toMatch(/medido/)
    }
    expect(r.canaisSemMedida).toEqual([{ nome: X.name, causa: 'tempo_esgotado' }])
    expect(r.blocos[0]!.agregado.porMetrica.likes?.semOsCanais).toContain(X.id)
  })
  it('(d) carregarMedidasDoSite lançando por inteiro: views seguem medidas, curtidas "não medido: erro_do_banco", ok, Sentry com a tag', async () => {
    const { rodar } = await preparar()
    m.medidas.mockRejectedValueOnce(new Error('SEGREDO-DO-BANCO'))
    const r = await resultado(rodar({ formato: 'longos' }))
    const linhas = todas(r)
    expect(linhas.length).toBeGreaterThan(0)
    expect(linhas.every((l) => l.celulas.views?.estado === 'medido')).toBe(true)
    expect(linhas.every((l) => l.celulas.likes?.estado === 'nao_medido' && l.celulas.likes.causa === 'medidas do canal indisponíveis: erro_do_banco')).toBe(true)
    expect(linhas.every((l) => l.celulas.engajamento?.estado === 'nao_medido')).toBe(true)
    expect(m.captureException).toHaveBeenCalledTimes(1)
    expect(m.captureException.mock.calls[0]![1]).toMatchObject({ tags: { step: 'consultar-medidas' } })
    expect(JSON.stringify(m.captureException.mock.calls[0]![1])).not.toContain('SEGREDO')
    expect(r.canaisSemMedida.length).toBeGreaterThan(0)
  })
})

describe('montarConsulta: dadosDe (D10)', () => {
  it('(e) as três fontes: motor = menor sync.last, medidas = lidoEmMaisAntigo, lugares = computed_at', async () => {
    const { w, rodar } = await preparar({ linhas: [{ video_id: 'x', chaves: [], semente_versao: 2 }] })
    const r = await resultado(rodar({ formato: 'longos' }))
    const lasts = [...new Set(w.obs.videos.filter((v) => v.fmt === 'long' && !w.obs.channel(v.ch)!.own).map((v) => v.ch))].map((id) => w.obs.channel(id)!.sync.last).filter((x): x is number => x != null)
    expect(r.dadosDe.motor).toBe(new Date(Math.min(...lasts)).toISOString())
    expect(r.dadosDe.medidas).toBe('2026-10-24T12:00:00.000Z')
    expect(r.dadosDe.lugares).toBe(new Date(CALCULADO).toISOString())
    expect(r.leituraMaisAntiga).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}/)
  })
  it('(e) canal com sync.last nulo: "sem sincronização boa: X" e o motor nunca vira agora', async () => {
    const { w, rodar } = await preparar({ mut: (ds) => { const c = ds.channels.find((x) => !x.own)!; c.sync = { ...c.sync, last: null } } })
    const X = w.obs.channels.find((c) => !c.own && c.sync.last === null)!
    expect(X).toBeTruthy()
    const r = await resultado(rodar({ formato: 'todos', janelaIdade: 'todas' }))
    expect(r.canaisSemSync).toContain(X.name)
    expect(r.dadosDe.motor).not.toBe(new Date(w.obs.NOW).toISOString())
    const canais = [...new Set(w.obs.videos.filter((v) => !w.obs.channel(v.ch)!.own).map((v) => v.ch))]
    const lasts = canais.map((id) => w.obs.channel(id)!.sync.last).filter((x): x is number => x != null)
    expect(r.dadosDe.motor).toBe(lasts.length ? new Date(Math.min(...lasts)).toISOString() : null)
  })
  it('sem nenhuma sincronização boa no conjunto: motor nulo ("não lido"), nunca a hora do pedido', async () => {
    const { rodar } = await preparar({ mut: (ds) => { for (const c of ds.channels) c.sync = { ...c.sync, last: null } } })
    const r = await resultado(rodar({}))
    expect(r.dadosDe.motor).toBeNull()
  })
})

describe('montarConsulta: varredura (§7 teste 5, Restrições globais)', () => {
  it('(f) montar.ts não importa nem chama loadRows, extrairLugares, achar, lerVideosDoCanal, lerMarcasDoCanal, multiplierAt', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors/_consultar/montar.ts'), 'utf8')
    for (const proibido of ['loadRows', 'extrairLugares', 'lerVideosDoCanal', 'lerMarcasDoCanal', 'multiplierAt', 'medidasDoCanal']) expect(src, proibido).not.toContain(proibido)
    expect(src).not.toMatch(/\bachar\b/)
    expect(src).not.toMatch(/\bmedian\(|\bquant\(/)
  })
})

describe('montarConsulta: canais e nicho', () => {
  it('(g, Foco 2) [A, B, Z]: ok com Z em canaisNaoEncontrados e naoEncontrados 1 de 3; uuid e UC do mesmo canal contam uma vez', async () => {
    const { w, rodar } = await preparar()
    const [A, B] = w.obs.channels.filter((c) => !c.own)
    const r = await resultado(rodar({ canalIds: [A!.id, B!.id, 'Z-inexistente'] }))
    expect(r.canaisNaoEncontrados).toEqual(['Z-inexistente'])
    expect(r.naoEncontrados).toEqual({ quantos: 1, de: 3 })
    expect(new Set(todas(r).map((l) => l.canalId))).toEqual(new Set([A!.id, B!.id]))
  })
  it('(g) UC do canal e o uuid dele são o mesmo canal: contam uma vez, sem "não encontrado"', async () => {
    const UC = 'UCabcdefghijklmnopqrstuv'
    const { w, rodar } = await preparar({ mut: (ds) => { const c = ds.channels.find((x) => !x.own)!; c.url = 'https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv' } })
    const A = w.obs.channels.find((c) => c.url.endsWith(UC))!
    const r = await resultado(rodar({ canalIds: [A.id, UC] }))
    expect(r.canaisNaoEncontrados).toEqual([])
    expect(r.naoEncontrados).toBeUndefined()
    expect(new Set(todas(r).map((l) => l.canalId))).toEqual(new Set([A.id]))
    expect([...m.medidas.mock.calls[0]![1].canais]).toEqual([A.id])
  })
  it('(g) canal próprio no meio cai em não encontrado sem vazar o id do próprio; [Z] sozinho recusa', async () => {
    const { w, rodar } = await preparar()
    const A = w.obs.channels.find((c) => !c.own)!
    const proprio = w.obs.channels.find((c) => c.own)
    const ids = proprio ? [A.id, proprio.id] : [A.id, 'yt_own_zzz']
    const r = await resultado(rodar({ canalIds: ids }))
    expect(r.canaisNaoEncontrados).toHaveLength(1)
    expect(todas(r).every((l) => l.canalId === A.id)).toBe(true)
    const z = await rodar({ canalIds: ['Z-inexistente'] })
    expect(z).toMatchObject({ recusa: 'canais_nao_encontrados', ids: ['Z-inexistente'] })
    expect((z as { frase: string }).frase).not.toMatch(/yt_own/)
  })
  it('(h) nicho desconhecido recusa; "todos" e um nicho existente passam', async () => {
    const { w, rodar } = await preparar()
    expect(await rodar({ nicho: 'culinaria-inexistente' })).toMatchObject({ recusa: 'nicho_desconhecido' })
    await resultado(rodar({ nicho: 'todos' }))
    await resultado(rodar({ nicho: w.obs.niches[0]!.id }))
  })
})

describe('montarConsulta: lugar (Focos 1 e 6, §7 testes 6, 7, 14, 18, 20)', () => {
  const primeiros = (w: Mundo) => w.obs.videos.filter((v) => v.fmt === 'long' && !w.obs.channel(v.ch)!.own)
  it('(i, Foco 6) vídeo sem linha entra em semLugarCalculado e fora do filtro; o cabeçalho tem o número', async () => {
    const w0 = mundo()
    const v = primeiros(w0)
    const linhas: Linha[] = [{ video_id: v[0]!.id, chaves: ['local:vn-hanoi', 'pais:VN'], semente_versao: 2 }, { video_id: v[1]!.id, chaves: [], semente_versao: 2 }]
    const { rodar } = await preparar({ linhas })
    const r = await resultado(rodar({ lugar: 'local:vn-hanoi', formato: 'longos', janelaIdade: 'todas' }))
    expect(todas(r).map((l) => l.id)).toEqual([v[0]!.id])
    expect(r.lugar).toMatchObject({ estado: 'marcado', calculadoEm: CALCULADO, atrasado: false, emRecalculo: false, maisDeUmLugar: 0 })
    expect(r.lugar!.semLugarCalculado).toBe(primeiros(w0).filter((x) => x.ageDays >= 0).length - 2)
    expect(r.lugar!.semLugarCalculado).toBeGreaterThan(0)
    expect(todas(r)[0]!.lugares).toEqual(['local:vn-hanoi', 'pais:VN'])
  })
  it('Foco 1: slug válido sem nenhum vídeo marcado é resultado vazio, nunca recusa "desconhecido"', async () => {
    const { rodar } = await preparar({ linhas: [] })
    const r = await rodar({ lugar: 'pais:VN', formato: 'longos', janelaIdade: 'todas' })
    expect(ehResultado(r)).toBe(true)
    expect(todas(r as never)).toHaveLength(0)
  })
  it('{local, pais} no mesmo vídeo conta 1 vídeo com mais de um lugar? não: é 1 lugar; dois locais distintos contam', async () => {
    const w0 = mundo()
    const v = primeiros(w0)
    const linhas: Linha[] = [
      { video_id: v[0]!.id, chaves: ['local:vn-hanoi', 'pais:VN'], semente_versao: 2 },
      { video_id: v[1]!.id, chaves: ['local:vn-hanoi', 'local:vn-saigon'], semente_versao: 2 },
    ]
    const { rodar } = await preparar({ linhas })
    const r = await resultado(rodar({ lugar: 'local:vn-hanoi', formato: 'longos', janelaIdade: 'todas' }))
    expect(r.lugar).toMatchObject({ maisDeUmLugar: 1, maisDeUmLugarSobre: 'marcados' })
  })
  it('slug inexistente: lugar_desconhecido, e nenhuma entrada de cache nem leitura de video_lugares', async () => {
    const { rodar, cache, b } = await preparar({ linhas: [] })
    const r = await rodar({ lugar: 'pais:ZZ' })
    expect(r).toMatchObject({ recusa: 'lugar_desconhecido' })
    expect(cache.entries.size).toBe(0)
    expect(b.leituras.video_lugares).toBe(0)
  })
  it('(j) lerEstadoDaAba null com lugar: lugar_falhou', async () => {
    const { rodar } = await preparar({ estado: null })
    expect(await rodar({ lugar: 'local:vn-hanoi' })).toMatchObject({ recusa: 'lugar_falhou' })
  })
  it('(k) situacaoDoSlug "falhou": lugar_falhou (nunca desconhecido, nunca vazio)', async () => {
    const { rodar } = await preparar({ db: { falhaLugares: true } })
    expect(await rodar({ lugar: 'local:vn-hanoi' })).toMatchObject({ recusa: 'lugar_falhou' })
  })
  it('leitura do mapa lançando com lugar: lugar_falhou, e a 2ª chamada relê (a falha não ficou no cache)', async () => {
    const { rodar, b, cache } = await preparar({ db: { falhaLinhas: true } })
    expect(await rodar({ lugar: 'local:vn-hanoi' })).toMatchObject({ recusa: 'lugar_falhou' })
    expect(await rodar({ lugar: 'local:vn-hanoi' })).toMatchObject({ recusa: 'lugar_falhou' })
    expect(b.leituras.video_lugares).toBe(2)
    expect(cache.entries.size).toBe(0)
  })
  it('nunca calculado: lugar_sem_calculo com a frase "nunca calculados"; sem lugar a ação responde e diz isso', async () => {
    const { rodar } = await preparar({ estado: { calculado: false, velho: false, computado_em: null } })
    const r = await rodar({ lugar: 'local:vn-hanoi' })
    expect(r).toMatchObject({ recusa: 'lugar_sem_calculo' })
    expect((r as { frase: string }).frase).toMatch(/nunca calculados/)
    const livre = await resultado(rodar({ lugar: undefined, formato: 'longos' }))
    expect(todas(livre).every((l) => l.lugares === null)).toBe(true)
    expect(livre.lugaresNota).toMatch(/nunca calculados/)
  })
  it('(14) tarefa desligada SEM cálculo: lugar_sem_calculo, frase "tarefa desligada" (a variável apagada)', async () => {
    delete process.env.OBS_SINAIS_NICHO
    const { rodar } = await preparar({ estado: { calculado: false, velho: false, computado_em: null } })
    const r = await rodar({ lugar: 'local:vn-hanoi' })
    expect(r).toMatchObject({ recusa: 'lugar_sem_calculo' })
    expect((r as { frase: string }).frase).toMatch(/tarefa desligada/)
  })
  it('DECISÃO Phil M-3: tarefa desligada COM cálculo existente NÃO recusa o filtro lugar: usa o mapa e avisa "tarefa de lugares desligada; lugares calculados em <data>"', async () => {
    delete process.env.OBS_SINAIS_NICHO
    const w0 = mundo()
    const v = primeiros(w0)
    const { rodar } = await preparar({ linhas: [{ video_id: v[0]!.id, chaves: ['local:vn-hanoi'], semente_versao: 2 }] })
    const r = await resultado(rodar({ lugar: 'local:vn-hanoi', formato: 'longos', janelaIdade: 'todas' }))
    expect(todas(r).map((l) => l.id)).toEqual([v[0]!.id])
    expect(r.lugar).toMatchObject({ estado: 'marcado', desligado: true, calculadoEm: CALCULADO })
    const { empacotarConsulta } = await import('@/app/cms/(authed)/youtube/competitors/_contexto-ia/empacotar-consulta')
    const linhaLugar = empacotarConsulta(r).tabelas[0]!.linhas.find((l) => l[0]!.texto === 'Lugar')![1]!.texto
    expect(linhaLugar).toMatch(/tarefa de lugares desligada; lugares calculados em \d{2}\/\d{2}/)
  })
  it('(7) cálculo velho: atrasado true; recálculo em andamento (duas semente_versao): emRecalculo true', async () => {
    const w0 = mundo()
    const v = primeiros(w0)
    const { rodar } = await preparar({
      estado: { calculado: true, velho: true, computado_em: '2026-10-20T10:00:00Z' },
      linhas: [{ video_id: v[0]!.id, chaves: ['local:vn-hanoi'], semente_versao: 2 }, { video_id: v[1]!.id, chaves: [], semente_versao: 3 }],
    })
    const r = await resultado(rodar({ lugar: 'local:vn-hanoi', formato: 'longos', janelaIdade: 'todas' }))
    expect(r.lugar).toMatchObject({ atrasado: true, emRecalculo: true })
  })
  it('(l, N4) sem lugar: computed_at A e depois B dão 2 leituras do mapa; a chave nunca é "nunca" com cálculo existente', async () => {
    const w0 = mundo()
    const topo = ordenar(montarConjunto(w0.p, w0.entrada).longos, w0.p, { canalAtrasado: () => false })[0]!
    const v = [{ id: topo.id, ch: topo.canalId }]
    const { rodar: rodar0, b, cache } = await preparar({ linhas: [{ video_id: v[0]!.id, chaves: ['pais:VN'], semente_versao: 2 }] })
    const rodar = (p: Parameters<typeof rodar0>[0] = {}) => rodar0({ limite: 3, ...p })
    await resultado(rodar({ formato: 'longos' }))
    expect(b.leituras.video_lugares).toBe(1)
    await resultado(rodar({ formato: 'longos' }))
    expect(b.leituras.video_lugares).toBe(1)
    m.estado.mockResolvedValue({ calculado: true, velho: false, computado_em: '2026-10-25T10:00:00Z' })
    const r = await resultado(rodar({ formato: 'longos' }))
    expect(b.leituras.video_lugares).toBe(2)
    expect([...cache.entries.keys()].some((k) => k.includes('nunca'))).toBe(false)
    expect(todas(r).find((l) => l.id === v[0]!.id)!.lugares).toEqual(['pais:VN'])
  })
  it('sem lugar e leitura do mapa falhando: lugares null ("lugares não carregaram"), resultado ok, nunca lista vazia', async () => {
    const { rodar } = await preparar({ db: { falhaLinhas: true } })
    const r = await resultado(rodar({ formato: 'longos' }))
    expect(todas(r).length).toBeGreaterThan(0)
    expect(todas(r).every((l) => l.lugares === null)).toBe(true)
    expect(r.lugaresNota).toMatch(/lugares não vieram/)
  })
  it('sem lugar e lerEstadoDaAba null: lugares não carregaram, ok (a ação responde sem o filtro)', async () => {
    const { rodar } = await preparar({ estado: null })
    const r = await resultado(rodar({ formato: 'longos' }))
    expect(r.lugaresNota).toMatch(/lugares não vieram/)
  })
  it('toda leitura de video_lugares leva .eq(site_id) do site da página', async () => {
    const { rodar, b } = await preparar({ linhas: [] })
    await resultado(rodar({ formato: 'longos' }))
    const doSite = b.eqs.filter((e) => e[0] === 'video_lugares' && e[1] === 'site_id')
    expect(doSite.length).toBeGreaterThan(0)
    expect(doSite.every((e) => e[2] === SITE)).toBe(true)
  })
})

describe('montarConsulta: o pedido vira blocos, limite e agregados', () => {
  it('formato todos: dois blocos; limite vale por bloco; os agregados são do conjunto inteiro, não das linhas', async () => {
    const { rodar } = await preparar()
    const r = await resultado(rodar({ formato: 'todos', limite: 2, janelaIdade: 'todas' }))
    expect(r.blocos.map((b) => b.formato)).toEqual(['longos', 'shorts'])
    for (const b of r.blocos) {
      expect(b.linhas.length).toBeLessThanOrEqual(2)
      expect(b.agregado.elegiveis).toBe(b.linhas.length + b.cortadasPorLimite)
    }
    expect(r.blocos[0]!.cortadasPorLimite).toBeGreaterThan(0)
  })
  it('formato longos: um bloco só', async () => {
    const { rodar } = await preparar()
    expect((await resultado(rodar({ formato: 'longos' }))).blocos.map((b) => b.formato)).toEqual(['longos'])
  })
  it('a ordem: multiplicador desc entre as sólidas, nulos por último (a ordem do motor)', async () => {
    const { rodar } = await preparar()
    const r = await resultado(rodar({ formato: 'longos', limite: 50, janelaIdade: 'todas' }))
    const ls = r.blocos[0]!.linhas
    const solidas = ls.filter((l) => l.celulas.multiplicador?.x != null && !l.baseFraca).map((l) => l.celulas.multiplicador!.x!)
    expect(solidas.length).toBeGreaterThan(1)
    expect(solidas).toEqual([...solidas].sort((a, b) => b - a))
    const primeiroNulo = ls.findIndex((l) => l.celulas.multiplicador?.x == null)
    if (primeiroNulo >= 0) expect(ls.slice(primeiroNulo).every((l) => l.celulas.multiplicador?.x == null)).toBe(true)
  })
  it('pedido() da fixture serve de base', () => { expect(pedido().limite).toBe(20) })
})
