// @vitest-environment node
/**
 * A5 · E11 (Tarefa 12): os passos `dimensoes` e `normalizadores`, os critérios (`criteriosE11`) e o leitor
 * (`lerDimensoes`, `lerDetalheDaOrigem`) rodando juntos contra Postgres de verdade, com a API do YouTube SIMULADA (o `fetch`
 * global é trocado por um roteador que só atende a Analytics API de mentira e o Supabase local; qualquer outro destino lança).
 * Banco: SÓ o `bythiago_int`. Rodar com:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run --no-file-parallelism test/integration/observatorio-a5-e11-passos.test.ts
 *
 * O banco é dividido com outras etapas: cada teste cria o SEU site, o SEU canal e os SEUS vídeos, passa o site à prova e só olha
 * para eles (nenhuma contagem global); o arquivo semeia e limpa. Função sem EXECUTE nunca é CHAMADA como anon/authenticated (derruba
 * este Postgres): só `service_role`. Datas: tudo relativo a hoje (Pacífico) ou passado; as execuções "em dias seguidos" andam o
 * relógio do PASSO (`ctx.hoje`) dentro do passado, nunca para o futuro. O "schema ausente" é real: o cliente é um Proxy que troca o
 * nome da função ou da tabela por um que não existe e deixa o PostgREST de verdade responder o erro (PGRST202/PGRST205).
 *
 * "Este sistema falha em VERDE": cada ausência (relatório sem linhas, dia sem relatório, passo desligado, tabela ausente, API com
 * lista vazia, 403 de cota, 500, `views` nulo, reexecução) tem aqui o desfecho do passo E o veredito do critério, e o que sai é
 * sempre explícito (nota escrita, tentativa com resultado próprio ou estado "não medido"), nunca saída vazia com "ok".
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import { Client } from 'pg'
import type { SupabaseClient } from '@supabase/supabase-js'
import { randomUUID, createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite, SUPABASE_URL } from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

const guarda = vi.hoisted(() => ({ edita: true }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/youtube/coleta/alerts', () => ({ avisarEntrada: vi.fn(), avisarSaida: vi.fn() }))
vi.mock('@/lib/social/token-refresh', async (orig) => ({
  ...(await orig<typeof import('@/lib/social/token-refresh')>()),
  ensureFreshToken: vi.fn(),
}))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireSiteScope: async () => (guarda.edita ? { ok: true, user: { id: 'u1' } } : { ok: false }),
}))

import { passoDimensoes, type DimensoesCtx, type DimensoesResumo } from '@/lib/youtube/coleta/dimensoes-step'
import { passoNormalizadores, type NormalizadoresResumo } from '@/lib/youtube/coleta/normalizadores-step'
import { criteriosE11 } from '@/lib/youtube/coleta/criteria-e11'
import { janelaDoConjunto, CARENCIA_COBERTURA_DIAS, CARENCIA_NORMALIZAR_DIAS } from '@/lib/youtube/coleta/e11-config'
import { addDays, dayPt, utcDay } from '@/lib/youtube/coleta/day-pt'
import { metricVersion } from '@/lib/youtube/coleta/metric-version'
import { paraBytea } from '@/lib/youtube/reporting/client'
import { CABECALHO_TRAFEGO, lerTrafego, agregarTrafego } from '@/lib/youtube/reporting/traffic-source-csv'
import { CABECALHO_ALCANCE_COMBINADO, lerAlcanceCombinado, agregarAlcanceCombinado } from '@/lib/youtube/reporting/reach-combined-csv'
import { provarEdicao } from '@/lib/youtube/observatorio/proprio/edicao'
import { lerDimensoes, lerDetalheDaOrigem, type PedidoDimensoes } from '@/lib/youtube/observatorio/proprio/ler-dimensoes'
import { estadoDoDiaLido } from '@/lib/youtube/observatorio/proprio/dimensoes-estado'
import type { ColetaChannel } from '@/lib/youtube/coleta/types'

vi.setConfig({ testTimeout: 90_000 })

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const FIXTURES = fileURLToPath(new URL('../youtube/coleta/fixtures/', import.meta.url))
const HOJE = dayPt(new Date())
const p = (n: number): string => addDays(HOJE, n)
const TOKEN = 'token-fixo-do-ensaio'
const SENTINELA = 'zz-sentinela-e11'
const TIPO_DETALHE = 'channel_traffic_source_a3'
const TIPO_ALCANCE = 'channel_reach_combined_a1'
const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex')

type Linha = Record<string, unknown>
interface Cen { site: string; canal: string; uc: string; nome: string }
interface Vid { id: string; yt: string }
type Rpc = { data: unknown; error: { code?: string; message: string } | null }

// ───────────────────────── a API do YouTube, de mentira ─────────────────────────
const fetchReal = globalThis.fetch
const YT = 'https://youtubeanalytics.googleapis.com/'
const json = (corpo: unknown, status = 200): Response => new Response(JSON.stringify(corpo), { status })
const erroGoogle = (status: number, reason?: string): Response =>
  json({ error: { code: status, message: 'texto do Google que não pode vazar', ...(reason ? { errors: [{ reason }] } : {}) } }, status)

type Familia = 'traffic_source' | 'device_os' | 'country' | 'subscribed_status'
const FAMILIA_DE: Record<string, Familia> = {
  insightTrafficSourceType: 'traffic_source', 'deviceType,operatingSystem': 'device_os', country: 'country', subscribedStatus: 'subscribed_status',
}
const VALORES: Record<Familia, string[]> = {
  traffic_source: ['YT_SEARCH'], device_os: ['MOBILE', 'ANDROID'], country: ['BR'], subscribed_status: ['SUBSCRIBED'],
}
const VALORES_ZERO: Record<Familia, string[]> = {
  traffic_source: ['EXT_URL'], device_os: ['DESKTOP', 'WINDOWS'], country: ['US'], subscribed_status: ['UNSUBSCRIBED'],
}
interface PedidoApi { familia: Familia; video: string; inicio: string; fim: string; engaged: boolean; comDia: boolean }
interface Sim {
  /** views por vídeo (youtube_video_id) e dia (Pacífico): é o que a API "tem". */
  views: Record<string, Record<string, number>>
  /** acrescenta uma linha de ZEROS por dia (o YouTube às vezes devolve) */
  zeros?: boolean
  /** resposta própria; `null` = usa a normal */
  resposta?: (q: PedidoApi, n: number) => Response | Error | null
}
let chamadas: PedidoApi[] = []

function corpoNormal(sim: Sim, q: PedidoApi): unknown {
  const nomes = Object.entries(FAMILIA_DE).find(([, f]) => f === q.familia)![0].split(',')
  const cab = [...(q.comDia ? ['day'] : []), ...nomes, 'views', 'estimatedMinutesWatched', ...(q.engaged ? ['engagedViews'] : [])].map(name => ({ name }))
  const rows: unknown[][] = []
  const dias = sim.views[q.video] ?? {}
  for (const dia of Object.keys(dias).sort()) {
    if (dia < q.inicio || dia > q.fim || !(dias[dia]! > 0)) continue
    const v = dias[dia]!
    rows.push([...(q.comDia ? [dia] : []), ...VALORES[q.familia], v, v * 0.5, ...(q.engaged ? [v] : [])])
    if (sim.zeros) rows.push([...(q.comDia ? [dia] : []), ...VALORES_ZERO[q.familia], 0, 0, ...(q.engaged ? [0] : [])])
  }
  return { columnHeaders: cab, rows }
}

/** Troca o `fetch` global: Analytics API = simulada (guarda cada pedido); Supabase local = o de verdade; o resto lança. */
function instalarApi(sim: Sim): void {
  chamadas = []
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (url.startsWith(YT)) {
      const u = new URL(url)
      const dims = u.searchParams.get('dimensions') ?? ''
      const comDia = dims.startsWith('day,')
      const familia = FAMILIA_DE[comDia ? dims.slice(4) : dims]
      if (!familia) throw new Error(`dimensão inesperada no ensaio: ${dims}`)
      const q: PedidoApi = {
        familia, comDia, video: /video==([^;]+)/.exec(u.searchParams.get('filters') ?? '')?.[1] ?? '',
        inicio: u.searchParams.get('startDate') ?? '', fim: u.searchParams.get('endDate') ?? '',
        engaged: (u.searchParams.get('metrics') ?? '').split(',').includes('engagedViews'),
      }
      chamadas.push(q)
      const propria = sim.resposta?.(q, chamadas.length)
      if (propria instanceof Error) throw propria
      return propria ?? json(corpoNormal(sim, q))
    }
    if (url.startsWith(SUPABASE_URL)) return fetchReal(input, init)
    throw new Error(`chamada de rede inesperada no ensaio: ${new URL(url).host}`)
  })
}
const porFamilia = (f: Familia): PedidoApi[] => chamadas.filter(c => c.familia === f)

// ───────────────────────── CSVs do Reporting ─────────────────────────
const CAB_T = CABECALHO_TRAFEGO.join(',')
const CAB_A = CABECALHO_ALCANCE_COMBINADO.join(',')
const ymd = (dia: string): string => dia.replace(/-/g, '')
const csvTrafego = (uc: string, dia: string, linhas: Array<{ video: string; origem?: string; detalhe?: string; views: number; min?: number }>): string =>
  [CAB_T, ...linhas.map(l => [ymd(dia), uc, l.video, 'on_demand', 'not_subscribed', 'BR', l.origem ?? '4', l.detalhe ?? '', l.views, l.views, l.min ?? 1.5, 0, 0, 0, 0].join(','))].join('\n') + '\n'
const csvAlcance = (uc: string, dia: string, linhas: Array<{ video: string; imp: number; ctr?: string; aparelho?: string; so?: string; origem?: string }>): string =>
  [CAB_A, ...linhas.map(l => [ymd(dia), uc, l.video, l.aparelho ?? '101', l.so ?? '9', l.origem ?? '4', 'XXXX', l.imp, l.ctr ?? '0.1'].join(','))].join('\n') + '\n'
const realTrafego = readFileSync(`${FIXTURES}traffic-source-a3-real.csv`, 'utf8')
const realAlcance = readFileSync(`${FIXTURES}reach-combined-a1-real.csv`, 'utf8')
const UC_REAL = 'UCRHtzTwaEpcjspAS2hbqmrA'
const linhasDoDia = (csv: string, dia: string): string => csv.split('\n').filter((l, i) => i === 0 || l.startsWith(dia)).join('\n') + '\n'
/**
 * O id de vídeo do YouTube é único no mundo (a chave das tabelas é global, sem site): dois testes não podem reusar os ids do arquivo
 * real. Cada teste troca a coluna `video_id` (a terceira) por ids próprios; `S1iMQVIOFL4` vira `mapa.get('S1iMQVIOFL4')`.
 */
function comVideosProprios(csv: string): { csv: string; mapa: Map<string, string> } {
  const mapa = new Map<string, string>()
  const linhas = csv.split('\n').map((l, i) => {
    if (i === 0 || l === '') return l
    const col = l.split(',')
    if (!mapa.has(col[2]!)) mapa.set(col[2]!, 'y' + randomUUID().replace(/-/g, '').slice(0, 10))
    col[2] = mapa.get(col[2]!)!
    return col.join(',')
  })
  return { csv: linhas.join('\n'), mapa }
}

describe.skipIf(skipIfNoLocalDb())('A5 E11 (Tarefa 12): passos, critérios e leitor contra o banco (bythiago_int), API do YouTube simulada', () => {
  let pg: Client
  let sb: SupabaseClient
  const sites: string[] = []
  const ambienteAntes = process.env.YT_OWN_STEPS_OFF

  beforeAll(async () => {
    sb = getSupabaseServiceClient()
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
  })
  afterAll(async () => {
    try {
      if (sites.length > 0) {
        // FK "restrict" do canal: as tabelas presas a ele primeiro, depois vídeos e canais; o site leva o resto por cascata
        for (const t of [
          'yt_own_video_dim_daily', 'yt_own_video_traffic_detail_daily', 'yt_own_video_reach_dim_daily', 'yt_reporting_reports',
          'yt_own_video_coverage', 'yt_own_video_daily', 'yt_own_collection_attempts', 'youtube_videos', 'youtube_channels',
        ]) {
          await pg.query(`delete from public.${t} where site_id = any($1::uuid[])`, [sites])
        }
        await pg.query('delete from public.audit_log where site_id = any($1::uuid[])', [sites])
        await pg.query('delete from public.sites where id = any($1::uuid[])', [sites])
      }
    } finally {
      await pg.end()
    }
  })
  beforeEach(() => { delete process.env.YT_OWN_STEPS_OFF; guarda.edita = true })
  afterEach(() => {
    vi.unstubAllGlobals()
    if (ambienteAntes === undefined) delete process.env.YT_OWN_STEPS_OFF
    else process.env.YT_OWN_STEPS_OFF = ambienteAntes
  })

  // ───────────────────────── semeadura e leitura ─────────────────────────
  const q = async (sql: string, params: unknown[] = []): Promise<Linha[]> => (await pg.query(sql, params)).rows as Linha[]
  const n = async (sql: string, params: unknown[] = []): Promise<number> => Number((await q(sql, params))[0]!.n)

  async function cenario(uc?: string): Promise<Cen> {
    const site = (await seedSite(sb)).siteId
    sites.push(site)
    const x = randomUUID().replace(/-/g, '')
    const canalUc = uc ?? 'UC' + x.slice(0, 22)
    const nome = 'Canal ' + x.slice(0, 6)
    const r = await q(`insert into public.youtube_channels (site_id, channel_id, locale, handle, name, uploads_playlist_id, slug, sync_enabled)
      values ($1, $2, 'pt', $3, $4, $5, $6, true) returning id`, [site, canalUc, '@t' + x.slice(0, 8), nome, 'UU' + x.slice(2, 24), 'teste-' + x.slice(0, 8)])
    return { site, canal: String(r[0]!.id), uc: canalUc, nome }
  }
  const canalDe = (c: Cen): ColetaChannel =>
    ({ id: c.canal, channel_id: c.uc, site_id: c.site, name: c.nome, sync_enabled: true, collection_status: 'ok', video_count: null })
  async function video(c: Cen, o: { yt?: string; pub?: string } = {}): Promise<Vid> {
    const yt = o.yt ?? 'y' + randomUUID().replace(/-/g, '').slice(0, 10)
    const r = await q(`insert into public.youtube_videos (site_id, channel_id, youtube_video_id, title, published_at)
      values ($1, $2, $3, 'Teste', $4) returning id`, [c.site, c.canal, yt, `${o.pub ?? p(-100)}T12:00:00Z`])
    return { id: String(r[0]!.id), yt }
  }
  /** Diário do vídeo: [dia, views][] (views nulo = a linha existe e o número não veio). */
  async function diario(c: Cen, v: Vid, dias: Array<[string, number | null]>): Promise<void> {
    for (const [dia, views] of dias) {
      await pg.query(`insert into public.yt_own_video_daily (youtube_video_id, day_pt, site_id, video_id, channel_id, views, metric_version)
        values ($1, $2, $3, $4, $5, $6, $7) on conflict (youtube_video_id, day_pt) do update set views = excluded.views`,
      [v.yt, dia, c.site, v.id, c.canal, views, metricVersion(dia)])
    }
  }
  const cobrir = async (c: Cen, v: Vid, conjunto: string, de: string, ate: string): Promise<void> => {
    const r = await sb.rpc('yt_own_dim_coverage_extend', {
      p_video: v.yt, p_set: conjunto, p_from: de, p_to: ate, p_site: c.site, p_video_id: v.id, p_channel: c.canal, p_source: 'analytics_api',
    })
    expect(r.error, JSON.stringify(r.error)).toBeNull()
  }
  const SETS = ['trafego', 'dispositivo', 'pais', 'inscrito'] as const
  const coberturaDe = async (v: Vid, conjunto: string): Promise<Array<[string, string]>> =>
    (await q(`select covered_from::text as a, covered_to::text as b from public.yt_own_video_coverage where youtube_video_id = $1 and metric_set = $2 order by covered_from`, [v.yt, conjunto]))
      .map(r => [String(r.a), String(r.b)])
  const dimsDe = async (v: Vid, kind?: string): Promise<Array<[string, string, string, number | null]>> =>
    (await q(`select day_pt::text as dia, dim_kind, dim_value, views from public.yt_own_video_dim_daily where youtube_video_id = $1 and ($2::text is null or dim_kind = $2) order by day_pt, dim_kind, dim_value`, [v.yt, kind ?? null]))
      .map(r => [String(r.dia), String(r.dim_kind), String(r.dim_value), r.views === null ? null : Number(r.views)])
  const tentDe = async (id: string, kind: string, escopo: 'video' | 'canal' = 'video'): Promise<Linha[]> =>
    q(`select outcome, http_status, error, attempts, attempt_day::text as attempt_day from public.yt_own_collection_attempts where scope_type = $1 and scope_id = $2 and kind = $3 order by attempt_day`, [escopo, id, kind])
  const prova = async (c: Cen, hoje: string, desde: string): Promise<Record<string, unknown>> => {
    const r = await sb.rpc('yt_own_dim_prova', { p_site: c.site, p_hoje: hoje, p_desde: desde }) as Rpc
    expect(r.error, JSON.stringify(r.error)).toBeNull()
    return r.data as Record<string, unknown>
  }

  /** Banco que não tem a função ou a tabela: o PostgREST de verdade responde o erro de "não existe". */
  function semSchema(o: { rpc?: string[]; from?: string[] }): SupabaseClient {
    return new Proxy(sb, {
      get(alvo, prop) {
        if (prop === 'rpc') return (fn: string, args?: Record<string, unknown>) => alvo.rpc(o.rpc?.includes(fn) ? `${fn}_ausente_zz` : fn, args)
        if (prop === 'from') return (tab: string) => alvo.from(o.from?.includes(tab) ? `${tab}_ausente_zz` : tab)
        const v: unknown = Reflect.get(alvo, prop, alvo)
        return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(alvo) : v
      },
    })
  }

  // ───────────────────────── os passos ─────────────────────────
  interface OpDim { hoje?: string; desde: string; ligadoEm?: string; supabase?: SupabaseClient }
  async function dim(c: Cen, o: OpDim): Promise<{ r: DimensoesResumo; ctx: DimensoesCtx }> {
    const ctx: DimensoesCtx = {
      supabase: o.supabase ?? sb, channels: [canalDe(c)], deadline: Date.now() + 120_000, falhas: [], tentativas: [],
      autorizados: new Set(), negados: new Set(), e11: { desde: o.desde, ligadoEm: o.ligadoEm ?? o.desde }, hoje: o.hoje ?? HOJE,
      token: async () => TOKEN,
    }
    const r = await passoDimensoes(ctx)
    return { r, ctx }
  }
  async function norm(c: Cen, supabase: SupabaseClient = sb): Promise<{ r: NormalizadoresResumo; falhas: string[] }> {
    const falhas: string[] = []
    const r = await passoNormalizadores({ supabase, channels: [canalDe(c)], deadline: Date.now() + 120_000, falhas, tentativas: [] })
    return { r, falhas }
  }
  async function criterios(c: Cen, o: { hoje?: string; desde: string; ligadoEm?: string; supabase?: SupabaseClient; desligados?: { dimensoes: boolean; normalizadores: boolean }; sites?: string[] }) {
    const falhas: string[] = []
    const res = await criteriosE11({
      supabase: o.supabase ?? sb, falhas, hoje: o.hoje ?? HOJE, e11: { desde: o.desde, ligadoEm: o.ligadoEm ?? o.desde },
      sites: o.sites ?? [c.site], desligados: o.desligados ?? { dimensoes: false, normalizadores: false },
    })
    return { falhas, res }
  }

  /** Um relatório do Reporting (linha + bruto gzip). `semBruto` não grava o blob. */
  async function relatorio(c: Cen, o: {
    tipo: string; dia: string; csv: string; criado?: string; status?: string; baixadoEm?: string; semBruto?: boolean; normalizado?: boolean; id?: string
  }): Promise<string> {
    const id = o.id ?? 'rep-' + randomUUID().slice(0, 12)
    const criado = o.criado ?? `${utcDay(new Date())}T01:00:00Z`
    await pg.query(`insert into public.yt_reporting_reports (report_id, site_id, job_id, channel_id, report_type_id, start_time, end_time, create_time, download_url, status, downloaded_at, normalized_at)
      values ($1, $2, 'job-e11', $3, $4, $5, $6, $7, 'https://exemplo.invalid/x', $8, $9, $10)`,
    [id, c.site, c.canal, o.tipo, `${o.dia}T07:00:00Z`, `${addDays(o.dia, 1)}T07:00:00Z`, criado, o.status ?? 'baixado', o.baixadoEm ?? criado, o.normalizado ? criado : null])
    if (!o.semBruto) await pg.query('insert into public.yt_reporting_report_blobs (report_id, site_id, csv_gz) values ($1, $2, $3)', [id, c.site, gzipSync(Buffer.from(o.csv))])
    return id
  }
  const relDe = async (id: string): Promise<Linha> =>
    (await q('select status, error, normalized_at, unmatched_video_ids from public.yt_reporting_reports where report_id = $1', [id]))[0]!
  const detalheDe = async (c: Cen): Promise<Linha[]> =>
    q(`select youtube_video_id, video_id, day_pt::text as dia, source_type, detail, views, watch_time_minutes, source_report_id from public.yt_own_video_traffic_detail_daily
       where channel_id = $1 order by day_pt, youtube_video_id, source_type, detail_hash`, [c.canal])
  const alcanceDe = async (c: Cen): Promise<Linha[]> =>
    q(`select youtube_video_id, video_id, day_pt::text as dia, traffic_source_type, device_type, operating_system, thumbnail_impressions, thumbnail_clicks_est, source_report_id
       from public.yt_own_video_reach_dim_daily where channel_id = $1 order by day_pt, youtube_video_id, traffic_source_type, device_type, operating_system`, [c.canal])

  /** Um canal com N vídeos e a `base` de cada um de `de` a `ate`. */
  async function canalComBase(nVideos: number, de: string, ate: string, uc?: string): Promise<{ c: Cen; vids: Vid[] }> {
    const c = await cenario(uc)
    const vids: Vid[] = []
    for (let i = 0; i < nVideos; i++) { const v = await video(c); vids.push(v); await cobrir(c, v, 'base', de, ate) }
    return { c, vids }
  }

  // ═════════════════════════ A. o passo "dimensões" ═════════════════════════
  describe('passo dimensões', () => {
    it('primeira execução (item 92; dados C-1, software C1): 3 vídeos, 1 com view num dia do meio da janela que NÃO é o último da base → os quatro conjuntos de todos até a base; país do ativo = UM intervalo que começa no começo da janela; prova 0', async () => {
      const desde = p(-12)
      const { c, vids } = await canalComBase(3, desde, p(-1))
      const [ativo, , ] = vids as [Vid, Vid, Vid]
      await diario(c, ativo, [[p(-6), 9]])
      instalarApi({ views: { [ativo.yt]: { [p(-6)]: 9 } } })

      const { r, ctx } = await dim(c, { desde })
      expect(ctx.falhas).toEqual([])
      expect(r).toMatchObject({ videos_com_view: 1, conjuntos_cobertos_sem_api: 8, consultas: 4, consultas_cortadas: 0, base_ate: p(-1) })
      // a API: três famílias com a janela inteira, país só no dia com view
      expect(chamadas).toHaveLength(4)
      for (const f of ['traffic_source', 'device_os', 'subscribed_status'] as const) {
        expect(porFamilia(f).map(x => [x.inicio, x.fim])).toEqual([[desde, p(-1)]])
      }
      expect(porFamilia('country').map(x => [x.inicio, x.fim])).toEqual([[p(-6), p(-6)]])
      // todos os vídeos têm os quatro conjuntos até menor(hoje, base); o do país do ativo é um intervalo só, do começo da janela
      for (const v of vids) for (const s of SETS) expect(await coberturaDe(v, s), `${v.yt}/${s}`).toEqual([[desde, p(-1)]])
      expect(await prova(c, HOJE, desde)).toMatchObject({ faltando_cobertura: 0, videos_com_base: 3, videos_base_antes_do_inicio: 0, base_ate: p(-1) })
      // o dado: quatro linhas, no dia da view; os vídeos parados não ganham linha alguma
      expect(await dimsDe(ativo)).toEqual([
        [p(-6), 'country', 'BR', 9], [p(-6), 'device_os', 'MOBILE|ANDROID', 9], [p(-6), 'subscribed_status', 'SUBSCRIBED', 9], [p(-6), 'traffic_source', 'YT_SEARCH', 9],
      ])
      expect(await n('select count(*) as n from public.yt_own_video_dim_daily where channel_id = $1', [c.canal])).toBe(4)
      // desfecho explícito por vídeo e por canal; o canal foi marcado autorizado
      expect(await tentDe(ativo.yt, 'dimensoes')).toEqual([expect.objectContaining({ outcome: 'ok', attempts: 1 })])
      expect(await tentDe(c.canal, 'dimensoes', 'canal')).toEqual([expect.objectContaining({ outcome: 'ok' })])
      expect(ctx.autorizados?.has(c.canal)).toBe(true)
      // o critério fecha o ciclo: com a prova inteira, nenhuma nota
      const cr = await criterios(c, { desde, ligadoEm: p(-8) })
      expect(cr.falhas).toEqual([])
      expect(cr.res.avaliados).toEqual(['dimensoes', 'normalizadores'])
    })

    it('view só em X, três execuções em dias seguidos sem view nova (software C1): a cobertura do país chega à base em cada uma, a prova dá 0 nas três, e a API recebe 0 consultas na execução em que X já saiu da janela', async () => {
      const desde = p(-20)
      const H0 = p(-6)
      const X = p(-15) // = H0 − 9: ainda dentro da janela de H0 + 1 (hoje − 10 = H0 − 9), fora da de H0 + 2
      const c = await cenario(); const v = await video(c)
      await diario(c, v, [[X, 5]])
      const sim: Sim = { views: { [v.yt]: { [X]: 5 } } }
      const rodar = async (hoje: string) => {
        await cobrir(c, v, 'base', p(-20), addDays(hoje, -1))
        instalarApi(sim)
        const { r, ctx } = await dim(c, { desde, hoje })
        expect(ctx.falhas, hoje).toEqual([])
        expect(await coberturaDe(v, 'pais'), hoje).toEqual([[desde, addDays(hoje, -1)]])
        expect(await prova(c, hoje, desde), hoje).toMatchObject({ faltando_cobertura: 0, videos_com_base: 1 })
        return r
      }
      const r1 = await rodar(H0)
      expect(r1.consultas).toBe(4)
      const r2 = await rodar(addDays(H0, 1))
      expect(r2.consultas).toBe(4) // X ainda é revisto: faz parte da janela de 10 dias
      expect(porFamilia('country').map(x => x.inicio)).toEqual([X])
      const r3 = await rodar(addDays(H0, 2))
      expect(r3.consultas).toBe(0)
      expect(chamadas).toHaveLength(0)
      expect(r3.videos_com_view).toBe(0)
      expect(r3.conjuntos_cobertos_sem_api).toBeGreaterThan(0) // a cobertura andou sem API, pelo banco
      // a linha de X continua lá (o YouTube não a reenvia e o dia não foi apagado)
      expect(await dimsDe(v, 'country')).toEqual([[X, 'country', 'BR', 5]])
    })

    it('a fórmula da janela do código e a do banco coincidem (vídeo com cobertura de 20 dias atrás): a API recebe o `de` do código, e o `cover_idle` apaga a dimensão exatamente a partir dele', async () => {
      const desde = p(-40)
      const c = await cenario(); const ativo = await video(c); const parado = await video(c)
      for (const v of [ativo, parado]) {
        await cobrir(c, v, 'base', p(-40), p(-1))
        for (const s of SETS) await cobrir(c, v, s, p(-30), p(-20))
      }
      await diario(c, ativo, [[p(-15), 6]])
      // dimensão velha do parado: uma no último dia coberto (p(-20), dentro da janela do banco) e uma ANTES (p(-21), fora dela)
      await sb.rpc('yt_own_dim_apply', { p_video: parado.yt, p_kind: 'traffic_source', p_from: p(-30), p_to: p(-20), p_site: c.site, p_video_id: parado.id, p_channel: c.canal, p_rows: [] })
      await pg.query(`insert into public.yt_own_video_dim_daily (youtube_video_id, day_pt, dim_kind, dim_value, site_id, video_id, channel_id, views, source, collected_at, metric_version)
        select $1, d, 'traffic_source', 'YT_SEARCH', $2, $3, $4, 2, 'analytics_api', now(), $5 from unnest($6::date[]) as d`,
      [parado.yt, c.site, parado.id, c.canal, metricVersion(p(-20)), [p(-21), p(-20)]])
      const janela = janelaDoConjunto({ desde, hoje: HOJE, ultimoCoberto: p(-20), baseAte: p(-1) })
      expect(janela).toEqual({ de: p(-20), ate: p(-1) })

      instalarApi({ views: { [ativo.yt]: { [p(-15)]: 6 } } })
      const { ctx } = await dim(c, { desde })
      expect(ctx.falhas).toEqual([])
      for (const f of ['traffic_source', 'device_os', 'subscribed_status'] as const) expect(porFamilia(f).map(x => [x.inicio, x.fim]), f).toEqual([[janela!.de, janela!.ate]])
      // o vídeo parado: a dimensão antes da janela fica; a do primeiro dia da janela (diário sem view) sai
      expect((await dimsDe(parado, 'traffic_source')).map(l => l[0])).toEqual([p(-21)])
      for (const s of SETS) expect(await coberturaDe(parado, s)).toEqual([[p(-30), p(-1)]])
    })

    it('dois dias depois sem cron: sem buraco na cobertura, e o dia que o cron pulou entra', async () => {
      const desde = p(-30)
      const c = await cenario(); const v = await video(c)
      await diario(c, v, [[p(-12), 4]])
      const sim: Sim = { views: { [v.yt]: { [p(-12)]: 4 } } }
      await cobrir(c, v, 'base', desde, p(-10))
      instalarApi(sim)
      const a = await dim(c, { desde, hoje: p(-9) })
      expect(a.ctx.falhas).toEqual([])
      expect(await coberturaDe(v, 'pais')).toEqual([[desde, p(-10)]])
      // o cron não rodou em p(-8); o dia p(-9) e p(-8) ganham view; dois dias depois ele volta
      await diario(c, v, [[p(-9), 3], [p(-8), 2]])
      sim.views[v.yt] = { [p(-12)]: 4, [p(-9)]: 3, [p(-8)]: 2 }
      await cobrir(c, v, 'base', p(-9), p(-8))
      instalarApi(sim)
      const b = await dim(c, { desde, hoje: p(-7) })
      expect(b.ctx.falhas).toEqual([])
      for (const s of SETS) expect(await coberturaDe(v, s), s).toEqual([[desde, p(-8)]])
      expect((await dimsDe(v, 'country')).map(l => l[0])).toEqual([p(-12), p(-9), p(-8)])
      expect(await prova(c, p(-7), desde)).toMatchObject({ faltando_cobertura: 0 })
    })

    it('reexecução no mesmo dia (idempotência): o mesmo estado, sem linha duplicada nem soma dobrada; uma linha de tentativa por vídeo e dia (o contador `attempts` sobe, por desenho)', async () => {
      const desde = p(-12)
      const { c, vids } = await canalComBase(2, desde, p(-1))
      const [ativo] = vids as [Vid, Vid]
      await diario(c, ativo, [[p(-6), 9]])
      instalarApi({ views: { [ativo.yt]: { [p(-6)]: 9 } } })
      const foto = async () => ({
        dims: await dimsDe(ativo),
        cob: await Promise.all(SETS.map(s => coberturaDe(ativo, s))),
        soma: await n('select coalesce(sum(views),0) as n from public.yt_own_video_dim_daily where youtube_video_id = $1 and dim_kind = $2', [ativo.yt, 'traffic_source']),
        linhas: await n('select count(*) as n from public.yt_own_video_dim_daily where channel_id = $1', [c.canal]),
      })
      await dim(c, { desde })
      const antes = await foto()
      const seg = await dim(c, { desde })
      expect(seg.ctx.falhas).toEqual([])
      expect(await foto()).toEqual(antes)
      expect(antes.soma).toBe(9)
      const t = await tentDe(ativo.yt, 'dimensoes')
      expect(t).toHaveLength(1)
      expect(t[0]).toMatchObject({ outcome: 'ok', attempts: 2 })
      expect(await prova(c, HOJE, desde)).toMatchObject({ faltando_cobertura: 0 })
    })

    it('gravação esparsa (item 85): linha com todas as métricas zeradas ou nulas, nas três tabelas e do site do teste, = 0 (a API devolve linha de zeros; o CSV também)', async () => {
      const desde = p(-12)
      const { c, vids } = await canalComBase(1, desde, p(-1), UC_REAL)
      const [v] = vids as [Vid]
      await diario(c, v, [[p(-6), 9]])
      instalarApi({ views: { [v.yt]: { [p(-6)]: 9 } }, zeros: true })
      const d1 = await dim(c, { desde })
      expect(d1.ctx.falhas).toEqual([])
      const dia = p(-5)
      await relatorio(c, { tipo: TIPO_DETALHE, dia, csv: csvTrafego(UC_REAL, dia, [{ video: v.yt, origem: '4', detalhe: 'termo', views: 5 }, { video: v.yt, origem: '3', views: 0, min: 0 }]) })
      await relatorio(c, { tipo: TIPO_ALCANCE, dia, csv: csvAlcance(UC_REAL, dia, [{ video: v.yt, imp: 50 }, { video: v.yt, imp: 0, aparelho: '102' }]) })
      const nr = await norm(c)
      expect(nr.falhas).toEqual([])
      expect(nr.r.por_tipo.detalhe.descartadas_zeradas + nr.r.por_tipo.alcance_dim.descartadas_zeradas).toBeGreaterThanOrEqual(2)
      // o controle: as três tabelas TÊM dado do teste (o zero não é por tabela vazia)
      expect(await n('select count(*) as n from public.yt_own_video_dim_daily where site_id = $1', [c.site])).toBe(4)
      expect(await n('select count(*) as n from public.yt_own_video_traffic_detail_daily where site_id = $1', [c.site])).toBe(1)
      expect(await n('select count(*) as n from public.yt_own_video_reach_dim_daily where site_id = $1', [c.site])).toBe(1)
      expect(await n(`select count(*) as n from public.yt_own_video_dim_daily where site_id = $1 and coalesce(views,0) = 0 and coalesce(engaged_views,0) = 0 and coalesce(watch_time_minutes,0) = 0`, [c.site])).toBe(0)
      expect(await n(`select count(*) as n from public.yt_own_video_traffic_detail_daily where site_id = $1 and coalesce(views,0) = 0 and coalesce(watch_time_minutes,0) = 0`, [c.site])).toBe(0)
      expect(await n(`select count(*) as n from public.yt_own_video_reach_dim_daily where site_id = $1 and coalesce(thumbnail_impressions,0) = 0 and coalesce(thumbnail_clicks_est,0) = 0`, [c.site])).toBe(0)
    })
  })

  // ═════════════════════════ B. o passo "normalizadores" ═════════════════════════
  describe('passo normalizadores', () => {
    it('normaliza a fila semeada com os brutos reais e zera os pendentes (item 84: a consulta C1 dá 0)', async () => {
      const c = await cenario(UC_REAL)
      const realT = comVideosProprios(linhasDoDia(realTrafego, '20260925'))
      const realA = comVideosProprios(realAlcance)
      const pareado = await video(c, { yt: realT.mapa.get('S1iMQVIOFL4')! })
      const baixado = `${utcDay(new Date(Date.now() - 3 * 86_400_000))}T01:00:00Z`
      const csvT = realT.csv
      const csvA = realA.csv
      const rT = await relatorio(c, { tipo: TIPO_DETALHE, dia: '2026-09-25', csv: csvT, criado: baixado })
      const rA = await relatorio(c, { tipo: TIPO_ALCANCE, dia: '2026-09-30', csv: csvA, criado: baixado })
      expect(await prova(c, HOJE, p(-30))).toMatchObject({ pendentes_normalizar: 2 })

      const { r, falhas } = await norm(c)
      expect(falhas).toEqual([])
      const esperadoT = agregarTrafego(lerTrafego(csvT)).linhas
      const esperadoA = agregarAlcanceCombinado(lerAlcanceCombinado(csvA)).linhas
      expect(r.por_tipo.detalhe).toMatchObject({ normalizados: 1, erros: 0, superados: 0 })
      expect(r.por_tipo.alcance_dim).toMatchObject({ normalizados: 1, erros: 0, superados: 0 })
      expect(r.pendentes).toBe(0)
      expect(await prova(c, HOJE, p(-30))).toMatchObject({ pendentes_normalizar: 0, dias_dois_relatorios_detalhe: 0, dias_dois_relatorios_alcance: 0 })
      for (const id of [rT, rA]) expect((await relDe(id)).normalized_at).not.toBeNull()
      expect((await relDe(rT)).status).toBe('baixado')
      const det = await detalheDe(c)
      expect(det).toHaveLength(esperadoT.length)
      expect(det.every(l => l.source_report_id === rT)).toBe(true)
      expect((await alcanceDe(c))).toHaveLength(esperadoA.length)
      // o vídeo que existe ganha o par; os outros ficam sem par (video_id nulo) e o relatório guarda quais
      expect(det.filter(l => l.video_id !== null).map(l => l.youtube_video_id)).toEqual(det.filter(l => l.youtube_video_id === pareado.yt).map(l => l.youtube_video_id))
      expect(det.some(l => l.video_id === null)).toBe(true)
      expect((await relDe(rT)).unmatched_video_ids).not.toBeNull()
      // a cobertura do 'detalhe' e do 'alcance_dim' foi estendida (inclusive para os sem par)
      expect(await n(`select count(*) as n from public.yt_own_video_coverage where channel_id = $1 and metric_set = 'detalhe'`, [c.canal])).toBeGreaterThan(0)
      expect(await n(`select count(*) as n from public.yt_own_video_coverage where channel_id = $1 and metric_set = 'alcance_dim'`, [c.canal])).toBeGreaterThan(0)
      expect(await tentDe(c.canal, 'normalizador_trafego', 'canal')).toEqual([expect.objectContaining({ outcome: 'ok' })])
      expect(await tentDe(c.canal, 'normalizador_alcance_dim', 'canal')).toEqual([expect.objectContaining({ outcome: 'ok' })])
    })

    it('reexecução do passo no mesmo dia (idempotência): fila vazia, mesmas linhas, soma de views não dobra; refazer a fila (normalized_at nulo) dá o mesmo estado', async () => {
      const c = await cenario(UC_REAL)
      const realT = comVideosProprios(linhasDoDia(realTrafego, '20260925'))
      await video(c, { yt: realT.mapa.get('S1iMQVIOFL4')! })
      const rT = await relatorio(c, { tipo: TIPO_DETALHE, dia: '2026-09-25', csv: realT.csv })
      const foto = async () => (await detalheDe(c)).map(l => JSON.stringify(l))
      const soma = (): Promise<number> => n('select coalesce(sum(views),0) as n from public.yt_own_video_traffic_detail_daily where channel_id = $1', [c.canal])
      const a = await norm(c)
      expect(a.r.por_tipo.detalhe.normalizados).toBe(1)
      const antes = await foto(); const s0 = await soma()
      expect(s0).toBeGreaterThan(0)
      const b = await norm(c)
      expect(b.r.por_tipo.detalhe).toMatchObject({ normalizados: 0, vazios: 0 })
      expect(b.r.gravados).toBe(0)
      expect(await foto()).toEqual(antes)
      expect(await soma()).toBe(s0)
      await pg.query('update public.yt_reporting_reports set normalized_at = null where report_id = $1', [rT])
      const cReproc = await norm(c)
      expect(cReproc.falhas).toEqual([])
      expect(await foto()).toEqual(antes)
      expect(await soma()).toBe(s0)
      expect(await n('select count(distinct source_report_id) as n from public.yt_own_video_traffic_detail_daily where channel_id = $1', [c.canal])).toBe(1)
    })

    it('detalhe com emoji na posição 300 entra (dados I-4): o relatório é normalizado e não fica na fila; o texto cortado em 300 pontos de código, inteiro, e o hash do texto inteiro', async () => {
      const c = await cenario(); const v = await video(c)
      const dia = p(-3)
      const longo = 'a'.repeat(299) + '😀' + 'cauda que passa de 300'
      const id = await relatorio(c, { tipo: TIPO_DETALHE, dia, csv: csvTrafego(c.uc, dia, [{ video: v.yt, origem: '4', detalhe: longo, views: 7 }]) })
      const { r, falhas } = await norm(c)
      expect(falhas).toEqual([])
      expect(r.por_tipo.detalhe).toMatchObject({ normalizados: 1, erros: 0 })
      const rel = await relDe(id)
      expect(rel.normalized_at).not.toBeNull()
      expect(rel.status).toBe('baixado')
      const linhas = await detalheDe(c)
      expect(linhas).toHaveLength(1)
      const detail = String(linhas[0]!.detail)
      expect(Array.from(detail)).toHaveLength(300)
      expect(Array.from(detail).at(-1)).toBe('😀')
      expect(Buffer.from(detail, 'utf8').toString('utf8')).toBe(detail) // nenhum meio-par solto
      expect(await n('select count(*) as n from public.yt_own_video_traffic_detail_daily where channel_id = $1 and detail_hash = $2', [c.canal, sha256(longo)])).toBe(1)
      expect(await prova(c, HOJE, p(-30))).toMatchObject({ pendentes_normalizar: 0 })
    })

    it('relatório bruto SEM LINHAS (só o cabeçalho): é lido e vazio, apaga o dia do canal (OP-13), sai da fila e fica registrado como `vazios`, nunca como "não li"', async () => {
      const c = await cenario(); const v = await video(c)
      const dia = p(-4)
      const cheio = await relatorio(c, { tipo: TIPO_DETALHE, dia, csv: csvTrafego(c.uc, dia, [{ video: v.yt, detalhe: 'termo', views: 5 }]), criado: `${utcDay(new Date())}T01:00:00Z` })
      await norm(c)
      expect(await detalheDe(c)).toHaveLength(1)
      const vazio = await relatorio(c, { tipo: TIPO_DETALHE, dia, csv: csvTrafego(c.uc, dia, []), status: 'vazio', criado: `${utcDay(new Date())}T02:00:00Z` })
      const { r, falhas } = await norm(c)
      expect(falhas).toEqual([])
      expect(r.por_tipo.detalhe).toMatchObject({ vazios: 1, normalizados: 0, erros: 0 })
      expect((await relDe(vazio)).normalized_at).not.toBeNull()
      expect(await detalheDe(c)).toEqual([])
      expect(await tentDe(c.canal, 'normalizador_trafego', 'canal')).toEqual([expect.objectContaining({ outcome: 'ok' })])
      expect((await relDe(cheio)).status).toBe('baixado')
    })

    it('dia SEM relatório: nada na fila, nada gravado e nenhuma tentativa de normalizador (não há o que dizer); a prova não acende nota por isso, e o alarme de relatório que não chega é o do passo de relatórios', async () => {
      const c = await cenario(); await video(c)
      const { r, falhas } = await norm(c)
      expect(falhas).toEqual([])
      expect(r).toMatchObject({ gravados: 0, pendentes: 0, tentativas: {} })
      expect(r.por_tipo.detalhe).toMatchObject({ normalizados: 0, vazios: 0, erros: 0 })
      expect(await tentDe(c.canal, 'normalizador_trafego', 'canal')).toEqual([])
      expect(await tentDe(c.canal, 'normalizador_alcance_dim', 'canal')).toEqual([])
      const cr = await criterios(c, { desde: p(-30), ligadoEm: p(-20) })
      expect(cr.falhas.filter(f => f.startsWith('normalizadores:'))).toEqual([])
    })

    it('bruto ausente, CSV de outro canal e dia diferente do relatório: vermelho com o motivo escrito (relatório vira `erro` com código), sai da fila, nenhum dado gravado, e o texto do CSV nunca vai à nota', async () => {
      const c = await cenario(); const v = await video(c)
      const dia = p(-4)
      const semBruto = await relatorio(c, { tipo: TIPO_DETALHE, dia, csv: '', semBruto: true })
      const outroCanal = await relatorio(c, { tipo: TIPO_DETALHE, dia, csv: csvTrafego('UCoutroCanal0000000000000', dia, [{ video: v.yt, detalhe: SENTINELA, views: 3 }]) })
      const diaErrado = await relatorio(c, { tipo: TIPO_DETALHE, dia, csv: csvTrafego(c.uc, p(-9), [{ video: v.yt, detalhe: SENTINELA, views: 3 }]) })
      const { r, falhas } = await norm(c)
      expect(r.por_tipo.detalhe.erros).toBe(3)
      expect(falhas).toHaveLength(3)
      for (const id of [semBruto, outroCanal, diaErrado]) {
        const rel = await relDe(id)
        expect(rel.status, id).toBe('erro')
        expect(String(rel.error)).toMatch(/^[a-z_]+$/) // um CÓDIGO de catálogo, nunca texto
        expect(falhas.some(f => f.includes(id)), id).toBe(true)
      }
      expect(JSON.stringify(falhas)).not.toContain(SENTINELA)
      expect(await detalheDe(c)).toEqual([])
      expect(await tentDe(c.canal, 'normalizador_trafego', 'canal')).toEqual([expect.objectContaining({ outcome: 'erro_http', error: 'forma_inesperada' })])
    })
  })

  // ═════════════════════════ C. a API devolvendo o que não é "dado" ═════════════════════════
  describe('a API simulada devolve lista vazia, 403 de cota, 500 (e o resto da lista de falhas)', () => {
    async function umVideoComView(): Promise<{ c: Cen; v: Vid; desde: string; sim: Sim }> {
      const desde = p(-12)
      const { c, vids } = await canalComBase(2, desde, p(-1))
      const v = vids[0]!
      await diario(c, v, [[p(-6), 10]])
      return { c, v, desde, sim: { views: { [v.yt]: { [p(-6)]: 10 } } } }
    }
    const faltamQuatro = async (c: Cen, desde: string): Promise<void> => {
      expect(await prova(c, HOJE, desde)).toMatchObject({ faltando_cobertura: 4 })
      const cr = await criterios(c, { desde, ligadoEm: p(-8) }) // hoje ≥ ligadoEm + 3: a nota acende
      expect(cr.falhas.some(f => /^dimensões: 4 par\(es\) vídeo e conjunto sem cobertura até/.test(f)), JSON.stringify(cr.falhas)).toBe(true)
    }

    it('lista vazia (cabeçalho certo, `rows: []`): dado legítimo, o dia é coberto como LIDO e a tentativa diz `sem_dado_na_janela` (nunca `ok`); nenhuma linha de zero; o leitor mostra "zero ou abaixo do limiar" com o omitido, não "valor 0"', async () => {
      const { c, v, desde, sim } = await umVideoComView()
      instalarApi({ ...sim, resposta: q => json({ columnHeaders: [...(q.comDia ? [{ name: 'day' }] : []), ...Object.keys(FAMILIA_DE).find(k => FAMILIA_DE[k] === q.familia)!.split(',').map(name => ({ name })), { name: 'views' }, { name: 'estimatedMinutesWatched' }], rows: [] }) })
      const { r, ctx } = await dim(c, { desde })
      expect(ctx.falhas).toEqual([])
      expect(await tentDe(v.yt, 'dimensoes')).toEqual([expect.objectContaining({ outcome: 'sem_dado_na_janela', error: null })])
      expect(r.tentativas).toMatchObject({ sem_dado_na_janela: 1 })
      expect(await dimsDe(v)).toEqual([])
      for (const s of SETS) expect(await coberturaDe(v, s)).toEqual([[desde, p(-1)]])
      expect((await criterios(c, { desde, ligadoEm: p(-8) })).falhas).toEqual([])
      // o leitor: o dia tem 10 views no diário e nenhuma linha → abaixo do limiar (omitido 10), nunca um zero medido
      const edicao = await provarEdicao(c.site)
      const lido = await lerDimensoes(sb, { edicao, canalId: c.canal, hoje: HOJE, ytIds: [v.yt], de: p(-8), ate: p(-1), desde: { trafego: desde, dispositivo: desde, pais: desde, inscrito: desde, alcance_dim: desde } })
      if (lido.acesso !== 'ok') throw new Error('leitura negada')
      for (const conj of ['trafego', 'dispositivo', 'pais', 'inscrito'] as const) {
        const dia = lido.dado.conjuntos[conj].videos[0]!.dias.find(x => x.dia === p(-6))!
        const e = estadoDoDiaLido(dia)
        expect(e.omitido, conj).toBe(10)
        expect(e.de('qualquer'), conj).toEqual({ tipo: 'zero_ou_abaixo_do_limiar' })
      }
    })

    it('403 de COTA: o canal para na primeira chamada, nota escrita, tentativa `erro_http` com o código; nada é coberto nem gravado como zero; a prova sobe e o critério acende', async () => {
      const { c, v, desde, sim } = await umVideoComView()
      instalarApi({ ...sim, resposta: () => erroGoogle(403, 'quotaExceeded') })
      const { r, ctx } = await dim(c, { desde })
      expect(chamadas).toHaveLength(1)
      expect(r.consultas).toBe(1)
      expect(ctx.falhas).toContain('dimensões: cota da Analytics API esgotada')
      expect(await tentDe(v.yt, 'dimensoes')).toEqual([expect.objectContaining({ outcome: 'erro_http', http_status: 403, error: 'http_403_quotaExceeded' })])
      expect(await tentDe(c.canal, 'dimensoes', 'canal')).toEqual([expect.objectContaining({ outcome: 'erro_http', error: 'http_403_quotaExceeded' })])
      expect(await dimsDe(v)).toEqual([])
      for (const s of SETS) expect(await coberturaDe(v, s)).toEqual([])
      expect(JSON.stringify(ctx.falhas)).not.toContain('texto do Google')
      await faltamQuatro(c, desde)
    })

    it('500 do servidor: as quatro famílias tentam e falham, nota com o motivo em palavras, `erro_http` 500; nenhuma cobertura; a prova sobe e o critério acende', async () => {
      const { c, v, desde, sim } = await umVideoComView()
      instalarApi({ ...sim, resposta: () => erroGoogle(500) })
      const { ctx } = await dim(c, { desde })
      expect(chamadas).toHaveLength(4)
      expect(ctx.falhas.some(f => /1 de 1 vídeos com erro/.test(f)), JSON.stringify(ctx.falhas)).toBe(true)
      expect(await tentDe(v.yt, 'dimensoes')).toEqual([expect.objectContaining({ outcome: 'erro_http', http_status: 500, error: 'http_500' })])
      expect(await dimsDe(v)).toEqual([])
      // as três famílias com dia não cobrem nada; o país cobre só os dias ANTES do primeiro dia com view que falhou (sem view = sem origem)
      for (const s of ['trafego', 'dispositivo', 'inscrito'] as const) expect(await coberturaDe(v, s), s).toEqual([])
      expect(await coberturaDe(v, 'pais')).toEqual([[desde, p(-7)]])
      await faltamQuatro(c, desde)
    })

    it('401/403 de permissão: `sem_autorizacao`, o canal vai a `reautorizar` no banco, nada coberto; resposta com forma errada: `forma_inesperada`', async () => {
      const a = await umVideoComView()
      instalarApi({ ...a.sim, resposta: () => erroGoogle(403, 'insufficientPermissions') })
      const ra = await dim(a.c, { desde: a.desde })
      expect(await tentDe(a.v.yt, 'dimensoes')).toEqual([expect.objectContaining({ outcome: 'sem_autorizacao', http_status: 403 })])
      expect((await q('select collection_status from public.youtube_channels where id = $1', [a.c.canal]))[0]!.collection_status).toBe('reautorizar')
      expect(ra.ctx.negados?.has(a.c.canal)).toBe(true)
      for (const s of SETS) expect(await coberturaDe(a.v, s)).toEqual([])

      const b = await umVideoComView()
      instalarApi({ ...b.sim, resposta: () => json({ qualquer: 'coisa' }) })
      await dim(b.c, { desde: b.desde })
      expect(await tentDe(b.v.yt, 'dimensoes')).toEqual([expect.objectContaining({ outcome: 'erro_http', error: 'forma_inesperada' })])
      for (const s of ['trafego', 'dispositivo', 'inscrito'] as const) expect(await coberturaDe(b.v, s), s).toEqual([])
      expect(await coberturaDe(b.v, 'pais')).toEqual([[b.desde, p(-7)]]) // só os dias anteriores ao que falhou
      expect(await dimsDe(b.v)).toEqual([])
    })

    it('sem tempo (prazo do passo abaixo da folga para começar): nada é chamado nem coberto, tentativa do canal `nao_alcancado_orcamento`, `pendentes` 1; a falta de cobertura aparece na prova depois (não fica verde)', async () => {
      const { c, v, desde, sim } = await umVideoComView()
      instalarApi(sim)
      const ctx: DimensoesCtx = {
        supabase: sb, channels: [canalDe(c)], deadline: Date.now() + 1_000, falhas: [], tentativas: [], autorizados: new Set(), negados: new Set(),
        e11: { desde, ligadoEm: p(-8) }, hoje: HOJE, token: async () => TOKEN,
      }
      const r = await passoDimensoes(ctx)
      expect(chamadas).toHaveLength(0)
      expect(r.pendentes).toBe(1)
      expect(await tentDe(c.canal, 'dimensoes', 'canal')).toEqual([expect.objectContaining({ outcome: 'nao_alcancado_orcamento' })])
      for (const s of SETS) expect(await coberturaDe(v, s)).toEqual([])
      expect(await prova(c, HOJE, desde)).toMatchObject({ faltando_cobertura: 8 }) // os dois vídeos × quatro conjuntos: nem o parado andou
    })

    it('400 em `engagedViews`: a repetição sem a métrica grava as linhas (engaged nulo, nunca zero) e a execução fica vermelha com a nota', async () => {
      const { c, v, desde, sim } = await umVideoComView()
      instalarApi({ ...sim, resposta: q => (q.engaged ? erroGoogle(400, 'badRequest') : null) })
      const { r, ctx } = await dim(c, { desde })
      expect(r.estendidas_recusadas).toBe(4) // uma por consulta que a API recusou
      expect(ctx.falhas.some(f => f.includes('recusou as métricas estendidas'))).toBe(true)
      expect(chamadas.length).toBe(8) // 4 famílias × (a recusada + a repetida)
      expect(await dimsDe(v)).toHaveLength(4)
      expect(await n('select count(*) as n from public.yt_own_video_dim_daily where youtube_video_id = $1 and engaged_views is null', [v.yt])).toBe(4)
    })
  })

  // ═════════════════════════ D. passo desligado ═════════════════════════
  describe('dimensão desligada', () => {
    it('`YT_OWN_STEPS_OFF=dimensoes`: o passo não chama a API nem o banco, devolve `desligado: true` (nunca "ok"), não registra tentativa; o critério devolve o passo em `desligados` e não o avalia; sem a flag, o mesmo canal roda', async () => {
      const desde = p(-12)
      const { c, vids } = await canalComBase(1, desde, p(-1))
      const v = vids[0]!
      await diario(c, v, [[p(-6), 9]])
      const sim: Sim = { views: { [v.yt]: { [p(-6)]: 9 } } }

      process.env.YT_OWN_STEPS_OFF = 'dimensoes'
      instalarApi(sim)
      const off = await dim(c, { desde })
      expect(off.r.desligado).toBe(true)
      expect(off.r).toMatchObject({ gravados: 0, consultas: 0, tentativas: {} })
      expect(chamadas).toHaveLength(0)
      expect(await tentDe(c.canal, 'dimensoes', 'canal')).toEqual([])
      for (const s of SETS) expect(await coberturaDe(v, s)).toEqual([])
      const crOff = await criterios(c, { desde, ligadoEm: p(-8), desligados: { dimensoes: true, normalizadores: false } })
      expect(crOff.res.desligados).toEqual(['dimensoes'])
      expect(crOff.res.avaliados).toEqual(['normalizadores'])
      expect(crOff.falhas.filter(f => f.startsWith('dimensões:'))).toEqual([]) // desligado não acende nota de cobertura: a nota é a do contador de desligado
      const crAmbos = await criterios(c, { desde, desligados: { dimensoes: true, normalizadores: true } })
      expect(crAmbos.res).toMatchObject({ avaliados: [], desligados: ['dimensoes', 'normalizadores'] })

      delete process.env.YT_OWN_STEPS_OFF // "invocação sem a flag": o padrão é LIGADO
      instalarApi(sim)
      const on = await dim(c, { desde })
      expect(on.r.desligado).toBeUndefined()
      expect(chamadas.length).toBe(4)
      expect(await coberturaDe(v, 'pais')).toEqual([[desde, p(-1)]])
    })

    it('`normalizadores` desligado: a fila fica intacta (normalized_at nulo), `desligado: true`, sem tentativa; ligado, normaliza', async () => {
      const c = await cenario(); const v = await video(c)
      const dia = p(-3)
      const id = await relatorio(c, { tipo: TIPO_DETALHE, dia, csv: csvTrafego(c.uc, dia, [{ video: v.yt, detalhe: 'x', views: 2 }]) })
      process.env.YT_OWN_STEPS_OFF = 'normalizadores'
      const off = await norm(c)
      expect(off.r.desligado).toBe(true)
      expect((await relDe(id)).normalized_at).toBeNull()
      expect(await tentDe(c.canal, 'normalizador_trafego', 'canal')).toEqual([])
      delete process.env.YT_OWN_STEPS_OFF
      const on = await norm(c)
      expect(on.r.desligado).toBeUndefined()
      expect((await relDe(id)).normalized_at).not.toBeNull()
    })
  })

  // ═════════════════════════ E. tabela ou função ausente ═════════════════════════
  describe('schema ausente (o PostgREST de verdade responde que a função ou a tabela não existe)', () => {
    it('sem `yt_own_dim_prova`: nota "schema_ausente: MG7", tentativa do canal `schema_ausente`, a API não é chamada; sem a cobertura também: a nota aponta a MG14', async () => {
      const desde = p(-12)
      const { c, vids } = await canalComBase(1, desde, p(-1))
      await diario(c, vids[0]!, [[p(-6), 9]])
      instalarApi({ views: { [vids[0]!.yt]: { [p(-6)]: 9 } } })
      const a = await dim(c, { desde, supabase: semSchema({ rpc: ['yt_own_dim_prova'] }) })
      expect(a.ctx.falhas).toEqual(['schema_ausente: MG7 não aplicada (yt_own_dim_prova)'])
      expect(await tentDe(c.canal, 'dimensoes', 'canal')).toEqual([expect.objectContaining({ outcome: 'schema_ausente' })])
      expect(chamadas).toHaveLength(0)
      const b = await dim(c, { desde, supabase: semSchema({ rpc: ['yt_own_dim_prova'], from: ['yt_own_video_coverage'] }) })
      expect(b.ctx.falhas).toEqual(['schema_ausente: MG14 não aplicada (yt_own_video_coverage)'])
      expect(chamadas).toHaveLength(0)
    })

    it('`yt_own_dim_apply` some no meio: tentativa do vídeo e do canal `schema_ausente`, nota, nada coberto como zero; a prova sobe', async () => {
      const desde = p(-12)
      const { c, vids } = await canalComBase(1, desde, p(-1))
      const v = vids[0]!
      await diario(c, v, [[p(-6), 9]])
      instalarApi({ views: { [v.yt]: { [p(-6)]: 9 } } })
      const { ctx } = await dim(c, { desde, supabase: semSchema({ rpc: ['yt_own_dim_apply'] }) })
      expect(ctx.falhas).toContain('schema_ausente: yt_own_dim_apply')
      expect(await tentDe(v.yt, 'dimensoes')).toEqual([expect.objectContaining({ outcome: 'schema_ausente' })])
      expect(await tentDe(c.canal, 'dimensoes', 'canal')).toEqual([expect.objectContaining({ outcome: 'schema_ausente' })])
      for (const s of SETS) expect(await coberturaDe(v, s)).toEqual([])
      expect(await dimsDe(v)).toEqual([])
      expect(await prova(c, HOJE, desde)).toMatchObject({ faltando_cobertura: 4 })
    })

    it('normalizadores sem `yt_own_traffic_detail_apply`: para, relatório fica na fila (normalized_at nulo), nota escrita, tentativa `schema_ausente`', async () => {
      const c = await cenario(); const v = await video(c)
      const dia = p(-3)
      const id = await relatorio(c, { tipo: TIPO_DETALHE, dia, csv: csvTrafego(c.uc, dia, [{ video: v.yt, detalhe: 'x', views: 2 }]) })
      const { r, falhas } = await norm(c, semSchema({ rpc: ['yt_own_traffic_detail_apply'] }))
      expect(falhas).toContain('schema_ausente: yt_own_traffic_detail_apply')
      expect(r.pendentes).toBe(1)
      expect((await relDe(id)).normalized_at).toBeNull()
      expect(await detalheDe(c)).toEqual([])
      expect(await tentDe(c.canal, 'normalizador_trafego', 'canal')).toEqual([expect.objectContaining({ outcome: 'schema_ausente' })])
    })

    it('o critério sem a prova: "prova não avaliada" escrita (MG7 ou MG14), nunca zero nem verde; `avaliados` vazio', async () => {
      const c = await cenario(); await video(c)
      const a = await criterios(c, { desde: p(-30), supabase: semSchema({ rpc: ['yt_own_dim_prova'] }) })
      expect(a.falhas).toEqual(['dimensões: prova não avaliada (migration MG7 não aplicada: falta a função yt_own_dim_prova)'])
      expect(a.res.avaliados).toEqual([])
      expect(a.res.provas[c.site]).toBeNull()
      const b = await criterios(c, { desde: p(-30), supabase: semSchema({ rpc: ['yt_own_dim_prova'], from: ['yt_own_video_coverage'] }) })
      expect(b.falhas).toEqual(['dimensões: prova não avaliada (migration MG14 não aplicada: falta a tabela yt_own_video_coverage)'])
    })

    it('o leitor sem a tabela de dimensões: estado `schema_ausente` e NENHUM vídeo/dia (ausente não vira zero)', async () => {
      const c = await cenario(); const v = await video(c)
      const edicao = await provarEdicao(c.site)
      const lido = await lerDimensoes(semSchema({ from: ['yt_own_video_dim_daily'] }), { edicao, canalId: c.canal, hoje: HOJE, ytIds: [v.yt], de: p(-5), ate: p(-1) })
      if (lido.acesso !== 'ok') throw new Error('leitura negada')
      for (const conj of ['trafego', 'dispositivo', 'pais', 'inscrito'] as const) {
        expect(lido.dado.conjuntos[conj].estado).toEqual({ tipo: 'schema_ausente' })
        expect(lido.dado.conjuntos[conj].videos).toEqual([])
      }
    })
  })

  // ═════════════════════════ F. critérios contra a função real ═════════════════════════
  describe('critérios contra `yt_own_dim_prova` (R9): para cada número, uma semente que acende e uma que não', () => {
    const DESDE = p(-30)
    const LIGADO_ANTIGO = p(-12) // hoje ≥ ligadoEm + 5: as duas carências já passaram
    const notas = (falhas: string[], prefixo: string): string[] => falhas.filter(f => f.startsWith(prefixo))

    it('faltando_cobertura: acende com base e sem dimensão; não acende coberta até menor(hoje − 4, base); nem dentro da carência de 3 dias do início', async () => {
      const { c, vids } = await canalComBase(1, DESDE, p(-1)); const v = vids[0]!
      const luz = await criterios(c, { desde: DESDE, ligadoEm: LIGADO_ANTIGO })
      expect(luz.falhas).toEqual([`dimensões: 4 par(es) vídeo e conjunto sem cobertura até ${p(-4).slice(8, 10)}/${p(-4).slice(5, 7)} (origem, aparelho, país ou inscrito)`])
      const carencia = await criterios(c, { desde: DESDE, ligadoEm: p(-1) })
      expect(carencia.falhas).toEqual([])
      expect(CARENCIA_COBERTURA_DIAS).toBe(3)
      for (const s of SETS) await cobrir(c, v, s, DESDE, p(-4))
      expect((await criterios(c, { desde: DESDE, ligadoEm: LIGADO_ANTIGO })).falhas).toEqual([])
    })

    it('sem vídeo com base (videos_com_base 0 e videos_sem_base > 0): acende "nenhum vídeo com cobertura do diário"; não acende com base em algum vídeo', async () => {
      const c = await cenario(); const v = await video(c)
      const luz = await criterios(c, { desde: DESDE, ligadoEm: LIGADO_ANTIGO })
      expect(luz.falhas).toEqual(['dimensões: nenhum vídeo com cobertura do diário (base): confira se a dieta (E6 P2) está em produção'])
      await cobrir(c, v, 'base', DESDE, p(-1))
      for (const s of SETS) await cobrir(c, v, s, DESDE, p(-1))
      expect((await criterios(c, { desde: DESDE, ligadoEm: LIGADO_ANTIGO })).falhas).toEqual([])
    })

    it('base_ate parada (< hoje − 4): acende "parou em dd/mm" e só ela (a cobertura chega à base); não acende com a base de ontem; vídeo com base ANTES do início não acende nada', async () => {
      const { c, vids } = await canalComBase(1, DESDE, p(-12)); const v = vids[0]!
      for (const s of SETS) await cobrir(c, v, s, DESDE, p(-12))
      const luz = await criterios(c, { desde: DESDE, ligadoEm: LIGADO_ANTIGO })
      expect(luz.falhas).toEqual([`dimensões: a cobertura do diário (base) parou em ${p(-12).slice(8, 10)}/${p(-12).slice(5, 7)} no canal mais atrasado`])
      await cobrir(c, v, 'base', p(-11), p(-2)); for (const s of SETS) await cobrir(c, v, s, p(-11), p(-2))
      expect((await criterios(c, { desde: DESDE, ligadoEm: LIGADO_ANTIGO })).falhas).toEqual([])
      // base inteira ANTES do início: vai em `videos_base_antes_do_inicio`, fora de faltando_cobertura, e a nota de "base parada" é a única
      const velho = await canalComBase(1, p(-90), p(-80))
      const antes = await criterios(velho.c, { desde: DESDE, ligadoEm: LIGADO_ANTIGO })
      expect((await prova(velho.c, HOJE, DESDE))).toMatchObject({ videos_base_antes_do_inicio: 1, faltando_cobertura: 0 })
      expect(antes.falhas).toEqual([`dimensões: a cobertura do diário (base) parou em ${p(-80).slice(8, 10)}/${p(-80).slice(5, 7)} no canal mais atrasado`])
    })

    it('dias_dois_relatorios_detalhe e _alcance: acende com duas linhas de relatórios diferentes no mesmo (canal, dia); não acende com uma só', async () => {
      const { c, vids } = await canalComBase(1, DESDE, p(-1)); const v = vids[0]!
      for (const s of SETS) await cobrir(c, v, s, DESDE, p(-1))
      const ins = async (dia: string, texto: string, rep: string): Promise<void> => {
        await pg.query(`insert into public.yt_own_video_traffic_detail_daily (youtube_video_id, day_pt, source_type, detail, detail_hash, site_id, channel_id, views, source_report_id, report_create_time, metric_version)
          values ($1, $2, '4', $3, $4, $5, $6, 1, $7, now(), 'v')`, [v.yt, dia, texto, sha256(texto), c.site, c.canal, rep])
      }
      await ins(p(-5), 'a', 'r1')
      expect((await criterios(c, { desde: DESDE, ligadoEm: LIGADO_ANTIGO })).falhas).toEqual([])
      await ins(p(-5), 'b', 'r2')
      expect((await criterios(c, { desde: DESDE, ligadoEm: LIGADO_ANTIGO })).falhas).toEqual(['normalizadores: 1 dia(s) com linhas de dois relatórios (item 249)'])
      await pg.query(`insert into public.yt_own_video_reach_dim_daily (youtube_video_id, day_pt, traffic_source_type, device_type, operating_system, site_id, channel_id, thumbnail_impressions, source_report_id, report_create_time, metric_version)
        values ($1, $2, '1', 'A', 'B', $3, $4, 5, 'r1', now(), 'v'), ($1, $2, '1', 'C', 'D', $3, $4, 5, 'r2', now(), 'v')`, [v.yt, p(-6), c.site, c.canal])
      expect((await criterios(c, { desde: DESDE, ligadoEm: LIGADO_ANTIGO })).falhas).toEqual(['normalizadores: 2 dia(s) com linhas de dois relatórios (item 249)'])
    })

    it('pendentes_normalizar: acende com relatório baixado há 3 dias sem normalizar (depois da carência de 5 dias do início); não acende com o de 1 dia, nem dentro da carência', async () => {
      const c = await cenario(); const v = await video(c)
      await cobrir(c, v, 'base', DESDE, p(-1)); for (const s of SETS) await cobrir(c, v, s, DESDE, p(-1))
      const antigo = `${utcDay(new Date(Date.now() - 3 * 86_400_000))}T00:00:00Z`
      const recente = `${utcDay(new Date(Date.now() - 86_400_000))}T00:00:00Z`
      await relatorio(c, { tipo: TIPO_DETALHE, dia: p(-10), csv: csvTrafego(c.uc, p(-10), []), criado: recente })
      expect((await criterios(c, { desde: DESDE, ligadoEm: LIGADO_ANTIGO })).falhas).toEqual([])
      await relatorio(c, { tipo: TIPO_ALCANCE, dia: p(-11), csv: csvAlcance(c.uc, p(-11), []), criado: antigo })
      expect((await criterios(c, { desde: DESDE, ligadoEm: LIGADO_ANTIGO })).falhas).toEqual(['normalizadores: 1 relatório(s) baixado(s) há mais de 2 dias sem normalizar'])
      expect(CARENCIA_NORMALIZAR_DIAS).toBe(5)
      expect((await criterios(c, { desde: DESDE, ligadoEm: p(-2) })).falhas).toEqual([]) // dentro da carência
    })

    it('site nulo, vazio ou sem lista = "prova não avaliada" escrita e `avaliados` vazio (nunca verde); data de hoje ou configuração inválida também', async () => {
      const c = await cenario(); await video(c)
      const base = { desde: DESDE, ligadoEm: LIGADO_ANTIGO }
      const nulo = await criterios(c, { ...base, sites: [null as never] })
      expect(nulo.falhas).toEqual(['dimensões: prova não avaliada (site sem id)'])
      expect(nulo.res.avaliados).toEqual([])
      const vazio = await criterios(c, { ...base, sites: [] })
      expect(vazio.falhas).toEqual(['dimensões: prova não avaliada (nenhum site com coleta ligada para avaliar)'])
      expect(vazio.res.avaliados).toEqual([])
      expect((await criterios(c, { ...base, hoje: '2026-13-45' })).falhas).toEqual(['dimensões: prova não avaliada (data de hoje inválida)'])
      expect(notas((await criterios(c, { desde: p(-1), ligadoEm: p(-5) })).falhas, 'dimensões: prova não avaliada')).toHaveLength(1)
    })
  })

  // ═════════════════════════ G. o leitor contra o banco ═════════════════════════
  describe('leitor (software I6): os nomes de tabela e de coluna que o banco falso aceitaria errados', () => {
    it('lerDimensoes devolve os estados: valor; zero medido e abaixo do limiar com `omitido`; não medido antes do início; `views` nulo no diário e buraco na `base` = base não medida; linha com `views` nulo = valor nulo, nunca zero', async () => {
      const desde = p(-8)
      const c = await cenario(); const v = await video(c)
      // a base cobre p(-9)..p(-6) e p(-4)..p(-1): o buraco é o dia p(-5)
      await cobrir(c, v, 'base', p(-9), p(-6)); await cobrir(c, v, 'base', p(-4), p(-1))
      await diario(c, v, [[p(-5), 10], [p(-4), 10], [p(-3), null], [p(-2), 4]])
      for (const s of SETS) await cobrir(c, v, s, desde, p(-1))
      const apply = async (kind: string, rows: Linha[]): Promise<void> => {
        const r = await sb.rpc('yt_own_dim_apply', { p_video: v.yt, p_kind: kind, p_from: desde, p_to: p(-1), p_rows: rows, p_site: c.site, p_video_id: v.id, p_channel: c.canal }) as Rpc
        expect(r.error, JSON.stringify(r.error)).toBeNull()
      }
      const mv = (dia: string): string => metricVersion(dia)
      await apply('traffic_source', [
        { day_pt: p(-4), dim_value: 'YT_SEARCH', views: 10, watch_time_minutes: 5, metric_version: mv(p(-4)) },
        { day_pt: p(-2), dim_value: 'YT_SEARCH', views: 3, metric_version: mv(p(-2)) },
      ])
      await apply('device_os', [{ day_pt: p(-4), dim_value: 'MOBILE|ANDROID', views: null, engaged_views: 5, metric_version: mv(p(-4)) }])
      const edicao = await provarEdicao(c.site)
      const pedido: PedidoDimensoes = { edicao, canalId: c.canal, hoje: HOJE, ytIds: [v.yt], de: p(-10), ate: p(-1), desde: { trafego: desde, dispositivo: desde, pais: desde, inscrito: desde, alcance_dim: desde } }
      const lido = await lerDimensoes(sb, pedido)
      if (lido.acesso !== 'ok') throw new Error('leitura negada')
      const dia = (conj: 'trafego' | 'dispositivo', d: string) => estadoDoDiaLido(lido.dado.conjuntos[conj].videos[0]!.dias.find(x => x.dia === d)!)
      expect(lido.dado.conjuntos.trafego.estado).toEqual({ tipo: 'coletado' })
      expect(lido.dado.descartados).toBe(0)
      // valor, e o outro valor do mesmo dia (soma = base) é zero MEDIDO
      expect(dia('trafego', p(-4)).de('YT_SEARCH')).toEqual({ tipo: 'valor', views: 10, minutos: 5 })
      expect(dia('trafego', p(-4)).de('EXT_URL')).toEqual({ tipo: 'zero_medido' })
      // abaixo do limiar: soma 3 de uma base de 4, omitido 1
      expect(dia('trafego', p(-2)).omitido).toBe(1)
      expect(dia('trafego', p(-2)).de('EXT_URL')).toEqual({ tipo: 'zero_ou_abaixo_do_limiar' })
      // dia sem linha de diário, com a base cobrindo e a dimensão cobrindo: dia medido sem atividade
      expect(dia('trafego', p(-7)).de('YT_SEARCH')).toEqual({ tipo: 'zero_medido' })
      // antes do início do conjunto
      expect(dia('trafego', p(-9)).de('YT_SEARCH')).toEqual({ tipo: 'nao_medido', motivo: 'antes_do_inicio', desde })
      // fora da cobertura do conjunto (antes de a cobertura começar mas depois do início não existe aqui; o dia p(-10) é antes do início)
      expect(dia('trafego', p(-10)).de('YT_SEARCH')).toMatchObject({ tipo: 'nao_medido', motivo: 'antes_do_inicio' })
      // `views` nulo no diário: a linha existe e o número não veio → base não medida, NUNCA zero_medido
      expect(dia('trafego', p(-3)).de('YT_SEARCH')).toEqual({ tipo: 'nao_medido', motivo: 'base_nao_medida', desde: null })
      expect(dia('trafego', p(-3)).de('EXT_URL')).toEqual({ tipo: 'nao_medido', motivo: 'base_nao_medida', desde: null })
      // buraco na `base` (o diário tem a linha, a cobertura da base não)
      expect(dia('trafego', p(-5)).de('YT_SEARCH')).toEqual({ tipo: 'nao_medido', motivo: 'base_nao_medida', desde: null })
      // linha da dimensão com `views` nulo: o valor existe e a contagem é nula (não 0), e o outro valor não afirma zero medido
      expect(dia('dispositivo', p(-4)).de('MOBILE|ANDROID')).toEqual({ tipo: 'valor', views: null, minutos: null })
      expect(dia('dispositivo', p(-4)).omitido).toBeNull()
      expect(dia('dispositivo', p(-4)).de('DESKTOP|WINDOWS')).toEqual({ tipo: 'zero_ou_abaixo_do_limiar' })
      // o interruptor aparece no estado do conjunto, com os dados preservados
      const off = await lerDimensoes(sb, { ...pedido, env: { YT_OWN_STEPS_OFF: 'dimensoes' } as NodeJS.ProcessEnv })
      if (off.acesso !== 'ok') throw new Error('leitura negada')
      expect(off.dado.conjuntos.pais.estado).toMatchObject({ tipo: 'passo_desligado', comDados: true })
    })

    it('o ciclo inteiro: o passo grava, o leitor lê as mesmas linhas que o passo gravou e o dia coberto sem view é "zero medido"', async () => {
      const desde = p(-8)
      const { c, vids } = await canalComBase(1, desde, p(-1)); const v = vids[0]!
      await diario(c, v, [[p(-4), 6]])
      instalarApi({ views: { [v.yt]: { [p(-4)]: 6 } } })
      expect((await dim(c, { desde })).ctx.falhas).toEqual([])
      const lido = await lerDimensoes(sb, { edicao: await provarEdicao(c.site), canalId: c.canal, hoje: HOJE, ytIds: [v.yt], de: p(-6), ate: p(-1), desde: { trafego: desde, dispositivo: desde, pais: desde, inscrito: desde, alcance_dim: desde } })
      if (lido.acesso !== 'ok') throw new Error('leitura negada')
      const e = (conj: 'trafego' | 'pais', d: string) => estadoDoDiaLido(lido.dado.conjuntos[conj].videos[0]!.dias.find(x => x.dia === d)!)
      expect(e('trafego', p(-4)).de('YT_SEARCH')).toMatchObject({ tipo: 'valor', views: 6, minutos: 3 })
      expect(e('pais', p(-4)).de('BR')).toMatchObject({ tipo: 'valor', views: 6 })
      expect(e('pais', p(-2)).de('BR')).toEqual({ tipo: 'zero_medido' })
    })

    it('lerDetalheDaOrigem devolve o sentinela a quem tem o token do site e NEGADO a quem não tem; o token de outro site não enxerga o dado deste', async () => {
      const c = await cenario(); const v = await video(c)
      const dia = p(-3)
      await relatorio(c, { tipo: TIPO_DETALHE, dia, csv: csvTrafego(c.uc, dia, [{ video: v.yt, origem: '4', detalhe: SENTINELA, views: 6, min: 2 }]) })
      expect((await norm(c)).falhas).toEqual([])
      const base = { canalId: c.canal, hoje: HOJE, ytIds: [v.yt], de: p(-5), ate: p(-1), desde: { detalhe: p(-10) } }
      const com = await lerDetalheDaOrigem(sb, { ...base, edicao: await provarEdicao(c.site) })
      if (com.acesso !== 'ok') throw new Error('leitura negada a quem tem o token')
      const linha = com.dado.conjunto.videos[0]!.dias.find(x => x.dia === dia)!.linhas
      expect(linha).toHaveLength(1)
      expect(linha[0]).toMatchObject({ detail: SENTINELA, sourceType: '4', views: 6 })
      expect(linha[0]!.valor).toBe(`4|${sha256(SENTINELA)}`) // a chave de tela é o hash, nunca o texto
      // sem o token (a guarda de edição não passou): negado, sem consultar nada
      guarda.edita = false
      const semToken = await provarEdicao(c.site)
      expect(semToken).toBeNull()
      const neg = await lerDetalheDaOrigem(sb, { ...base, edicao: semToken })
      expect(neg).toEqual({ acesso: 'negado' })
      expect(JSON.stringify(neg)).not.toContain(SENTINELA)
      guarda.edita = true
      // o token de OUTRO site, com o canal deste: o filtro por site devolve vazio (nada vaza por trocar o canal)
      const outro = await cenario()
      const cruzado = await lerDetalheDaOrigem(sb, { ...base, edicao: await provarEdicao(outro.site) })
      if (cruzado.acesso !== 'ok') throw new Error('leitura negada')
      expect(JSON.stringify(cruzado)).not.toContain(SENTINELA)
      expect(cruzado.dado.conjunto.videos[0]!.dias.every(x => x.linhas.length === 0)).toBe(true)
    })
  })
})
