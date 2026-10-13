// @vitest-environment node
// A5 · E14, Tarefa 9: a tarefa `retratos_comentarios` (coletar). Banco falso, API por `fetchImpl` falso (o tempo é do relógio
// injetado, nunca de timers falsos sobre a API), dado 100% inventado. O teste 23 usa HTTP de verdade e o SDK do Sentry.
import { readFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { scrubBreadcrumbPii, scrubEventPii } from '@/lib/sentry-pii'

const desde = vi.hoisted(() => ({ v: null as string | null }))
const relatar = vi.hoisted(() => vi.fn())

vi.mock('@/lib/youtube/observatorio/comentarios/regras', async (orig) => {
  const m = await orig<typeof import('@/lib/youtube/observatorio/comentarios/regras')>()
  return { ...m, get COMMENT_SINCE() { return desde.v } }
})
vi.mock('@/lib/youtube/observatorio/comentarios/relato', async (orig) => {
  const m = await orig<typeof import('@/lib/youtube/observatorio/comentarios/relato')>()
  return {
    ...m,
    relatarComentarios: (...a: Parameters<typeof m.relatarComentarios>) => { relatar(...a); m.relatarComentarios(...a) },
  }
})
vi.mock('@/lib/youtube/observatorio/comentarios/gravar', async (orig) => {
  const m = await orig<typeof import('@/lib/youtube/observatorio/comentarios/gravar')>()
  return { ...m, gravarRetrato: vi.fn(m.gravarRetrato), montarPacote: vi.fn(m.montarPacote) }
})

import { runRetratosComentarios } from '@/lib/youtube/observatorio/comentarios/coletar'
import { gravarRetrato, montarPacote, PacoteInvalido } from '@/lib/youtube/observatorio/comentarios/gravar'
import { fraseDe, FRASES_FIXAS } from '@/lib/youtube/observatorio/comentarios/frases'
import { CODIGOS_EXECUCAO, COMMENT_RULES, WORST_END_FROM_T0_MS } from '@/lib/youtube/observatorio/comentarios/regras'
import type { TarefaSaida } from '@/lib/youtube/observatorio/comentarios/tipos'
import {
  CANAL_ACOMPANHADO, CANAL_DO_DONO, CANAL_DO_VIDEO, H, canal, canalComInscritos, comentarioPorId, conversa, corpoDeCanais,
  corpoDeConversas, corpoPorId, iso, CORPO_DESLIGADOS,
} from './comentarios-fixtures'

// ───── o mundo falso ─────
const NOW0 = Date.parse('2026-03-10T16:00:00.000Z')
const CHAVE = 'CHAVE-FALSA-DE-TESTE-9f8e7d'
const SENT_TEXTO = 'TEXTO-SENTINELA-123'
const SENT_NOME = 'AUTOR-SENTINELA'
const SENT_CANAL = 'UCsentinelaAUTOR000000001'
const SENT_ID = 'UgxSENTINELAcomentario01'
const SENTINELAS = [SENT_TEXTO, SENT_NOME, SENT_CANAL, SENT_ID]

const clock = { t: NOW0, explode: false }
const now = (): number => {
  if (clock.explode) {
    clock.explode = false
    throw new TypeError(`erro com ${SENT_TEXTO} e ${SENT_NOME}`)
  }
  return clock.t
}
const custo = { api: 0, ida: 0 }

type Resp = { data: unknown; error: unknown }
interface ChamadaSb { tipo: 'rpc' | 'from'; nome: string; args?: Record<string, unknown>; filtros: Array<[string, unknown[]]> }
const ok = (data: unknown): Resp => ({ data, error: null })
const falha = (code: string, message = 'mensagem do banco'): Resp => ({ data: null, error: { message, details: 'detalhe', hint: null, code } })

const PROVA = {
  identidade_vencida: 0, identidade_prazo_errado: 0, identidade_de_criador: 0, respostas_de_terceiros: 0, retratos_atrasados: 0,
  retratos_em_erro: 0, erros_por_motivo: {}, retratos_na_janela: 4, retratos_perdidos_7d: 0, perdidos_por_motivo: {},
  retratos_total: 10, retratos_ok: 9, primeira_coleta: iso(NOW0 - 100 * H), ultima_coleta: iso(NOW0 - H), comentarios_total: 50,
  identidades_total: 40, comentarios_ausentes_sem_decisao: 0,
}

interface Mundo {
  provas: unknown[] // por ordem de chamada; a última se repete
  linhas: Array<Record<string, unknown>> | Resp
  cadastro: () => Resp
  guardados: (videoId: string) => Resp
  apply: (args: Record<string, unknown>, n: number) => Resp | Promise<Resp>
  quota: (args: Record<string, unknown>) => Resp | Promise<Resp>
}
let mundo: Mundo
let chamadasSb: ChamadaSb[]

function novoMundo(): Mundo {
  return {
    provas: [PROVA],
    linhas: [],
    cadastro: () => ok([{ id: 'row-ch-1', channel_id: CANAL_ACOMPANHADO }]),
    guardados: () => ok([]),
    apply: () => ok({ status: 'gravado', ausentes_marcados: 0 }),
    quota: () => ok(null),
  }
}

const COM_CUSTO_RPC = new Set(['competitor_comment_health', 'competitor_comment_due', 'apply_competitor_comment_snap', 'youtube_quota_add'])
const COM_CUSTO_FROM = new Set(['competitor_channels', 'competitor_video_comments'])

function resolver(c: ChamadaSb): Resp | Promise<Resp> {
  const nChamadas = chamadasSb.filter((x) => x.nome === c.nome).length // já inclui esta
  if ((c.tipo === 'rpc' && COM_CUSTO_RPC.has(c.nome)) || (c.tipo === 'from' && COM_CUSTO_FROM.has(c.nome))) clock.t += custo.ida
  if (c.tipo === 'rpc') {
    const a = c.args ?? {}
    if (c.nome === 'competitor_comment_health') {
      const p = mundo.provas[Math.min(nChamadas - 1, mundo.provas.length - 1)]
      return p instanceof Error ? falhaDe(p) : isResp(p) ? p : ok(p)
    }
    if (c.nome === 'competitor_comment_due') return Array.isArray(mundo.linhas) ? ok(mundo.linhas) : mundo.linhas
    if (c.nome === 'apply_competitor_comment_snap') return mundo.apply(a, nChamadas)
    if (c.nome === 'youtube_quota_add') return mundo.quota(a)
    throw new Error('rpc inesperada: ' + c.nome)
  }
  if (c.nome === 'competitor_channels') return mundo.cadastro()
  if (c.nome === 'youtube_channels') return ok([{ channel_id: CANAL_DO_DONO }])
  if (c.nome === 'competitor_video_comments') {
    const f = c.filtros.find((x) => x[0] === 'eq' && x[1][0] === 'video_id')
    return mundo.guardados(String(f?.[1][1]))
  }
  throw new Error('tabela inesperada: ' + c.nome)
}
const isResp = (x: unknown): x is Resp => typeof x === 'object' && x !== null && 'data' in x && 'error' in x
const falhaDe = (e: Error): Resp => { throw e }

function criarSb(): SupabaseClient {
  const construtor = (c: ChamadaSb): Record<string, unknown> => {
    const b: Record<string, unknown> = {}
    for (const m of ['eq', 'limit', 'in', 'order']) b[m] = (...a: unknown[]) => { c.filtros.push([m, a]); return b }
    b.select = () => b
    b.abortSignal = () => b
    b.then = (okf: (r: Resp) => unknown, ko: (e: unknown) => unknown) => {
      chamadasSb.push(c)
      try { return Promise.resolve(resolver(c)).then(okf, ko) } catch (e) { return Promise.reject(e).then(okf, ko) }
    }
    return b
  }
  return {
    rpc: (nome: string, args: Record<string, unknown>) => construtor({ tipo: 'rpc', nome, args, filtros: [] }),
    from: (nome: string) => construtor({ tipo: 'from', nome, filtros: [] }),
  } as unknown as SupabaseClient
}

// ───── a API falsa (fetchImpl) ─────
type Rota = 'commentThreads' | 'channels' | 'comments' | 'videos'
type RespApi = { status?: number; body?: unknown; raw?: string } | Error
interface ChamadaApi { rota: Rota; params: URLSearchParams; n: number }
type Roteiro = (c: ChamadaApi) => RespApi
const okApi = (body: unknown): RespApi => ({ status: 200, body })
const erroApi = (status: number, reason: string | null, message = 'mensagem da API'): RespApi => ({
  status, body: { error: { code: status, message, errors: reason === null ? [] : [{ reason, domain: 'youtube.commentThread' }] } },
})
const conversasPadrao = (): unknown => corpoDeConversas([1, 2, 3].map((n) => conversa(n, { curtidas: 100 - n })))
const padrao: Roteiro = ({ rota }) => {
  switch (rota) {
    case 'commentThreads': return okApi(conversasPadrao())
    case 'channels': return okApi(corpoDeCanais([], 0))
    case 'comments': return okApi(corpoPorId([]))
    case 'videos': return okApi({ items: [{ id: 'x', statistics: { commentCount: '0' } }] })
  }
}
let roteiro: Roteiro
let chamadasApi: ChamadaApi[]
const contador: Record<string, number> = {}

const fetchImpl = (async (input: string | URL | Request): Promise<Response> => {
  const url = new URL(String(input))
  const rota = url.pathname.split('/').pop() as Rota
  contador[rota] = (contador[rota] ?? 0) + 1
  const c: ChamadaApi = { rota, params: url.searchParams, n: contador[rota] - 1 }
  chamadasApi.push(c)
  clock.t += custo.api
  const r = roteiro(c)
  if (r instanceof Error) throw r
  return new Response(r.raw ?? JSON.stringify(r.body ?? {}), { status: r.status ?? 200, headers: { 'content-type': 'application/json' } })
}) as typeof fetch

const doRota = (rota: Rota): ChamadaApi[] => chamadasApi.filter((c) => c.rota === rota)
const sbDe = (nome: string): ChamadaSb[] => chamadasSb.filter((c) => c.nome === nome)
const idsDe = (c: ChamadaApi): string[] => (c.params.get('id') ?? '').split(',').filter((x) => x !== '')

// ───── os devidos ─────
function linha(n: number, o: Record<string, unknown> = {}): Record<string, unknown> {
  const marco = (o.mark as number | undefined) ?? 1
  const idadeH = marco === 1 ? 30 : marco === 7 ? 170 : 722
  return {
    video_id: `vid-row-${n}`, youtube_video_id: `YT-VIDEO-${n}`, site_id: 'site-1', channel_row_id: 'canal-row-1',
    channel_youtube_id: CANAL_DO_VIDEO, channel_subscribers: 1000, channel_subscribers_hidden: false, mark: marco,
    t0: iso(NOW0 - idadeH * H), deadline: iso(NOW0 + n * H), video_comment_count: 50, video_checked_at: iso(NOW0 - H),
    prev_status: null, stored_n: 0, total_due: 0, ...o,
  }
}
function lista(n: number, o: (i: number) => Record<string, unknown> = () => ({})): Array<Record<string, unknown>> {
  return Array.from({ length: n }, (_, i) => ({ ...linha(i + 1, o(i + 1)), total_due: (o(i + 1).total_due as number | undefined) ?? n }))
}

interface Opcoes { inicio?: number; t0?: number; ctx?: Record<string, unknown>; semFetch?: boolean }
async function rodar(o: Opcoes = {}): Promise<TarefaSaida> {
  const inicio = o.inicio ?? clock.t
  return runRetratosComentarios({
    sb: criarSb(), apiKey: CHAVE, now, t0: o.t0 ?? inicio, inicioMs: inicio, ...(o.semFetch ? {} : { fetchImpl }), ...(o.ctx ?? {}),
  })
}

/** A frase do dono nunca é vazia para um erro (a agenda cairia na frase fixa em silêncio). */
function comFrase(s: TarefaSaida): TarefaSaida {
  if (s.status === 'erro') {
    expect(s.motivo).toBeDefined()
    expect(fraseDe(s.motivo as string, s.numeros)).not.toBe('')
  }
  return s
}

const snapDe = (c: ChamadaSb): Record<string, unknown> => (c.args?.p_snap ?? {}) as Record<string, unknown>
const comentariosDe = (c: ChamadaSb): Array<Record<string, unknown>> => (c.args?.p_comments ?? []) as Array<Record<string, unknown>>

const envelopes: string[] = []
beforeAll(() => {
  Sentry.init({
    dsn: 'https://publica@o0.ingest.sentry.io/0',
    tracesSampleRate: 1,
    sendDefaultPii: false,
    beforeSend: scrubEventPii,
    beforeSendTransaction: scrubEventPii,
    beforeBreadcrumb: scrubBreadcrumbPii,
    transport: () => ({ send: async (e) => { envelopes.push(JSON.stringify(e)); return {} }, flush: async () => true }),
  })
})

beforeEach(() => {
  clock.t = NOW0
  clock.explode = false
  custo.api = 0
  custo.ida = 0
  desde.v = null
  mundo = novoMundo()
  chamadasSb = []
  chamadasApi = []
  for (const k of Object.keys(contador)) delete contador[k]
  roteiro = padrao
  relatar.mockClear()
  vi.mocked(gravarRetrato).mockClear()
  vi.mocked(montarPacote).mockClear()
})
afterEach(() => { vi.useRealTimers() })

// ───── 1 a 6: a guarda e a lista ─────
describe('a guarda do começo', () => {
  it('1. MG8 ausente: erro schema_ausente, 0 chamadas ao YouTube, nada gravado', async () => {
    for (const code of ['PGRST202', '42883', '42P01', 'PGRST205']) {
      chamadasApi = []; chamadasSb = []
      mundo.provas = [falha(code)]
      mundo.linhas = lista(2)
      const s = comFrase(await rodar())
      expect(s.status).toBe('erro')
      expect(s.motivo).toBe('schema_ausente')
      expect(chamadasApi).toHaveLength(0)
      expect(sbDe('apply_competitor_comment_snap')).toHaveLength(0)
      expect(sbDe('competitor_comment_due')).toHaveLength(0)
    }
  })

  it('2. identidade vencida: erro, 0 chamadas, nada gravado (item 127)', async () => {
    mundo.provas = [{ ...PROVA, identidade_vencida: 3 }]
    mundo.linhas = lista(2)
    const s = comFrase(await rodar())
    expect(s.status).toBe('erro')
    expect(s.motivo).toBe('identidade_vencida')
    expect(s.numeros.identidade_vencida).toBe(3)
    expect(fraseDe('identidade_vencida', s.numeros)).toContain('3')
    expect(chamadasApi).toHaveLength(0)
    expect(sbDe('apply_competitor_comment_snap')).toHaveLength(0)
    expect(sbDe('competitor_comment_due')).toHaveLength(0)
  })

  it('3. prova ilegível (inclusive resposta nula): erro, 0 chamadas; o do começo leva na_guarda 1, o do fim não', async () => {
    const ilegiveis: unknown[] = [null, { ...PROVA, retratos_atrasados: undefined }, [PROVA], { ...PROVA, identidade_vencida: '3' }]
    for (const p of ilegiveis) {
      chamadasApi = []; chamadasSb = []
      mundo.provas = [ok(p)]
      mundo.linhas = lista(2)
      const s = comFrase(await rodar())
      expect(s.status).toBe('erro')
      expect(s.motivo).toBe('prova_ilegivel')
      expect(s.numeros.na_guarda).toBe(1)
      expect(chamadasApi).toHaveLength(0)
    }
    // erro do banco que não é schema
    chamadasSb = []
    mundo.provas = [falha('')]
    const b = comFrase(await rodar())
    expect(b.motivo).toBe('prova_ilegivel')
    expect(b.numeros.na_guarda).toBe(1)
    // a prova do fim ilegível
    chamadasSb = []; chamadasApi = []
    mundo.provas = [PROVA, ok(null)]
    mundo.linhas = lista(1)
    const fim = comFrase(await rodar())
    expect(fim.status).toBe('erro')
    expect(fim.motivo).toBe('prova_ilegivel')
    expect(fim.numeros.na_guarda).toBeUndefined()
    expect(fim.feitos).toBe(1)
  })

  it('4. COMMENT_SINCE a_decidir (o valor de verdade do repositório): erro inicio_nao_decidido, 0 idas ao banco, 0 chamadas', async () => {
    const real = await vi.importActual<typeof import('@/lib/youtube/observatorio/comentarios/regras')>('@/lib/youtube/observatorio/comentarios/regras')
    expect(real.COMMENT_SINCE).toBe('a_decidir')
    desde.v = real.COMMENT_SINCE
    mundo.linhas = lista(2)
    const s = comFrase(await rodar())
    expect(s.status).toBe('erro')
    expect(s.motivo).toBe('inicio_nao_decidido')
    expect(chamadasSb).toHaveLength(0)
    expect(chamadasApi).toHaveLength(0)
  })

  it('4b. com since ISO, a prova (começo e fim) e a lista recebem o mesmo instante; com null, nulo nos dois', async () => {
    const corte = iso(NOW0 - 10 * H)
    desde.v = corte
    mundo.linhas = lista(1)
    await rodar()
    const prova = sbDe('competitor_comment_health').map((c) => c.args?.p_since)
    expect(prova).toEqual([corte, corte])
    expect(sbDe('competitor_comment_due')[0]?.args?.p_since).toBe(corte)
    chamadasSb = []
    desde.v = null
    await rodar()
    expect(sbDe('competitor_comment_health').map((c) => c.args?.p_since)).toEqual([null, null])
    expect(sbDe('competitor_comment_due')[0]?.args?.p_since).toBeNull()
  })

  it('5. nada devido e nada atrasado: ok, 0 chamadas, uma ida só para a prova; com 2 atrasados: erro retratos_atrasados', async () => {
    mundo.linhas = []
    const s = await rodar()
    expect(s.status).toBe('ok')
    expect(s.feitos).toBe(0)
    expect(s.ficaram).toBe(0)
    expect(s.numeros.devidos).toBe(0)
    expect(chamadasApi).toHaveLength(0)
    expect(sbDe('competitor_comment_health')).toHaveLength(1)
    expect(sbDe('apply_competitor_comment_snap')).toHaveLength(0)

    chamadasSb = []
    mundo.provas = [{ ...PROVA, retratos_atrasados: 2 }]
    const e = comFrase(await rodar())
    expect(e.status).toBe('erro')
    expect(e.motivo).toBe('retratos_atrasados')
    expect(e.numeros.retratos_atrasados).toBe(2)
    expect(sbDe('competitor_comment_health')).toHaveLength(1)
  })

  it('6. lista de devidos ilegível: erro (nunca "nada devido"); cadastro ilegível: erro', async () => {
    for (const l of [falha('XX000'), ok(null), ok({}), ok([{ video_id: 'x' }])]) {
      chamadasSb = []
      mundo.linhas = l
      const s = comFrase(await rodar())
      expect(s.status).toBe('erro')
      expect(s.motivo).toBe('lista_de_devidos_ilegivel')
      expect(chamadasApi).toHaveLength(0)
    }
    chamadasSb = []
    mundo.linhas = lista(2)
    mundo.cadastro = () => falha('XX000')
    const c = comFrase(await rodar())
    expect(c.motivo).toBe('cadastro_ilegivel')
    expect(chamadasApi).toHaveLength(0)
    expect(sbDe('apply_competitor_comment_snap')).toHaveLength(0)
  })
})

// ───── 7 a 10: o retrato ─────
describe('o retrato do marco 1', () => {
  it('7. caminho feliz: 2 chamadas (conversas e inscritos), guardados não lidos, 1 escrita; ids pedidos conferidos (item 145)', async () => {
    mundo.linhas = lista(1)
    roteiro = ({ rota }) => rota === 'channels'
      ? okApi(corpoDeCanais([canalComInscritos(canal(101), { inscritos: 5_000_000 })], 3))
      : padrao({ rota, params: new URLSearchParams(), n: 0 })
    const s = await rodar()
    expect(s.status).toBe('ok')
    expect(s.feitos).toBe(1)
    expect(s.ficaram).toBe(0)
    expect(chamadasApi.map((c) => c.rota)).toEqual(['commentThreads', 'channels'])
    expect(doRota('commentThreads')[0]?.params.get('videoId')).toBe('YT-VIDEO-1')
    expect(idsDe(doRota('channels')[0] as ChamadaApi).sort()).toEqual([canal(101), canal(102), canal(103)])
    expect(sbDe('competitor_video_comments')).toHaveLength(0)
    const escritas = sbDe('apply_competitor_comment_snap')
    expect(escritas).toHaveLength(1)
    const e = escritas[0] as ChamadaSb
    expect(e.args?.p_video).toBe('vid-row-1')
    expect(e.args?.p_mark).toBe(1)
    const snap = snapDe(e)
    expect(snap.status).toBe('ok')
    expect(snap.selected_count).toBe(3)
    expect(snap.featured_lookup_n).toBe(3)
    expect(snap.featured_unknown_n).toBe(2)
    expect(snap.units_used).toBe(2)
    const c101 = comentariosDe(e).find((c) => (c.author as { channel_id?: string } | null)?.channel_id === canal(101))
    expect(c101?.featured_reason).toBe('inscritos')
    expect(c101?.featured_size_band).toBe('1m_10m')
    expect(s.numeros.unidades).toBe(2)
    expect(s.numeros.ok).toBe(1)
    const cota = sbDe('youtube_quota_add')
    expect(cota).toHaveLength(1)
    expect(cota[0]?.args).toMatchObject({ p_site_id: 'site-1', p_units: 2, p_add: { comentarios: 2, comentarios_retratos: 1 } })
  })

  it('8. desligados, vazio com contagem 0, vazio com contagem 57, falha de rede (item 111)', async () => {
    mundo.linhas = lista(1)
    // desligados
    roteiro = ({ rota }) => (rota === 'commentThreads' ? { status: 403, body: CORPO_DESLIGADOS } : padrao({ rota, params: new URLSearchParams(), n: 0 }))
    let s = await rodar()
    expect(snapDe(sbDe('apply_competitor_comment_snap')[0] as ChamadaSb).status).toBe('desligados')
    expect(s.status).toBe('ok')
    expect(s.numeros.desligados).toBe(1)
    expect(chamadasApi.map((c) => c.rota)).toEqual(['commentThreads'])

    const vazio = (contagem: unknown): Roteiro => ({ rota }) => {
      if (rota === 'commentThreads') return okApi(corpoDeConversas([]))
      if (rota === 'videos') return okApi({ items: [{ id: 'x', statistics: contagem }] })
      return padrao({ rota, params: new URLSearchParams(), n: 0 })
    }
    // contagem lida 0 → sem_comentarios (e só aí)
    chamadasSb = []; chamadasApi = []
    roteiro = vazio({ commentCount: '0' })
    s = await rodar()
    let snap = snapDe(sbDe('apply_competitor_comment_snap')[0] as ChamadaSb)
    expect(snap.status).toBe('sem_comentarios')
    expect(snap.video_comment_count).toBe(0)
    expect(s.numeros.sem_comentarios).toBe(1)
    expect(s.numeros.unidades).toBe(2)
    expect(chamadasApi.map((c) => c.rota)).toEqual(['commentThreads', 'videos'])

    // contagem 57 → erro, nunca sem_comentarios
    chamadasSb = []
    roteiro = vazio({ commentCount: '57' })
    s = await rodar()
    snap = snapDe(sbDe('apply_competitor_comment_snap')[0] as ChamadaSb)
    expect(snap.status).toBe('erro')
    expect(snap.error_reason).toBe('lista_vazia_com_contagem')
    expect(s.numeros.erros).toBe(1)
    expect(s.status).toBe('ok') // motivo do vídeo: nota, não vermelho

    // contagem que não veio: erro, nunca sem_comentarios
    chamadasSb = []
    roteiro = vazio({})
    await rodar()
    snap = snapDe(sbDe('apply_competitor_comment_snap')[0] as ChamadaSb)
    expect(snap.status).toBe('erro')
    expect(snap.error_reason).toBe('contagem_ausente')

    // contagem não lida (a chamada falhou): erro passageiro, vermelho
    chamadasSb = []
    roteiro = ({ rota }) => (rota === 'videos' ? erroApi(500, null) : vazio({})({ rota, params: new URLSearchParams(), n: 0 }))
    s = comFrase(await rodar())
    snap = snapDe(sbDe('apply_competitor_comment_snap')[0] as ChamadaSb)
    expect(snap.status).toBe('erro')
    expect(snap.error_reason).toBe('contagem_nao_lida')
    expect(s.status).toBe('erro')
    expect(s.motivo).toBe('falhas_passageiras')

    // falha de rede
    chamadasSb = []
    roteiro = ({ rota }) => (rota === 'commentThreads' ? new TypeError('fetch failed') : padrao({ rota, params: new URLSearchParams(), n: 0 }))
    s = comFrase(await rodar())
    snap = snapDe(sbDe('apply_competitor_comment_snap')[0] as ChamadaSb)
    expect(snap.status).toBe('erro')
    expect(snap.error_reason).toBe('rede')
    expect(s.feitos).toBe(1)
  })

  it('8b. conversas ilegíveis: sem lista → resposta_sem_lista; todas descartadas → lote_ilegivel', async () => {
    mundo.linhas = lista(1)
    roteiro = ({ rota }) => (rota === 'commentThreads' ? okApi({ pageInfo: { totalResults: 5 } }) : padrao({ rota, params: new URLSearchParams(), n: 0 }))
    await rodar()
    expect(snapDe(sbDe('apply_competitor_comment_snap')[0] as ChamadaSb).error_reason).toBe('resposta_sem_lista')
    chamadasSb = []
    roteiro = ({ rota }) => (rota === 'commentThreads'
      ? okApi(corpoDeConversas([conversa(1, { curtidas: 'sem-chave' }), conversa(2, { texto: null })]))
      : padrao({ rota, params: new URLSearchParams(), n: 0 }))
    const s2 = await rodar()
    expect(snapDe(sbDe('apply_competitor_comment_snap')[0] as ChamadaSb).error_reason).toBe('lote_ilegivel')
    expect(s2.numeros.descartados).toBe(2)
  })

  it('9. vazio com contagem guardada 0 e carimbo de 1 hora: a contagem é lida de novo; com a leitura falhando, erro contagem_nao_lida', async () => {
    mundo.linhas = lista(1, () => ({ video_comment_count: 0, video_checked_at: iso(NOW0 - H) }))
    roteiro = ({ rota }) => {
      if (rota === 'commentThreads') return okApi(corpoDeConversas([]))
      if (rota === 'videos') return erroApi(500, null)
      return padrao({ rota, params: new URLSearchParams(), n: 0 })
    }
    const s = comFrase(await rodar())
    expect(doRota('videos')).toHaveLength(1)
    expect(snapDe(sbDe('apply_competitor_comment_snap')[0] as ChamadaSb).status).toBe('erro')
    expect(snapDe(sbDe('apply_competitor_comment_snap')[0] as ChamadaSb).error_reason).toBe('contagem_nao_lida')
    expect(s.status).toBe('erro')
  })

  it('10. consulta de inscritos falha: o retrato é gravado, featured_lookup_n nulo, ninguém por tamanho (item 145)', async () => {
    mundo.linhas = lista(1)
    roteiro = ({ rota }) => (rota === 'channels' ? erroApi(500, null) : padrao({ rota, params: new URLSearchParams(), n: 0 }))
    const s = await rodar()
    const e = sbDe('apply_competitor_comment_snap')[0] as ChamadaSb
    expect(snapDe(e).status).toBe('ok')
    expect(snapDe(e).featured_lookup_n).toBeNull()
    expect(snapDe(e).featured_unknown_n).toBe(3)
    expect(comentariosDe(e).every((c) => c.featured_reason === null)).toBe(true)
    expect(s.numeros.consultas_de_autor_falhas).toBe(1)
    expect(s.status).toBe('ok')
  })
})

// ───── 11 a 13: a conferência por id ─────
describe('marcos 7 e 30: a conferência dos guardados', () => {
  const g = (id: string, topo = true): Record<string, unknown> => ({ youtube_comment_id: id, parent_id: topo ? null : 9 })
  const lote3 = ['Ugx-sintetico-01', 'Ugx-sintetico-02', 'Ugx-sintetico-03']

  it('11. guardado fora do lote e achado por id entra sem posição; fora do lote e não achado vai para missing', async () => {
    mundo.linhas = lista(1, () => ({ mark: 7, stored_n: 5 }))
    mundo.guardados = () => ok([...lote3.map((id) => g(id)), g('G-ACHADO'), g('G-SUMIU')])
    roteiro = ({ rota }) => (rota === 'comments' ? okApi(corpoPorId([comentarioPorId('G-ACHADO', { curtidas: 7 })])) : padrao({ rota, params: new URLSearchParams(), n: 0 }))
    const s = await rodar()
    expect(sbDe('competitor_video_comments')).toHaveLength(1)
    expect(sbDe('competitor_video_comments')[0]?.filtros).toContainEqual(['eq', ['video_id', 'vid-row-1']])
    expect(doRota('comments')).toHaveLength(1)
    expect(idsDe(doRota('comments')[0] as ChamadaApi).sort()).toEqual(['G-ACHADO', 'G-SUMIU'])
    const e = sbDe('apply_competitor_comment_snap')[0] as ChamadaSb
    const achado = comentariosDe(e).find((c) => c.youtube_comment_id === 'G-ACHADO')
    expect(achado).toMatchObject({ via: 'id', likes: 7 })
    expect(achado).not.toHaveProperty('relevance_rank')
    expect(e.args?.p_missing).toEqual(['G-SUMIU'])
    expect(s.numeros.unidades).toBe(3)
    expect(s.status).toBe('ok')
  })

  it('12. a chamada por id falha: nenhum ausente, conferencias_falhas 1, conferencia_falhou no pool_stats, retrato gravado', async () => {
    mundo.linhas = lista(1, () => ({ mark: 7, stored_n: 5 }))
    mundo.guardados = () => ok([...lote3.map((id) => g(id)), g('G-ACHADO'), g('G-SUMIU')])
    roteiro = ({ rota }) => (rota === 'comments' ? erroApi(500, null) : padrao({ rota, params: new URLSearchParams(), n: 0 }))
    const s = await rodar()
    const e = sbDe('apply_competitor_comment_snap')[0] as ChamadaSb
    expect(e.args?.p_missing).toEqual([])
    expect(snapDe(e).status).toBe('ok')
    expect((snapDe(e).pool_stats as Record<string, unknown>).conferencia_falhou).toBe(true)
    expect(s.numeros.conferencias_falhas).toBe(1)
    expect(s.feitos).toBe(1)
  })

  it('12b. lerGuardados nulo (erro do banco ou linha ilegível) ou lançando: "não li", nenhum ausente, nenhuma chamada por id', async () => {
    const casos: Array<() => Resp> = [
      () => falha('XX000'),
      () => ok(null),
      () => ok([{ youtube_comment_id: 5, parent_id: null }]),
      () => ok(Array.from({ length: 1000 }, (_, i) => g(`G-${i}`))), // página cheia: lança ComentariosErro
    ]
    for (const caso of casos) {
      chamadasSb = []; chamadasApi = []
      mundo.linhas = lista(1, () => ({ mark: 30, stored_n: 5 }))
      mundo.guardados = caso
      const s = await rodar()
      const e = sbDe('apply_competitor_comment_snap')[0] as ChamadaSb
      expect(e.args?.p_missing).toEqual([])
      expect(doRota('comments')).toHaveLength(0)
      expect((snapDe(e).pool_stats as Record<string, unknown>).conferencia_falhou).toBe(true)
      expect(s.numeros.conferencias_falhas).toBe(1)
      expect(s.numeros.ausentes_marcados).toBe(0)
      expect(s.feitos).toBe(1)
    }
  })

  it('12c. stored_n 0 no marco 7: não lê os guardados', async () => {
    mundo.linhas = lista(1, () => ({ mark: 7, stored_n: 0 }))
    await rodar()
    expect(sbDe('competitor_video_comments')).toHaveLength(0)
  })

  it('13. 120 guardados fora do lote: 3 chamadas de 50, 50 e 20; 200: 3 chamadas (150 ids), 50 em conferencias_nao_feitas, nenhum deles ausente', async () => {
    mundo.linhas = lista(1, () => ({ mark: 30, stored_n: 120 }))
    mundo.guardados = () => ok(Array.from({ length: 120 }, (_, i) => g(`G-${String(i).padStart(3, '0')}`)))
    await rodar()
    expect(doRota('comments').map((c) => idsDe(c).length)).toEqual([50, 50, 20])

    chamadasSb = []; chamadasApi = []; contador.comments = 0
    mundo.linhas = lista(1, () => ({ mark: 30, stored_n: 200 }))
    mundo.guardados = () => ok(Array.from({ length: 200 }, (_, i) => g(`G-${String(i).padStart(3, '0')}`)))
    const s = await rodar()
    expect(doRota('comments').map((c) => idsDe(c).length)).toEqual([50, 50, 50])
    expect(s.numeros.conferencias_nao_feitas).toBe(50)
    const faltantes = (sbDe('apply_competitor_comment_snap')[0]?.args?.p_missing ?? []) as string[]
    expect(faltantes).toHaveLength(150)
    for (let i = 150; i < 200; i++) expect(faltantes).not.toContain(`G-${String(i).padStart(3, '0')}`)
    expect(s.status).toBe('ok')
  })

  it('13b. a reserva antes de começar é 2 + 3 no marco 7 com 120 guardados (e 2 no marco 1)', async () => {
    // 29 retratos do marco 1 gastam 58 unidades; o 30º de marco 7 e 120 guardados precisa de 58 + 5 > 60: não começa.
    mundo.linhas = lista(30, (i) => (i === 30 ? { mark: 7, stored_n: 120 } : {}))
    mundo.guardados = () => ok([])
    const s = await rodar()
    expect(s.feitos).toBe(29)
    expect(s.ficaram).toBe(1)
    expect(s.status).toBe('parcial')
    // o 30º de marco 1 começa (58 + 2 = 60, que não passa de 60)
    chamadasSb = []; chamadasApi = []; for (const k of Object.keys(contador)) delete contador[k]
    mundo.linhas = lista(30)
    const t = await rodar()
    expect(t.feitos).toBe(30)
    expect(t.numeros.unidades).toBe(60)
    // marco 30 com stored_n 49: 1 bloco, reserva 2 + 1 = 3 (58 + 3 = 61 passa de 60: não começa)
    chamadasSb = []; chamadasApi = []; for (const k of Object.keys(contador)) delete contador[k]
    mundo.linhas = lista(30, (i) => (i === 30 ? { mark: 30, stored_n: 49 } : {}))
    const u = await rodar()
    expect(u.feitos).toBe(29)
  })
})

// ───── 14 a 17: tolerância, tetos de chamadas e de tempo ─────
describe('tolerância e tetos', () => {
  it('14. retrato cujo tempo passou de 72 h entre a lista e a escrita não é gravado; o banco devolvendo fora_da_tolerancia conta e não é erro', async () => {
    mundo.linhas = lista(1, () => ({ t0: iso(NOW0 - 71 * H) }))
    custo.api = 2 * H // o relógio falso avança 2 h durante a chamada
    const s = await rodar()
    expect(sbDe('apply_competitor_comment_snap')).toHaveLength(0)
    expect(s.numeros.fora_da_tolerancia).toBe(1)
    expect(s.feitos).toBe(0)
    expect(s.status).toBe('ok')

    custo.api = 0; chamadasSb = []; clock.t = NOW0
    mundo.linhas = lista(1)
    mundo.apply = () => ok({ status: 'fora_da_tolerancia', idade_h: 73 })
    const b = await rodar()
    expect(b.numeros.fora_da_tolerancia).toBe(1)
    expect(b.numeros.erros_de_gravacao).toBe(0)
    expect(b.feitos).toBe(0)
    expect(b.status).toBe('ok')
  })

  it('15. teto de chamadas: 40 devidos, 30 no máximo, ficaram conta o resto, e os primeiros são os de prazo mais curto', async () => {
    // a lista chega em ordem inversa de prazo: a tarefa ordena pelo prazo
    mundo.linhas = lista(40).reverse()
    const s = await rodar()
    expect(s.feitos).toBe(30)
    expect(s.ficaram).toBe(10)
    expect(s.numeros.devidos).toBe(40)
    expect(s.numeros.unidades).toBe(60)
    expect(s.status).toBe('parcial')
    const videos = sbDe('apply_competitor_comment_snap').map((c) => c.args?.p_video)
    expect(videos).toEqual(Array.from({ length: 30 }, (_, i) => `vid-row-${i + 1}`))
  })

  it('15b. a lista traz mais do que veio (total 250, 200 linhas): ficaram conta todos', async () => {
    mundo.linhas = Array.from({ length: 200 }, (_, i) => ({ ...linha(i + 1), total_due: 250 }))
    const s = await rodar()
    expect(s.feitos).toBe(30)
    expect(s.ficaram).toBe(220)
    expect(s.numeros.devidos).toBe(250)
  })

  it('16. teto de tempo: para de COMEÇAR aos 40 s do começo da tarefa e aos 170 s de t0 quando a tarefa começou tarde; o fim nunca passa do pior fim', async () => {
    custo.api = COMMENT_RULES.callTimeoutMs
    custo.ida = COMMENT_RULES.dbTimeoutMs
    const inicio = clock.t
    const inicios: number[] = []
    const base = roteiro
    roteiro = (c) => { if (c.rota === 'commentThreads') inicios.push(clock.t - custo.api - inicio); return base(c) }
    mundo.linhas = lista(10)
    const s = await rodar()
    expect(inicios.length).toBeGreaterThan(0)
    for (const i of inicios) expect(i).toBeLessThan(COMMENT_RULES.startBudgetMs)
    expect(s.feitos).toBe(2) // começam aos 15 s e aos 32 s; o terceiro seria aos 49 s
    expect(s.ficaram).toBe(8)
    expect(s.status).toBe('parcial')
    expect(clock.t - inicio).toBeLessThanOrEqual(WORST_END_FROM_T0_MS)

    // a tarefa começou tarde (150 s depois de t0)
    chamadasSb = []; chamadasApi = []; for (const k of Object.keys(contador)) delete contador[k]
    const t0 = clock.t
    clock.t = t0 + 150_000
    const inicios2: number[] = []
    roteiro = (c) => { if (c.rota === 'commentThreads') inicios2.push(clock.t - custo.api - t0); return base(c) }
    const l = await rodar({ t0, inicio: clock.t })
    for (const i of inicios2) expect(i).toBeLessThan(COMMENT_RULES.lastSnapStartsByMs)
    expect(l.feitos).toBe(1)
    expect(l.ficaram).toBe(9)
    expect(clock.t - t0).toBeLessThanOrEqual(WORST_END_FROM_T0_MS)
  })

  it('17. ida ao banco que não responde: a escrita volta banco:tempo_esgotado, conta como falha passageira, e a tarefa termina', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    mundo.linhas = lista(1)
    mundo.apply = () => new Promise<Resp>(() => undefined)
    const p = rodar()
    for (let i = 0; i < 30; i++) await vi.advanceTimersByTimeAsync(1000)
    const s = comFrase(await p)
    expect(s.status).toBe('erro')
    expect(s.motivo).toBe('banco')
    expect(s.numeros.erros_de_gravacao).toBe(1)
    expect(s.numeros.falhas_passageiras).toBe(1)
    expect(s.feitos).toBe(0)
    expect(relatar).toHaveBeenCalledWith('coletar', 'banco:tempo_esgotado', { marco: 1 })
  })

  it('17b. gravação que falha depois de a API responder: a cota gasta é registrada, o retrato não conta como feito, erro banco com o código só no relato', async () => {
    mundo.linhas = lista(2)
    mundo.apply = (_a, n) => (n === 1 ? falha('23514', `Failing row contains (${SENT_TEXTO})`) : ok({ status: 'gravado' }))
    const s = comFrase(await rodar())
    expect(s.feitos).toBe(1)
    expect(s.numeros.erros_de_gravacao).toBe(1)
    expect(s.numeros.unidades).toBe(4)
    expect(s.status).toBe('erro')
    expect(s.motivo).toBe('banco')
    expect(relatar).toHaveBeenCalledWith('coletar', 'banco:23514', { marco: 1 })
    expect(JSON.stringify(s)).not.toContain(SENT_TEXTO)
    expect(JSON.stringify(relatar.mock.calls)).not.toContain(SENT_TEXTO)
    expect(sbDe('youtube_quota_add')[0]?.args).toMatchObject({ p_units: 4 })
  })
})

// ───── 18 a 22: falhas e o estado da execução ─────
describe('falhas e estado da execução', () => {
  it('18. cota esgotada no terceiro: para, os dois primeiros ficam gravados, ficaram conta o resto, erro cota_esgotada', async () => {
    for (const falhaCota of [erroApi(403, 'quotaExceeded'), erroApi(429, null), erroApi(403, 'rateLimitExceeded')]) {
      chamadasSb = []; chamadasApi = []; for (const k of Object.keys(contador)) delete contador[k]
      mundo.linhas = lista(5)
      roteiro = (c) => (c.rota === 'commentThreads' && c.n === 2 ? falhaCota : padrao(c))
      const s = comFrase(await rodar())
      expect(s.status).toBe('erro')
      expect(s.motivo).toBe('cota_esgotada')
      expect(s.feitos).toBe(2)
      expect(s.ficaram).toBe(3)
      expect(sbDe('apply_competitor_comment_snap')).toHaveLength(2)
      expect(doRota('commentThreads')).toHaveLength(3)
      expect(fraseDe('cota_esgotada', s.numeros)).toContain('3')
    }
  })

  it('18b. cota esgotada numa chamada auxiliar: o retrato em curso termina sem chamar mais nada, e a execução para', async () => {
    mundo.linhas = lista(3)
    roteiro = (c) => (c.rota === 'channels' && c.n === 1 ? erroApi(403, 'quotaExceeded') : padrao(c))
    const s = comFrase(await rodar())
    expect(s.motivo).toBe('cota_esgotada')
    expect(s.feitos).toBe(2)
    expect(s.ficaram).toBe(1)
    expect(doRota('commentThreads')).toHaveLength(2)
  })

  it('19. falha passageira: 1 de 5 com http_5xx deixa em erro falhas_passageiras; 1 de 5 com proibido não deixa', async () => {
    mundo.linhas = lista(5)
    roteiro = (c) => (c.rota === 'commentThreads' && c.n === 1 ? erroApi(500, null) : padrao(c))
    let s = comFrase(await rodar())
    expect(s.status).toBe('erro')
    expect(s.motivo).toBe('falhas_passageiras')
    expect(s.feitos).toBe(5)
    expect(s.numeros.falhas_passageiras).toBe(1)
    const frase = fraseDe(s.motivo as string, s.numeros)
    expect(frase).toContain('1 leituras')
    expect(frase).toContain('http_5xx')

    chamadasSb = []; chamadasApi = []; for (const k of Object.keys(contador)) delete contador[k]
    roteiro = (c) => (c.rota === 'commentThreads' && c.n === 1 ? erroApi(403, 'forbidden') : padrao(c))
    s = await rodar()
    expect(s.status).toBe('ok')
    expect(s.numeros.erros).toBe(1)
    expect(snapDe(sbDe('apply_competitor_comment_snap')[1] as ChamadaSb).error_reason).toBe('proibido')
  })

  it('19b. três passageiras seguidas param a execução (disjuntor) e o resto é ficaram', async () => {
    mundo.linhas = lista(6)
    roteiro = (c) => (c.rota === 'commentThreads' && c.n < 3 ? erroApi(500, null) : padrao(c))
    const s = comFrase(await rodar())
    expect(s.status).toBe('erro')
    expect(doRota('commentThreads')).toHaveLength(3)
    expect(sbDe('apply_competitor_comment_snap')).toHaveLength(3)
    expect(s.feitos).toBe(3)
    expect(s.ficaram).toBe(3)
    expect(s.numeros.vermelhos).toBeGreaterThanOrEqual(2)
    expect(fraseDe('disjuntor', s.numeros)).toContain('3 retratos ficaram')
    // não seguidas: não abre
    chamadasSb = []; chamadasApi = []; for (const k of Object.keys(contador)) delete contador[k]
    roteiro = (c) => (c.rota === 'commentThreads' && c.n % 2 === 0 ? erroApi(500, null) : padrao(c))
    const t = await rodar()
    expect(t.ficaram).toBe(0)
    expect(t.feitos).toBe(6)
  })

  it('19c. inscritos falha nas 3 tentadas: erro; falha em 2 de 3: não', async () => {
    mundo.linhas = lista(3)
    roteiro = (c) => (c.rota === 'channels' ? erroApi(500, null) : padrao(c))
    let s = comFrase(await rodar())
    expect(s.status).toBe('erro')
    expect(s.motivo).toBe('consulta_de_autores_falhou')
    expect(s.numeros.consultas_de_autor_falhas).toBe(3)
    expect(s.feitos).toBe(3)

    chamadasSb = []; chamadasApi = []; for (const k of Object.keys(contador)) delete contador[k]
    roteiro = (c) => (c.rota === 'channels' && c.n < 2 ? erroApi(500, null) : padrao(c))
    s = await rodar()
    expect(s.status).toBe('ok')
    expect(s.numeros.consultas_de_autor_falhas).toBe(2)
  })

  it('19d. conferência por id falha nas 3 tentadas: erro conferencia_falhou', async () => {
    mundo.linhas = lista(3, () => ({ mark: 7, stored_n: 2 }))
    mundo.guardados = () => ok([{ youtube_comment_id: 'G-1', parent_id: null }, { youtube_comment_id: 'G-2', parent_id: null }])
    roteiro = (c) => (c.rota === 'comments' ? erroApi(500, null) : padrao(c))
    const s = comFrase(await rodar())
    expect(s.status).toBe('erro')
    expect(s.motivo).toBe('conferencia_falhou')
    expect(s.numeros.conferencias_falhas).toBe(3)
  })

  it('20. exceção inesperada num vídeo: os outros seguem, relato com inesperado:typeerror, status erro', async () => {
    mundo.linhas = lista(3)
    roteiro = (c) => { if (c.rota === 'commentThreads' && c.n === 1) clock.explode = true; return padrao(c) }
    const s = comFrase(await rodar())
    expect(s.status).toBe('erro')
    expect(s.motivo).toBe('inesperado')
    expect(s.numeros.inesperados).toBe(1)
    expect(s.feitos).toBe(2)
    expect(relatar).toHaveBeenCalledWith('coletar', 'inesperado:typeerror', { marco: 1 })
    expect(JSON.stringify(s)).not.toContain(SENT_TEXTO)
    expect(JSON.stringify(relatar.mock.calls)).not.toContain(SENT_TEXTO)
    expect(JSON.stringify(relatar.mock.calls)).not.toContain(SENT_NOME)
  })

  it('20b. PacoteInvalido é defeito nosso: conta em inesperados, relato do nome, o retrato fica devido', async () => {
    mundo.linhas = lista(2)
    vi.mocked(montarPacote).mockImplementationOnce(() => { throw new PacoteInvalido('mais escolhidos do que o alvo') })
    const s = comFrase(await rodar())
    expect(s.status).toBe('erro')
    expect(s.motivo).toBe('inesperado')
    expect(s.numeros.inesperados).toBe(1)
    expect(s.feitos).toBe(1)
    expect(sbDe('apply_competitor_comment_snap')).toHaveLength(1)
    expect(relatar).toHaveBeenCalledWith('coletar', 'inesperado:pacoteinvalido', { marco: 1 })
  })

  it('21. a cota é somada por site, com o modo comentarios e os contadores', async () => {
    mundo.linhas = [
      { ...linha(1), total_due: 3 }, { ...linha(2), total_due: 3 }, { ...linha(3, { site_id: 'site-2' }), total_due: 3 },
    ]
    roteiro = (c) => (c.rota === 'commentThreads' && c.n === 2 ? erroApi(403, 'forbidden') : padrao(c))
    await rodar()
    const cotas = sbDe('youtube_quota_add').map((c) => c.args as Record<string, unknown>)
    expect(cotas).toHaveLength(2)
    const s1 = cotas.find((c) => c.p_site_id === 'site-1')
    const s2 = cotas.find((c) => c.p_site_id === 'site-2')
    expect(s1).toMatchObject({ p_units: 4, p_add: { comentarios: 4, comentarios_retratos: 2 } })
    expect(s2).toMatchObject({ p_units: 1, p_add: { comentarios: 1, comentarios_retratos: 1, comentarios_erros: 1 } })
    expect(s1?.p_max).toEqual({})
  })

  it('21b. recordQuota falha: erro cota_nao_registrada; não responde: idem, e a tarefa termina', async () => {
    mundo.linhas = lista(2)
    mundo.quota = () => falha('XX000', `message com ${SENT_NOME}`)
    let s = comFrase(await rodar())
    expect(s.status).toBe('erro')
    expect(s.motivo).toBe('cota_nao_registrada')
    expect(s.numeros.unidades_nao_registradas).toBe(4)
    expect(s.feitos).toBe(2)
    expect(JSON.stringify(s)).not.toContain(SENT_NOME)

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    chamadasSb = []; chamadasApi = []; for (const k of Object.keys(contador)) delete contador[k]
    mundo.quota = () => new Promise<Resp>(() => undefined)
    const p = rodar()
    for (let i = 0; i < 30; i++) await vi.advanceTimersByTimeAsync(1000)
    s = comFrase(await p)
    expect(s.motivo).toBe('cota_nao_registrada')
    expect(s.numeros.unidades_nao_registradas).toBe(4)
  })

  it('21c. exceção fora do try por devido: a cota já gasta é gravada mesmo assim', async () => {
    mundo.linhas = lista(5)
    mundo.apply = (_a, n) => { if (n === 2) clock.explode = true; return ok({ status: 'gravado' }) }
    await expect(rodar()).rejects.toThrow(TypeError)
    const cota = sbDe('youtube_quota_add')
    expect(cota).toHaveLength(1)
    expect(cota[0]?.args).toMatchObject({ p_site_id: 'site-1', p_units: 4, p_add: { comentarios: 4, comentarios_retratos: 2 } })
  })

  it('22a. 12 devidos, todos gravados, prova do fim com 2 atrasados: erro retratos_atrasados', async () => {
    mundo.linhas = lista(12)
    mundo.provas = [PROVA, { ...PROVA, retratos_atrasados: 2 }]
    const s = comFrase(await rodar())
    expect(s.status).toBe('erro')
    expect(s.motivo).toBe('retratos_atrasados')
    expect(s.feitos).toBe(12)
    expect(s.numeros.retratos_atrasados).toBe(2)
  })

  it('22b. 40 devidos, fila não zerou, prova do fim com 31 atrasados: parcial, NÃO é vermelho por isso (o primeiro dia)', async () => {
    mundo.linhas = lista(40)
    mundo.provas = [{ ...PROVA, retratos_atrasados: 31 }, { ...PROVA, retratos_atrasados: 31 }]
    const s = await rodar()
    expect(s.status).toBe('parcial')
    expect(s.feitos).toBe(30)
    expect(s.ficaram).toBe(10)
    expect(s.motivo).toBeUndefined()
    expect(s.numeros.retratos_atrasados).toBe(31)
  })

  it('22b2. a fila zerou mas uma gravação falhou (o retrato continua sem retrato): não é "atrasado" que se cobra duas vezes, e o erro é banco', async () => {
    mundo.linhas = lista(2)
    mundo.apply = (_a, n) => (n === 1 ? falha('23514') : ok({ status: 'gravado' }))
    mundo.provas = [PROVA, { ...PROVA, retratos_atrasados: 1 }]
    const s = comFrase(await rodar())
    expect(s.motivo).toBe('banco')
    expect(s.numeros.vermelhos).toBe(1)
  })

  it('22c. prova do começo com prazo errado 1: a coleta é feita e a execução termina em erro identidade_invariante', async () => {
    mundo.linhas = lista(2)
    mundo.provas = [{ ...PROVA, identidade_prazo_errado: 1 }, PROVA]
    const s = comFrase(await rodar())
    expect(sbDe('apply_competitor_comment_snap')).toHaveLength(2)
    expect(s.status).toBe('erro')
    expect(s.motivo).toBe('identidade_invariante')
    expect(s.numeros.identidade_prazo_errado).toBe(1)
    expect(fraseDe(s.motivo as string, s.numeros)).toContain('prazo diferente de 28 dias: 1')
  })

  it('22d. prova do fim com perdidos {sem_retrato: 1}: erro retratos_perdidos; com {proibido: 2}: ok', async () => {
    mundo.linhas = lista(1)
    mundo.provas = [PROVA, { ...PROVA, retratos_perdidos_7d: 1, perdidos_por_motivo: { sem_retrato: 1 } }]
    let s = comFrase(await rodar())
    expect(s.motivo).toBe('retratos_perdidos')
    expect(s.numeros.perdidos_fora_do_aceito).toBe(1)
    chamadasSb = []
    mundo.provas = [PROVA, { ...PROVA, retratos_perdidos_7d: 2, perdidos_por_motivo: { proibido: 2 } }]
    s = await rodar()
    expect(s.status).toBe('ok')
  })

  it('22e. prova do fim com erros_por_motivo {http_400: 3}: erro erros_presos', async () => {
    mundo.linhas = lista(1)
    mundo.provas = [PROVA, { ...PROVA, retratos_em_erro: 3, erros_por_motivo: { http_400: 3 } }]
    const s = comFrase(await rodar())
    expect(s.motivo).toBe('erros_presos')
    expect(s.numeros.erros_presos_max).toBe(3)
    expect(fraseDe('erros_presos', s.numeros)).toContain('http_400')
  })

  it('22f. schema ausente na prova do fim: erro schema_ausente; numeros traz os dez números da prova', async () => {
    mundo.linhas = lista(1)
    mundo.provas = [PROVA, falha('42883')]
    const s = comFrase(await rodar())
    expect(s.motivo).toBe('schema_ausente')

    chamadasSb = []
    mundo.provas = [PROVA]
    const ok2 = await rodar()
    for (const k of [
      'identidade_vencida', 'identidade_prazo_errado', 'identidade_de_criador', 'respostas_de_terceiros', 'retratos_atrasados',
      'retratos_em_erro', 'retratos_perdidos_7d', 'perdidos_fora_do_aceito', 'erros_presos_max', 'identidades_total',
    ]) expect(ok2.numeros, k).toHaveProperty(k)
    for (const k of [
      'devidos', 'feitos', 'ficaram', 'ok', 'sem_comentarios', 'desligados', 'erros', 'descartados', 'conferencias_falhas',
      'conferencias_nao_feitas', 'consultas_de_autor_falhas', 'ausentes_marcados', 'fora_da_tolerancia', 'erros_de_gravacao',
      'inesperados', 'unidades', 'ms', 'vermelhos',
    ]) expect(ok2.numeros, k).toHaveProperty(k)
    expect(ok2.numeros.vermelhos).toBe(0)
    expect(ok2.numeros.na_guarda).toBeUndefined()
  })

  it('22g. a frase nunca é vazia para nenhum código que a tarefa pode devolver (dívida da seção 14)', async () => {
    // os cenários acima já passam por comFrase; aqui, o mapa de códigos × chaves que a tarefa promete nos números
    mundo.linhas = lista(1)
    roteiro = (c) => (c.rota === 'commentThreads' ? erroApi(500, null) : padrao(c))
    const s = comFrase(await rodar())
    const f = fraseDe(s.motivo as string, s.numeros)
    expect(f).toContain('1 leituras')
    for (const codigo of CODIGOS_EXECUCAO) expect(FRASES_FIXAS[codigo]).not.toBe('')
  })
})

// ───── 24 a 27: o que não é tocado, o que não vaza ─────
describe('o que não é tocado e o que não vaza', () => {
  it('24. competitor_raw não é tocado; só as funções e tabelas do contrato são chamadas', async () => {
    mundo.linhas = lista(2, () => ({ mark: 7, stored_n: 1 }))
    mundo.guardados = () => ok([{ youtube_comment_id: 'G-1', parent_id: null }])
    await rodar()
    const tabelas = new Set(chamadasSb.filter((c) => c.tipo === 'from').map((c) => c.nome))
    expect([...tabelas].sort()).toEqual(['competitor_channels', 'competitor_video_comments', 'youtube_channels'])
    expect(chamadasSb.some((c) => c.nome.includes('raw'))).toBe(false)
    const rpcs = new Set(chamadasSb.filter((c) => c.tipo === 'rpc').map((c) => c.nome))
    expect([...rpcs].sort()).toEqual(['apply_competitor_comment_snap', 'competitor_comment_due', 'competitor_comment_health', 'youtube_quota_add'])
  })

  it('25. nada do lote não escolhido é gravado: 100 conversas, 12 escolhidas; o pool_stats não leva texto', async () => {
    mundo.linhas = lista(1)
    roteiro = (c) => (c.rota === 'commentThreads'
      ? okApi(corpoDeConversas(Array.from({ length: 100 }, (_, i) => conversa(i + 1, { curtidas: 1000 - i, texto: `SENT-LOTE-${i + 1}-FIM` }))))
      : padrao(c))
    await rodar()
    const e = sbDe('apply_competitor_comment_snap')[0] as ChamadaSb
    const pacote = JSON.stringify(e.args)
    for (let n = 1; n <= 12; n++) expect(pacote).toContain(`SENT-LOTE-${n}-FIM`)
    for (let n = 13; n <= 100; n++) expect(pacote).not.toContain(`SENT-LOTE-${n}-FIM`)
    expect(JSON.stringify(snapDe(e).pool_stats)).not.toContain('SENT-LOTE')
    expect(comentariosDe(e)).toHaveLength(12)
    expect(snapDe(e).pool_size).toBe(100)
    expect(doRota('channels')).toHaveLength(1)
    expect(idsDe(doRota('channels')[0] as ChamadaApi)).toHaveLength(20)
  })

  it('26. coletar.ts não lê process.env e não tem nenhuma frase em português', () => {
    const fonte = readFileSync(new URL('../../../src/lib/youtube/observatorio/comentarios/coletar.ts', import.meta.url), 'utf8')
    expect(fonte).not.toMatch(/process\.env/)
    const semComentarios = fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
    expect(semComentarios).not.toContain('comentários:')
    const literais = semComentarios.match(/(['"`])(?:(?!\1)[^\\\n]|\\.)*\1/g) ?? []
    for (const l of literais) expect(l, l).not.toMatch(/[áéíóúâêôãõçÁÉÍÓÚÂÊÔÃÕÇ]/)
    for (const frase of Object.values(FRASES_FIXAS)) expect(semComentarios).not.toContain(frase)
  })

  it('27. gravarRetrato devolve tolerancia_incoerente: conta em inesperados, não em erros_de_gravacao; relato; erro inesperado (não banco); o retrato continua devido', async () => {
    mundo.linhas = lista(2)
    vi.mocked(gravarRetrato).mockResolvedValueOnce({ ok: false, codigo: 'tolerancia_incoerente' })
    const s = comFrase(await rodar())
    expect(s.numeros.inesperados).toBe(1)
    expect(s.numeros.erros_de_gravacao).toBe(0)
    expect(s.status).toBe('erro')
    expect(s.motivo).toBe('inesperado')
    expect(s.feitos).toBe(1)
    expect(relatar).toHaveBeenCalledWith('coletar', 'tolerancia_incoerente', { marco: 1 })
  })

  it('sentinela: nada com nome, id de autor ou texto de comentário em TarefaSaida nem no que foi ao Sentry (várias falhas)', async () => {
    const saidas: TarefaSaida[] = []
    const mensagemRuim = `corpo de erro com ${SENT_TEXTO} ${SENT_NOME} ${SENT_CANAL} ${SENT_ID}`
    const conv = (): unknown => corpoDeConversas([conversa(1, { texto: SENT_TEXTO, nome: SENT_NOME, canalId: SENT_CANAL, id: SENT_ID, curtidas: 9 })])
    const cenarios: Array<[Roteiro, (m: Mundo) => void]> = [
      [(c) => (c.rota === 'commentThreads' ? erroApi(500, null, mensagemRuim) : padrao(c)), () => undefined],
      [(c) => (c.rota === 'commentThreads' ? { status: 200, raw: `{{ ${mensagemRuim}` } : padrao(c)), () => undefined],
      [(c) => (c.rota === 'commentThreads' ? okApi(conv()) : c.rota === 'channels' ? erroApi(403, 'forbidden', mensagemRuim) : padrao(c)), () => undefined],
      [(c) => (c.rota === 'commentThreads' ? okApi(conv()) : padrao(c)), (m) => { m.apply = () => ({ data: null, error: { code: '23514', message: mensagemRuim, details: mensagemRuim, hint: null } }) }],
      [(c) => (c.rota === 'commentThreads' ? okApi(conv()) : padrao(c)), (m) => { m.quota = () => falha('XX000', mensagemRuim) }],
      [(c) => (c.rota === 'commentThreads' ? new TypeError(mensagemRuim) : padrao(c)), () => undefined],
    ]
    for (const [r, ajusta] of cenarios) {
      mundo = novoMundo()
      mundo.linhas = lista(1)
      ajusta(mundo)
      roteiro = r
      saidas.push(await rodar())
    }
    // marco 7 com guardados que falham
    mundo = novoMundo()
    mundo.linhas = lista(1, () => ({ mark: 7, stored_n: 2 }))
    mundo.guardados = () => falha('XX000', mensagemRuim)
    roteiro = padrao
    saidas.push(await rodar())
    for (const s of saidas) {
      const t = JSON.stringify(s)
      for (const sent of SENTINELAS) expect(t).not.toContain(sent)
    }
    const r = JSON.stringify(relatar.mock.calls)
    for (const sent of SENTINELAS) expect(r).not.toContain(sent)
    await Sentry.flush(2000)
    for (const e of envelopes) for (const sent of SENTINELAS) expect(e).not.toContain(sent)
    expect(saidas.every((s) => Object.values(s.numeros).every((v) => typeof v === 'number'))).toBe(true)
  })
})

// ───── 23: a prova da C0.9, com HTTP de verdade ─────
describe('23. HTTP de verdade dentro do SDK: as quatro rotas, nenhum envelope com as sentinelas', () => {
  let servidor: Server
  let porta = 0
  let modo = 'normal'
  const ROTAS: Rota[] = ['commentThreads', 'channels', 'comments', 'videos']

  beforeAll(async () => {
    servidor = createServer((req, res) => {
      const rota = (req.url ?? '').split('?')[0]?.split('/').pop() ?? ''
      res.setHeader('content-type', 'application/json')
      if (modo === `http:${rota}`) { res.statusCode = 500; res.end(JSON.stringify({ error: { code: 500, message: SENT_TEXTO, errors: [] } })); return }
      if (modo === 'json' && rota === 'commentThreads') { res.end(`{{ ${SENT_TEXTO}`); return }
      if (modo === 'explode' && rota === 'commentThreads') clock.explode = true
      if (rota === 'commentThreads') {
        res.end(JSON.stringify(modo === 'vazio' || modo === 'http:videos'
          ? corpoDeConversas([])
          : corpoDeConversas([conversa(1, { texto: SENT_TEXTO, nome: SENT_NOME, canalId: SENT_CANAL, id: SENT_ID, curtidas: 9 })])))
      } else if (rota === 'channels') {
        res.end(JSON.stringify(corpoDeCanais([canalComInscritos(SENT_CANAL, { inscritos: 437_000_000 })], 1)))
      } else if (rota === 'comments') {
        res.end(JSON.stringify(corpoPorId([comentarioPorId(SENT_ID, { texto: SENT_TEXTO, nome: SENT_NOME })])))
      } else {
        res.end(JSON.stringify({ items: [{ id: 'x', statistics: { commentCount: '0' } }] }))
      }
    })
    await new Promise<void>((okf) => servidor.listen(0, '127.0.0.1', okf))
    porta = (servidor.address() as AddressInfo).port
  })
  afterAll(async () => { await new Promise<void>((okf) => servidor.close(() => okf())) })

  it('as quatro rotas com o fetch global, erro HTTP em cada uma, JSON ilegível, falha de escrita e TypeError no laço', async () => {
    envelopes.length = 0
    const base = `http://127.0.0.1:${porta}/youtube/v3`
    const guardados = [{ youtube_comment_id: SENT_ID, parent_id: null }, { youtube_comment_id: 'G-OUTRO', parent_id: null }]
    const cenarios: Array<{ modo: string; marco?: number; escrita?: 'falha' }> = [
      { modo: 'normal' }, { modo: 'normal', marco: 7 }, { modo: 'vazio' },
      { modo: 'http:commentThreads' }, { modo: 'http:channels' }, { modo: 'http:comments', marco: 7 }, { modo: 'http:videos' }, { modo: 'json' },
      { modo: 'normal', escrita: 'falha' }, { modo: 'explode' },
    ]
    await Sentry.startSpan({ name: 'prova-coletar', op: 'test' }, async () => {
      for (const c of cenarios) {
        mundo = novoMundo()
        chamadasSb = []
        clock.t = NOW0
        modo = c.modo
        mundo.linhas = lista(1, () => ({ mark: c.marco ?? 1, stored_n: c.marco ? 2 : 0 }))
        mundo.guardados = () => ok(guardados)
        if (c.escrita === 'falha') mundo.apply = () => ({ data: null, error: { code: '23514', message: `Failing row contains (${SENT_TEXTO})`, details: SENT_NOME, hint: null } })
        await runRetratosComentarios({ sb: criarSb(), apiKey: CHAVE, now, t0: clock.t, inicioMs: clock.t, apiBase: base })
      }
    })
    await Sentry.flush(2000)

    const transacoes = envelopes.filter((e) => e.includes('"type":"transaction"'))
    const eventos = envelopes.filter((e) => e.includes('"category":"http"'))
    expect(transacoes.length).toBeGreaterThan(0)
    expect(eventos.length).toBeGreaterThan(0)
    for (const rota of ROTAS.filter((r) => r !== 'videos')) {
      expect(transacoes.some((t) => t.includes('http.client') && t.includes(`/youtube/v3/${rota}`)), rota).toBe(true)
    }
    expect(envelopes.some((e) => e.includes('comentarios: coletar'))).toBe(true)
    for (const e of envelopes) {
      for (const sent of [...SENTINELAS, '437000000']) expect(e).not.toContain(sent)
    }
  })
})
