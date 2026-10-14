// @vitest-environment node
/**
 * A5 · E8 (Tarefa 9b): o passo `retencao` (`coleta/retencao-step.ts`) e o critério da retenção (`coleta/criteria-retencao.ts`) rodando
 * juntos contra Postgres de verdade, com `lerFatos`/`decidirRetencao` lendo `yt_own_retention_facts` do banco (MG5) e a API do YouTube
 * FALSA (nenhuma chamada real: o `fetch` global é trocado por um roteador que só atende a Analytics API, de mentira, e o Supabase
 * local). Banco: SÓ o `bythiago_int`. Rodar com:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/a5-e8-passos.test.ts --no-file-parallelism
 *
 * O banco é dividido com outras etapas: cada teste cria o SEU site, o SEU canal e os SEUS vídeos e só olha para eles; o arquivo
 * semeia e limpa. Função sem EXECUTE nunca é CHAMADA aqui como anon/authenticated (derruba este Postgres): só `service_role`.
 * Datas: tudo relativo a hoje (UTC para o banco, Pacífico para a fonte) ou passado; o único relógio adiantado é o do teste das janelas
 * de 7 e 30 dias (Date falso, só no JavaScript), porque elas só existem depois de `RETENCAO_JANELAS_DESDE`.
 * O dia da tentativa (`attempt_day`) é posto pelo BANCO (UTC, relógio real): o histórico de teste é semeado por esse dia.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { Client } from 'pg'
import type { SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite, SUPABASE_URL } from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/youtube/coleta/alerts', () => ({ avisarEntrada: vi.fn(), avisarSaida: vi.fn() }))
vi.mock('@/lib/social/token-refresh', async (orig) => ({
  ...(await orig<typeof import('@/lib/social/token-refresh')>()),
  ensureFreshToken: vi.fn(),
}))

import { ensureFreshToken } from '@/lib/social/token-refresh'
import { passoRetencao, type DepsRetencao, type RetencaoResumo } from '@/lib/youtube/coleta/retencao-step'
import { ALARME_RETENCAO, criteriosRetencao } from '@/lib/youtube/coleta/criteria-retencao'
import { lerFatos, RETENCAO_JANELAS_DESDE } from '@/lib/youtube/coleta/retencao-regra'
import { registrarTentativa } from '@/lib/youtube/coleta/attempts'
import { criarRelogio } from '@/lib/youtube/coleta/clock'
import { addDays, dayPt, utcDay } from '@/lib/youtube/coleta/day-pt'
import { metricVersion } from '@/lib/youtube/coleta/metric-version'
import type { ColetaChannel, StepCtx } from '@/lib/youtube/coleta/types'
import type { AttemptKind } from '@/lib/youtube/coleta/kinds'

vi.setConfig({ testTimeout: 90_000 })

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const FIXTURES = fileURLToPath(new URL('../youtube/coleta/fixtures/retencao/', import.meta.url))
const DIA_MS = 86_400_000

/** Dia UTC (o do banco: `attempt_day`) e dia do Pacífico (o da fonte e da janela) de hoje, fixados na carga do arquivo. */
const HOJE = utcDay(new Date())
const HOJE_PT = dayPt(new Date())
const d = (n: number): string => addDays(HOJE, n)
const p = (n: number): string => addDays(HOJE_PT, n)
const TOKEN = 'token-fixo-do-ensaio'

type Linha = Record<string, unknown>
interface Cen { site: string; canal: string; uc: string; nome: string }
interface Vid { id: string; yt: string }

// ───────────────────────── a API do YouTube, de mentira ─────────────────────────
const fetchReal = globalThis.fetch
const YT = 'https://youtubeanalytics.googleapis.com/'
const json = (corpo: unknown, status = 200): Response => new Response(JSON.stringify(corpo), { status })
const erroGoogle = (status: number, reason: string): Response =>
  json({ error: { code: status, message: 'texto do Google que não pode vazar', errors: [{ reason }] } }, status)
const CABECALHO3 = ['elapsedVideoTimeRatio', 'audienceWatchRatio', 'relativeRetentionPerformance', 'totalSegmentImpressions'].map(name => ({ name }))
/** Uma curva de `n` pontos com as três métricas. */
const curva = (n = 100) => ({
  columnHeaders: CABECALHO3,
  rows: Array.from({ length: n }, (_, k) => [(k + 1) / n, 1 - k / (2 * n), 0.5, 100 + k]),
})
const fixture = (nome: string): unknown => (JSON.parse(readFileSync(FIXTURES + nome, 'utf8')) as { resposta: unknown }).resposta
/** A resposta real da C0.1 para "vida" sem a quarta métrica: 100 pontos, 2 métricas. */
const VIDA_REAL = fixture('c01-vida-so2.json')
/** A resposta real da C0.1 de um vídeo sem curva: cabeçalho completo e `rows: []`. */
const VAZIA_REAL = fixture('c01-28d.json')

type Resp = Response | Error | (() => Response | Error)
let chamadasYt: Array<{ video: string; auth: string | null; inicio: string | null; fim: string | null }> = []
/** Troca o `fetch` global: Analytics API = falsa (guarda cada chamada); Supabase local = o de verdade; qualquer outro destino lança. */
function instalarYt(porVideo: Record<string, Resp> = {}, padrao: Resp = () => json(curva())): void {
  chamadasYt = []
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (url.startsWith(YT)) {
      const u = new URL(url)
      const video = /video==([^;]+)/.exec(u.searchParams.get('filters') ?? '')?.[1] ?? ''
      const h = init?.headers as Record<string, string> | undefined
      chamadasYt.push({ video, auth: h?.Authorization ?? null, inicio: u.searchParams.get('startDate'), fim: u.searchParams.get('endDate') })
      const r = porVideo[video] ?? padrao
      const v = typeof r === 'function' ? r() : r
      if (v instanceof Error) throw v
      return v
    }
    if (url.startsWith(SUPABASE_URL)) return fetchReal(input, init)
    throw new Error(`chamada de rede inesperada no ensaio: ${new URL(url).host}`)
  })
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.mocked(ensureFreshToken).mockClear()
})

describe.skipIf(skipIfNoLocalDb())('A5 E8 (9b): o passo e o alarme da retenção contra o banco (bythiago_int), API do YouTube falsa', () => {
  let pg: Client
  let sb: SupabaseClient
  const sites: string[] = []

  beforeAll(async () => {
    sb = getSupabaseServiceClient()
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
  })
  afterAll(async () => {
    try {
      if (sites.length > 0) {
        // FK "restrict" do canal: as tabelas presas a ele primeiro, depois vídeos e canais; o site leva o resto por cascata
        for (const t of ['yt_own_video_retention', 'yt_own_video_coverage', 'yt_own_video_daily', 'yt_own_collection_attempts', 'youtube_videos', 'youtube_channels']) {
          await pg.query(`delete from public.${t} where site_id = any($1::uuid[])`, [sites])
        }
        await pg.query('delete from public.site_memberships where site_id = any($1::uuid[])', [sites])
        await pg.query('delete from public.audit_log where site_id = any($1::uuid[])', [sites])
        await pg.query('delete from public.sites where id = any($1::uuid[])', [sites])
      }
    } finally {
      await pg.end()
    }
  })

  // ───────────────────────── semeadura e leitura ─────────────────────────
  const q = async (sql: string, params: unknown[] = []): Promise<Linha[]> => (await pg.query(sql, params)).rows as Linha[]
  const novoYt = (): string => 'y' + randomUUID().replace(/-/g, '').slice(0, 10)
  /** Ids de 11 caracteres com ordem controlada (a cauda) e cabeça aleatória DO TESTE: a chave da curva não leva o site, então ids fixos colidiriam. */
  const grupoDeIds = (): ((cauda: string) => string) => {
    const cabeca = 'k' + randomUUID().replace(/-/g, '').slice(0, 4)
    return (cauda: string) => cabeca + cauda.padStart(6, 'a')
  }
  const ok = async (r: PromiseLike<{ error: { message?: string } | null }>): Promise<void> => { expect((await r).error).toBeNull() }

  async function cenario(): Promise<Cen> {
    const site = (await seedSite(sb)).siteId
    sites.push(site)
    const n = randomUUID().replace(/-/g, '')
    const uc = 'UC' + n.slice(0, 22)
    const nome = 'Canal ' + n.slice(0, 6)
    const r = await q(`insert into public.youtube_channels (site_id, channel_id, locale, handle, name, uploads_playlist_id, slug)
      values ($1, $2, 'pt', $3, $4, $5, $6) returning id`, [site, uc, '@t' + n.slice(0, 8), nome, 'UU' + n.slice(2, 24), 'teste-' + n.slice(0, 8)])
    return { site, canal: String(r[0]!.id), uc, nome }
  }
  const canalDe = (c: Cen): ColetaChannel =>
    ({ id: c.canal, channel_id: c.uc, site_id: c.site, name: c.nome, sync_enabled: true, collection_status: 'ok', video_count: null })

  const janelasDe = (c: Cen, v: Vid, pub: string): Linha[] => [
    linhaRetencao(c, v, { window_kind: 'primeiros_7_dias', window_end: addDays(pub, 6), window_start: pub, requested_end: addDays(pub, 6) }),
    linhaRetencao(c, v, { window_kind: 'primeiros_30_dias', window_end: addDays(pub, 29), window_start: pub, requested_end: addDays(pub, 29) }),
  ]
  /** Um vídeo do canal. Padrão: publicado há 60 dias (PT), com as janelas de 7 e 30 dias já guardadas (só a "vida" é do teste). */
  async function video(c: Cen, o: { pub?: string; yt?: string; janelas?: boolean; duracao?: number } = {}): Promise<Vid> {
    const pub = o.pub ?? p(-60)
    const yt = o.yt ?? novoYt()
    const r = await q(`insert into public.youtube_videos (site_id, channel_id, youtube_video_id, title, published_at, duration_seconds)
      values ($1, $2, $3, 'Teste', $4, $5) returning id`, [c.site, c.canal, yt, `${pub}T12:00:00Z`, o.duracao ?? 600])
    const v = { id: String(r[0]!.id), yt }
    if (o.janelas !== false) await ok(sb.from('yt_own_video_retention').insert(janelasDe(c, v, pub)))
    return v
  }
  /** Fonte do diário: um dia com views (`viewsEm`, `views`) e o `fonte` (último dia gravado). */
  async function diario(c: Cen, v: Vid, o: { fonte: string; viewsEm?: string; views?: number }): Promise<void> {
    const linhas: Linha[] = []
    const viewsEm = o.viewsEm ?? o.fonte
    linhas.push({ day: viewsEm, views: o.views ?? 5 })
    if (viewsEm !== o.fonte) linhas.push({ day: o.fonte, views: 0 })
    await ok(sb.from('yt_own_video_daily').insert(linhas.map(l => ({
      youtube_video_id: v.yt, day_pt: l.day, site_id: c.site, video_id: v.id, channel_id: c.canal, views: l.views, metric_version: metricVersion(String(l.day)),
    }))))
  }
  /** Vídeo com view recente (ontem) e diário em dia: nunca tentado, é lido hoje (prioridade 0). */
  async function vivo(c: Cen, o: { yt?: string; views?: number; pub?: string } = {}): Promise<Vid> {
    const v = await video(c, { yt: o.yt, pub: o.pub })
    await diario(c, v, { fonte: p(-1), views: o.views ?? 5 })
    return v
  }
  /** N vídeos "em dia": linha da vida de hoje, tentativa de hoje `ok`, janelas guardadas, diário em dia. Nenhum é lido. */
  async function saudaveis(c: Cen, n: number): Promise<Vid[]> {
    const pub = p(-60)
    const ins = await sb.from('youtube_videos').insert(Array.from({ length: n }, () => ({
      site_id: c.site, channel_id: c.canal, youtube_video_id: novoYt(), title: 'Teste', published_at: `${pub}T12:00:00Z`, duration_seconds: 600,
    }))).select('id, youtube_video_id')
    expect(ins.error).toBeNull()
    const vids = (ins.data as Array<{ id: string; youtube_video_id: string }>).map(r => ({ id: r.id, yt: r.youtube_video_id }))
    await ok(sb.from('yt_own_video_daily').insert(vids.map(v => ({
      youtube_video_id: v.yt, day_pt: p(-1), site_id: c.site, video_id: v.id, channel_id: c.canal, views: 5, metric_version: metricVersion(p(-1)),
    }))))
    await ok(sb.from('yt_own_video_retention').insert(vids.flatMap(v => [
      linhaRetencao(c, v, { window_kind: 'vida', window_end: p(-1), window_start: pub, requested_end: HOJE_PT, views_at_read: 5 }),
      ...janelasDe(c, v, pub),
    ])))
    await ok(sb.from('yt_own_collection_attempts').insert(vids.map(v => ({
      scope_type: 'video', scope_id: v.yt, kind: 'retencao_vida', attempt_day: HOJE, site_id: c.site, channel_id: c.canal, outcome: 'ok',
    }))))
    return vids
  }

  const ponto = (t: number, ratio: number) => ({ t, ratio, relative: 0.5, segment_impressions: 100 })
  function linhaRetencao(c: Cen, v: Vid, o: Linha = {}): Linha {
    return {
      youtube_video_id: v.yt, window_kind: 'vida', segment: 'organico', window_end: p(-3), window_start: p(-30), requested_end: p(-2),
      site_id: c.site, video_id: v.id, channel_id: c.canal,
      points: [ponto(0.01, 1.05), ponto(0.02, 0.9)], point_count: 2, metrics_returned: ['audienceWatchRatio', 'relativeRetentionPerformance'],
      views_at_read: 10, source: 'analytics_api', collected_at: new Date().toISOString(), metric_version: metricVersion(p(-3)), ...o,
    }
  }
  async function tentativa(c: Cen, o: { escopo?: 'video' | 'canal'; id: string; kind: string; dia: string; outcome: string; status?: number | null; error?: string | null }): Promise<void> {
    await pg.query(`insert into public.yt_own_collection_attempts (scope_type, scope_id, kind, attempt_day, site_id, channel_id, outcome, http_status, error)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`, [o.escopo ?? 'video', o.id, o.kind, o.dia, c.site, c.canal, o.outcome, o.status ?? null, o.error ?? null])
  }
  /** As tentativas do diário dos 4 últimos dias UTC (hoje e os 3 anteriores): a janela de `diario_falhas_4d`. */
  const quatroDiasDeDiario = async (c: Cen, v: Vid, o: { outcome: string; status?: number | null; error?: string | null }): Promise<void> => {
    for (let k = 3; k >= 0; k--) await tentativa(c, { id: v.yt, kind: 'diario', dia: d(-k), ...o })
  }
  /** Anda o histórico de um canal `n` dias para trás (tentativas e coletas): é "o tempo passou", sem esperar. */
  async function envelhecer(c: Cen, n: number): Promise<void> {
    await pg.query(`update public.yt_own_collection_attempts set attempt_day = attempt_day - $2::int where site_id = $1`, [c.site, n])
    await pg.query(`update public.yt_own_video_retention set collected_at = collected_at - ($2::int * interval '1 day') where site_id = $1`, [c.site, n])
  }

  const linhasDe = async (v: Vid): Promise<Linha[]> => q(`select window_kind, window_end::text as window_end, window_start::text as window_start, requested_end::text as requested_end,
      point_count, jsonb_array_length(points) as n, metrics_returned, views_at_read, collected_at, source, metric_version, site_id, channel_id, video_id, segment
    from public.yt_own_video_retention where youtube_video_id = $1 order by window_kind, window_end`, [v.yt])
  const vidaDe = async (v: Vid): Promise<Linha[]> => (await linhasDe(v)).filter(l => l.window_kind === 'vida')
  const tentDe = async (v: Vid, kind: string = 'retencao_vida'): Promise<Linha[]> => q(`select outcome, http_status, error, attempts, attempt_day::text as attempt_day, channel_id, site_id
    from public.yt_own_collection_attempts where scope_type = 'video' and scope_id = $1 and kind = $2 order by attempt_day`, [v.yt, kind])
  const tentCanal = async (c: Cen): Promise<Linha[]> => q(`select outcome, attempts, attempt_day::text as attempt_day, kind from public.yt_own_collection_attempts
    where scope_type = 'canal' and scope_id = $1 order by attempt_day`, [c.canal])

  /** `yt_own_retention_facts` de verdade, lido pelo Zod do passo (e o conjunto de chaves do banco = o do Zod). */
  async function fatos(c: Cen, hoje: string = HOJE): Promise<ReturnType<typeof lerFatos>> {
    const r = await sb.rpc('yt_own_retention_facts', { p_channel_id: c.canal, p_hoje_utc: hoje })
    expect(r.error).toBeNull()
    const bruto = r.data as Array<Record<string, unknown>>
    const lidos = lerFatos(bruto)
    expect(lidos).toHaveLength(bruto.length)
    for (let i = 0; i < bruto.length; i++) expect(Object.keys(bruto[i]!).sort(), 'campos do banco = campos do Zod').toEqual(Object.keys(lidos[i]!).sort())
    return lidos
  }
  const fato = (todos: Awaited<ReturnType<typeof fatos>>, v: Vid) => {
    const f = todos.find(x => x.youtube_video_id === v.yt)
    if (!f) throw new Error('vídeo ausente dos fatos')
    return f
  }

  // ───────────────────────── o passo e o critério ─────────────────────────
  async function passo(c: Cen, deps: DepsRetencao = {}): Promise<{ r: RetencaoResumo; ctx: StepCtx }> {
    const ctx: StepCtx = {
      supabase: sb, channels: [canalDe(c)], deadline: Date.now() + 120_000, falhas: [], tentativas: [],
      autorizados: new Set(), negados: new Set(),
    }
    const r = await passoRetencao(ctx, { token: async () => TOKEN, ...deps })
    return { r, ctx }
  }
  async function criterio(c: Cen, o: { supabase?: SupabaseClient; channels?: ColetaChannel[] } = {}): Promise<string[]> {
    const falhas: string[] = []
    await criteriosRetencao({ supabase: o.supabase ?? sb, channels: o.channels ?? [canalDe(c)], falhas, relogio: criarRelogio() })
    return falhas
  }
  const idsChamados = (): string[] => chamadasYt.map(x => x.video)
  const notaDe = (c: Cen, ids: string[]): string =>
    `retenção: ${c.nome}: ${ids.length} vídeo(s) com leitura da curva vencida há mais de ${ALARME_RETENCAO.dias} dias (${ids.join(', ')})`

  // ═════════════════════════ o passo ═════════════════════════
  describe('passo: gravar', () => {
    it('100 pontos: 1 linha com tudo, tentativa de vídeo e de canal `ok`, âncora e carimbo de autorização no banco (a)', async () => {
      const c = await cenario()
      const v = await video(c, { duracao: 600 }); await diario(c, v, { fonte: p(-1), views: 4321 })
      instalarYt()
      expect(fato(await fatos(c), v).leva_ancora_dia, 'antes do passo: sem âncora').toBeNull()
      const { r, ctx } = await passo(c)

      expect(ctx.falhas).toEqual([])
      expect(r).toMatchObject({ gravados: 1, chamadas: 1, vazios: 0, pendentes: 0 })
      expect(chamadasYt).toHaveLength(1)
      expect(chamadasYt[0]).toMatchObject({ video: v.yt, auth: `Bearer ${TOKEN}`, inicio: p(-60), fim: HOJE_PT })
      expect(ensureFreshToken).not.toHaveBeenCalled()

      const l = await vidaDe(v)
      expect(l).toHaveLength(1)
      expect(await linhasDe(v), 'vida + as duas janelas semeadas').toHaveLength(3)
      expect(l[0]).toMatchObject({
        window_kind: 'vida', segment: 'organico', window_end: p(-1), window_start: p(-60), requested_end: HOJE_PT,
        point_count: 100, n: 100, views_at_read: '4321', source: 'analytics_api', metric_version: metricVersion(p(-1)),
        site_id: c.site, channel_id: c.canal, video_id: v.id,
      })
      expect(l[0]!.metrics_returned).toEqual(['audienceWatchRatio', 'relativeRetentionPerformance', 'totalSegmentImpressions'])
      expect(await tentDe(v)).toEqual([expect.objectContaining({ outcome: 'ok', http_status: null, error: null, attempts: 1, attempt_day: HOJE, channel_id: c.canal })])
      expect(await tentCanal(c)).toEqual([expect.objectContaining({ outcome: 'ok', attempts: 1, attempt_day: HOJE, kind: 'retencao_vida' })])

      // o ciclo "o passo grava → os fatos leem": a âncora, a linha e a resposta aparecem nos fatos
      expect(fato(await fatos(c), v)).toMatchObject({
        leva_ancora_dia: HOJE, primeira_tent_dia: HOJE, vida_tent_dia: HOJE, vida_tent_resultado: 'ok', vida_resposta_dia: HOJE,
        vida_window_end: p(-1), vida_views_at_read: 4321, duration_seconds: 600,
      })
      // marcarAutorizado gravou a coluna de verdade
      const aut = await q('select authorization_verified_at from public.youtube_channels where id = $1', [c.canal])
      expect(aut[0]!.authorization_verified_at).not.toBeNull()
    })

    it('a resposta REAL da C0.1 (vida, 2 métricas, 100 pontos) grava com 2 métricas', async () => {
      const c = await cenario(); const v = await vivo(c)
      instalarYt({}, () => json(VIDA_REAL))
      const { r, ctx } = await passo(c)
      expect(ctx.falhas).toEqual([])
      expect(r.gravados).toBe(1)
      const l = (await vidaDe(v))[0]!
      expect(l).toMatchObject({ point_count: 100, n: 100 })
      expect(l.metrics_returned).toEqual(['audienceWatchRatio', 'relativeRetentionPerformance'])
    })

    it('janelas de 7 e 30 dias gravam com `retencao_7d` e `retencao_30d` (relógio adiantado só no JavaScript); os três `kind` passam no check (h)', async () => {
      const c = await cenario()
      // Depois de RETENCAO_JANELAS_DESDE as janelas valem; o relógio do JavaScript anda 40 dias (o do banco não).
      vi.useFakeTimers({ now: new Date(Date.now() + 40 * DIA_MS), toFake: ['Date'] })
      const hojePt = dayPt(new Date())
      const pub = addDays(hojePt, -29)
      expect(addDays(pub, 6) >= RETENCAO_JANELAS_DESDE).toBe(true)
      const v = await video(c, { pub, janelas: false })
      await ok(sb.from('yt_own_video_daily').insert(Array.from({ length: 30 }, (_, k) => ({
        youtube_video_id: v.yt, day_pt: addDays(pub, k), site_id: c.site, video_id: v.id, channel_id: c.canal, views: 1, metric_version: metricVersion(addDays(pub, k)),
      }))))
      instalarYt()
      const { r, ctx } = await passo(c)
      expect(ctx.falhas).toEqual([])
      expect(r.gravados).toBe(3)
      expect(r.chamadas).toBe(3)

      const l = await linhasDe(v)
      expect(l.map(x => x.window_kind)).toEqual(['primeiros_30_dias', 'primeiros_7_dias', 'vida'])
      expect(l.find(x => x.window_kind === 'primeiros_7_dias')).toMatchObject({ window_start: pub, window_end: addDays(pub, 6), requested_end: addDays(pub, 6), views_at_read: '7' })
      expect(l.find(x => x.window_kind === 'primeiros_30_dias')).toMatchObject({ window_start: pub, window_end: addDays(pub, 29), requested_end: addDays(pub, 29), views_at_read: '30' })
      for (const kind of ['retencao_vida', 'retencao_7d', 'retencao_30d']) {
        expect(await tentDe(v, kind), kind).toEqual([expect.objectContaining({ outcome: 'ok', attempt_day: HOJE })])
      }
    })

    it('(h) os três `kind` da retenção passam no check de `yt_own_collection_attempts`, gravados pelo mesmo `registrarTentativa` do passo', async () => {
      const c = await cenario(); const v = await video(c)
      const ctx = { supabase: sb, falhas: [] as string[], tentativas: [] as StepCtx['tentativas'] }
      for (const kind of ['retencao_vida', 'retencao_7d', 'retencao_30d'] as AttemptKind[]) {
        await registrarTentativa(ctx, { site_id: c.site, scope_type: 'video', scope_id: v.yt, kind, channel_id: c.canal, outcome: 'nao_alcancado_orcamento' })
      }
      expect(ctx.falhas).toEqual([])
      const rows = await q(`select kind, outcome from public.yt_own_collection_attempts where scope_id = $1 order by kind`, [v.yt])
      expect(rows.map(x => x.kind)).toEqual(['retencao_30d', 'retencao_7d', 'retencao_vida'])
    })
  })

  describe('passo: idempotência e o que não volta a ser lido', () => {
    it('a segunda execução no mesmo dia não chama a API, não duplica linha nem regrava a curva (f)', async () => {
      const c = await cenario(); const v = await vivo(c)
      instalarYt()
      await passo(c)
      expect(chamadasYt).toHaveLength(1)
      const antes = (await vidaDe(v))[0]!
      const { r, ctx } = await passo(c)
      expect(chamadasYt, 'nenhum fetch novo').toHaveLength(1)
      expect(r).toMatchObject({ gravados: 0, chamadas: 0 })
      expect(ctx.falhas).toEqual([])
      const depois = await vidaDe(v)
      expect(depois).toHaveLength(1)
      expect(depois[0]!.collected_at, 'a curva não foi regravada').toEqual(antes.collected_at)
      // a tentativa de canal soma a execução; a de vídeo, não (ninguém foi lido)
      expect(await tentCanal(c)).toEqual([expect.objectContaining({ outcome: 'ok', attempts: 2 })])
      expect(await tentDe(v)).toEqual([expect.objectContaining({ outcome: 'ok', attempts: 1 })])
    })

    it('duas execuções simultâneas que decidem ler a mesma janela deixam UMA linha, sem erro (f)', async () => {
      const c = await cenario(); const v = await vivo(c)
      instalarYt()
      const [a, b] = await Promise.all([passo(c), passo(c)])
      expect(a.ctx.falhas).toEqual([])
      expect(b.ctx.falhas).toEqual([])
      expect(chamadasYt.length).toBeGreaterThanOrEqual(1)
      expect(await vidaDe(v)).toHaveLength(1)
      expect(await tentDe(v)).toHaveLength(1)
    })

    it('uma semana depois, com views novas e a fonte andando, cria OUTRA linha (outro `window_end`); logo em seguida não relê (f)', async () => {
      const c = await cenario(); const v = await vivo(c, { views: 100 })
      instalarYt()
      await passo(c)
      expect(await vidaDe(v)).toHaveLength(1)
      // o tempo passa: tentativas e coleta 8 dias atrás; entra o dia de hoje (PT) com views novas
      await envelhecer(c, 8)
      await ok(sb.from('yt_own_video_daily').insert({
        youtube_video_id: v.yt, day_pt: HOJE_PT, site_id: c.site, video_id: v.id, channel_id: c.canal, views: 60, metric_version: metricVersion(HOJE_PT),
      }))
      const { r } = await passo(c)
      expect(r.gravados).toBe(1)
      expect(chamadasYt).toHaveLength(2)
      const linhas = await vidaDe(v)
      expect(linhas.map(l => l.window_end)).toEqual([p(-1), HOJE_PT])
      expect(linhas[1]).toMatchObject({ views_at_read: '160' })
      const f = fato(await fatos(c), v)
      expect(f).toMatchObject({ vida_window_end: HOJE_PT, vida_views_at_read: 160, vida_resposta_dia: HOJE })
      await passo(c)
      expect(chamadasYt, 'o mesmo ciclo não lê de novo').toHaveLength(2)
      expect(await vidaDe(v)).toHaveLength(2)
    })

    it('curva vazia (`rows: []`, a resposta real da C0.1) é leitura FEITA: `sem_dado_na_janela`, 0 linhas, e o vídeo não volta a ser devido no mesmo ciclo (b)', async () => {
      const c = await cenario(); const v = await vivo(c)
      instalarYt({}, () => json(VAZIA_REAL))
      const { r, ctx } = await passo(c)
      expect(ctx.falhas).toEqual([])
      expect(r).toMatchObject({ vazios: 1, gravados: 0, chamadas: 1 })
      expect(await vidaDe(v)).toEqual([])
      expect(await tentDe(v)).toEqual([expect.objectContaining({ outcome: 'sem_dado_na_janela' })])
      expect(fato(await fatos(c), v)).toMatchObject({ vida_resposta_dia: HOJE, vida_tent_resultado: 'sem_dado_na_janela', vida_window_end: null })

      const seg = await passo(c)
      expect(chamadasYt, 'nenhum fetch na execução seguinte').toHaveLength(1)
      expect(seg.r.vazios).toBe(0)

      // oito dias depois, com view depois da resposta, volta a ser devido (a regra (c)); e continua sem linha
      await envelhecer(c, 8)
      await passo(c)
      expect(chamadasYt).toHaveLength(2)
      expect(await vidaDe(v)).toEqual([])
    })
  })

  describe('passo: erros da API', () => {
    it('500 três vezes: tentativa `erro_http`, `http_status 500`, `error = http_500` NA TABELA, nada avança; a nota do canal conta (c)', async () => {
      const c = await cenario(); const v = await vivo(c)
      instalarYt({}, () => new Response('', { status: 500 }))
      const { r, ctx } = await passo(c)
      expect(chamadasYt).toHaveLength(3)
      expect(r).toMatchObject({ gravados: 0, chamadas: 3 })
      expect(await tentDe(v)).toEqual([expect.objectContaining({ outcome: 'erro_http', http_status: 500, error: 'http_500' })])
      expect(await vidaDe(v)).toEqual([])
      expect(ctx.falhas).toEqual([`retenção: ${c.nome}: 1 de 1 leituras com erro (erro do YouTube (500))`])
      expect(ctx.falhas.join(' ')).not.toContain('texto do Google')
      expect(fato(await fatos(c), v)).toMatchObject({ vida_tent_resultado: 'erro_http', vida_resposta_dia: null, vida_window_end: null })
      // o canal fecha `ok`: o erro de vídeo não é falha do canal
      expect(await tentCanal(c)).toEqual([expect.objectContaining({ outcome: 'ok' })])
    })

    it('erro num vídeo: nada avança para ele (sem linha, sem resposta) e os outros seguem (c)', async () => {
      const c = await cenario()
      const id = grupoDeIds()
      const [a, b, z] = [await vivo(c, { yt: id('1') }), await vivo(c, { yt: id('2') }), await vivo(c, { yt: id('3') })]
      instalarYt({ [b.yt]: () => erroGoogle(404, 'notFound') })
      const { r, ctx } = await passo(c)
      expect(r.gravados).toBe(2)
      expect(await vidaDe(a)).toHaveLength(1)
      expect(await vidaDe(z)).toHaveLength(1)
      expect(await vidaDe(b)).toEqual([])
      expect(await tentDe(b)).toEqual([expect.objectContaining({ outcome: 'erro_http', http_status: 404, error: 'http_404_notFound' })])
      expect(await tentDe(a)).toEqual([expect.objectContaining({ outcome: 'ok' })])
      expect(ctx.falhas).toEqual([`retenção: ${c.nome}: 1 de 3 leituras com erro (o YouTube não encontrou o item (404))`])
      const todos = await fatos(c)
      expect(fato(todos, b)).toMatchObject({ vida_resposta_dia: null, vida_tent_resultado: 'erro_http' })
      expect(fato(todos, a)).toMatchObject({ vida_resposta_dia: HOJE })
      // repetir hoje: só o vídeo sem resposta é tentado de novo, e continua sem avançar
      await passo(c)
      expect(idsChamados().slice(3)).toEqual([b.yt])
      expect(await vidaDe(b)).toEqual([])
    })

    it('403 de cota: o passo para de chamar (só os 4 em voo saem), grava os pendentes e conta quantos (c)', async () => {
      const c = await cenario()
      const id = grupoDeIds()
      for (let i = 1; i <= 10; i++) await vivo(c, { yt: id(String(i).padStart(2, '0')) })
      instalarYt({}, () => erroGoogle(403, 'quotaExceeded'))
      const { r, ctx } = await passo(c)
      expect(chamadasYt).toHaveLength(4)
      expect(r.pendentes).toBe(6)
      expect(r.chamadas).toBe(4)
      const t = await q(`select outcome, http_status, error, count(*)::int as n from public.yt_own_collection_attempts
        where scope_type = 'video' and kind = 'retencao_vida' and site_id = $1 group by 1, 2, 3 order by 1`, [c.site])
      expect(t).toEqual([
        { outcome: 'erro_http', http_status: 403, error: 'http_403_quotaExceeded', n: 4 },
        { outcome: 'nao_alcancado_orcamento', http_status: null, error: null, n: 6 },
      ])
      expect(await tentCanal(c)).toEqual([expect.objectContaining({ outcome: 'nao_alcancado_orcamento' })])
      expect(ctx.falhas).toEqual([`retenção: ${c.nome}: 4 de 10 leituras com erro (o YouTube recusou por cota (403))`])
      expect(Number((await q('select count(*) as n from public.yt_own_video_retention where site_id = $1 and window_kind = \'vida\'', [c.site]))[0]!.n)).toBe(0)
      // nenhum virou resposta
      const todos = await fatos(c)
      expect(todos.every(f => f.vida_resposta_dia === null)).toBe(true)
    })
  })

  describe('passo: a ordem sem fome (g)', () => {
    it('nunca tentado primeiro; depois a tentativa mais antiga; o id só desempata (com os dados que o banco devolve)', async () => {
      const c = await cenario()
      const id = grupoDeIds()
      const nunca = await vivo(c, { yt: id('zzzzzz') })
      const antiga = await vivo(c, { yt: id('1') })
      const media = await vivo(c, { yt: id('2') })
      const recente = await vivo(c, { yt: id('3') })
      await tentativa(c, { id: antiga.yt, kind: 'retencao_vida', dia: d(-5), outcome: 'erro_http', status: 500, error: 'http_500' })
      await tentativa(c, { id: media.yt, kind: 'retencao_vida', dia: d(-3), outcome: 'nao_alcancado_orcamento' })
      await tentativa(c, { id: recente.yt, kind: 'retencao_vida', dia: d(-1), outcome: 'nao_alcancado_orcamento' })
      instalarYt()
      const { r } = await passo(c)
      expect(r.gravados).toBe(4)
      expect(idsChamados()).toEqual([nunca.yt, antiga.yt, media.yt, recente.yt])
    })
  })

  // ═════════════════════════ as notas do passo: o fim do alarme ═════════════════════════
  describe('passo: vídeo sem diário em dia (vermelho × ação do dono)', () => {
    /** Um canal com `filler` vídeos em dia e UM vídeo cuja fonte do diário parou em `fonteDias` dias atrás e cujas 4 últimas tentativas do diário são `diario`. */
    async function umAtrasado(filler: number, fonteDias: number, diario: { outcome: string; status?: number | null; error?: string | null } | null) {
      const c = await cenario()
      await saudaveis(c, filler - 1)
      const v = await video(c)
      await diario_(c, v, fonteDias)
      if (diario) await quatroDiasDeDiario(c, v, diario)
      instalarYt()
      const { r, ctx } = await passo(c)
      return { c, v, r, ctx }
    }
    const diario_ = (c: Cen, v: Vid, fonteDias: number) => diario(c, v, { fonte: p(fonteDias) })
    const notaSemDiario = (ctx: StepCtx): string | undefined => ctx.falhas.find(n => n.includes('sem diário em dia'))

    it('N1: 4 dias de `erro_de_banco` do diário NÃO tiram o vídeo do vermelho (o fato real traz `diario_falhas_4d 0`) (d)', async () => {
      const { c, v, r, ctx } = await umAtrasado(35, -20, { outcome: 'erro_http', error: 'erro_de_banco' })
      expect(fato(await fatos(c), v).diario_falhas_4d).toBe(0)
      expect(notaSemDiario(ctx)).toBe(`retenção: ${c.nome}: 1 vídeo(s) sem diário em dia; a curva espera o diário (${v.yt})`)
      expect(r.sem_resposta_do_youtube).toEqual([])
      expect(r.sem_diario_em_dia).toBe(1)
    })

    it('N1: 4 dias de 404 tiram (o fato real traz `diario_falhas_4d 4`), 1 de 35: `falhas` sem a nota e `sem_resposta_do_youtube` com o id (d)', async () => {
      const { c, v, r, ctx } = await umAtrasado(35, -20, { outcome: 'erro_http', status: 404, error: 'http_404' })
      expect(fato(await fatos(c), v).diario_falhas_4d).toBe(4)
      expect(notaSemDiario(ctx)).toBeUndefined()
      expect(r.sem_resposta_do_youtube).toEqual([`retenção: ${c.nome}: 1 vídeo(s) que o YouTube não devolve mais (${v.yt}); a curva não é lida`])
      expect(r.sem_diario_em_dia).toBe(0)
      expect(ctx.falhas).toEqual([])
    })

    it.each([
      ['404', { outcome: 'erro_http', status: 404, error: 'http_404' }, true],
      ['403 sem permissão', { outcome: 'erro_http', status: 403, error: 'http_403_forbidden' }, true],
      ['410', { outcome: 'erro_http', status: 410, error: 'http_410' }, true],
      ['sem_dado_na_janela', { outcome: 'sem_dado_na_janela' }, true],
      ['403 de cota', { outcome: 'erro_http', status: 403, error: 'http_403_quotaExceeded' }, false],
      ['500', { outcome: 'erro_http', status: 500, error: 'http_500' }, false],
      ['429', { outcome: 'erro_http', status: 429, error: 'http_429' }, false],
      ['erro sem status (forma_inesperada)', { outcome: 'erro_http', error: 'forma_inesperada' }, false],
    ])('quatro dias de %s no diário: %s sai do vermelho para a ação do dono (d)', async (_nome, diarioDe, saiDoVermelho) => {
      const { v, r, ctx } = await umAtrasado(35, -20, diarioDe)
      if (saiDoVermelho) {
        expect(r.sem_resposta_do_youtube).toHaveLength(1)
        expect(r.sem_resposta_do_youtube[0]).toContain(v.yt)
        expect(notaSemDiario(ctx)).toBeUndefined()
      } else {
        expect(r.sem_resposta_do_youtube).toEqual([])
        expect(notaSemDiario(ctx)).toContain(v.yt)
      }
    })

    it.each([
      [-10, 'dois dias de atraso: ainda vermelho', false],
      [-11, 'três dias de atraso: ação do dono', true],
    ])('só depois dos dias que a regra manda: fonte parada em p(%i) (%s) (d)', async (fonteDias, _nome, saiDoVermelho) => {
      const { v, r, ctx } = await umAtrasado(35, fonteDias, { outcome: 'erro_http', status: 404, error: 'http_404' })
      expect(r.sem_resposta_do_youtube.length === 1).toBe(saiDoVermelho)
      expect(Boolean(notaSemDiario(ctx))).toBe(!saiDoVermelho)
      if (!saiDoVermelho) expect(notaSemDiario(ctx)).toContain(v.yt)
    })

    it('pane: metade ou mais do canal com 4 dias de 404 fica VERMELHO, ninguém vira ação do dono (d)', async () => {
      const c = await cenario()
      await saudaveis(c, 3)
      const ruins: Vid[] = []
      for (let i = 0; i < 3; i++) {
        const v = await video(c); await diario(c, v, { fonte: p(-20) })
        await quatroDiasDeDiario(c, v, { outcome: 'erro_http', status: 404, error: 'http_404' })
        ruins.push(v)
      }
      instalarYt()
      const { r, ctx } = await passo(c)
      expect(r.sem_resposta_do_youtube).toEqual([])
      const nota = notaSemDiario(ctx)!
      expect(nota).toContain('3 vídeo(s) sem diário em dia')
      expect(nota).toContain('metade ou mais do canal: é pane da coleta')
      for (const v of ruins) expect(nota).toContain(v.yt)
    })

    it('vídeo de 2 dias sem diário é "novo": nem nota nem ação (m-3)', async () => {
      const c = await cenario()
      await video(c, { pub: p(-2), janelas: false })
      instalarYt()
      const { r, ctx } = await passo(c)
      expect(r).toMatchObject({ novos: 1, sem_diario_em_dia: 0 })
      expect(ctx.falhas).toEqual([])
      expect(chamadasYt).toHaveLength(0)
    })
  })

  // ═════════════════════════ o critério (o alarme) ═════════════════════════
  describe('critério: o alarme nos dois sentidos', () => {
    it('verde depois do passo (`falhas` vazio) (e a âncora: o critério sai da carência com a âncora gravada pelo próprio passo) (a)', async () => {
      const c = await cenario()
      const [a, b] = [await vivo(c), await vivo(c)]
      instalarYt()
      const { ctx } = await passo(c)
      expect(ctx.falhas).toEqual([])
      expect(await criterio(c)).toEqual([])
      expect(fato(await fatos(c), a).leva_ancora_dia).toBe(HOJE)
      expect(fato(await fatos(c), b).leva_ancora_dia).toBe(HOJE)
    })

    it('a âncora gravada pelo passo: depois dele o critério deixa de estar em carência; 9 dias depois, sem nenhuma resposta, lista o vídeo (a)', async () => {
      const c = await cenario(); const v = await vivo(c)
      // o YouTube não responde para ninguém (404): nenhuma tentativa de vídeo é resposta
      instalarYt({}, () => erroGoogle(404, 'notFound'))
      await passo(c)
      expect(await tentCanal(c)).toEqual([expect.objectContaining({ outcome: 'ok', attempt_day: HOJE })])
      expect(fato(await fatos(c), v)).toMatchObject({ leva_ancora_dia: HOJE, vida_resposta_dia: null })
      expect(await criterio(c), 'âncora de hoje: o passo roda há 0 dia').toEqual([])
      await envelhecer(c, 9)
      expect(fato(await fatos(c), v).leva_ancora_dia).toBe(d(-9))
      expect(await criterio(c)).toEqual([notaDe(c, [v.yt])])
    })

    it('vermelho com a âncora antiga e nenhuma resposta: a nota lista os vídeos com diário em dia, e só eles (D)', async () => {
      const c = await cenario()
      const id = grupoDeIds()
      const [a, b] = [await vivo(c, { yt: id('1') }), await vivo(c, { yt: id('2') })]
      const semDiario = await video(c); await diario(c, semDiario, { fonte: p(-20) })
      const novo = await video(c, { pub: p(-2), janelas: false })
      await tentativa(c, { escopo: 'canal', id: c.canal, kind: 'retencao_vida', dia: d(-9), outcome: 'ok' })
      expect(await criterio(c)).toEqual([notaDe(c, [a.yt, b.yt])])
      const nota = (await criterio(c)).join(' ')
      expect(nota).not.toContain(semDiario.yt)
      expect(nota).not.toContain(novo.yt)
    })

    it('tabelas vazias, primeiro dia: âncora nula, `falhas` vazio (e a função devolve a âncora nula de verdade)', async () => {
      const c = await cenario()
      const vs = [await vivo(c), await vivo(c), await vivo(c)]
      const todos = await fatos(c)
      expect(todos).toHaveLength(3)
      for (const v of vs) expect(fato(todos, v)).toMatchObject({ leva_ancora_dia: null, primeira_tent_dia: null, vida_tent_dia: null })
      expect(await criterio(c)).toEqual([])
    })

    it('o ciclo completo: vencido há 9 dias → vermelho; o passo FALHA (500) → continua vermelho; o passo conserta → verde; quem está em dia nunca entra (d)', async () => {
      const c = await cenario()
      const pub = p(-60)
      const v = await video(c, { pub }); await diario(c, v, { fonte: p(-1), views: 50 })
      await ok(sb.from('yt_own_video_retention').insert(linhaRetencao(c, v, {
        window_kind: 'vida', window_end: p(-10), window_start: pub, requested_end: p(-9), views_at_read: 10, collected_at: new Date(Date.now() - 9 * DIA_MS).toISOString(),
      })))
      await tentativa(c, { id: v.yt, kind: 'retencao_vida', dia: d(-9), outcome: 'ok' })
      await tentativa(c, { escopo: 'canal', id: c.canal, kind: 'retencao_vida', dia: d(-9), outcome: 'ok' })
      const emDia = await saudaveis(c, 2)

      expect(await criterio(c), 'antes do passo: vencido há 9 dias, com views novas e a fonte andou').toEqual([notaDe(c, [v.yt])])

      instalarYt({}, () => new Response('', { status: 500 }))
      const falhou = await passo(c)
      expect(chamadasYt.map(x => x.video)).toEqual([v.yt, v.yt, v.yt])
      expect(falhou.ctx.falhas).toEqual([`retenção: ${c.nome}: 1 de 1 leituras com erro (erro do YouTube (500))`])
      expect((await tentDe(v)).map(x => [x.attempt_day, x.outcome])).toEqual([[d(-9), 'ok'], [HOJE, 'erro_http']])
      expect(await criterio(c), 'o passo falhou: o erro de hoje com resposta há 9 dias ainda conta (C)').toEqual([notaDe(c, [v.yt])])

      instalarYt()
      const certo = await passo(c)
      expect(certo.ctx.falhas).toEqual([])
      expect(idsChamados()).toEqual([v.yt])
      expect(await vidaDe(v)).toHaveLength(2)
      // a tentativa de hoje troca o `erro_http` por `ok` (mesma chave do dia) e soma a execução
      expect((await tentDe(v)).map(x => [x.attempt_day, x.outcome, x.attempts])).toEqual([[d(-9), 'ok', 1], [HOJE, 'ok', 2]])
      expect(await criterio(c), 'o passo leu: verde').toEqual([])
      for (const w of emDia) expect(await tentDe(w)).toHaveLength(1)
    })

    it('só o canal do teste é olhado: o vídeo vencido de OUTRO canal (outro site) não aparece em nota nenhuma nem recebe chamada (R5)', async () => {
      const c1 = await cenario(); const c2 = await cenario()
      const v1 = await vivo(c1); const v2 = await vivo(c2)
      for (const c of [c1, c2]) await tentativa(c, { escopo: 'canal', id: c.canal, kind: 'retencao_vida', dia: d(-9), outcome: 'ok' })
      const antes = await q('select count(*)::int as n from public.yt_own_collection_attempts where site_id = $1', [c2.site])

      const falhas = await criterio(c1)
      expect(falhas).toEqual([notaDe(c1, [v1.yt])])
      expect(falhas.join(' ')).not.toContain(v2.yt)
      expect(falhas.join(' ')).not.toContain(c2.nome)

      instalarYt()
      await passo(c1)
      expect(idsChamados()).toEqual([v1.yt])
      expect(await q('select count(*)::int as n from public.yt_own_collection_attempts where site_id = $1', [c2.site])).toEqual(antes)
      expect(await vidaDe(v2)).toEqual([])
      // a função de fatos de um canal nunca devolve o vídeo do outro
      expect((await fatos(c1)).map(f => f.youtube_video_id)).toEqual([v1.yt])
    })
  })

  describe('critério: lista de fatos vazia (e)', () => {
    /** O cliente real, só que `yt_own_retention_facts` devolve a lista vazia (o defeito que o alarme precisa pegar). */
    const comFatosVazios = (): SupabaseClient => new Proxy(sb, {
      get(alvo, chave) {
        if (chave === 'rpc') {
          return (nome: string, args?: Record<string, unknown>) =>
            nome === 'yt_own_retention_facts' ? Promise.resolve({ data: [], error: null }) : alvo.rpc(nome, args)
        }
        const v = Reflect.get(alvo, chave, alvo) as unknown
        return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(alvo) : v
      },
    })

    it('lista vazia com vídeos no canal: "não foi possível avaliar … (lista vazia, mas o canal tem N vídeos)", contada no banco real', async () => {
      const c = await cenario()
      await vivo(c); await vivo(c)
      expect(await criterio(c, { supabase: comFatosVazios() })).toEqual([`critérios: não foi possível avaliar retenção de ${c.nome} (lista vazia, mas o canal tem 2 vídeos)`])
    })

    it('um vídeo só: singular', async () => {
      const c = await cenario(); await vivo(c)
      expect(await criterio(c, { supabase: comFatosVazios() })).toEqual([`critérios: não foi possível avaliar retenção de ${c.nome} (lista vazia, mas o canal tem 1 vídeo)`])
    })

    it('canal sem vídeo nenhum: verde, mesmo com vídeos em OUTRO canal (a contagem filtra por `channel_id`)', async () => {
      const c = await cenario(); const outro = await cenario()
      await vivo(outro); await vivo(outro)
      expect(await criterio(c, { supabase: comFatosVazios() }), 'canal vazio').toEqual([])
      // o mesmo canal, sem o defeito: a função real também devolve vazio
      expect(await fatos(c)).toEqual([])
      expect(await criterio(c)).toEqual([])
    })
  })

  describe('contrato dos fatos', () => {
    it('um item REAL dos fatos (todos os campos preenchidos) passa por `lerFatos`: campo a campo, nenhum some e nenhum sobra', async () => {
      const c = await cenario()
      const pub = p(-40)
      const v = await video(c, { pub, janelas: false, duracao: 600 })
      await ok(sb.from('yt_own_video_daily').insert([pub, addDays(pub, 29), p(-1)].map(dia => ({
        youtube_video_id: v.yt, day_pt: dia, site_id: c.site, video_id: v.id, channel_id: c.canal, views: 1, metric_version: metricVersion(dia),
      }))))
      await ok(sb.from('yt_own_video_retention').insert([
        linhaRetencao(c, v, { window_kind: 'vida', window_end: p(-2), window_start: pub, requested_end: p(-1), views_at_read: 2 }),
        ...janelasDe(c, v, pub),
      ]))
      for (const kind of ['retencao_vida', 'retencao_7d', 'retencao_30d']) await tentativa(c, { id: v.yt, kind, dia: d(-2), outcome: 'ok' })
      await tentativa(c, { id: v.yt, kind: 'diario', dia: d(-1), outcome: 'erro_http', status: 404, error: 'http_404' })
      await tentativa(c, { escopo: 'canal', id: c.canal, kind: 'retencao_vida', dia: d(-5), outcome: 'ok' })

      const itens = await fatos(c)
      expect(itens).toHaveLength(1)
      const f = itens[0]!
      const nulos = Object.entries(f).filter(([, x]) => x === null).map(([k]) => k)
      expect(nulos, 'todos os 29 campos preenchidos').toEqual([])
      expect(Object.keys(f)).toHaveLength(29)
      expect(f).toMatchObject({
        youtube_video_id: v.yt, video_id: v.id, site_id: c.site, duration_seconds: 600, publicado_dia_pt: pub, fonte_ate: p(-1), views_total: 3,
        ultimo_dia_com_view: p(-1), views_7d: 1, views_30d: 2, vida_window_end: p(-2), vida_views_at_read: 2, tem_7d: true, tem_30d: true,
        primeira_tent_dia: d(-2), leva_ancora_dia: d(-5), diario_tent_dia: d(-1), diario_tent_resultado: 'erro_http', diario_falhas_4d: 1,
        vida_tent_dia: d(-2), vida_tent_resultado: 'ok', vida_resposta_dia: d(-2), d7_tent_dia: d(-2), d7_tent_resultado: 'ok', d7_resposta_dia: d(-2),
        d30_tent_dia: d(-2), d30_tent_resultado: 'ok', d30_resposta_dia: d(-2),
      })
      expect(typeof f.vida_collected_at).toBe('string')
    })
  })
})
