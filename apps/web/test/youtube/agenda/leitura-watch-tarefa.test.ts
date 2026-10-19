// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AlvoAtivo } from '@/lib/youtube/watch/alvos'
import type { ResultadoLeitor } from '@/lib/youtube/watch/leitor'
import { RENDERERS_TITULO } from '@/lib/youtube/teste-youtube/tipos'

const mocks = vi.hoisted(() => ({ schema: vi.fn(), conciliar: vi.fn(), lerDevidos: vi.fn() }))
vi.mock('@/lib/youtube/competitor-health', () => ({ schemaTablesReady: mocks.schema }))
vi.mock('@/lib/youtube/watch/alvos', async orig => ({ ...(await orig<typeof import('@/lib/youtube/watch/alvos')>()), conciliar: mocks.conciliar, lerDevidos: mocks.lerDevidos }))

import { rodarLeituraWatch } from '@/lib/youtube/agenda/tarefas/leitura-watch'
import type { ContextoTarefa } from '@/lib/youtube/agenda/tipos'

const T0 = Date.UTC(2026, 9, 18, 12, 0, 0)
const SITE = '00000000-0000-4000-8000-000000000099'
const yt = (n: number): string => `v${String(n).padStart(10, '0')}`
const iso = (ms: number): string => new Date(ms).toISOString()
const uuid = (() => { let n = 0; return () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}` })()

const alvo = (n: number): AlvoAtivo => ({ id: n, siteId: SITE, ytId: yt(n), horaBaseMin: 10, rodadasPorDia: 4, proximaRodadaEm: iso(T0 - 60_000),
  coletaAte: iso(T0 + 10 * 86_400_000), motivoAte: 'janela_concorrente', extensoesCurtas: 0, indisponivelSeguidas: 0, rodadas: 0, temTesteNosso: false })
function res(id: string, erro: string | null, quando: number): ResultadoLeitor {
  return {
    leitura: { youtubeVideoId: id, lidaEm: iso(quando), rodadaId: uuid(), origemRede: 'vercel', idioma: erro === null ? 'pt-BR' : null, erro, tituloOficial: null,
      titulo_oficial_fonte: null, rendicoesSqp: null, titulosExibidos: RENDERERS_TITULO.map(renderer => ({ renderer, texto: erro === null ? 'T' : null })), miniaturas: [] },
    http: erro === null ? 200 : null, jogadorBloqueado: false,
  }
}

interface Rpc { nome: string; p: { leituras: unknown[]; alvos: Array<Record<string, unknown>>; thumbs: unknown[] } }
function contexto(inicio = 0) {
  const state = { agora: T0 + inicio }
  const rpcs: Rpc[] = []
  const sb = {
    rpc: (nome: string, args: { p: Rpc['p'] }) => { rpcs.push({ nome, p: args.p }); return { abortSignal: () => Promise.resolve({ data: null, error: null }) } },
  } as never
  const c: ContextoTarefa = { t0: T0, agora: () => state.agora, apiKey: '', sb, linhas: null }
  return { c, state, rpcs }
}
const conc = (o: Partial<{ candidatosEsperados: number; alvosAtivos: number; idsDescartados: number }> = {}) =>
  ({ valor: { candidatosEsperados: 3, alvosAtivos: 3, inseridos: 0, removidos: 0, sites: [SITE], testesVivos: new Set<string>(), idsDescartados: 0, ...o } })

beforeEach(() => {
  mocks.schema.mockReset().mockResolvedValue(null)
  mocks.conciliar.mockReset().mockResolvedValue(conc())
  mocks.lerDevidos.mockReset().mockResolvedValue({ valor: [alvo(1), alvo(2), alvo(3)] })
})
const deps = (ler: (id: string) => Promise<ResultadoLeitor>) => ({ ler: ler as never, novoUuid: uuid, rng: () => 0.5 })

describe('leitura_watch: tarefa', () => {
  it('guarda ausente (42P01): parcial schema_ausente, sem conciliar', async () => {
    mocks.schema.mockResolvedValue({ tipo: 'ausente', texto: 'x', codigo: '42P01' })
    const { c } = contexto()
    expect(await rodarLeituraWatch(c, deps(async id => res(id, null, T0)))).toMatchObject({ estado: 'parcial', motivo: 'schema_ausente', feitas: 0 })
    expect(mocks.conciliar).not.toHaveBeenCalled()
  })
  it('conciliar com porque: erro lista_falhou e nenhuma leitura', async () => {
    mocks.conciliar.mockResolvedValue({ porque: 'conciliação dos alvos falhou', causa: 'erro_do_banco' })
    const ler = vi.fn()
    const { c, rpcs } = contexto()
    expect(await rodarLeituraWatch(c, deps(ler))).toMatchObject({ estado: 'erro', motivo: 'lista_falhou', feitas: 0 })
    expect(ler).not.toHaveBeenCalled()
    expect(rpcs).toHaveLength(0)
  })
  it('lerDevidos com porque: erro lista_falhou', async () => {
    mocks.lerDevidos.mockResolvedValue({ porque: 'x', causa: 'excecao' })
    expect(await rodarLeituraWatch(contexto().c, deps(async id => res(id, null, T0)))).toMatchObject({ estado: 'erro', motivo: 'lista_falhou' })
  })
  it('caminho feliz: 9 leituras, uma gravação, alvos fechados', async () => {
    const { c, rpcs } = contexto()
    const r = await rodarLeituraWatch(c, deps(async id => res(id, null, T0)))
    expect(r).toMatchObject({ estado: 'ok', feitas: 9, deixadas: 0 })
    expect(rpcs).toHaveLength(1)
    expect(rpcs[0]!.nome).toBe('yt_watch_gravar_disparo')
    expect(rpcs[0]!.p.leituras).toHaveLength(9)
    expect(rpcs[0]!.p.alvos).toHaveLength(3)
    expect(rpcs[0]!.p.alvos.every(a => a.rodadas_mais === 1 && typeof a.proxima_rodada_em === 'string')).toBe(true)
  })
  it('sem devido: ok feitas 0 se há alvos; parcial sem_alvos se não há', async () => {
    mocks.lerDevidos.mockResolvedValue({ valor: [] })
    expect(await rodarLeituraWatch(contexto().c, deps(async id => res(id, null, T0)))).toMatchObject({ estado: 'ok', feitas: 0 })
    mocks.conciliar.mockResolvedValue(conc({ alvosAtivos: 0, candidatosEsperados: 3 }))
    expect(await rodarLeituraWatch(contexto().c, deps(async id => res(id, null, T0)))).toMatchObject({ estado: 'parcial', motivo: 'sem_alvos' })
    mocks.conciliar.mockResolvedValue(conc({ alvosAtivos: 0, candidatosEsperados: 0 }))
    expect(await rodarLeituraWatch(contexto().c, deps(async id => res(id, null, T0)))).toMatchObject({ estado: 'ok', feitas: 0 })
  })
  it('bloqueio: 3 respostas 429 param, as feitas são gravadas, erro bloqueado', async () => {
    const { c, rpcs } = contexto()
    const r = await rodarLeituraWatch(c, deps(async id => res(id, 'http_429', T0)))
    expect(r).toMatchObject({ estado: 'erro', motivo: 'bloqueado', feitas: 0 })
    expect(rpcs).toHaveLength(1)
    expect(rpcs[0]!.p.leituras).toHaveLength(3)
    expect(rpcs[0]!.p.alvos).toEqual([])
  })
  it('com agora em 70 s (decorrido > 70 s): nenhum vídeo novo começa', async () => {
    const ler = vi.fn()
    const { c, rpcs } = contexto(70_001)
    expect(await rodarLeituraWatch(c, deps(ler))).toMatchObject({ estado: 'parcial', motivo: 'sobrou', feitas: 0 })
    expect(ler).not.toHaveBeenCalled()
    expect(mocks.conciliar).not.toHaveBeenCalled()
    expect(rpcs).toHaveLength(0)
  })
  it('a tarefa não passa de 30 s próprios (relógio falso): a 3ª passada não começa', async () => {
    const { c, state } = contexto()
    const ler = vi.fn(async (id: string) => { state.agora += 5_000; return res(id, null, state.agora) })
    const r = await rodarLeituraWatch(c, deps(ler))
    expect(ler).toHaveBeenCalledTimes(6)
    expect(r.feitas).toBe(6)
  })
  it('K pelo relógio: a 60 s o disparo pede K + 1 = 6 devidos e leva 5; sobrou', async () => {
    mocks.lerDevidos.mockImplementation(async (_sb: unknown, _agora: number, limite: number) => ({ valor: Array.from({ length: limite }, (_, i) => alvo(i + 1)) }))
    const { c, state, rpcs } = contexto(60_000)
    const r = await rodarLeituraWatch(c, deps(async id => { state.agora += 1; return res(id, null, state.agora) }))
    expect(mocks.lerDevidos.mock.calls[0]![2]).toBe(6)
    expect(r).toMatchObject({ estado: 'parcial', motivo: 'sobrou', deixadas: null })
    expect(r.detalhe).toMatchObject({ sobrou_algum: 1 })
    expect(rpcs[0]!.p.leituras).toHaveLength(15)
  })
  it('I1: nenhuma leitura nova começa depois de t0 + 70 s e a gravação ainda acontece antes de 83 s', async () => {
    mocks.lerDevidos.mockImplementation(async (_sb: unknown, _agora: number, limite: number) => ({ valor: Array.from({ length: limite }, (_, i) => alvo(i + 1)) }))
    const { c, state, rpcs } = contexto(55_000)
    const ler = vi.fn(async (id: string) => { state.agora += 6_000; return res(id, 'timeout', state.agora) })
    const r = await rodarLeituraWatch(c, deps(ler))
    expect(ler).toHaveBeenCalledTimes(3)
    expect(r.motivo).not.toBe('passou_do_tempo')
    expect(rpcs).toHaveLength(1)
    expect(rpcs[0]!.p.leituras).toHaveLength(3)
  })
  it('M4: guarda de schema que não conseguiu conferir: erro schema_nao_conferido, sem conciliar nem ler', async () => {
    mocks.schema.mockResolvedValue({ tipo: 'nao_conferido', texto: 'x', codigo: '08006' })
    const ler = vi.fn()
    expect(await rodarLeituraWatch(contexto().c, deps(ler))).toMatchObject({ estado: 'erro', motivo: 'schema_nao_conferido', feitas: 0 })
    expect(mocks.conciliar).not.toHaveBeenCalled()
    expect(ler).not.toHaveBeenCalled()
  })
  it('Phil: os ids descartados pelo filtro de 11 caracteres vão ao detalhe', async () => {
    mocks.conciliar.mockResolvedValue(conc({ idsDescartados: 3 }))
    const r = await rodarLeituraWatch(contexto().c, deps(async id => res(id, null, T0)))
    expect(r.detalhe).toMatchObject({ ids_descartados: 3 })
  })
  it('gravação que falha por timeout: erro gravacao_falhou', async () => {
    const { c } = contexto()
    ;(c as { sb: unknown }).sb = { rpc: () => ({ abortSignal: () => Promise.reject(new Error('t')) }) }
    expect(await rodarLeituraWatch(c, deps(async id => res(id, null, T0)))).toMatchObject({ estado: 'erro', motivo: 'gravacao_falhou' })
  })
})
