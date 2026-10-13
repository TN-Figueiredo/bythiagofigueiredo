// @vitest-environment node
/**
 * A5 · E14, Tarefa 11: a coleta de comentários de destaque INTEIRA contra Postgres de verdade, com a API do YouTube falsa.
 * `runRetratosComentarios` e `runAnularIdentidade`, sem banco falso: o que um banco falso escondia (CHECK, FK, SQLSTATE, o relógio do
 * banco calculando a idade do vídeo, a trava de linha das execuções simultâneas) aparece aqui.
 *
 * Banco: SÓ o `bythiago_int` na máquina de quem desenvolve; na CI (variável `CI=true` do GitHub Actions), o banco
 * descartável que o próprio job cria com `supabase start` e `db reset` (127.0.0.1:54321 e :54322). Rodar com:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/observatorio-a5-e14-coleta.test.ts --no-file-parallelism
 *
 * Duas travas contra acidente: (1) o cliente do Supabase deste arquivo só fala com 127.0.0.1:54421 e a API falsa só com
 * api-falsa.invalid (qualquer outro host lança erro); (2) o arquivo se recusa a rodar se as variáveis não apontarem para o
 * `bythiago_int`. Cada teste cria o SEU site, os SEUS canais e vídeos, semeia e limpa (o `afterAll` roda também depois de falha).
 * Datas relativas ao relógio. DADO PESSOAL: só dado INVENTADO (fixtures), e sentinelas aleatórias procuradas por catálogo.
 * Função sem EXECUTE nunca é chamada como anon/authenticated (derruba este Postgres): aqui só `service_role`.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SERVICE_KEY, seedSite } from '../helpers/db-seed'

const desde = vi.hoisted(() => ({ v: null as string | null }))
const relatado = vi.hoisted(() => ({ chamadas: [] as unknown[][] }))

// O início da coleta (`COMMENT_SINCE`) é uma constante de módulo ('a_decidir' no HEAD): para exercitar a coleta de verdade o teste a
// substitui por um getter (o `ctx` não tem como injetá-la: achado de testabilidade no relatório).
vi.mock('@/lib/youtube/observatorio/comentarios/regras', async (orig) => {
  const m = await orig<typeof import('@/lib/youtube/observatorio/comentarios/regras')>()
  return { ...m, get COMMENT_SINCE() { return desde.v } }
})
vi.mock('@/lib/youtube/observatorio/comentarios/relato', async (orig) => {
  const m = await orig<typeof import('@/lib/youtube/observatorio/comentarios/relato')>()
  return {
    ...m,
    relatarComentarios: (...a: Parameters<typeof m.relatarComentarios>) => { relatado.chamadas.push(a); m.relatarComentarios(...a) },
  }
})

import { runRetratosComentarios } from '@/lib/youtube/observatorio/comentarios/coletar'
import { runAnularIdentidade } from '@/lib/youtube/observatorio/comentarios/anular'
import { lerImpacto } from '@/lib/youtube/observatorio/comentarios/gravar'
import { COMMENT_RULES, MOTIVOS } from '@/lib/youtube/observatorio/comentarios/regras'
import type { TarefaSaida } from '@/lib/youtube/observatorio/comentarios/tipos'
import {
  H, canal, canalComInscritos, comentarioPorId, conversa, corpoDeCanais, corpoDeConversas, corpoPorId, iso, resposta,
  type OpcoesConversa,
} from '../youtube/observatorio/comentarios-fixtures'

const URL_BANCO = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
// Na CI o banco é o que o job de integração acabou de criar e vai jogar fora; fora dela, só o `bythiago_int`. O 54321 de
// uma máquina de desenvolvimento é o banco do navegador, com dado de uso, e continua recusado (lá `CI` não existe).
const NA_CI = process.env.CI === 'true'
const HOST_BANCO = NA_CI ? '127.0.0.1:54321' : '127.0.0.1:54421'
const PORTA_PG = NA_CI ? ':54322/' : ':54422/'
const PG_URL = process.env.SUPABASE_DB_URL ?? (NA_CI ? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' : '')
const BASE_API = 'http://api-falsa.invalid/youtube/v3'
const CHAVE = 'CHAVE-FALSA-DE-TESTE-9f8e7d'
const D = 24 * H
const MIN = 60_000
const uid = (): string => randomUUID().replace(/-/g, '').slice(0, 12)

vi.setConfig({ testTimeout: 120_000, hookTimeout: 60_000 })

type Linha = Record<string, unknown>

// ───────────────────────── o cliente do banco, trancado ─────────────────────────
const idas = {
  n: 0,
  urls: [] as string[],
  /** Faz uma ida falhar (para provar o que acontece quando o banco não responde). */
  falhar: undefined as undefined | ((url: URL, init?: RequestInit) => Response | undefined),
}
const fetchDoBanco: typeof fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input))
  if (url.host !== HOST_BANCO) throw new Error('host fora do banco de integração (' + HOST_BANCO + '): ' + url.host)
  idas.n += 1
  idas.urls.push(url.pathname)
  const falha = idas.falhar?.(url, init)
  if (falha !== undefined) return falha
  return fetch(input, init)
}

// ───────────────────────── a API do YouTube falsa ─────────────────────────
type Rota = 'commentThreads' | 'channels' | 'comments' | 'videos'
type RespApi = { status?: number; body?: unknown } | Error
interface ChamadaApi { rota: Rota; id: string; ids: string[]; chave: string | null }
interface Roteiro {
  threads(videoYt: string): RespApi
  channels(ids: string[]): RespApi
  comments(ids: string[]): RespApi
  videos(videoYt: string): RespApi
}
const okApi = (body: unknown): RespApi => ({ status: 200, body })
const erroApi = (status: number, reason: string | null, message = 'mensagem da API'): RespApi => ({
  status, body: { error: { code: status, message, errors: reason === null ? [] : [{ reason, domain: 'youtube.commentThread' }] } },
})
const canaisPequenos = (ids: string[]): RespApi => okApi(corpoDeCanais(ids.map((id) => canalComInscritos(id, { inscritos: 1000 })), ids.length))
const ROTEIRO_PADRAO: Roteiro = {
  threads: () => okApi(corpoDeConversas([1, 2, 3].map((n) => conversa(n, { curtidas: 100 - n, publicadoEm: iso(Date.now() - 20 * H) })))),
  channels: () => okApi(corpoDeCanais([], 0)),
  comments: () => okApi(corpoPorId([])),
  videos: (yt) => okApi({ items: [{ id: yt, statistics: { commentCount: '0' } }] }),
}

interface ApiFalsa { fetchImpl: typeof fetch; chamadas: ChamadaApi[]; n(rota: Rota): number }
function criarApiFalsa(r: Partial<Roteiro> = {}, antes?: (rota: Rota) => Promise<void>): ApiFalsa {
  const roteiro: Roteiro = { ...ROTEIRO_PADRAO, ...r }
  const chamadas: ChamadaApi[] = []
  const fetchImpl = (async (input: string | URL | Request): Promise<Response> => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    if (url.host !== 'api-falsa.invalid') throw new Error('host fora da API falsa: ' + url.host)
    const rota = url.pathname.split('/').pop() as Rota
    const id = url.searchParams.get('videoId') ?? url.searchParams.get('id') ?? ''
    chamadas.push({ rota, id, ids: id.split(',').filter((x) => x !== ''), chave: url.searchParams.get('key') })
    if (antes !== undefined) await antes(rota)
    const ids = id.split(',').filter((x) => x !== '')
    const resp = rota === 'commentThreads' ? roteiro.threads(id) : rota === 'channels' ? roteiro.channels(ids)
      : rota === 'comments' ? roteiro.comments(ids) : roteiro.videos(id)
    if (resp instanceof Error) throw resp
    return new Response(JSON.stringify(resp.body ?? {}), { status: resp.status ?? 200, headers: { 'content-type': 'application/json' } })
  }) as typeof fetch
  return { fetchImpl, chamadas, n: (rota) => chamadas.filter((c) => c.rota === rota).length }
}

// ───────────────────────── respostas sintéticas ─────────────────────────
const idDe = (tag: string, i: number): string => `${tag}c${String(i).padStart(2, '0')}`
/** Uma conversa com id, curtidas e autor próprios (curtidas decrescentes: a 1 é a mais curtida). */
function cv(tag: string, i: number, o: OpcoesConversa = {}): Record<string, unknown> {
  return conversa(i, {
    id: idDe(tag, i), curtidas: 200 - i, publicadoEm: iso(Date.now() - 20 * H), nome: `Autor ${tag}${i}`,
    canalId: canal(1000 + i), texto: `texto inventado ${tag} ${i}`, ...o,
  })
}
const lote = (tag: string, de: number, ate: number, o: (i: number) => OpcoesConversa = () => ({})): Record<string, unknown>[] =>
  Array.from({ length: ate - de + 1 }, (_, k) => cv(tag, de + k, o(de + k)))
/** Troca a foto do autor (o fixture só tem uma URL por número). */
function comFoto(c: Record<string, unknown>, foto: string): Record<string, unknown> {
  const topo = ((c.snippet as Record<string, unknown>).topLevelComment as Record<string, unknown>).snippet as Record<string, unknown>
  topo.authorProfileImageUrl = foto
  return c
}

// ───────────────────────── a espera pela outra execução ─────────────────────────
function criarBarreira(n: number): () => Promise<void> {
  let chegaram = 0
  let liberar: () => void = () => undefined
  const porta = new Promise<void>((r) => { liberar = r })
  return async () => {
    chegaram += 1
    if (chegaram >= n) liberar()
    await Promise.race([porta, new Promise<void>((r) => setTimeout(r, 8_000))])
  }
}

describe.skipIf(skipIfNoLocalDb())('A5 E14 (coleta): comentários de destaque, coleta inteira contra o banco local com a API falsa', () => {
  let pg: Client
  let sb: SupabaseClient
  const sites: string[] = []
  let inicioDoArquivo = 0

  beforeAll(async () => {
    // a trava: este arquivo só roda contra o banco de integração
    if (new URL(URL_BANCO).host !== HOST_BANCO) throw new Error('NEXT_PUBLIC_SUPABASE_URL não aponta para o banco de integração (' + HOST_BANCO + ')')
    if (!PG_URL.includes(PORTA_PG)) throw new Error('SUPABASE_DB_URL não aponta para o banco de integração (' + PORTA_PG + ')')
    sb = createClient(URL_BANCO, process.env.SUPABASE_SERVICE_ROLE_KEY ?? SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: fetchDoBanco },
    })
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
    inicioDoArquivo = Date.now()
  })
  afterAll(async () => {
    // roda também depois de falha. youtube_channels e a decisão de remoção não caem em cascata do site: apagar antes dele
    try {
      if (sites.length > 0) {
        for (const t of ['competitor_removed_items', 'youtube_channels']) {
          await pg.query(`delete from public.${t} where site_id = any($1::uuid[])`, [sites])
        }
        await pg.query('delete from public.sites where id = any($1::uuid[])', [sites])
      }
    } finally {
      await pg.end()
    }
  })
  beforeEach(() => {
    desde.v = null
    relatado.chamadas.length = 0
    idas.falhar = undefined
    idas.n = 0
    idas.urls.length = 0
  })

  // ───────────────────────── semeadura ─────────────────────────
  const q = async (sql: string, params: unknown[] = []): Promise<Linha[]> => (await pg.query(sql, params)).rows as Linha[]
  const novoSite = async (): Promise<string> => { const s = (await seedSite(sb)).siteId; sites.push(s); return s }
  async function novoCanal(site: string, o: { subs?: number; yt?: string } = {}): Promise<{ id: string; yt: string }> {
    const yt = o.yt ?? 'UC' + uid() + uid()
    const r = await q(`insert into public.competitor_channels (site_id, channel_id, channel_name, subscriber_count) values ($1, $2, 'Canal de teste', $3) returning id`,
      [site, yt, o.subs ?? 5000])
    return { id: String(r[0]!.id), yt }
  }
  async function novoVideo(canalId: string, idadeH: number, o: { contagem?: number | null } = {}): Promise<{ id: string; yt: string }> {
    const yt = 'v' + uid()
    const r = await q(`insert into public.competitor_videos (competitor_channel_id, video_id, published_at, comment_count) values ($1, $2, now() - ($3 || ' hours')::interval, $4) returning id`,
      [canalId, yt, String(idadeH), o.contagem === undefined ? 40 : o.contagem])
    return { id: String(r[0]!.id), yt }
  }
  interface Cenario { site: string; canal: { id: string; yt: string }; video: { id: string; yt: string } }
  async function cenario(idadeH = 30): Promise<Cenario> {
    const site = await novoSite()
    const c = await novoCanal(site)
    return { site, canal: c, video: await novoVideo(c.id, idadeH) }
  }
  const idadeDoVideo = (video: string, dias: number): Promise<unknown> =>
    pg.query(`update public.competitor_videos set published_at = now() - ($2 || ' hours')::interval where id = $1`, [video, String(dias * 24)])

  // ───────────────────────── execução ─────────────────────────
  async function rodar(site: string, api: ApiFalsa, o: { sbX?: SupabaseClient } = {}): Promise<TarefaSaida> {
    const agora = Date.now()
    return runRetratosComentarios({
      sb: o.sbX ?? sb, apiKey: CHAVE, now: Date.now, t0: agora, inicioMs: agora, siteId: site, fetchImpl: api.fetchImpl, apiBase: BASE_API,
    })
  }
  const anular = (site: string): Promise<TarefaSaida> => runAnularIdentidade({ sb, now: Date.now, siteId: site })

  // ───────────────────────── leituras do banco ─────────────────────────
  const snaps = (video: string): Promise<Linha[]> => q(
    `select mark, status, error_reason, video_age_hours::float8 as idade, pool_size, pool_complete, selected_count, featured_lookup_n, units_used, video_comment_count, rule_params, pool_stats
       from public.competitor_video_comment_snaps where video_id = $1 order by mark`, [video])
  const comentarios = (video: string): Promise<Linha[]> => q('select * from public.competitor_video_comments where video_id = $1 order by id', [video])
  async function cm(video: string, yt: string): Promise<Linha> {
    const r = await q('select * from public.competitor_video_comments where video_id = $1 and youtube_comment_id = $2', [video, yt])
    expect(r, 'comentário ' + yt).toHaveLength(1)
    return r[0]!
  }
  const leitura = async (commentId: unknown, mark: number): Promise<Linha | undefined> =>
    (await q('select * from public.competitor_video_comment_marks where comment_id = $1 and mark = $2', [commentId, mark]))[0]
  async function contagens(site: string): Promise<Record<string, number>> {
    const r = await q(`select
      (select count(*) from public.competitor_video_comment_snaps where site_id = $1)::int as snaps,
      (select count(*) from public.competitor_video_comments where site_id = $1)::int as comentarios,
      (select count(*) from public.competitor_video_comment_marks where site_id = $1)::int as leituras,
      (select count(*) from public.competitor_video_comment_authors where site_id = $1)::int as identidades`, [site])
    return r[0] as Record<string, number>
  }
  const cotaDoSite = async (site: string): Promise<Linha[]> =>
    q('select date::text as dia, units_used, operations from public.youtube_quota_usage where site_id = $1 order by date', [site])

  /** Envelhece a identidade e o vídeo em `dias` dias por SQL (o banco calcula a idade; a anulação confere pelo relógio dele). */
  async function envelhecer(site: string, dias: number): Promise<void> {
    const iv = `${dias} days`
    await pg.query(`update public.competitor_video_comments set first_seen_at = first_seen_at - $2::interval, last_seen_at = last_seen_at - $2::interval where site_id = $1`, [site, iv])
    await pg.query(`update public.competitor_video_comment_authors set expires_at = expires_at - $2::interval, created_at = created_at - $2::interval where site_id = $1`, [site, iv])
    await pg.query(`update public.competitor_video_comment_snaps set taken_at = taken_at - $2::interval where site_id = $1`, [site, iv])
    await pg.query(`update public.competitor_videos set published_at = published_at - $2::interval where competitor_channel_id in (select id from public.competitor_channels where site_id = $1)`, [site, iv])
  }

  /**
   * Varredura por catálogo: acha cada sentinela em QUALQUER coluna de QUALQUER tabela do schema `public` (linha inteira em texto, depois
   * a coluna). Devolve, por sentinela, "tabela.coluna". Partições entram pela tabela-mãe.
   */
  async function varredura(sentinelas: string[]): Promise<Record<string, string[]>> {
    const res: Record<string, string[]> = Object.fromEntries(sentinelas.map((s) => [s, [] as string[]]))
    const padroes = sentinelas.map((s) => '%' + s + '%')
    const tabelas = await q(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relispartition order by 1`)
    for (const t of tabelas) {
      const nome = String(t.relname)
      const n = Number((await q(`select count(*) as n from public."${nome}" x where x::text like any($1::text[])`, [padroes]))[0]!.n)
      if (n === 0) continue
      const cols = await q(`select column_name from information_schema.columns where table_schema = 'public' and table_name = $1 order by ordinal_position`, [nome])
      for (const col of cols) {
        for (const s of sentinelas) {
          const m = Number((await q(`select count(*) as n from public."${nome}" x where x."${String(col.column_name)}"::text like $1`, ['%' + s + '%']))[0]!.n)
          if (m > 0) (res[s] as string[]).push(nome + '.' + String(col.column_name))
        }
      }
    }
    for (const s of sentinelas) (res[s] as string[]).sort()
    return res
  }
  const AUTORES = ['competitor_video_comment_authors.avatar_url', 'competitor_video_comment_authors.channel_id', 'competitor_video_comment_authors.display_name']

  /** Tudo o que o RELATO (Sentry) recebeu: só código e número, nunca uma das sentinelas. */
  const relatoComoTexto = (): string => JSON.stringify(relatado.chamadas)

  // ───────────────────────── 0 ─────────────────────────
  it('0. os dois caminhos falam com o mesmo banco: a tabela existe pelo pg direto e pelo cliente de serviço, e o relógio dele é o nosso', async () => {
    const viaPg = await q(`select to_regclass('public.competitor_video_comment_snaps') is not null as existe, extract(epoch from now()) * 1000 as agora`)
    expect(viaPg[0]!.existe, 'a MG8 está aplicada neste banco').toBe(true)
    expect(Math.abs(Number(viaPg[0]!.agora) - Date.now()), 'o relógio do banco é o nosso').toBeLessThan(60_000)
    const viaServico = await sb.from('competitor_video_comment_snaps').select('video_id').limit(1)
    expect(viaServico.error, 'um select pelo cliente de serviço não pode devolver PGRST205').toBeNull()
    expect(idas.n).toBe(1)
    expect(idas.urls[0]).toBe('/rest/v1/competitor_video_comment_snaps')
  })

  // ───────────────────────── 1 (e a) e (d) ─────────────────────────
  it('1. do zero ao marco 30: três retratos ok (30 h, 8 dias, 31 dias), leituras por marco, ausência em duas etapas, conferência por id e idempotência', async () => {
    const b = await cenario(30)
    const tag = 't1' + uid()
    const replyId = `${tag}-resposta-do-criador`
    const reply = (): Record<string, unknown> => resposta(idDe(tag, 2), 1, { id: replyId, canalId: b.canal.yt, texto: 'resposta inventada do criador' })
    const por = { curtidas: new Map<string, number | 'sem-chave'>(), fora: new Set<string>() }
    // marco 1: 14 comentários, o 2 com resposta do criador; todos os autores pequenos
    let fase: 1 | 7 | 30 = 1
    const api = criarApiFalsa({
      threads: () => {
        const todos = lote(tag, 1, 14, (i) => (i === 2 && fase < 30 ? { respostas: [reply()], totalReplyCount: 1 } : i === 2 ? { totalReplyCount: 3, respostas: [] } : {}))
        const itens = todos.filter((_, k) => !por.fora.has(idDe(tag, k + 1)))
        return okApi(corpoDeConversas(itens.map((c, k) => (k === 0 && fase > 1 ? cv(tag, 1, { curtidas: fase === 7 ? 500 : 900 }) : c))))
      },
      channels: canaisPequenos,
      comments: (ids) => okApi(corpoPorId(ids.flatMap((id) => {
        if (id === idDe(tag, 5)) return [comentarioPorId(id, { curtidas: 'sem-chave' })] // curtida não lida
        if (id === idDe(tag, 7)) return [comentarioPorId(id, { curtidas: 77 })]
        return [] // c06 apagado: a API não devolve
      }))),
    })

    // ---- marco 1
    const r1 = await rodar(b.site, api)
    expect(r1, JSON.stringify(r1.numeros)).toMatchObject({ status: 'ok', feitos: 1, ficaram: 0 })
    expect(r1.numeros).toMatchObject({ devidos: 1, ok: 1, erros: 0, unidades: 2, ja_existe: 0, retratos_atrasados: 0 })
    expect(api.chamadas.map((c) => c.rota)).toEqual(['commentThreads', 'channels'])
    expect(api.chamadas.every((c) => c.chave === CHAVE), 'a chave de API vai em ?key=').toBe(true)
    const s1 = await snaps(b.video.id)
    expect(s1).toHaveLength(1)
    expect(s1[0]).toMatchObject({ mark: 1, status: 'ok', error_reason: null, pool_size: 14, pool_complete: true, selected_count: 12, units_used: 2 })
    expect(Math.abs(Number(s1[0]!.idade) - 30), 'a idade do vídeo é calculada pelo banco').toBeLessThan(0.2)
    expect(Number(s1[0]!.featured_lookup_n)).toBeGreaterThan(0)
    const dos1 = await comentarios(b.video.id)
    expect(dos1.filter((c) => c.parent_id === null)).toHaveLength(12)
    expect(dos1.filter((c) => c.parent_id !== null), 'a resposta do criador entra').toHaveLength(1)
    const c1 = await cm(b.video.id, idDe(tag, 1))
    expect(Number((await leitura(c1.id, 1))!.likes)).toBe(199)
    const c2 = await cm(b.video.id, idDe(tag, 2))
    expect(c2.creator_replied).toBe(true)
    expect((await leitura(c2.id, 1))!.creator_replied).toBe(true)
    expect((await contagens(b.site)).identidades, 'uma identidade por comentário de topo escolhido').toBe(12)

    // ---- (a) o mesmo disparo repetido: nada devido, nada regravado, nenhuma chamada
    const antes = await contagens(b.site)
    const chamadasAntes = api.chamadas.length
    const r1b = await rodar(b.site, api)
    expect(r1b).toMatchObject({ status: 'ok', feitos: 0, ficaram: 0 })
    expect(r1b.numeros).toMatchObject({ devidos: 0, retratos_atrasados: 0 })
    expect(api.chamadas.length, 'zero chamadas à API').toBe(chamadasAntes)
    expect(await contagens(b.site)).toEqual(antes)

    // ---- marco 7 (8 dias): c05, c06 e c07 saíram do lote; c05 volta SEM curtida, c06 não volta, c07 volta com 77
    fase = 7
    ;['05', '06', '07'].forEach((n) => por.fora.add(`${tag}c${n}`))
    await idadeDoVideo(b.video.id, 8)
    const r7 = await rodar(b.site, api)
    expect(r7, JSON.stringify(r7.numeros)).toMatchObject({ status: 'ok', feitos: 1, ficaram: 0 })
    expect(r7.numeros).toMatchObject({ ok: 1, conferencias_falhas: 0, conferencias_nao_feitas: 0 })
    const porId = api.chamadas.filter((c) => c.rota === 'comments')
    expect(porId, 'uma única chamada por id').toHaveLength(1)
    expect([...porId[0]!.ids].sort(), 'só o que estava guardado e não veio no lote').toEqual([idDe(tag, 5), idDe(tag, 6), idDe(tag, 7)])
    // (d) curtida nula NÃO vira zero nem ausente
    const c5 = await cm(b.video.id, idDe(tag, 5))
    expect(c5.miss_streak, 'curtida não lida não é ausência').toBe(0)
    expect(c5.missing_since).toBeNull()
    expect(Number((await leitura(c5.id, 1))!.likes), 'a curtida guardada continua a de antes').toBe(195)
    const l5 = await leitura(c5.id, 7)
    expect(l5 === undefined || l5.likes !== 0, 'nunca uma leitura com curtida 0 inventada').toBe(true)
    // apagado vira ausente (primeira vez: miss_streak 1, missing_since nulo)
    const c6 = await cm(b.video.id, idDe(tag, 6))
    expect(c6).toMatchObject({ miss_streak: 1, missing_since: null })
    // achado por id: curtidas novas, sem posição
    const c7 = await cm(b.video.id, idDe(tag, 7))
    expect(c7.miss_streak).toBe(0)
    expect(Number((await leitura(c7.id, 7))!.likes)).toBe(77)
    // o lote traz a curtida nova do c01 e a leitura do marco 7 tem o valor DAQUELA leitura
    expect(Number((await leitura(c1.id, 7))!.likes)).toBe(500)
    expect(Number((await leitura(c1.id, 1))!.likes), 'a leitura do marco 1 não foi reescrita').toBe(199)
    expect((await leitura(c2.id, 7))!.creator_replied).toBe(true)

    // ---- marco 30 (31 dias): c06 de novo ausente; o c02 volta sem a resposta e com a lista de respostas incompleta
    fase = 30
    await idadeDoVideo(b.video.id, 31)
    const r30 = await rodar(b.site, api)
    expect(r30, JSON.stringify(r30.numeros)).toMatchObject({ status: 'ok', feitos: 1 })
    const c6b = await cm(b.video.id, idDe(tag, 6))
    expect(c6b.missing_since, 'no marco 30 uma ausência basta').not.toBeNull()
    const c5b = await cm(b.video.id, idDe(tag, 5))
    expect(c5b).toMatchObject({ miss_streak: 0, missing_since: null })
    const c2b = await cm(b.video.id, idDe(tag, 2))
    expect(c2b.creator_replied, 'sim não vira "não se sabe" (regra 2)').toBe(true)
    expect((await leitura(c2b.id, 30))!.creator_replied, 'a leitura do marco guarda o que ESTA leitura viu: não se sabe').toBeNull()
    expect(Number((await leitura(c1.id, 30))!.likes)).toBe(900)

    // ---- no fim: 3 retratos ok com as idades certas
    const todos = await snaps(b.video.id)
    expect(todos.map((s) => [s.mark, s.status])).toEqual([[1, 'ok'], [7, 'ok'], [30, 'ok']])
    const idades = todos.map((s) => Number(s.idade))
    ;[30, 192, 744].forEach((esperada, k) => expect(Math.abs((idades[k] as number) - esperada), 'idade do marco ' + esperada).toBeLessThan(0.2))
    expect(relatoComoTexto()).not.toContain(tag)
  })

  // ───────────────────────── 2 ─────────────────────────
  it('2. identidade no tempo: vencida, a coleta recusa; a anulação apaga e prova; o comentário que volta não ganha identidade; o motivo do destaque fica e o vínculo com o canal é zerado (pergunta 30)', async () => {
    const b = await cenario(30)
    const acompanhado = await novoCanal(b.site)
    const tag = 't2' + uid()
    const itens = (): Record<string, unknown>[] => [
      ...lote(tag, 1, 5),
      cv(tag, 6, { canalId: acompanhado.yt, nome: 'Acompanhado inventado' }),
    ]
    let extra: Record<string, unknown>[] = []
    const api = criarApiFalsa({ threads: () => okApi(corpoDeConversas([...itens(), ...extra])), channels: canaisPequenos })
    const r1 = await rodar(b.site, api)
    expect(r1).toMatchObject({ status: 'ok', feitos: 1 })
    expect(await contagens(b.site)).toMatchObject({ snaps: 1, comentarios: 6, identidades: 6 })
    const destaque = await cm(b.video.id, idDe(tag, 6))
    expect(destaque).toMatchObject({ featured_reason: 'canal_acompanhado', featured_channel_id: acompanhado.id, featured_size_band: null, featured_ratio_band: null })

    // 29 dias depois: a identidade venceu há um dia e a rotina não rodou
    await envelhecer(b.site, 29)
    const chamadasAntes = api.chamadas.length
    const recusa = await rodar(b.site, api)
    expect(recusa).toMatchObject({ status: 'erro', motivo: 'identidade_vencida', feitos: 0 })
    expect(recusa.numeros.identidade_vencida).toBe(6)
    expect(api.chamadas.length, 'recusou antes de chamar o YouTube').toBe(chamadasAntes)
    expect((await snaps(b.video.id)).map((s) => s.mark), 'e antes de gravar').toEqual([1])

    // a anulação apaga e prova
    const idasAntes = idas.n
    const an = await anular(b.site)
    expect(an).toMatchObject({ status: 'ok', feitos: 6, ficaram: 0 })
    expect(an.numeros).toMatchObject({ apagadas: 6, comentarios_carimbados: 6, restantes: 0, identidade_vencida: 0, identidade_prazo_errado: 0, identidade_de_criador: 0, respostas_de_terceiros: 0 })
    expect(idas.n - idasAntes, 'a anulação são duas idas: a função e a prova').toBe(2)
    const v6 = await q(`select
      (select count(*) from public.competitor_video_comment_authors a join public.competitor_video_comments c on c.id = a.comment_id where a.site_id = $1 and least(c.first_seen_at, a.created_at) < now() - interval '29 days')::int as com_mais_de_29_dias,
      (select count(*) from public.competitor_video_comment_authors a join public.competitor_video_comments c on c.id = a.comment_id where a.site_id = $1 and (a.expires_at is distinct from c.first_seen_at + interval '28 days' or a.expires_at > a.created_at + interval '28 days 10 minutes'))::int as prazo_diferente_de_28,
      (select count(*) from public.competitor_video_comment_authors a join public.competitor_video_comments c on c.id = a.comment_id where a.site_id = $1 and c.is_creator)::int as de_criador`, [b.site])
    expect(v6[0], 'V6: 0, 0, 0').toEqual({ com_mais_de_29_dias: 0, prazo_diferente_de_28: 0, de_criador: 0 })
    // a anulação é idempotente
    expect(await anular(b.site)).toMatchObject({ status: 'ok', feitos: 0, numeros: { apagadas: 0, restantes: 0 } })

    // pergunta 30 (dono, 13/10): o motivo e as faixas do destaque ficam, mas featured_channel_id (liga o comentário ao canal do autor) é zerado
    const depois = await cm(b.video.id, idDe(tag, 6))
    expect(depois).toMatchObject({ featured_reason: 'canal_acompanhado', featured_channel_id: null, featured_size_band: null, featured_ratio_band: null })
    expect(depois.author_purged_at).not.toBeNull()

    // a coleta do marco 30 (o vídeo tem 29 dias + 30 h = 726 h) roda; os mesmos comentários voltam e NÃO ganham identidade; um novo ganha
    extra = [cv(tag, 7)]
    const r30 = await rodar(b.site, api)
    expect(r30, JSON.stringify(r30.numeros)).toMatchObject({ status: 'ok', feitos: 1, ficaram: 0 })
    expect((await snaps(b.video.id)).map((s) => s.mark)).toEqual([1, 30])
    const apos = await q(`select c.youtube_comment_id from public.competitor_video_comment_authors a join public.competitor_video_comments c on c.id = a.comment_id where a.site_id = $1`, [b.site])
    expect(apos.map((x) => x.youtube_comment_id), 'só o comentário NOVO tem identidade').toEqual([idDe(tag, 7)])
    expect((await cm(b.video.id, idDe(tag, 1))).author_purged_at, 'o carimbo continua').not.toBeNull()
    expect(await cm(b.video.id, idDe(tag, 6)), 'o marco 30 depois da anulação não regrava o vínculo').toMatchObject({ featured_reason: 'canal_acompanhado', featured_channel_id: null })
  })

  // ───────────────────────── 3 (b) e (c) ─────────────────────────
  it('3. os quatro estados (ok, sem_comentarios, desligados, erro) e o vídeo sem linha nenhuma; o erro do vídeo tem motivo de catálogo, a fila anda e o erro volta a ser tentado depois de 20 h', async () => {
    const site = await novoSite()
    const c = await novoCanal(site)
    const vOk = await novoVideo(c.id, 30)
    const vSem = await novoVideo(c.id, 40)
    const vDesl = await novoVideo(c.id, 50)
    const vErro = await novoVideo(c.id, 60)
    const vCedo = await novoVideo(c.id, 5) // ainda não chegou às 24 h
    const tag = 't3' + uid()
    let consertado = false
    const api = criarApiFalsa({
      threads: (yt) => {
        if (yt === vSem.yt) return okApi(corpoDeConversas([]))
        if (yt === vDesl.yt) return erroApi(403, 'commentsDisabled')
        if (yt === vErro.yt && !consertado) return erroApi(404, 'videoNotFound', 'o vídeo SENTINELA-DE-ERRO não existe')
        return okApi(corpoDeConversas(lote(tag, 1, 4)))
      },
      channels: canaisPequenos,
      videos: (yt) => okApi({ items: [{ id: yt, statistics: { commentCount: '0' } }] }),
    })
    const r = await rodar(site, api)
    expect(r, JSON.stringify(r.numeros)).toMatchObject({ status: 'ok', feitos: 4, ficaram: 0 })
    expect(r.numeros).toMatchObject({ devidos: 4, ok: 1, sem_comentarios: 1, desligados: 1, erros: 1 })
    expect(api.chamadas.some((x) => x.id === vCedo.yt), 'o vídeo de 5 h nem é pedido').toBe(false)
    const estado = async (v: { id: string }): Promise<Linha | undefined> => (await snaps(v.id))[0]
    expect(await estado(vOk)).toMatchObject({ status: 'ok', error_reason: null, selected_count: 4 })
    expect(await estado(vSem)).toMatchObject({ status: 'sem_comentarios', error_reason: null, video_comment_count: '0', selected_count: null })
    expect(await estado(vDesl)).toMatchObject({ status: 'desligados', error_reason: null })
    expect(await estado(vErro)).toMatchObject({ status: 'erro', error_reason: 'video_nao_encontrado' })
    // o vídeo que ainda não é devido não tem linha em nenhuma das quatro tabelas
    expect(await snaps(vCedo.id)).toEqual([])
    expect(await comentarios(vCedo.id)).toEqual([])
    const sobre = await q(`select
      (select count(*) from public.competitor_video_comment_marks m join public.competitor_video_comments x on x.id = m.comment_id where x.video_id = $1)::int as leituras,
      (select count(*) from public.competitor_video_comment_authors a join public.competitor_video_comments x on x.id = a.comment_id where x.video_id = $1)::int as identidades`, [vCedo.id])
    expect(sobre[0]).toEqual({ leituras: 0, identidades: 0 })
    // os três que não são "ok" não têm comentário nenhum
    for (const v of [vSem, vDesl, vErro]) expect(await comentarios(v.id)).toEqual([])
    // o motivo gravado é de catálogo e sem dois-pontos (o check do banco recusaria dois-pontos)
    const motivos = await q(`select error_reason from public.competitor_video_comment_snaps where site_id = $1 and error_reason is not null`, [site])
    for (const m of motivos) expect(String(m.error_reason)).toMatch(/^[a-z0-9_]{1,40}$/)
    expect(relatoComoTexto()).not.toContain('SENTINELA-DE-ERRO')

    // o mesmo disparo de novo: o erro do vídeo só volta depois de 20 horas, os finais nunca
    const chamadas = api.chamadas.length
    expect(await rodar(site, api)).toMatchObject({ status: 'ok', feitos: 0 })
    expect(api.chamadas.length).toBe(chamadas)
    // 21 horas depois (taken_at do erro recuado), o vídeo é tentado de novo e o retrato ok SUBSTITUI o erro
    consertado = true
    await pg.query(`update public.competitor_video_comment_snaps set taken_at = taken_at - interval '21 hours' where video_id = $1`, [vErro.id])
    const r2 = await rodar(site, api)
    expect(r2, JSON.stringify(r2.numeros)).toMatchObject({ status: 'ok', feitos: 1 })
    expect(await estado(vErro)).toMatchObject({ status: 'ok', error_reason: null })
  })

  // ───────────────────────── (c) motivos ─────────────────────────
  it('c. cada erro da API vira um motivo de catálogo SEM dois-pontos; erro do vídeo não deixa a execução vermelha; falha passageira deixa e três seguidas param; texto da exceção nunca chega à coluna', async () => {
    const SENT = 'SENTINELA-EXCECAO-' + uid()
    const site = await novoSite()
    const c = await novoCanal(site)
    const v = { v400: await novoVideo(c.id, 30), v403: await novoVideo(c.id, 31), v404: await novoVideo(c.id, 32), v404b: await novoVideo(c.id, 33), vOk: await novoVideo(c.id, 34) }
    const api = criarApiFalsa({
      threads: (yt) => {
        if (yt === v.v400.yt) return erroApi(400, 'invalidFilters', SENT)
        if (yt === v.v403.yt) return erroApi(403, 'forbidden', SENT)
        if (yt === v.v404.yt) return erroApi(404, 'videoNotFound', SENT)
        if (yt === v.v404b.yt) return erroApi(404, null, SENT)
        return okApi(corpoDeConversas(lote('c' + uid(), 1, 3)))
      },
      channels: canaisPequenos,
    })
    const r = await rodar(site, api)
    expect(r, JSON.stringify(r.numeros)).toMatchObject({ status: 'ok', feitos: 5, ficaram: 0 })
    expect(r.numeros).toMatchObject({ erros: 4, ok: 1 })
    const porVideo = async (x: { id: string }): Promise<unknown> => (await snaps(x.id))[0]?.error_reason
    expect(await porVideo(v.v400)).toBe('http_400')
    expect(await porVideo(v.v403)).toBe('proibido')
    expect(await porVideo(v.v404)).toBe('video_nao_encontrado')
    expect(await porVideo(v.v404b)).toBe('http_4xx')
    expect((await snaps(v.vOk.id))[0]).toMatchObject({ status: 'ok' })
    // a prova do fim enxerga os quatro erros e nenhum é "perdido"
    const prova = await q(`select public.competitor_comment_health($1::uuid, now(), $2::jsonb, 28, '30 hours'::interval, null) as r`, [site,
      JSON.stringify(COMMENT_RULES.marks.map((m) => ({ mark: m.mark, from_h: m.fromH, until_h: m.untilH })))])
    expect((prova[0]!.r as Linha).erros_por_motivo).toEqual({ http_400: 1, proibido: 1, video_nao_encontrado: 1, http_4xx: 1 })

    // passageiras: 500, rede (a exceção carrega a sentinela) e tempo esgotado; a terceira seguida abre o disjuntor
    const site2 = await novoSite()
    const c2 = await novoCanal(site2)
    const p = { v500: await novoVideo(c2.id, 30), vRede: await novoVideo(c2.id, 31), vTempo: await novoVideo(c2.id, 32) }
    const api2 = criarApiFalsa({
      threads: (yt) => {
        if (yt === p.v500.yt) return erroApi(500, 'backendError', SENT)
        if (yt === p.vRede.yt) return new TypeError('fetch failed: ' + SENT)
        return Object.assign(new Error('prazo ' + SENT), { name: 'TimeoutError' })
      },
    })
    const r2 = await rodar(site2, api2)
    expect(r2.status).toBe('erro')
    expect(r2.motivo).toBe('falhas_passageiras')
    expect(r2.numeros).toMatchObject({ erros: 3, feitos: 3 })
    const motivos2 = (await q(`select error_reason from public.competitor_video_comment_snaps where site_id = $1 order by error_reason`, [site2])).map((x) => x.error_reason)
    expect(motivos2).toEqual(['http_5xx', 'rede', 'tempo_esgotado'])
    // todo motivo gravado nos dois sites é do catálogo e não tem dois-pontos
    const todos = await q(`select error_reason from public.competitor_video_comment_snaps where site_id = any($1::uuid[]) and error_reason is not null`, [[site, site2]])
    expect(todos).toHaveLength(7)
    for (const m of todos) {
      expect((MOTIVOS as readonly string[]).includes(String(m.error_reason))).toBe(true)
      expect(String(m.error_reason)).not.toContain(':')
    }
    // o texto da exceção e da API não está em coluna nenhuma, nem no que foi para o Sentry
    expect((await varredura([SENT]))[SENT]).toEqual([])
    expect(relatoComoTexto()).not.toContain(SENT)
    // as falhas passageiras voltam a ser devidas no disparo seguinte (15 min), não só em 20 h
    await pg.query(`update public.competitor_video_comment_snaps set taken_at = taken_at - interval '16 minutes' where site_id = $1`, [site2])
    const api3 = criarApiFalsa({ channels: canaisPequenos })
    const r3 = await rodar(site2, api3)
    expect(r3, JSON.stringify(r3.numeros)).toMatchObject({ status: 'ok', feitos: 3 })
    expect((await snaps(p.v500.id))[0]).toMatchObject({ status: 'ok', error_reason: null })
  })

  // ───────────────────────── 4 ─────────────────────────
  it('4. sentinelas (itens 114 e 146): texto, autor, id e canal de um comentário NÃO escolhido, e o número de inscritos de um escolhido, não estão em lugar nenhum', async () => {
    const s = { texto: 'zqtexto' + uid(), nome: 'zqnome' + uid(), id: 'zqid' + uid(), canal: 'UCzq' + uid() + uid(), foto: 'zqfoto' + uid(), exc: 'zqexc' + uid() }
    const b = await cenario(30)
    const tag = 't4' + uid()
    // 25 comentários; o 15 (não escolhido) leva as sentinelas; o 3 tem um autor de 437.000.000 de inscritos (escolhido como destaque)
    const autorGrande = canal(2003)
    const itens = lote(tag, 1, 25, (i) => (i === 15
      ? { id: s.id, texto: s.texto, nome: s.nome, canalId: s.canal }
      : {}))
    comFoto(itens[14] as Record<string, unknown>, 'https://img.invalid/' + s.foto + '.jpg')
    const grande = cv(tag, 3, { canalId: autorGrande })
    itens[2] = grande
    const raw0 = Number((await q('select count(*) as n from public.competitor_raw where site_id = $1', [b.site]))[0]!.n)
    const api = criarApiFalsa({
      threads: () => okApi(corpoDeConversas(itens)),
      channels: (ids) => okApi(corpoDeCanais(ids.map((id) => canalComInscritos(id, { inscritos: id === autorGrande ? 437_000_000 : 1000 })), ids.length)),
    })
    const r = await rodar(b.site, api)
    expect(r, JSON.stringify(r.numeros)).toMatchObject({ status: 'ok', feitos: 1 })
    // a sentinela do não escolhido saiu na consulta de inscritos (a API a viu), mas nenhuma coluna a guarda
    expect(api.chamadas.find((c) => c.rota === 'channels')!.ids).toContain(s.canal)
    const guardados = (await comentarios(b.video.id)).map((c) => c.youtube_comment_id)
    expect(guardados, 'o comentário das sentinelas NÃO foi escolhido').not.toContain(s.id)
    expect(guardados, 'o do canal grande foi').toContain(idDe(tag, 3))
    expect(await cm(b.video.id, idDe(tag, 3))).toMatchObject({ featured_reason: 'inscritos', featured_size_band: '10m_mais', featured_ratio_band: '1000x_mais' })

    const achados = await varredura([s.texto, s.nome, s.id, s.canal, s.foto, s.exc])
    for (const [sentinela, onde] of Object.entries(achados)) expect(onde, 'sentinela ' + sentinela).toEqual([])
    // o número: nem para o escolhido. As quatro tabelas do site, a cota do dia e a linha da agenda
    const numero = await q(`select
      (select count(*) from public.competitor_video_comment_snaps x where x.site_id = $1 and x::text like '%437000000%')::int as snaps,
      (select count(*) from public.competitor_video_comments x where x.site_id = $1 and x::text like '%437000000%')::int as comentarios,
      (select count(*) from public.competitor_video_comment_marks x where x.site_id = $1 and x::text like '%437000000%')::int as leituras,
      (select count(*) from public.competitor_video_comment_authors x where x.site_id = $1 and x::text like '%437000000%')::int as identidades,
      (select count(*) from public.youtube_quota_usage x where x.site_id = $1 and x::text like '%437000000%')::int as cota,
      (select count(*) from public.competitor_agenda_runs x where x::text like '%437000000%')::int as agenda`, [b.site])
    expect(numero[0]).toEqual({ snaps: 0, comentarios: 0, leituras: 0, identidades: 0, cota: 0, agenda: 0 })
    // pool_stats e rule_params (jsonb) só têm números; o bruto do canal não mudou
    const snap = (await snaps(b.video.id))[0]!
    expect(JSON.stringify(snap.pool_stats)).not.toMatch(/[A-Za-z]{4,}.*"[^"]*zq/)
    expect(Number((await q('select count(*) as n from public.competitor_raw where site_id = $1', [b.site]))[0]!.n), 'competitor_raw não mudou').toBe(raw0)
    // a cota gravada leva só contadores
    const cota = await cotaDoSite(b.site)
    expect(cota).toHaveLength(1)
    expect(Object.keys(cota[0]!.operations as Linha).sort()).toEqual(['comentarios', 'comentarios_retratos'])
    expect(relatoComoTexto()).toBe('[]')
  })

  // ───────────────────────── 5 ─────────────────────────
  it('5. custo: 12 retratos custam no máximo 6 + 2 por retrato idas ao banco e 3 chamadas à API por retrato (tempos medidos)', async () => {
    const site = await novoSite()
    const c = await novoCanal(site)
    for (let i = 0; i < 12; i++) await novoVideo(c.id, 30 + i)
    const tag = 't5' + uid()
    const api = criarApiFalsa({ threads: () => okApi(corpoDeConversas(lote(tag, 1, 14))), channels: canaisPequenos })
    idas.n = 0; idas.urls.length = 0
    const t = performance.now()
    const r = await rodar(site, api)
    const ms = Math.round(performance.now() - t)
    expect(r, JSON.stringify(r.numeros)).toMatchObject({ status: 'ok', feitos: 12, ficaram: 0 })
    const teto = 6 + 2 * 12
    console.info(`[E14 T11 custo] 12 retratos: ${idas.n} idas ao banco (teto ${teto}), ${api.chamadas.length} chamadas à API (teto 36), ${ms} ms, ${r.numeros.unidades} unidades`)
    expect(idas.n).toBeLessThanOrEqual(teto)
    expect(api.chamadas.length).toBeLessThanOrEqual(3 * 12)
    expect(r.numeros.unidades).toBe(api.chamadas.length)
    // por rota: as idas do banco de um marco 1 são a prova (2), os devidos, o cadastro (2), um apply por retrato e a cota
    const porRota = idas.urls.reduce<Record<string, number>>((acc, u) => { acc[u] = (acc[u] ?? 0) + 1; return acc }, {})
    expect(porRota['/rest/v1/rpc/apply_competitor_comment_snap']).toBe(12)
    expect(porRota['/rest/v1/rpc/competitor_comment_health']).toBe(2)
    expect(porRota['/rest/v1/rpc/competitor_comment_due']).toBe(1)
    expect(porRota['/rest/v1/rpc/youtube_quota_add']).toBe(1)
    expect(porRota['/rest/v1/competitor_video_comments'], 'marco 1: nenhuma leitura de guardados').toBeUndefined()
    expect(ms, 'o orçamento de começo de retrato é 40 s para a execução inteira').toBeLessThan(COMMENT_RULES.startBudgetMs)
  })

  // ───────────────────────── 6 ─────────────────────────
  it('6. o dia de 75 canais: 61 devidos e callsMax 60: três execuções seguidas zeram a fila do site, cada uma com o `ficaram` certo', async () => {
    const site = await novoSite()
    const tag = uid()
    await pg.query(`insert into public.competitor_channels (site_id, channel_id, channel_name, subscriber_count)
      select $1, 'UC' || $2 || lpad(i::text, 10, '0'), 'Canal ' || i, 5000 from generate_series(1, 75) i`, [site, tag])
    await pg.query(`insert into public.competitor_videos (competitor_channel_id, video_id, published_at, comment_count)
      select c.id, 'v' || $2 || lpad(c.rn::text, 4, '0'), now() - (interval '30 hours' + c.rn * interval '1 minute'), 40
        from (select id, row_number() over (order by channel_id) as rn from public.competitor_channels where site_id = $1) c where c.rn <= 61`, [site, tag])
    const api = criarApiFalsa({ threads: () => okApi(corpoDeConversas(lote('t6', 1, 3))), channels: canaisPequenos })
    const execucoes: Array<{ r: TarefaSaida; ms: number; idas: number }> = []
    for (let k = 0; k < 3; k++) {
      idas.n = 0
      const t = performance.now()
      const r = await rodar(site, api)
      execucoes.push({ r, ms: Math.round(performance.now() - t), idas: idas.n })
    }
    const [a, b2, c3] = execucoes as [typeof execucoes[0], typeof execucoes[0], typeof execucoes[0]]
    // 2 unidades por retrato (conversas + autores) e 60 de teto: 30 por execução
    expect(a.r).toMatchObject({ status: 'parcial', feitos: 30, ficaram: 31 })
    expect(a.r.numeros).toMatchObject({ devidos: 61, unidades: 60 })
    expect(b2.r).toMatchObject({ status: 'parcial', feitos: 30, ficaram: 1 })
    expect(b2.r.numeros).toMatchObject({ devidos: 31, unidades: 60 })
    expect(c3.r).toMatchObject({ status: 'ok', feitos: 1, ficaram: 0 })
    expect(c3.r.numeros).toMatchObject({ devidos: 1, retratos_atrasados: 0 })
    console.info(`[E14 T11 dia de 75 canais] ${execucoes.map((e, k) => `exec ${k + 1}: ${e.ms} ms, ${e.idas} idas, feitos ${e.r.feitos}, ficaram ${e.r.ficaram}`).join(' | ')}`)
    expect((await contagens(site)).snaps).toBe(61)
    // a cota do dia soma as três execuções (60 + 60 + 2 = 122 unidades) e guarda o maior "ficaram" (31)
    const cota = await cotaDoSite(site)
    expect(cota).toHaveLength(1)
    expect(Number(cota[0]!.units_used)).toBe(122)
    expect(cota[0]!.operations).toMatchObject({ comentarios: 122, comentarios_retratos: 61, comentarios_ficaram: 31 })
    // e um disparo a mais não acha nada devido
    expect(await rodar(site, api)).toMatchObject({ status: 'ok', feitos: 0, ficaram: 0 })
  })

  // ───────────────────────── 7 ─────────────────────────
  it('7. duas execuções ao mesmo tempo sobre os mesmos devidos: cada (vídeo, marco) tem um retrato, nenhuma identidade duplicada, a cota somada é a das duas', async () => {
    const site = await novoSite()
    const c = await novoCanal(site)
    const videos = [await novoVideo(c.id, 30), await novoVideo(c.id, 31), await novoVideo(c.id, 32)]
    const tag = 't7' + uid()
    // cada execução espera a outra antes da primeira chamada à API: as duas já leram a mesma lista de devidos
    const espera = criarBarreira(2)
    const primeira = { passou: false }
    const segunda = { passou: false }
    const mk = (estado: { passou: boolean }): ApiFalsa => criarApiFalsa(
      { threads: () => okApi(corpoDeConversas(lote(tag, 1, 6))), channels: canaisPequenos },
      async (rota) => { if (rota === 'commentThreads' && !estado.passou) { estado.passou = true; await espera() } },
    )
    const [apiA, apiB] = [mk(primeira), mk(segunda)]
    const [ra, rb] = await Promise.all([rodar(site, apiA), rodar(site, apiB)])
    expect(ra.numeros.devidos).toBe(3)
    expect(rb.numeros.devidos).toBe(3)
    expect(ra.feitos + rb.feitos, 'cada retrato foi feito por UMA das duas').toBe(3)
    expect(ra.numeros.ja_existe + rb.numeros.ja_existe, 'e a outra recebeu ja_existe').toBe(3)
    for (const v of videos) expect(await snaps(v.id)).toHaveLength(1)
    const dup = await q(`select count(*)::int as n from (select video_id, youtube_comment_id from public.competitor_video_comments where site_id = $1 group by 1, 2 having count(*) > 1) x`, [site])
    expect(dup[0]!.n).toBe(0)
    expect(await contagens(site)).toEqual({ snaps: 3, comentarios: 18, leituras: 18, identidades: 18 })
    // o gasto em dobro é real e fica registrado: a cota soma as duas
    const gasto = ra.numeros.unidades + rb.numeros.unidades
    expect(gasto).toBe(apiA.chamadas.length + apiB.chamadas.length)
    const cota = await cotaDoSite(site)
    expect(cota).toHaveLength(1)
    expect(Number(cota[0]!.units_used), 'a cota somada é a das duas').toBe(gasto)
    expect(cota[0]!.operations).toMatchObject({ comentarios: gasto })
  })

  // ───────────────────────── 8 ─────────────────────────
  it('8. a remoção leva tudo: competitor_channel_comment_impact antes, delete do canal, as quatro tabelas zeradas para ele (item 120)', async () => {
    const b = await cenario(30)
    const outro = await novoCanal(b.site)
    const videoOutro = await novoVideo(outro.id, 30)
    const tag = 't8' + uid()
    const api = criarApiFalsa({ threads: () => okApi(corpoDeConversas(lote(tag, 1, 5))), channels: canaisPequenos })
    expect(await rodar(b.site, api)).toMatchObject({ status: 'ok', feitos: 2 })
    const impacto = await lerImpacto(sb, b.site, b.canal.id)
    expect(impacto, 'o impacto do canal é lido').not.toBeNull()
    const direto = await q(`select
      (select count(*) from public.competitor_video_comment_snaps where competitor_channel_id = $1)::int as snaps,
      (select count(*) from public.competitor_video_comments where competitor_channel_id = $1)::int as comentarios`, [b.canal.id])
    expect(direto[0]).toEqual({ snaps: 1, comentarios: 5 })
    expect(JSON.stringify(impacto)).toContain('5')
    await pg.query('delete from public.competitor_channels where id = $1', [b.canal.id])
    const resto = await q(`select
      (select count(*) from public.competitor_video_comment_snaps where video_id = $1)::int as snaps,
      (select count(*) from public.competitor_video_comments where video_id = $1)::int as comentarios,
      (select count(*) from public.competitor_video_comment_marks m join public.competitor_video_comments c on c.id = m.comment_id where c.video_id = $1)::int as leituras,
      (select count(*) from public.competitor_video_comment_authors a join public.competitor_video_comments c on c.id = a.comment_id where c.video_id = $1)::int as identidades`, [b.video.id])
    expect(resto[0], 'as quatro tabelas zeradas para o canal removido').toEqual({ snaps: 0, comentarios: 0, leituras: 0, identidades: 0 })
    expect(await lerImpacto(sb, b.site, b.canal.id), 'canal que não existe mais: nada a contar').toBeNull()
    // o outro canal do site ficou intacto
    expect((await snaps(videoOutro.id))).toHaveLength(1)
    expect((await contagens(b.site)).snaps).toBe(1)
  })

  // ───────────────────────── 9 ─────────────────────────
  it('9. retrato com autor de nome sujo é gravado: NUL e substituto solitário no nome e no texto não derrubam o retrato (antes: 22P05 para sempre)', async () => {
    const b = await cenario(30)
    const tag = 't9' + uid()
    const sujo = `Autor\u0000 sujo \ud800 da ${tag}`
    const api = criarApiFalsa({
      threads: () => okApi(corpoDeConversas([cv(tag, 1, { nome: sujo, texto: `texto\u0000 com \udc00 lixo ${tag}` }), ...lote(tag, 2, 3)])),
      channels: canaisPequenos,
    })
    const r = await rodar(b.site, api)
    expect(r, JSON.stringify(r.numeros)).toMatchObject({ status: 'ok', feitos: 1, numeros: { ok: 1, erros_de_gravacao: 0 } })
    expect((await snaps(b.video.id))[0]).toMatchObject({ status: 'ok' })
    const nome = await q(`select a.display_name, c.body from public.competitor_video_comment_authors a join public.competitor_video_comments c on c.id = a.comment_id where c.video_id = $1 and c.youtube_comment_id = $2`, [b.video.id, idDe(tag, 1)])
    expect(nome).toHaveLength(1)
    for (const campo of [String(nome[0]!.display_name), String(nome[0]!.body)]) {
      expect(campo).not.toContain('\u0000')
      expect(/[\ud800-\udfff]/.test(campo), 'nenhum substituto solitário').toBe(false)
    }
    expect(String(nome[0]!.display_name)).toContain('Autor')
    expect(String(nome[0]!.display_name)).toContain(tag)
  })

  // ───────────────────────── 10 ─────────────────────────
  it('10. o número da prova chega à execução nos dois sentidos: retrato que não grava (curtida de 3 bilhões, banco:22003) = erro e retratos_atrasados 1; consertado = ok e 0; identidade com prazo errado = identidade_invariante', async () => {
    const b = await cenario(9 * 24)
    const tag = 't10' + uid()
    let curtidas = 3_000_000_000
    const api = criarApiFalsa({
      threads: () => okApi(corpoDeConversas(lote(tag, 1, 4, (i) => (i === 1 ? { curtidas } : {})))),
      channels: canaisPequenos,
    })
    const ruim = await rodar(b.site, api)
    expect(ruim.status).toBe('erro')
    expect(ruim.numeros).toMatchObject({ retratos_atrasados: 1, erros_de_gravacao: 1, feitos: 0 })
    expect(ruim.motivo, 'o motivo é o do banco, nunca texto').toBe('banco')
    expect(await snaps(b.video.id), 'nada foi gravado').toEqual([])
    expect(relatado.chamadas.map((c) => c[1]), 'o Sentry recebeu o SQLSTATE como código').toContain('banco:22003')
    expect(relatoComoTexto()).not.toContain(tag)
    // consertada a resposta, a mesma execução fecha o vídeo
    curtidas = 3_000
    const bom = await rodar(b.site, api)
    expect(bom, JSON.stringify(bom.numeros)).toMatchObject({ status: 'ok', feitos: 1 })
    expect(bom.numeros.retratos_atrasados).toBe(0)
    expect((await snaps(b.video.id))[0]).toMatchObject({ mark: 7, status: 'ok' })

    // identidade com prazo diferente de 28 dias: a rotina fica vermelha; desfeita a forja, volta ao verde
    const alvo = await cm(b.video.id, idDe(tag, 2))
    await pg.query(`update public.competitor_video_comment_authors set expires_at = expires_at + interval '40 days' where comment_id = $1`, [alvo.id])
    const forjada = await anular(b.site)
    expect(forjada).toMatchObject({ status: 'erro', motivo: 'identidade_invariante' })
    expect(forjada.numeros.identidade_prazo_errado).toBe(1)
    await pg.query(`update public.competitor_video_comment_authors set expires_at = expires_at - interval '40 days' where comment_id = $1`, [alvo.id])
    expect(await anular(b.site)).toMatchObject({ status: 'ok', numeros: { identidade_prazo_errado: 0, apagadas: 0 } })
  })

  // ───────────────────────── 11 ─────────────────────────
  it('11. o corte: com `since` de agora não coleta os vídeos que atingiram o marco antes e termina ok com retratos_atrasados 0; com `since` nulo, coleta', async () => {
    const b = await cenario(30)
    const api = criarApiFalsa({ threads: () => okApi(corpoDeConversas(lote('t11', 1, 3))), channels: canaisPequenos })
    desde.v = iso(Date.now())
    const cortado = await rodar(b.site, api)
    expect(cortado, JSON.stringify(cortado.numeros)).toMatchObject({ status: 'ok', feitos: 0, ficaram: 0 })
    expect(cortado.numeros).toMatchObject({ devidos: 0, retratos_atrasados: 0 })
    expect(api.chamadas).toHaveLength(0)
    expect(await snaps(b.video.id)).toEqual([])
    desde.v = null
    const livre = await rodar(b.site, api)
    expect(livre).toMatchObject({ status: 'ok', feitos: 1 })
    expect(await snaps(b.video.id)).toHaveLength(1)
  })

  // ───────────────────────── (d) a conferência que falha ─────────────────────────
  it('d. lerGuardados falhando (o banco responde 500) não marca nada: a conferência FALHOU, nunca "lista vazia", e nenhum guardado vira ausente', async () => {
    const b = await cenario(30)
    const tag = 'td' + uid()
    const fora = new Set<string>()
    const api = criarApiFalsa({
      threads: () => okApi(corpoDeConversas(lote(tag, 1, 8).filter((c) => !fora.has(String((c as { id: string }).id))))),
      channels: canaisPequenos,
    })
    expect(await rodar(b.site, api)).toMatchObject({ status: 'ok', feitos: 1 })
    await idadeDoVideo(b.video.id, 8)
    ;[idDe(tag, 4), idDe(tag, 5)].forEach((id) => fora.add(id))
    idas.falhar = (url) => (url.pathname === '/rest/v1/competitor_video_comments' && url.search.includes('video_id=eq.')
      ? new Response(JSON.stringify({ message: 'falha inventada do banco', code: '57P01' }), { status: 500, headers: { 'content-type': 'application/json' } })
      : undefined)
    const r = await rodar(b.site, api)
    expect(r, JSON.stringify(r.numeros)).toMatchObject({ status: 'ok', feitos: 1 })
    expect(r.numeros).toMatchObject({ conferencias_falhas: 1, ausentes_marcados: 0 })
    expect(api.n('comments'), 'sem a lista dos guardados não há o que conferir').toBe(0)
    const marcados = await q(`select youtube_comment_id, miss_streak, missing_since from public.competitor_video_comments where video_id = $1 and (miss_streak <> 0 or missing_since is not null)`, [b.video.id])
    expect(marcados, 'nenhum comentário foi marcado como ausente').toEqual([])
    expect((await snaps(b.video.id)).map((s) => s.mark), 'o retrato do marco 7 foi gravado').toEqual([1, 7])
    // com o banco de volta, o marco 30 confere e marca o que de fato sumiu (uma ausência basta no marco 30)
    idas.falhar = undefined
    await idadeDoVideo(b.video.id, 31)
    const r30 = await rodar(b.site, api)
    expect(r30, JSON.stringify(r30.numeros)).toMatchObject({ status: 'ok', feitos: 1 })
    expect(api.n('comments')).toBe(1)
    const ausentes = await q(`select youtube_comment_id from public.competitor_video_comments where video_id = $1 and missing_since is not null order by 1`, [b.video.id])
    expect(ausentes.map((x) => x.youtube_comment_id)).toEqual([idDe(tag, 4), idDe(tag, 5)])
  })

  // ───────────────────────── (e) cota ─────────────────────────
  it('e. cota: cota_esgotada no meio para a execução (o resto fica para o próximo disparo) e a cota gasta é gravada', async () => {
    const site = await novoSite()
    const c = await novoCanal(site)
    // a ordem é a do prazo: o mais velho primeiro
    const v50 = await novoVideo(c.id, 50)
    const v40 = await novoVideo(c.id, 40)
    const v30 = await novoVideo(c.id, 30)
    const tag = 'te' + uid()
    const api = criarApiFalsa({
      threads: (yt) => (yt === v40.yt ? erroApi(403, 'quotaExceeded') : okApi(corpoDeConversas(lote(tag, 1, 4)))),
      channels: canaisPequenos,
    })
    const r = await rodar(site, api)
    expect(r.status).toBe('erro')
    expect(r.motivo).toBe('cota_esgotada')
    expect(r).toMatchObject({ feitos: 1, ficaram: 2 })
    expect(api.chamadas.map((x) => [x.rota, x.id])).toEqual([['commentThreads', v50.yt], ['channels', expect.any(String)], ['commentThreads', v40.yt]])
    expect(api.chamadas.some((x) => x.id === v30.yt), 'depois da cota nenhuma chamada').toBe(false)
    expect((await snaps(v50.id))).toHaveLength(1)
    expect(await snaps(v40.id), 'o vídeo da cota não ganha retrato em erro').toEqual([])
    expect(await snaps(v30.id)).toEqual([])
    // a cota gasta: 3 unidades (duas do primeiro vídeo, uma da chamada recusada) gravadas, com o que ficou
    expect(r.numeros.unidades).toBe(3)
    const cota = await cotaDoSite(site)
    expect(cota).toHaveLength(1)
    expect(Number(cota[0]!.units_used)).toBe(3)
    expect(cota[0]!.operations).toMatchObject({ comentarios: 3, comentarios_retratos: 1, comentarios_ficaram: 2 })
    // no disparo seguinte (cota de volta) os dois que ficaram são feitos
    const api2 = criarApiFalsa({ threads: () => okApi(corpoDeConversas(lote(tag, 1, 4))), channels: canaisPequenos })
    expect(await rodar(site, api2)).toMatchObject({ status: 'ok', feitos: 2, ficaram: 0 })
    expect(Number((await cotaDoSite(site))[0]!.units_used)).toBe(3 + 4)
  })

  // ───────────────────────── (f) LGPD de ponta a ponta ─────────────────────────
  it('f. LGPD de ponta a ponta: grava com sentinelas de autor, envelhece 28 dias, anula, e a varredura por catálogo não acha identidade em lugar nenhum (só ficam o texto e o motivo do destaque; o vínculo com o canal é zerado)', async () => {
    const b = await cenario(30)
    const acompanhado = await novoCanal(b.site)
    const sent = (): string => 'zq' + uid()
    const regulares = Array.from({ length: 5 }, sent)
    const sentAcomp = sent()
    const sentCriador = sent()
    const sentRespostaDoCriador = sent()
    const corpo = sent()
    const tag = 'tf' + uid()
    // o canal acompanhado precisa do id da sentinela
    await pg.query('update public.competitor_channels set channel_id = $2 where id = $1', [acompanhado.id, 'UC' + sentAcomp])
    const regs = regulares.map((x, i) => comFoto(cv(tag, i + 1, {
      nome: 'Autor ' + x, canalId: 'UC' + x, texto: i === 0 ? 'texto com a marca ' + corpo : undefined,
      ...(i === 1 ? { respostas: [resposta(idDe(tag, 2), 1, { id: tag + '-r1', canalId: b.canal.yt, nome: 'Resposta ' + sentRespostaDoCriador, texto: 'resposta do criador ' + corpo })], totalReplyCount: 1 } : {}),
    }), 'https://img.invalid/' + x + '.jpg'))
    const daAcomp = comFoto(cv(tag, 6, { nome: 'Acompanhado ' + sentAcomp, canalId: 'UC' + sentAcomp }), 'https://img.invalid/' + sentAcomp + '.jpg')
    const doCriador = comFoto(cv(tag, 7, { nome: 'Criador ' + sentCriador, canalId: b.canal.yt }), 'https://img.invalid/' + sentCriador + '.jpg')
    let extra: Record<string, unknown>[] = []
    const api = criarApiFalsa({ threads: () => okApi(corpoDeConversas([...regs, daAcomp, doCriador, ...extra])), channels: canaisPequenos })
    expect(await rodar(b.site, api)).toMatchObject({ status: 'ok', feitos: 1 })
    expect(await contagens(b.site)).toMatchObject({ comentarios: 8, identidades: 6 })

    const todas = [...regulares, sentAcomp, sentCriador, sentRespostaDoCriador, corpo]
    const antes = await varredura(todas)
    for (const x of regulares) expect(antes[x], 'antes: ' + x).toEqual(AUTORES)
    expect(antes[sentAcomp], 'o autor que é canal acompanhado: a identidade e o cadastro do canal (dado do dono)').toEqual(['competitor_channels.channel_id', ...AUTORES])
    expect(antes[sentCriador], 'o criador nunca tem identidade').toEqual([])
    expect(antes[sentRespostaDoCriador], 'o nome do autor da resposta do criador nunca é guardado').toEqual([])
    expect(antes[corpo], 'o texto fica no comentário (risco aceito) e só lá').toEqual(['competitor_video_comments.body'])

    // 28 dias (e um a mais) depois
    await envelhecer(b.site, 29)
    const an = await anular(b.site)
    expect(an).toMatchObject({ status: 'ok', feitos: 6, numeros: { apagadas: 6, restantes: 0 } })
    const depois = await varredura(todas)
    for (const x of regulares) expect(depois[x], 'depois: ' + x).toEqual([])
    expect(depois[sentAcomp], 'só o cadastro do canal acompanhado, que é do dono').toEqual(['competitor_channels.channel_id'])
    expect(depois[sentCriador]).toEqual([])
    expect(depois[sentRespostaDoCriador]).toEqual([])
    expect(depois[corpo], 'o que o plano declara que fica: o texto').toEqual(['competitor_video_comments.body'])
    expect(await cm(b.video.id, idDe(tag, 6))).toMatchObject({ featured_reason: 'canal_acompanhado', featured_channel_id: null })
    expect(Number((await q('select count(*) as n from public.competitor_video_comment_authors where site_id = $1', [b.site]))[0]!.n)).toBe(0)

    // a coleta do marco 30 devolve os mesmos autores: nenhum ganha identidade de volta; um comentário NOVO ganha
    const sentNovo = sent()
    extra = [comFoto(cv(tag, 8, { nome: 'Novo ' + sentNovo, canalId: 'UC' + sentNovo }), 'https://img.invalid/' + sentNovo + '.jpg')]
    expect(await rodar(b.site, api)).toMatchObject({ status: 'ok', feitos: 1 })
    const volta = await varredura([...todas, sentNovo])
    for (const x of regulares) expect(volta[x], 'depois da volta: ' + x).toEqual([])
    expect(volta[sentAcomp]).toEqual(['competitor_channels.channel_id'])
    expect(volta[sentNovo], 'o comentário novo tem identidade, com prazo próprio').toEqual(AUTORES)
    // a prova: nenhuma identidade vencida, e a execução seguinte da rotina apaga 0
    expect(await anular(b.site)).toMatchObject({ status: 'ok', feitos: 0, numeros: { restantes: 1 } })
    expect(relatoComoTexto()).not.toMatch(/zq[0-9a-f]{12}/)
  })

  // ───────────────────────── (g) COMMENT_SINCE ─────────────────────────
  it('g. COMMENT_SINCE: o valor do HEAD é "a_decidir" e a coleta devolve inicio_nao_decidido sem ler nem chamar nada; com o início decidido a coleta de verdade roda', async () => {
    const real = (await vi.importActual<typeof import('@/lib/youtube/observatorio/comentarios/regras')>('@/lib/youtube/observatorio/comentarios/regras')).COMMENT_SINCE
    // o HEAD ainda não decidiu (pergunta 1 do dono): este caso é o aviso de que o valor mudou
    console.info(`[E14 T11 COMMENT_SINCE] valor real no HEAD: ${JSON.stringify(real)}`)

    const b = await cenario(30)
    const api = criarApiFalsa({ threads: () => okApi(corpoDeConversas(lote('tg', 1, 3))), channels: canaisPequenos })
    desde.v = 'a_decidir'
    idas.n = 0
    const parada = await rodar(b.site, api)
    expect(parada).toMatchObject({ status: 'erro', motivo: 'inicio_nao_decidido', feitos: 0, ficaram: 0 })
    expect(api.chamadas, 'nada é chamado na API').toHaveLength(0)
    expect(idas.n, 'nada é lido no banco').toBe(0)
    expect(await snaps(b.video.id)).toEqual([])
    // a anulação NÃO depende do início: roda com 'a_decidir'
    expect(await anular(b.site)).toMatchObject({ status: 'ok' })
    // com uma data decidida no passado distante, o vídeo entra
    desde.v = iso(Date.now() - 400 * D)
    expect(await rodar(b.site, api)).toMatchObject({ status: 'ok', feitos: 1 })
    expect(await snaps(b.video.id)).toHaveLength(1)
  })

  // ───────────────────────── o relógio do arquivo ─────────────────────────
  it('z. o arquivo inteiro cabe nos limites de tempo e só tocou no bythiago_int', () => {
    expect(Date.now() - inicioDoArquivo).toBeLessThan(15 * MIN)
    expect(URL_BANCO).toContain(HOST_BANCO)
  })
})
