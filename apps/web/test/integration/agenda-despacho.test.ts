// @vitest-environment node
/**
 * A5 · E16 parte 1, Tarefa 13: o disparo da agenda de ponta a ponta contra Postgres de verdade (`executarAgenda`, o despachante, as
 * tarefas, o fecho, a prova SQL e o aviso ao dono), com um `fetch` FIXO: nenhuma chamada sai da máquina para a API do YouTube.
 * Banco: SÓ o `bythiago_int`. Rodar com:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/agenda-despacho.test.ts --no-file-parallelism
 *
 * O banco é dividido com outras etapas. Cada caso cria o SEU site, os SEUS canais e vídeos e as SUAS tarefas (`teste-<uuid>-<nome>`);
 * o `loadBatchRows` é injetado com filtro por site e o cliente que o disparo recebe só enxerga os vídeos dos sites do teste (a lista da
 * leitura horária lê a tabela inteira). Nenhuma afirmação conta linhas de tabela inteira.
 *
 * O arrendamento tem nome FIXO ('despachante'): o teste o TOMA de verdade no banco compartilhado, roda em série e o solta no fim de
 * cada caso (inclusive depois de falha). O relógio é injetado: BASE é "ontem às 15:20 em São Paulo" (passado, depois das 12:00 de SP).
 */
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import { skipIfNoLocalDb, localSupabaseUrl } from '../helpers/db-skip'
import { seedSite, seedStaffUser } from '../helpers/db-seed'

// ── os módulos que o teste espia ou isola (nada disto troca o comportamento de um disparo da agenda) ───────────────────────────────
vi.mock('@sentry/nextjs', async importOriginal => {
  const real = await importOriginal<typeof import('@sentry/nextjs')>()
  return { ...real, captureMessage: vi.fn(), captureException: vi.fn() }
})
/** O arrendamento "forçado a dar erro" do item 153: o resto de `estado.ts` é o de verdade. */
const gancho: { tomar: null | (() => Promise<{ porque: string; causa: 'excecao' }>) } = { tomar: null }
vi.mock('@/lib/youtube/agenda/estado', async importOriginal => {
  const real = await importOriginal<typeof import('@/lib/youtube/agenda/estado')>()
  return { ...real, tomarArrendamento: vi.fn((sb: Parameters<typeof real.tomarArrendamento>[0], holder: string) => (gancho.tomar ? gancho.tomar() : real.tomarArrendamento(sb, holder))) }
})
/** O item (e): a rota chama `executarAgenda`; o espião delega ao de verdade. */
vi.mock('@/lib/youtube/agenda/executar', async importOriginal => {
  const real = await importOriginal<typeof import('@/lib/youtube/agenda/executar')>()
  return { ...real, executarAgenda: vi.fn(real.executarAgenda) }
})
/** Só o lote antigo é falso (o teste da rota com a agenda desligada não pode sincronizar canais alheios). */
vi.mock('@/lib/youtube/competitor-sync-batch', async importOriginal => {
  const real = await importOriginal<typeof import('@/lib/youtube/competitor-sync-batch')>()
  return { ...real, runCompetitorBatch: vi.fn() }
})
vi.mock('@/lib/cron-health', async importOriginal => {
  const real = await importOriginal<typeof import('@/lib/cron-health')>()
  return { ...real, recordCronSuccess: vi.fn(async () => undefined), recordCronFailure: vi.fn(async () => undefined) }
})
/** A trava de sessão do lote antigo (`cron_try_lock`) não é o assunto aqui e guarda estado na sessão do pool. */
vi.mock('../../lib/logger', async importOriginal => {
  const real = await importOriginal<typeof import('../../lib/logger')>()
  return { ...real, withCronLock: vi.fn(async (_sb: unknown, _lock: string, _run: string, _job: string, fn: () => Promise<Record<string, unknown>>) => Response.json(await fn())) }
})

import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { executarAgenda } from '@/lib/youtube/agenda/executar'
import { DEFINICOES } from '@/lib/youtube/agenda/catalogo'
import { leituraHoraria } from '@/lib/youtube/agenda/tarefas/leitura-horaria'
import { lerEstado } from '@/lib/youtube/agenda/estado'
import { lerAgendaDoVigia } from '@/lib/youtube/agenda/saude'
import { chaveDoPeriodo } from '@/lib/youtube/agenda/periodo'
import type { Tarefa } from '@/lib/youtube/agenda/tipos'
import { loadBatchRows, runCompetitorBatch } from '@/lib/youtube/competitor-sync-batch'
import { readSiteHealth } from '@/lib/youtube/competitor-health'
import { lerNegadosDoDono, lerProvaHoraria, veredictoHorario, type ProvaHoraria } from '@/lib/youtube/horaria/prova'
import { lerCandidatos } from '@/lib/youtube/horaria/gravar'
import { GET as rotaSyncYoutube } from '@/app/api/cron/sync-youtube/route'
import { recordCronFailure } from '@/lib/cron-health'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const RUN = !skipIfNoLocalDb()
if (RUN) vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 })
const HORA = 3_600_000
const DIA = 24 * HORA
/** O relógio de todos os casos: ontem às 15:20 em São Paulo (18:20 UTC). Passado, e depois das 12:00 de SP (a série semanal é devida). */
const BASE = Math.floor((Date.now() - DIA) / DIA) * DIA + 18 * HORA + 20 * 60_000
const iso = (ms: number): string => new Date(ms).toISOString()
const dia = (ms: number): string => iso(ms).slice(0, 10)
const dormir = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms))

// ── o `fetch`: o YouTube é de mentira; o resto passa. O cliente do Supabase resolve o `fetch` global na criação: o embrulho entra antes. ──
const dbCalls = { n: 0 }
const realFetch = globalThis.fetch
interface Resposta { views: number; privacidade?: 'public' | 'unlisted' | 'private' | 'semStatus' }
interface Mundo {
  /** id → o que o YouTube devolve; o id que não está aqui "foi apagado" (não vem na resposta). */
  videos: Map<string, Resposta>
  /** resposta fixa para toda chamada (HTTP 200 com este corpo), no lugar da montada. */
  corpoFixo?: unknown
  /** HTTP de erro para toda chamada. */
  http?: number
  chamadas: number
  blocos: string[][]
}
let mundo: Mundo | null = null
const novoMundo = (videos: Array<[string, Resposta]> = []): Mundo => ({ videos: new Map(videos), chamadas: 0, blocos: [] })
if (RUN) {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input)
    if (url.includes('googleapis.com/youtube/')) {
      const m = mundo
      if (!m) return new Response('sem mundo no teste', { status: 500 })
      m.chamadas++
      const ids = (new URL(url).searchParams.get('id') ?? '').split(',').filter(Boolean)
      m.blocos.push(ids)
      if (m.http !== undefined) return new Response('{}', { status: m.http })
      if (m.corpoFixo !== undefined) return Response.json(m.corpoFixo)
      const items = ids.flatMap(id => {
        const r = m.videos.get(id)
        if (!r) return []
        return [{
          id,
          statistics: { viewCount: String(r.views), likeCount: String(Math.floor(r.views / 100)), commentCount: '2' },
          ...(r.privacidade === 'semStatus' ? {} : { status: { privacyStatus: r.privacidade ?? 'public' } }),
        }]
      })
      return Response.json({ items })
    }
    if (url.startsWith(localSupabaseUrl())) dbCalls.n++
    return realFetch(input, init)
  }) as typeof fetch
}

// ── o banco ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
type Sb = ReturnType<typeof getSupabaseServiceClient>
type Linha = Record<string, unknown>

describe.skipIf(skipIfNoLocalDb())('A5 E16 parte 1: o disparo inteiro da agenda contra o banco local (fetch fixo)', () => {
  let pg: Client
  let sb: Sb
  const sites: string[] = []
  const prefixos: string[] = []
  const usuarios: string[] = []
  const gatilhos: Array<{ funcao: string; gatilho: string }> = []
  const diretorio = RUN ? mkdtempSync(join(tmpdir(), 'agenda-despacho-')) : ''

  beforeAll(async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    sb = getSupabaseServiceClient()
    pg = new Client({ connectionString: PG_URL })
    await pg.connect()
    // o arrendamento é fixo e compartilhado: se alguém o tem agora, o teste não pode seguir (tomaria o de outro)
    const preso = await q('select expires_at > now() as vivo from public.competitor_agenda_lease where name = $1', ['despachante'])
    if (preso.length > 0 && preso[0]!.vivo === true) throw new Error('o arrendamento "despachante" está tomado por outro; rode quando o banco estiver livre')
  })

  afterEach(async () => {
    gancho.tomar = null
    mundo = null
    vi.mocked(Sentry.captureMessage).mockClear()
    vi.mocked(Sentry.captureException).mockClear()
    // sobrou arrendamento (caso que falhou no meio)? É nosso: o teste conferiu no começo que não havia outro. Solta.
    await pg.query(`delete from public.competitor_agenda_lease where name = 'despachante'`)
  })

  afterAll(async () => {
    try {
      for (const g of gatilhos) {
        await pg.query(`drop trigger if exists ${g.gatilho} on public.competitor_video_early`)
        await pg.query(`drop function if exists public.${g.funcao}()`)
      }
      if (sites.length > 0) {
        await pg.query('delete from public.notifications where site_id = any($1::uuid[])', [sites])
        for (const t of ['yt_own_public_hour_fold_log', 'yt_own_public_hour_map', 'yt_own_public_video_early', 'yt_own_public_video_hourly', 'yt_own_video_meta_daily', 'youtube_videos', 'youtube_channels', 'youtube_quota_usage']) {
          await pg.query(`delete from public.${t} where site_id = any($1::uuid[])`, [sites])
        }
        await pg.query('delete from public.sites where id = any($1::uuid[])', [sites])
      }
      for (const p of prefixos) await pg.query('delete from public.competitor_agenda_runs where task like $1', [p + '%'])
      await pg.query(`delete from public.competitor_agenda_lease where name = 'despachante'`)
      if (usuarios.length > 0) {
        await pg.query('delete from public.organization_members where user_id = any($1::uuid[])', [usuarios])
        await pg.query('delete from auth.users where id = any($1::uuid[])', [usuarios])
      }
    } finally {
      await pg.end()
      vi.restoreAllMocks()
    }
  })

  // ───────────────────────── ajudantes ─────────────────────────
  async function q(sql: string, params: unknown[] = []): Promise<Linha[]> { return (await pg.query(sql, params)).rows as Linha[] }
  const n = async (sql: string, params: unknown[] = []): Promise<number> => Number((await q(sql, params))[0]!.n)
  const prefixo = (): string => { const p = 'teste-' + randomUUID(); prefixos.push(p); return p }
  const novoSite = async (): Promise<string> => { const s = (await seedSite(sb)).siteId; sites.push(s); return s }

  interface Canal { id: string; yt: string }
  interface Video { id: string; yt: string; canal: string; pub: number | null }
  interface OpcCanal { visto?: number }
  async function canais(siteId: string, quantos: number, o: OpcCanal = {}): Promise<Canal[]> {
    const ids = Array.from({ length: quantos }, () => 'UC' + randomUUID().replace(/-/g, '').slice(0, 20))
    const r = await q(`insert into public.competitor_channels (site_id, channel_id, channel_name, last_synced_at, last_seen_at)
      select $1::uuid, c, 'Teste', $3::timestamptz, $4::timestamptz from unnest($2::text[]) as c returning id, channel_id`,
    [siteId, ids, iso(BASE - HORA), o.visto === undefined ? null : iso(o.visto)])
    return r.map(x => ({ id: String(x.id), yt: String(x.channel_id) }))
  }
  interface EntradaVideo { canal: Canal; pub: number | null; descoberto?: number | null }
  async function videosConc(entradas: EntradaVideo[]): Promise<Video[]> {
    if (entradas.length === 0) return []
    const yts = entradas.map(() => 'v' + randomUUID().replace(/-/g, '').slice(0, 10))
    const r = await q(`insert into public.competitor_videos (competitor_channel_id, video_id, published_at, discovered_at)
      select * from unnest($1::uuid[], $2::text[], $3::timestamptz[], $4::timestamptz[]) returning id, video_id, competitor_channel_id`,
    [entradas.map(e => e.canal.id), yts, entradas.map(e => (e.pub === null ? null : iso(e.pub))), entradas.map(e => (e.descoberto == null ? null : iso(e.descoberto)))])
    const porYt = new Map(r.map(x => [String(x.video_id), x]))
    return entradas.map((e, i) => ({ id: String(porYt.get(yts[i]!)!.id), yt: yts[i]!, canal: e.canal.id, pub: e.pub }))
  }
  /** As leituras horárias de um vídeo de concorrente em `slots` (ms), `taken_at` 10 min depois da hora. */
  async function lerConc(v: Video, siteId: string, slots: readonly number[]): Promise<void> {
    if (slots.length === 0) return
    await pg.query(`insert into public.competitor_video_hourly (video_id, hour_slot, taken_at, site_id, views)
      select $1::uuid, s, s + interval '10 minutes', $3::uuid, 100 from unnest($2::timestamptz[]) as s`, [v.id, slots.map(iso), siteId])
  }
  async function canalDono(siteId: string): Promise<string> {
    const k = randomUUID().replace(/-/g, '')
    const r = await q(`insert into public.youtube_channels (site_id, channel_id, locale, handle, name, uploads_playlist_id, slug)
      values ($1, $2, 'pt', $3, 'Teste', $4, $5) returning id`, [siteId, 'UC' + k.slice(0, 20), '@t' + k.slice(0, 8), 'UU' + k.slice(0, 20), 'teste-' + k.slice(0, 8)])
    return String(r[0]!.id)
  }
  interface Dono { id: string; yt: string; canal: string }
  /** `capturas`: privacidade do dia (de `captured_at` relativo a BASE, em horas atrás). */
  async function videoDono(siteId: string, canal: string, o: { pub?: number; criado?: number; capturas: Array<{ status: string | null; haH: number }> }): Promise<Dono> {
    const yt = 'y' + randomUUID().replace(/-/g, '').slice(0, 10)
    const r = await q(`insert into public.youtube_videos (site_id, channel_id, youtube_video_id, title, published_at, created_at)
      values ($1, $2, $3, 'Teste', $4, $5) returning id`, [siteId, canal, yt, iso(o.pub ?? BASE - 5 * DIA), iso(o.criado ?? BASE - 4 * DIA)])
    for (const c of o.capturas) {
      const cap = BASE - c.haH * HORA
      await pg.query(`insert into public.yt_own_video_meta_daily (youtube_video_id, day_pt, site_id, channel_id, privacy_status, captured_at) values ($1, $2, $3, $4, $5, $6)`,
        [yt, dia(cap - DIA), siteId, canal, c.status, iso(cap)])
    }
    return { id: String(r[0]!.id), yt, canal }
  }
  async function lerDono(siteId: string, v: Dono, slots: readonly number[]): Promise<void> {
    if (slots.length === 0) return
    await pg.query(`insert into public.yt_own_public_video_hourly (youtube_video_id, hour_slot, taken_at, site_id, video_id, channel_id, views)
      select $1, s, s + interval '10 minutes', $3::uuid, $4::uuid, $5::uuid, 100 from unnest($2::timestamptz[]) as s`, [v.yt, slots.map(iso), siteId, v.id, v.canal])
  }
  /** As horas cheias (ms) `de` a `ate` horas atrás de BASE (inclusive). */
  const horas = (de: number, ate: number): number[] => {
    const hora = Math.floor(BASE / HORA) * HORA
    return Array.from({ length: ate - de + 1 }, (_, k) => hora - (de + k) * HORA)
  }
  /** Seis vídeos de até 14 dias em três canais: dois recentes e elegíveis à curva. */
  async function cenarioDeSeis(siteId: string): Promise<{ canais: Canal[]; videos: Video[] }> {
    const cs = await canais(siteId, 3)
    const idades = [5 * HORA, 30 * HORA, 3 * DIA, 5 * DIA, 8 * DIA, 12 * DIA]
    const videos = await videosConc(idades.map((idade, i) => ({
      canal: cs[i % 3]!, pub: BASE - idade, descoberto: i < 2 ? BASE - idade + 10 * 60_000 : null,
    })))
    return { canais: cs, videos }
  }
  const mundoDe = (vs: Array<{ yt: string }>, views = 1000): Mundo => novoMundo(vs.map((v, i) => [v.yt, { views: views + i }] as [string, Resposta]))

  // O cliente que o disparo recebe: igual ao de verdade, mas a leitura das listas de vídeos só enxerga os sites do teste.
  interface Seletor { select: (colunas: string, ...resto: unknown[]) => { in: (coluna: string, valores: string[]) => unknown } }
  function soDosSites(real: Sb, siteIds: string[]): Sb {
    const envolver = (alvo: object, tabela: string): object => new Proxy(alvo, {
      get(t, p) {
        if (p === 'select') {
          return (colunas: string, ...resto: unknown[]) => {
            const consulta = (t as Seletor).select(colunas, ...resto)
            if (tabela === 'competitor_videos' && colunas.includes('competitor_channels!inner')) return consulta.in('competitor_channels.site_id', siteIds)
            if (tabela === 'youtube_videos' && colunas.includes('youtube_video_id') && colunas.includes('site_id')) return consulta.in('site_id', siteIds)
            return consulta
          }
        }
        const v: unknown = Reflect.get(t, p)
        return typeof v === 'function' ? v.bind(t) : v
      },
    })
    return new Proxy(real, {
      get(t, p) {
        if (p === 'from') return (tabela: string) => (tabela === 'competitor_videos' || tabela === 'youtube_videos' ? envolver(t.from(tabela), tabela) : t.from(tabela))
        const v: unknown = Reflect.get(t, p)
        return typeof v === 'function' ? v.bind(t) : v
      },
    }) as Sb
  }

  type Rodar = Tarefa['rodar']
  const rodarOk: Rodar = async () => ({ estado: 'ok', feitas: 1, deixadas: 0 })
  /** As três tarefas do catálogo (definições de verdade, nomes de teste). Só a leitura horária roda o código de verdade. */
  function catalogoDe(p: string, o: { sincronizar?: Rodar; serie?: Rodar } = {}): Tarefa[] {
    const ren = (nome: string): string => `${p}-${nome}`
    return DEFINICOES.map(d => ({
      ...d, nome: ren(d.nome), ...(d.cedeA ? { cedeA: d.cedeA.map(ren) } : {}),
      rodar: d.nome === 'leitura_horaria' ? leituraHoraria.rodar : d.nome === 'sincronizar_canais' ? (o.sincronizar ?? rodarOk) : (o.serie ?? rodarOk),
    }))
  }
  const soALeitura = (p: string): Tarefa[] => catalogoDe(p).filter(t => t.nome.endsWith('leitura_horaria'))
  /** Uma tarefa de teste simples: 'sempre', por hora, até 3 tentativas. */
  const tarefaSimples = (nome: string, rodar: Rodar, o: Partial<Tarefa> = {}): Tarefa => ({
    nome, rotulo: 'tarefa de teste', ordem: 1, peso: 'sempre', periodo: 'hora', tetoTentativas: 3, toleranciaVigiaH: 2, naoTerminouVermelhoEm: 3,
    comecaAteMs: 22_000, fimAteMs: 60_000, motivos: { falha_de_teste: 'falhou no teste' }, rodar, ...o,
  })
  const chaveHora = (t0: number = BASE): string => chaveDoPeriodo('hora', t0)

  interface Disparo { corpo: Record<string, unknown> | null; status: string; sucesso: ReturnType<typeof vi.fn>; falha: ReturnType<typeof vi.fn>; estado: Array<{ tarefa: string; estado: string; motivo?: string; detalhe?: Record<string, number> }> }
  async function disparar(catalogo: Tarefa[], siteIds: string[], o: { t0?: number; linhas?: 'sites' | 'vazio' } = {}): Promise<Disparo> {
    const t0 = o.t0 ?? BASE
    const sucesso = vi.fn(async () => undefined)
    const falha = vi.fn(async () => undefined)
    const r = await executarAgenda({
      supabase: soDosSites(sb, siteIds), apiKey: 'chave-de-teste', runId: 'teste-' + randomUUID(), t0,
      deps: {
        catalogo, agora: () => t0,
        carregarLinhas: async cliente => (o.linhas === 'vazio' ? [] : (await loadBatchRows(cliente)).filter(l => siteIds.includes(l.site_id))),
        gravarSaude: { sucesso, falha: falha as never },
      },
    })
    if (!r.resposta) throw new Error('a agenda devolveu semAgenda: ' + r.semAgenda)
    const corpo = (await r.resposta.json()) as Record<string, unknown>
    const estado = Array.isArray(corpo.tarefas) ? (corpo.tarefas as Disparo['estado']) : []
    return { corpo, status: String(corpo.status), sucesso, falha, estado }
  }
  const estadoDe = (d: Disparo, sufixo: string): Disparo['estado'][number] | undefined => d.estado.find(t => t.tarefa.endsWith(sufixo))
  async function linhaDaAgenda(task: string, chave: string = chaveHora()): Promise<Linha> {
    const r = await q('select * from public.competitor_agenda_runs where task = $1 and period_key = $2', [task, chave])
    expect(r, `linha ${task}/${chave}`).toHaveLength(1)
    return r[0]!
  }
  async function semear(task: string, chave: string, status: string, o: { attempts?: number; iniciouHaMin?: number; doneN?: number | null } = {}): Promise<void> {
    await pg.query(`insert into public.competitor_agenda_runs (task, period_key, status, attempts, started_at, done_n)
      values ($1, $2, $3, $4, now() - ($5::numeric * interval '1 minute'), $6)`, [task, chave, status, o.attempts ?? 1, o.iniciouHaMin ?? 60, o.doneN ?? null])
  }
  const horarias = (siteId: string): Promise<number> => n('select count(*) as n from public.competitor_video_hourly where site_id = $1', [siteId])
  const curvas = (siteId: string): Promise<number> => n('select count(*) as n from public.competitor_video_early where site_id = $1', [siteId])
  const donoHorarias = (siteId: string): Promise<number> => n('select count(*) as n from public.yt_own_public_video_hourly where site_id = $1', [siteId])
  const provaDe = async (siteId: string): Promise<ProvaHoraria> => {
    const r = await lerProvaHoraria(sb, siteId, iso(BASE))
    if (!('valor' in r)) throw new Error('prova não lida: ' + r.porque)
    return r.valor
  }
  const opcVeredito = (o: { agendaDesdeH?: number; negados?: number | null } = {}): Parameters<typeof veredictoHorario>[1] => ({
    agoraMs: BASE, ligada: true, agendaDesde: iso(BASE - (o.agendaDesdeH ?? 30) * HORA), listaDoDisparo: null, semStatusNoDisparo: null,
    negadosDoDono: o.negados === undefined ? 0 : o.negados, negadosSemClasse: 0,
  })

  // ───────────────────────── o caminho feliz, em duas passadas ─────────────────────────

  it('primeiro disparo com a agenda vazia: 6 linhas horárias do site, a leitura e a sincronização ok, a série semanal adiada (item 214)', async () => {
    const site = await novoSite(); const p = prefixo()
    const { videos } = await cenarioDeSeis(site)
    mundo = mundoDe(videos)
    const d = await disparar(catalogoDe(p), [site])
    expect(d.status).toBe('ok')
    expect(await horarias(site)).toBe(6)
    expect(estadoDe(d, 'leitura_horaria')?.estado).toBe('ok')
    expect(estadoDe(d, 'sincronizar_canais')?.estado).toBe('ok')
    // são 15:20 em São Paulo: a série semanal é devida e cede a vez à sincronização (uma pesada por disparo)
    expect(estadoDe(d, 'serie_semanal')).toMatchObject({ estado: 'adiada', motivo: 'uma_pesada_por_disparo' })
    expect(mundo.chamadas).toBe(1)
    expect(estadoDe(d, 'leitura_horaria')?.detalhe).toMatchObject({ lista: 6, cruas: 6, chamadas: 1, curva: 2 })
    expect(await curvas(site)).toBe(2)
    // as três linhas da agenda existem, uma por tarefa e período
    expect(await n(`select count(*) as n from public.competitor_agenda_runs where task like $1`, [p + '%'])).toBe(3)
    expect(await linhaDaAgenda(`${p}-leitura_horaria`)).toMatchObject({ status: 'ok', attempts: 1, done_n: 6 })
    expect(await linhaDaAgenda(`${p}-serie_semanal`, chaveDoPeriodo('dia', BASE))).toMatchObject({ status: 'adiada', attempts: 0, reason: 'uma_pesada_por_disparo' })
  })

  it('segundo disparo na mesma hora não lê de novo: 6 linhas, 0 chamadas; e, com a linha ok apagada, a leitura já gravada não se repete (item 131; itens b)', async () => {
    const site = await novoSite(); const p = prefixo()
    const { videos } = await cenarioDeSeis(site)
    mundo = mundoDe(videos)
    const catalogo = catalogoDe(p)
    await disparar(catalogo, [site])
    expect(mundo.chamadas).toBe(1)
    const d2 = await disparar(catalogo, [site])
    expect(mundo.chamadas).toBe(1)
    expect(await horarias(site)).toBe(6)
    expect(estadoDe(d2, 'leitura_horaria')?.estado).toBe('nao_devida')
    expect(await linhaDaAgenda(`${p}-leitura_horaria`)).toMatchObject({ status: 'ok', attempts: 1, runs: 1 })
    // sem a trava da agenda (a linha ok some): a tarefa roda de novo, vê as 6 leituras da hora e não chama o YouTube nem duplica nada
    await pg.query(`delete from public.competitor_agenda_runs where task = $1`, [`${p}-leitura_horaria`])
    const d3 = await disparar(catalogo, [site])
    expect(estadoDe(d3, 'leitura_horaria')).toMatchObject({ estado: 'ok', detalhe: expect.objectContaining({ ja_lidos: 6, pedidos: 0, chamadas: 0 }) })
    expect(mundo.chamadas).toBe(1)
    expect(await horarias(site)).toBe(6)
    expect(await curvas(site)).toBe(2)
  })

  // ───────────────────────── concorrência, arrendamento e retomada ─────────────────────────

  it('dois disparos ao mesmo tempo com o arrendamento de verdade: um toma, o outro sai limpo ("locked"); cada tarefa roda uma vez (item a)', async () => {
    const p = prefixo()
    let rodou = 0
    let ttl = 0
    const t = tarefaSimples(`${p}-a`, async () => {
      rodou++
      ttl = Number((await q(`select extract(epoch from expires_at - now()) as s from public.competitor_agenda_lease where name = 'despachante'`))[0]!.s)
      await dormir(400)
      return { estado: 'ok', feitas: 1, deixadas: 0 }
    })
    const [x, y] = await Promise.all([disparar([t], [], { linhas: 'vazio' }), disparar([t], [], { linhas: 'vazio' })])
    expect([x.status, y.status].sort()).toEqual(['locked', 'ok'])
    expect(rodou).toBe(1)
    expect(ttl).toBeGreaterThan(280)
    expect(ttl).toBeLessThanOrEqual(290)
    expect(await n(`select count(*) as n from public.competitor_agenda_runs where task = $1`, [t.nome])).toBe(1)
    expect(await linhaDaAgenda(t.nome)).toMatchObject({ status: 'ok', attempts: 1, runs: 1 })
    // o arrendamento foi solto pelo dono dele
    expect(await n(`select count(*) as n from public.competitor_agenda_lease where name = 'despachante'`)).toBe(0)
  })

  it('dois disparos ao mesmo tempo com o arrendamento forçado a dar erro: uma linha por tarefa e período; cada `rodar` executado uma vez (item 153)', async () => {
    const p = prefixo()
    gancho.tomar = async () => ({ porque: 'forçado pelo teste', causa: 'excecao' })
    const contagem = { a: 0, b: 0 }
    const ta = tarefaSimples(`${p}-a`, async () => { contagem.a++; await dormir(300); return { estado: 'ok', feitas: 1, deixadas: 0 } }, { ordem: 1 })
    const tb = tarefaSimples(`${p}-b`, async () => { contagem.b++; await dormir(300); return { estado: 'ok', feitas: 1, deixadas: 0 } }, { ordem: 2 })
    const [x, y] = await Promise.all([disparar([ta, tb], [], { linhas: 'vazio' }), disparar([ta, tb], [], { linhas: 'vazio' })])
    expect(x.status).toBe('ok'); expect(y.status).toBe('ok')
    expect(contagem).toEqual({ a: 1, b: 1 })
    expect(await n(`select count(*) as n from public.competitor_agenda_runs where task like $1`, [p + '%'])).toBe(2)
    expect((await q(`select task, status, attempts, runs from public.competitor_agenda_runs where task like $1 order by task`, [p + '%']))
      .map(l => [l.status, Number(l.attempts), Number(l.runs)])).toEqual([['ok', 1, 1], ['ok', 1, 1]])
    // quem não pegou a tarefa ficou "ocupada" (nunca rodou nem fechou por cima)
    const ocupadas = [...x.estado, ...y.estado].filter(t => t.estado === 'ocupada')
    expect(ocupadas.length).toBeGreaterThanOrEqual(1)
    expect(vi.mocked(Sentry.captureMessage).mock.calls.some(c => String(c[0]).includes('arrendamento não tomado'))).toBe(true)
  })

  it('dois disparos sobre uma parcial e sobre uma rodando de 11 minutos: uma retomada de cada (item 153)', async () => {
    const p = prefixo()
    gancho.tomar = async () => ({ porque: 'forçado pelo teste', causa: 'excecao' })
    const contagem = { parcial: 0, rodando: 0 }
    const tp = tarefaSimples(`${p}-parcial`, async () => { contagem.parcial++; await dormir(300); return { estado: 'ok', feitas: 1, deixadas: 0 } }, { ordem: 1 })
    const tr = tarefaSimples(`${p}-rodando`, async () => { contagem.rodando++; await dormir(300); return { estado: 'ok', feitas: 1, deixadas: 0 } }, { ordem: 2 })
    await semear(tp.nome, chaveHora(), 'parcial', { attempts: 1, doneN: 3 })
    await semear(tr.nome, chaveHora(), 'rodando', { attempts: 1, iniciouHaMin: 11 })
    await Promise.all([disparar([tp, tr], [], { linhas: 'vazio' }), disparar([tp, tr], [], { linhas: 'vazio' })])
    expect(contagem).toEqual({ parcial: 1, rodando: 1 })
    // parcial com progresso não gasta tentativa; a rodando vencida gasta
    expect(await linhaDaAgenda(tp.nome)).toMatchObject({ status: 'ok', attempts: 1, runs: 2 })
    expect(await linhaDaAgenda(tr.nome)).toMatchObject({ status: 'ok', attempts: 2, runs: 2 })
  })

  it('linha rodando há 11 minutos é retomada: tomada, attempts = 2 (item 157)', async () => {
    const p = prefixo()
    let rodou = 0
    const t = tarefaSimples(`${p}-r`, async () => { rodou++; return { estado: 'ok', feitas: 1, deixadas: 0 } })
    await semear(t.nome, chaveHora(), 'rodando', { attempts: 1, iniciouHaMin: 11 })
    const d = await disparar([t], [], { linhas: 'vazio' })
    expect(rodou).toBe(1)
    expect(estadoDe(d, '-r')?.estado).toBe('ok')
    expect(await linhaDaAgenda(t.nome)).toMatchObject({ status: 'ok', attempts: 2, runs: 2 })
    // e a rodando de 5 minutos NÃO é retomada: alguém ainda a executa
    const t2 = tarefaSimples(`${p}-r5`, async () => { rodou++; return { estado: 'ok', feitas: 1, deixadas: 0 } })
    await semear(t2.nome, chaveHora(), 'rodando', { attempts: 1, iniciouHaMin: 5 })
    const d2 = await disparar([t2], [], { linhas: 'vazio' })
    expect(rodou).toBe(1)
    expect(estadoDe(d2, '-r5')?.estado).toBe('ocupada')
  })

  it('arrendamento preso: com expires_at no futuro o disparo sai "locked" sem rodar nada; vencido, o disparo toma e roda (item 213)', async () => {
    const p = prefixo()
    let rodou = 0
    const t = tarefaSimples(`${p}-l`, async () => { rodou++; return { estado: 'ok', feitas: 1, deixadas: 0 } })
    await pg.query(`insert into public.competitor_agenda_lease (name, holder, expires_at) values ('despachante', gen_random_uuid(), now() + interval '290 seconds')
      on conflict (name) do update set holder = excluded.holder, expires_at = excluded.expires_at`)
    const preso = await disparar([t], [], { linhas: 'vazio' })
    expect(preso.status).toBe('locked')
    expect(rodou).toBe(0)
    expect(await n(`select count(*) as n from public.competitor_agenda_runs where task = $1`, [t.nome])).toBe(0)
    expect(preso.sucesso).not.toHaveBeenCalled(); expect(preso.falha).not.toHaveBeenCalled()
    await pg.query(`update public.competitor_agenda_lease set expires_at = now() - interval '1 second' where name = 'despachante'`)
    const livre = await disparar([t], [], { linhas: 'vazio' })
    expect(livre.status).toBe('ok')
    expect(rodou).toBe(1)
    expect(await n(`select count(*) as n from public.competitor_agenda_lease where name = 'despachante'`)).toBe(0)
  })

  it('tarefa que falha 3 vezes vira esgotada, aparece como PROBLEMA nos disparos seguintes do período e some quando o período vira (item c)', async () => {
    const p = prefixo()
    let rodou = 0
    const t = tarefaSimples(`${p}-e`, async () => { rodou++; return { estado: 'erro', feitas: 0, deixadas: null, motivo: 'falha_de_teste' } })
    for (const tentativa of [1, 2, 3]) {
      const d = await disparar([t], [], { linhas: 'vazio' })
      expect(estadoDe(d, '-e')).toMatchObject({ estado: 'erro', motivo: 'falha_de_teste' })
      expect(await linhaDaAgenda(t.nome)).toMatchObject({ status: 'erro', attempts: tentativa })
      expect(d.falha).toHaveBeenCalledTimes(1)
    }
    expect(rodou).toBe(3)
    // o quarto disparo: o teto de tentativas foi batido; a linha vira esgotada e o problema aparece
    const d4 = await disparar([t], [], { linhas: 'vazio' })
    expect(rodou).toBe(3)
    expect(estadoDe(d4, '-e')?.estado).toBe('esgotada')
    expect(await linhaDaAgenda(t.nome)).toMatchObject({ status: 'esgotada' })
    expect(d4.falha).toHaveBeenCalledTimes(1)
    expect(String(d4.falha.mock.calls[0]![1])).toContain('esgotou as 3 tentativas do período')
    expect(d4.sucesso).not.toHaveBeenCalled()
    // o quinto: a linha já está esgotada; a tomada nem é tentada e o problema continua
    const d5 = await disparar([t], [], { linhas: 'vazio' })
    expect(rodou).toBe(3)
    expect(estadoDe(d5, '-e')?.estado).toBe('esgotada')
    expect(String(d5.falha.mock.calls[0]![1])).toContain('esgotou as 3 tentativas do período')
    // a hora seguinte: período novo, tarefa nova, sem problema da anterior
    let rodouDepois = 0
    const depois = { ...t, rodar: (async () => { rodouDepois++; return { estado: 'ok', feitas: 1, deixadas: 0 } }) as Rodar }
    const d6 = await disparar([depois], [], { linhas: 'vazio', t0: BASE + HORA })
    expect(rodouDepois).toBe(1)
    expect(estadoDe(d6, '-e')?.estado).toBe('ok')
    expect(d6.falha).not.toHaveBeenCalled()
    expect(d6.sucesso).toHaveBeenCalledTimes(1)
    expect(await linhaDaAgenda(t.nome, chaveHora(BASE))).toMatchObject({ status: 'esgotada' })
  })

  // ───────────────────────── o dono ─────────────────────────

  it('canal do dono: as leituras ficam em yt_own_public_video_hourly e nenhuma lista de concorrentes muda (item 216)', async () => {
    const site = await novoSite(); const p = prefixo()
    const cs = await canais(site, 1)
    await videosConc([{ canal: cs[0]!, pub: BASE - 6 * DIA }])
    const canal = await canalDono(site)
    const v = await videoDono(site, canal, { pub: BASE - 2 * DIA, criado: BASE - 2 * DIA, capturas: [{ status: 'public', haH: 6 }] })
    const antes = {
      canais: await n('select count(*) as n from public.competitor_channels where site_id = $1', [site]),
      videos: await n('select count(*) as n from public.competitor_videos x join public.competitor_channels c on c.id = x.competitor_channel_id where c.site_id = $1', [site]),
    }
    mundo = novoMundo([[v.yt, { views: 4321, privacidade: 'public' }]])
    const d = await disparar(soALeitura(p), [site])
    expect(estadoDe(d, 'leitura_horaria')).toMatchObject({ estado: 'ok', detalhe: expect.objectContaining({ proprios_lista: 1, proprios_cruas: 1 }) })
    expect(await donoHorarias(site)).toBe(1)
    expect(Number((await q('select views from public.yt_own_public_video_hourly where site_id = $1', [site]))[0]!.views)).toBe(4321)
    expect({
      canais: await n('select count(*) as n from public.competitor_channels where site_id = $1', [site]),
      videos: await n('select count(*) as n from public.competitor_videos x join public.competitor_channels c on c.id = x.competitor_channel_id where c.site_id = $1', [site]),
    }).toEqual(antes)
    // nada do dono foi parar na tabela do concorrente
    expect(await n('select count(*) as n from public.competitor_video_hourly h where h.site_id = $1 and h.video_id = $2', [site, v.id])).toBe(0)
  })

  it('próprio não listado não é lido: 0 linhas; proprios_fora_nao_publico = 1 na linha da agenda (item 217)', async () => {
    const site = await novoSite(); const p = prefixo()
    const canal = await canalDono(site)
    const v = await videoDono(site, canal, { pub: BASE - 2 * DIA, criado: BASE - 2 * DIA, capturas: [{ status: 'public', haH: 6 }] })
    mundo = novoMundo([[v.yt, { views: 900, privacidade: 'unlisted' }]])
    const d = await disparar(soALeitura(p), [site])
    expect(await donoHorarias(site)).toBe(0)
    expect(estadoDe(d, 'leitura_horaria')?.estado).toBe('ok')
    const linha = await linhaDaAgenda(`${p}-leitura_horaria`)
    expect((linha.detail as Record<string, number>).proprios_fora_nao_publico).toBe(1)
  })

  // ───────────────────────── a curva e a resposta vazia ─────────────────────────

  it('erro só na curva no primeiro disparo; o segundo a completa do bruto, sem chamar o YouTube (D-I3)', async () => {
    const site = await novoSite(); const p = prefixo()
    const { videos } = await cenarioDeSeis(site)
    mundo = mundoDe(videos)
    const sufixo = randomUUID().replace(/-/g, '').slice(0, 10)
    const funcao = `zz_t13_recusa_${sufixo}`; const gatilho = `zz_t13_g_${sufixo}`
    gatilhos.push({ funcao, gatilho })
    const catalogo = soALeitura(p)
    await pg.query(`set lock_timeout = '5s'`)
    await pg.query(`create function public.${funcao}() returns trigger language plpgsql as $$ begin
      if new.site_id = '${site}'::uuid then raise exception 'recusado pelo teste'; end if; return new; end $$`)
    await pg.query(`create trigger ${gatilho} before insert on public.competitor_video_early for each row execute function public.${funcao}()`)
    await pg.query('reset lock_timeout')
    let d1: Disparo
    try {
      d1 = await disparar(catalogo, [site])
      expect(estadoDe(d1, 'leitura_horaria')).toMatchObject({ estado: 'parcial', motivo: 'curva_falhou' })
      expect(await horarias(site)).toBe(6)
      expect(await curvas(site)).toBe(0)
    } finally {
      await pg.query(`drop trigger if exists ${gatilho} on public.competitor_video_early`)
      await pg.query(`drop function if exists public.${funcao}()`)
      gatilhos.splice(gatilhos.findIndex(g => g.gatilho === gatilho), 1)
    }
    const chamadas = mundo.chamadas
    const d2 = await disparar(catalogo, [site])
    expect(estadoDe(d2, 'leitura_horaria')).toMatchObject({ estado: 'ok', detalhe: expect.objectContaining({ curva_completada: 2, chamadas: 0 }) })
    expect(mundo.chamadas).toBe(chamadas)
    const c = await q(`select e.video_id, e.views as v_curva, h.views as v_crua from public.competitor_video_early e
      join public.competitor_video_hourly h on h.video_id = e.video_id where e.site_id = $1`, [site])
    expect(c).toHaveLength(2)
    for (const l of c) expect(Number(l.v_curva)).toBe(Number(l.v_crua))
    // parcial com progresso não gastou tentativa
    expect(await linhaDaAgenda(`${p}-leitura_horaria`)).toMatchObject({ status: 'ok', attempts: 1 })
  })

  it('resposta vazia para os 6 vídeos: a hora fica em erro (resposta_vazia) e o disparo seguinte lê: ok, 6 linhas, attempts = 2 (D-I2)', async () => {
    const site = await novoSite(); const p = prefixo()
    const { videos } = await cenarioDeSeis(site)
    mundo = mundoDe(videos)
    mundo.corpoFixo = { items: [] }
    const catalogo = soALeitura(p)
    const d1 = await disparar(catalogo, [site])
    expect(estadoDe(d1, 'leitura_horaria')).toMatchObject({ estado: 'erro', motivo: 'resposta_vazia' })
    expect(await linhaDaAgenda(`${p}-leitura_horaria`)).toMatchObject({ status: 'erro', reason: 'resposta_vazia', attempts: 1 })
    expect(await horarias(site)).toBe(0)
    expect(d1.falha).toHaveBeenCalledTimes(1)
    delete mundo.corpoFixo
    const d2 = await disparar(catalogo, [site])
    expect(estadoDe(d2, 'leitura_horaria')?.estado).toBe('ok')
    expect(await horarias(site)).toBe(6)
    expect(await linhaDaAgenda(`${p}-leitura_horaria`)).toMatchObject({ status: 'ok', attempts: 2 })
  })

  // ───────────────────────── o texto de fora nunca é gravado ─────────────────────────

  it('tarefa que lança um erro do banco: o texto não é gravado nem sai (reason = excecao) (S-I4, R3)', async () => {
    const site = await novoSite(); const p = prefixo()
    const SENT = 'UCsentinela' + randomUUID().replace(/-/g, '').slice(0, 8)
    await pg.query(`insert into public.competitor_channels (site_id, channel_id, channel_name) values ($1, $2, 'Teste')`, [site, SENT])
    let visto = ''
    const t = tarefaSimples(`${p}-s`, async () => {
      const { error } = await sb.from('competitor_channels').insert({ site_id: site, channel_id: SENT })
      if (error) { visto = `${error.message} | ${error.details ?? ''}`; throw new Error(visto) }
      return { estado: 'ok', feitas: 1, deixadas: 0 }
    })
    const d = await disparar([t], [site], { linhas: 'vazio' })
    // o banco de verdade recusou: o texto do erro leva o valor (a premissa do caso)
    expect(visto.toLowerCase()).toContain('sentinela')
    expect(estadoDe(d, '-s')).toMatchObject({ estado: 'erro', motivo: 'excecao' })
    expect(await linhaDaAgenda(t.nome)).toMatchObject({ status: 'erro', reason: 'excecao' })
    expect(await n(`select count(*) as n from public.competitor_agenda_runs where task like $1 and (reason like '%sentinela%' or detail::text like '%sentinela%')`, [p + '%'])).toBe(0)
    expect(d.falha).toHaveBeenCalled()
    expect(JSON.stringify(d.falha.mock.calls).toLowerCase()).not.toContain('sentinela')
    expect(JSON.stringify(d.corpo).toLowerCase()).not.toContain('sentinela')
    expect(JSON.stringify([...vi.mocked(Sentry.captureMessage).mock.calls, ...vi.mocked(Sentry.captureException).mock.calls]).toLowerCase()).not.toContain('sentinela')
  })

  // ───────────────────────── a prova do dono: negados, apagados, rascunhos ─────────────────────────

  /**
   * O cenário comum dos três casos do dono: o dono tem 1 vídeo público pela captura (de 30 h e de 6 h atrás) com leituras só até 5 h atrás
   * (quatro leituras); o site tem outro vídeo de concorrente VELHO (fora da lista de 14 dias) com 23 horas de leitura, que faz a tarefa ter
   * "lido 23 horas" sem entrar na lista do disparo.
   */
  async function cenarioDoDono(): Promise<{ site: string; p: string; dono: Dono }> {
    const site = await novoSite(); const p = prefixo()
    const canal = await canalDono(site)
    const dono = await videoDono(site, canal, { capturas: [{ status: 'public', haH: 30 }, { status: 'public', haH: 6 }] })
    await lerDono(site, dono, horas(5, 8))
    const cs = await canais(site, 1)
    const [velho] = await videosConc([{ canal: cs[0]!, pub: BASE - 20 * DIA }])
    await lerConc(velho!, site, horas(1, 23))
    return { site, p, dono }
  }

  it('vídeo do dono tirado do ar: a prova ainda o cobra e o veredito não sobe; sem a linha da agenda dá os dois problemas (D2-F1, D3-T1)', async () => {
    const { site, p, dono } = await cenarioDoDono()
    mundo = novoMundo([[dono.yt, { views: 500, privacidade: 'unlisted' }]])
    await disparar(soALeitura(p), [site])
    const nome = `${p}-leitura_horaria`
    const detalhe = (await linhaDaAgenda(nome)).detail as Record<string, number>
    expect(detalhe).toMatchObject({ proprios_fora_nao_publico: 1, proprios_negados_cobraveis: 1 })
    expect(await donoHorarias(site)).toBe(4) // só as quatro semeadas: nada novo
    const prova = await provaDe(site)
    expect(prova.proprios_cobrados).toBe(1)
    expect(prova.proprios_abaixo_do_lido).toBe(1)
    const negados = await lerNegadosDoDono(sb, iso(BASE), nome)
    expect(negados).toEqual({ valor: { negados: 1, semClasse: 0 } })
    const com = veredictoHorario(prova, opcVeredito({ negados: 1 }))
    expect(com.problems.filter(x => x.includes('seu canal'))).toEqual([])
    expect(com.notes.some(x => x.includes('saiu do ar ou deixou de ser público'))).toBe(true)
    // o outro sentido: sem a linha da agenda (negados 0) os dois problemas do dono voltam
    const sem = veredictoHorario(prova, opcVeredito({ negados: 0 }))
    expect(sem.problems.filter(x => x.includes('seu canal')).map(x => x.replace(/\d+/g, 'N'))).toEqual([
      'leitura horária do seu canal parada há N h', 'N vídeo do seu canal com leituras faltando nas últimas N horas',
    ])
    // outra tarefa (o nome padrão de produção) não tem essa linha: nada é descontado
    expect(await lerNegadosDoDono(sb, iso(BASE), `${p}-outra`)).toEqual({ valor: { negados: 0, semClasse: 0 } })
  })

  it('vídeo do dono apagado: não devolvido pela resposta conta em proprios_nao_devolvidos e o veredito é o mesmo (D2-F1, D3-T1)', async () => {
    const { site, p } = await cenarioDoDono()
    mundo = novoMundo([]) // o YouTube não devolve o id do dono
    await disparar(soALeitura(p), [site])
    const nome = `${p}-leitura_horaria`
    const detalhe = (await linhaDaAgenda(nome)).detail as Record<string, number>
    expect(detalhe.proprios_nao_devolvidos).toBe(1)
    expect(detalhe.proprios_fora_nao_publico ?? 0).toBe(0)
    expect(detalhe.proprios_negados_cobraveis).toBe(1)
    const prova = await provaDe(site)
    expect(prova.proprios_cobrados).toBe(1)
    expect(await lerNegadosDoDono(sb, iso(BASE), nome)).toEqual({ valor: { negados: 1, semClasse: 0 } })
    const v = veredictoHorario(prova, opcVeredito({ negados: 1 }))
    expect(v.problems.filter(x => x.includes('seu canal'))).toEqual([])
  })

  it('rascunho do dono: a tarefa o nega toda hora e a prova continua acusando o público sem leitura (D3-T1)', async () => {
    const { site, p, dono } = await cenarioDoDono()
    const rascunho = await videoDono(site, (await q('select channel_id as c from public.youtube_videos where id = $1', [dono.id]))[0]!.c as string,
      { capturas: [{ status: 'private', haH: 30 }, { status: 'private', haH: 6 }] })
    // o público vem na resposta, mas sem o estado de privacidade (nada gravado, nada negado); o rascunho não vem
    mundo = novoMundo([[dono.yt, { views: 500, privacidade: 'semStatus' }]])
    expect(mundo.videos.has(rascunho.yt)).toBe(false)
    await disparar(soALeitura(p), [site])
    const detalhe = (await linhaDaAgenda(`${p}-leitura_horaria`)).detail as Record<string, number>
    expect(detalhe).toMatchObject({ proprios_nao_devolvidos: 1, proprios_negados_cobraveis: 0, proprios_fora_sem_status: 1 })
    const negados = await lerNegadosDoDono(sb, iso(BASE), `${p}-leitura_horaria`)
    expect(negados).toEqual({ valor: { negados: 0, semClasse: 0 } })
    const prova = await provaDe(site)
    expect(prova.proprios_cobrados).toBe(1) // o rascunho (private) nunca é cobrado
    const v = veredictoHorario(prova, opcVeredito({ negados: 0 }))
    expect(v.problems.filter(x => x.includes('seu canal'))).toHaveLength(2)
  })

  // ───────────────────────── a prova lida de verdade ─────────────────────────

  it('a prova lida de verdade, por site: 6 na lista e verde depois de uma leitura boa; site vazio, tudo zero (R5, item d)', async () => {
    const site = await novoSite(); const p = prefixo()
    const { videos } = await cenarioDeSeis(site)
    mundo = mundoDe(videos)
    const d = await disparar(catalogoDe(p), [site])
    const prova = await provaDe(site)
    expect(prova.videos_na_lista).toBe(6)
    expect(prova.desde).not.toBeNull()
    expect(prova.horas_lidas_24h).toBe(1)
    const v = veredictoHorario(prova, opcVeredito({ agendaDesdeH: 1 }))
    expect(v.problems).toEqual([])
    expect(v.ok).toBe(true)
    // o fecho do próprio disparo leu a mesma prova e não achou problema nela
    expect((d.corpo!.prova_horaria as { ok: boolean }).ok).toBe(true)
    // site sem nada: zeros e datas nulas (a função não devolve nulo)
    const vazio = await novoSite()
    const zero = await provaDe(vazio)
    expect(zero).toEqual({
      desde: null, ultima_leitura: null, horas_lidas_24h: 0, videos_na_lista: 0, videos_fora_do_teto: 0, videos_cobrados: 0, videos_abaixo_de_22h: 0,
      videos_abaixo_do_lido: 0, proprios_desde: null, proprios_ultima_leitura: null, proprios_na_lista: 0, proprios_fora_do_teto: 0, proprios_sem_captura: 0,
      proprios_cobrados: 0, proprios_abaixo_de_22h: 0, proprios_abaixo_do_lido: 0, proprios_em_competitor: 0,
    })
    // a prova de um site não enxerga o outro
    expect((await provaDe(vazio)).videos_na_lista).toBe(0)
  })

  it('a leitura que falha: erro api_falhou, nada gravado, e a prova diz o que o plano manda (nota no começo, vermelho com a agenda velha) (item d)', async () => {
    const site = await novoSite(); const p = prefixo()
    const { videos } = await cenarioDeSeis(site)
    mundo = mundoDe(videos)
    mundo.http = 500
    const d = await disparar(soALeitura(p), [site])
    expect(estadoDe(d, 'leitura_horaria')).toMatchObject({ estado: 'erro', motivo: 'api_falhou' })
    expect(await horarias(site)).toBe(0)
    expect(d.falha).toHaveBeenCalledTimes(1)
    expect(String(d.falha.mock.calls[0]![1])).toContain('leitura horária')
    const prova = await provaDe(site)
    expect(prova.videos_na_lista).toBe(6)
    expect(prova.desde).toBeNull()
    // agenda de 30 minutos: começo, é nota
    const novo = veredictoHorario(prova, opcVeredito({ agendaDesdeH: 0.5 }))
    expect(novo.ok).toBe(true)
    expect(novo.notes.some(x => x.includes('ainda sem leitura'))).toBe(true)
    // agenda de 5 horas e nenhuma leitura: vermelho, com o aviso por e-mail
    const velho = veredictoHorario(prova, opcVeredito({ agendaDesdeH: 5 }))
    expect(velho.ok).toBe(false)
    expect(velho.problems).toContain('nenhuma leitura horária gravada')
    expect(velho.avisos).toHaveLength(1)
  })

  it('a prova da captura continua acusando cota não registrada com a leitura horária gravando (S-I2)', async () => {
    const site = await novoSite(); const p = prefixo()
    const cs = await canais(site, 1, { visto: BASE - HORA })
    await videosConc([{ canal: cs[0]!, pub: BASE - 3 * DIA }])
    const v = (await q('select video_id from public.competitor_videos where competitor_channel_id = $1', [cs[0]!.id]))[0]!.video_id as string
    mundo = novoMundo([[v, { views: 700 }]])
    await disparar(soALeitura(p), [site])
    expect(await horarias(site)).toBe(1)
    // a linha do dia tem a parcela 'horario' e nenhuma de 'competitors'
    const cota = await q('select operations from public.youtube_quota_usage where site_id = $1', [site])
    expect(cota).toHaveLength(1)
    expect(cota[0]!.operations).toHaveProperty('horario')
    expect(cota[0]!.operations).not.toHaveProperty('competitors')
    const saude = await readSiteHealth(sb, site, iso(BASE), { slotDone: true, e2: true })
    expect(saude.problems.some(x => x.startsWith('cota do dia não registrada'))).toBe(true)
  })

  // ───────────────────────── o aviso por e-mail ─────────────────────────

  it('o aviso por e-mail é criado uma vez no dia: avisos_enviados = N e depois 0, uma notificação por dono com a dedup_key do dia (R10)', async () => {
    const site = await novoSite(); const p = prefixo()
    await canais(site, 1)
    // quem é dono deste site (org_admin da organização raiz)? Sem ninguém, o teste cadastra um (e o remove no fim)
    const orgId = String((await q('select org_id from public.sites where id = $1', [site]))[0]!.org_id)
    let donos = Number((await q(`select count(*) as n from public.organization_members where org_id = $1 and role = 'org_admin'`, [orgId]))[0]!.n)
    if (donos === 0) { usuarios.push((await seedStaffUser(sb, orgId, 'admin')).userId); donos = 1 }
    const t = catalogoDe(p).filter(x => x.nome.endsWith('leitura_horaria'))
    await semear(t[0]!.nome, chaveHora(), 'esgotada', { attempts: 3 })
    const d1 = await disparar(t, [site])
    expect(estadoDe(d1, 'leitura_horaria')?.estado).toBe('esgotada')
    expect(d1.corpo!.avisos_enviados).toMatchObject({ enviados: donos })
    const chave = `obs-agenda-tarefa_esgotada-${DEFINICOES[0]!.rotulo}-${site}-${chaveDoPeriodo('dia', BASE)}`
    const linhas = await q(`select dedup_key from public.notifications where site_id = $1`, [site])
    expect(linhas).toHaveLength(donos)
    expect(new Set(linhas.map(l => l.dedup_key))).toEqual(new Set([chave]))
    const d2 = await disparar(t, [site])
    expect(d2.corpo!.avisos_enviados).toMatchObject({ enviados: 0 })
    expect(await n(`select count(*) as n from public.notifications where site_id = $1`, [site])).toBe(donos)
    expect(d2.falha).toHaveBeenCalledTimes(1)
  })

  // ───────────────────────── o volume ─────────────────────────

  it('75 canais simulados: a leitura horária faz 6 chamadas para 285 vídeos; a duração e as idas ao banco vão para um arquivo (item 158)', async () => {
    const site = await novoSite(); const p = prefixo()
    const cs = await canais(site, 75)
    const entradas: EntradaVideo[] = Array.from({ length: 285 }, (_, i) => ({ canal: cs[i % 75]!, pub: BASE - (1 + (i % 13)) * DIA - (i % 7) * HORA }))
    const videos = await videosConc(entradas)
    mundo = mundoDe(videos)
    const catalogo = soALeitura(p)
    const idas0 = dbCalls.n
    const t = Date.now()
    const d = await disparar(catalogo, [site])
    const ms = Date.now() - t
    const idas = dbCalls.n - idas0
    expect(mundo.chamadas).toBe(6)
    expect(mundo.blocos.map(b => b.length).sort((a, b) => b - a)).toEqual([50, 50, 50, 50, 50, 35])
    expect(estadoDe(d, 'leitura_horaria')).toMatchObject({ estado: 'ok', detalhe: expect.objectContaining({ lista: 285, cruas: 285, chamadas: 6 }) })
    expect(await horarias(site)).toBe(285)
    const arquivo = join(diretorio, 'horaria-75-canais.json')
    writeFileSync(arquivo, JSON.stringify({ canais: 75, videos: 285, chamadas_youtube: mundo.chamadas, duracao_ms: ms, idas_ao_banco: idas }, null, 2))
    process.stderr.write(`[agenda-despacho] 75 canais: ${ms} ms, ${idas} idas ao banco, 6 chamadas -> ${arquivo}\n`)
    expect(ms).toBeLessThan(60_000)
  })

  // ───────────────────────── o vigia ─────────────────────────

  it('o vigia depois de apagar os ok: unknown sem linha nenhuma; late com o desde antigo (itens 156, 211)', async () => {
    const site = await novoSite(); const p = prefixo()
    const { videos } = await cenarioDeSeis(site)
    mundo = mundoDe(videos)
    const catalogo = catalogoDe(p)
    await disparar(catalogo, [site])
    const env: NodeJS.ProcessEnv = { NODE_ENV: 'test' }
    const ok = await lerAgendaDoVigia(sb, BASE, env, catalogo)
    expect(ok.itens.find(i => i.nome.endsWith('leitura_horaria'))).toMatchObject({ status: 'ok' })
    expect(ok.itens.find(i => i.nome.endsWith('sincronizar_canais'))).toMatchObject({ status: 'ok' })
    // apaga as linhas: estado real sem linha nenhuma
    await pg.query(`delete from public.competitor_agenda_runs where task like $1`, [p + '%'])
    const pares = catalogo.map(t => ({ task: t.nome, period_key: chaveDoPeriodo(t.periodo, BASE) }))
    const lido = await lerEstado(sb, pares)
    expect('valor' in lido && lido.valor.desde).toBeNull()
    const sem = await lerAgendaDoVigia(sb, BASE, env, catalogo)
    expect(sem.itens.map(i => i.status)).toEqual(['unknown', 'unknown', 'unknown'])
    expect(sem.itens.every(i => i.motivo === 'sem leitura')).toBe(true)
    // uma linha antiga (a agenda existe há mais que a tolerância) e nenhum ok: late
    const agora = Date.now()
    await pg.query(`insert into public.competitor_agenda_runs (task, period_key, status, attempts, started_at)
      values ($1, $2, 'erro', 1, now() - interval '100 hours')`, [`${p}-leitura_horaria`, chaveDoPeriodo('hora', agora)])
    const velho = await lerAgendaDoVigia(sb, agora, env, catalogo)
    expect(velho.itens.map(i => i.status)).toEqual(['late', 'late', 'late'])
    expect(velho.itens.every(i => i.ultimoOk === null && i.motivo === 'sem leitura')).toBe(true)
    // e com a agenda desligada pelo ambiente, nada é cobrado
    expect((await lerAgendaDoVigia(sb, agora, { NODE_ENV: 'test', OBS_AGENDA: 'off' }, catalogo)).itens.every(i => i.status === 'desligada')).toBe(true)
  })

  // ───────────────────────── o que o banco falso escondia ─────────────────────────

  it('o filtro `.or` de lerCandidatos: vídeo de published_at nulo entra pela descoberta dentro da janela e sai quando é antiga (item f)', async () => {
    const site = await novoSite(); const p = prefixo()
    const cs = await canais(site, 1)
    const [recente, nuloDentro, nuloFora, velho] = await videosConc([
      { canal: cs[0]!, pub: BASE - 2 * DIA },
      { canal: cs[0]!, pub: null, descoberto: BASE - 2 * DIA },
      { canal: cs[0]!, pub: null, descoberto: BASE - 20 * DIA },
      { canal: cs[0]!, pub: BASE - 20 * DIA },
    ]) as [Video, Video, Video, Video]
    const { conc } = await lerCandidatos(soDosSites(sb, [site]), BASE)
    const ids = conc.map(c => c.id)
    expect(ids).toContain(recente.id)
    expect(ids).toContain(nuloDentro.id)
    expect(ids).not.toContain(nuloFora.id)
    expect(ids).not.toContain(velho.id)
    // e o disparo conta o sem data em `fora_sem_data`, sem pedi-lo ao YouTube
    mundo = novoMundo([[recente.yt, { views: 10 }]])
    const d = await disparar(soALeitura(p), [site])
    expect(estadoDe(d, 'leitura_horaria')?.detalhe).toMatchObject({ lista: 1, fora_sem_data: 1, pedidos: 1 })
    expect(mundo.blocos).toEqual([[recente.yt]])
  })

  it('OBS_AGENDA=off: a rota não chama executarAgenda e o lote antigo roda (item e)', async () => {
    vi.stubEnv('OBS_AGENDA', 'off')
    vi.stubEnv('CRON_SECRET', 'segredo-de-teste')
    vi.stubEnv('YOUTUBE_API_KEY', 'chave-de-teste')
    vi.mocked(executarAgenda).mockClear()
    vi.mocked(runCompetitorBatch).mockReset()
    vi.mocked(runCompetitorBatch).mockRejectedValueOnce(new Error('lote antigo rodou'))
    vi.mocked(recordCronFailure).mockClear()
    try {
      const req = new NextRequest('http://localhost/api/cron/sync-youtube?mode=competitors', { headers: { authorization: 'Bearer segredo-de-teste' } })
      const res = await rotaSyncYoutube(req)
      const corpo = (await res.json()) as Record<string, unknown>
      expect(executarAgenda).not.toHaveBeenCalled()
      expect(runCompetitorBatch).toHaveBeenCalledTimes(1)
      expect(corpo).toMatchObject({ status: 'error', mode: 'competitors', error: 'lote antigo rodou' })
      expect(corpo.agenda_desligada).toEqual(DEFINICOES.map(d => d.rotulo))
      expect(recordCronFailure).toHaveBeenCalledTimes(1)
    } finally {
      vi.unstubAllEnvs()
    }
    // a agenda não deixou rastro: nenhuma linha de tarefa de catálogo de produção foi tocada por este caso
    expect(await n(`select count(*) as n from public.competitor_agenda_lease where name = 'despachante'`)).toBe(0)
  })
})
