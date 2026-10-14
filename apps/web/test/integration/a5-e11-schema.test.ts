// @vitest-environment node
/**
 * A5 · E11 (canal próprio em tabelas, MG7): o SQL do Apêndice A contra Postgres de verdade, e o TypeScript da coleta e do leitor
 * (`coleta/dimensoes-step.ts`, `normalizadores-step.ts`, `e11-config.ts`, `reporting/*-csv.ts`, `observatorio/proprio/ler-dimensoes.ts`)
 * contra o banco real. Banco: SÓ o `bythiago_int`. Rodar com:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/a5-e11-schema.test.ts --no-file-parallelism
 *
 * O banco é dividido com outras etapas: cada teste cria o SEU site e o SEU canal e só olha para eles; o arquivo semeia e limpa.
 * Função sem EXECUTE nunca é CHAMADA aqui como anon/authenticated (derruba este Postgres): o privilégio se confere por catálogo.
 * Datas: todas relativas a hoje (UTC) ou passadas; nada no futuro.
 * RLS e privilégios das tabelas: `a5-e11-rls.test.ts`.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Client } from 'pg'
import { randomUUID, createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite } from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { addDays, utcDay } from '@/lib/youtube/coleta/day-pt'
import { metricVersion } from '@/lib/youtube/coleta/metric-version'
import { COLLECTION_KINDS } from '@/lib/youtube/coleta/kinds'
import { lerProva, chamarProva, schemaE11, janelaDoConjunto } from '@/lib/youtube/coleta/e11-config'
import { CABECALHO_TRAFEGO, lerTrafego, agregarTrafego } from '@/lib/youtube/reporting/traffic-source-csv'
import { CABECALHO_ALCANCE_COMBINADO, lerAlcanceCombinado, agregarAlcanceCombinado } from '@/lib/youtube/reporting/reach-combined-csv'
import { provarEdicao } from '@/lib/youtube/observatorio/proprio/edicao'
import { lerDimensoes, lerDetalheDaOrigem } from '@/lib/youtube/observatorio/proprio/ler-dimensoes'

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: async () => ({ ok: true, user: { id: 'u1' } }) }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.setConfig({ testTimeout: 60_000 })

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const RAIZ = fileURLToPath(new URL('../../../../', import.meta.url))
// Tarefa 1b: o SQL vem do arquivo de migration (a pasta de ensaio em .superpowers/ é ignorada pelo git e não existe na CI)
const MG7_ARQUIVO = 'observatorio_a5_e11_canal_proprio_em_tabelas'
const MG7_SQL = ((): string => {
  const dir = `${RAIZ}supabase/migrations/`
  const achado = readdirSync(dir).find(f => f.includes(MG7_ARQUIVO))
  return achado ? dir + achado : `${dir}<${MG7_ARQUIVO} não existe>`
})()
const CORPO_UNICO_MD5 = '4827d5ad12a0120b52ebc1280491b00c'

const HOJE = utcDay(new Date())
const d = (n: number): string => addDays(HOJE, n)
/** Dia n da série de teste das funções de gravação: 80 dias atrás + n. */
const B0 = d(-80)
const dia = (n: number): string => addDays(B0, n)
const md5 = (s: string): string => createHash('md5').update(s).digest('hex')
const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex')

type Linha = Record<string, unknown>
interface Cen { site: string; canal: string; uc: string; slug: string }
interface Vid { id: string; yt: string }
type Rpc = { data: unknown; error: { code?: string; message: string } | null }

describe.skipIf(skipIfNoLocalDb())('A5 E11 (MG7): schema, funções SQL e o TypeScript da coleta e do leitor contra o banco (bythiago_int)', () => {
  let pg: Client
  let sb: ReturnType<typeof getSupabaseServiceClient>
  const sites: string[] = []
  const tabelasInventadas: string[] = []

  beforeAll(async () => {
    sb = getSupabaseServiceClient()
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
  })
  afterAll(async () => {
    try {
      for (const t of tabelasInventadas) await pg.query(`drop table if exists public.${t}`)
      if (sites.length > 0) {
        // FK "restrict" do canal: as tabelas presas a ele primeiro, depois vídeos, canais, e o site leva o resto por cascata
        for (const t of [
          'yt_own_video_dim_daily', 'yt_own_video_traffic_detail_daily', 'yt_own_video_reach_dim_daily', 'yt_reporting_reports',
          'yt_own_video_retention', 'yt_own_video_coverage', 'yt_own_video_daily', 'yt_own_collection_attempts', 'youtube_videos', 'youtube_channels',
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

  // ───────────────────────── semeadura e leitura ─────────────────────────
  const q = async (sql: string, params: unknown[] = []): Promise<Linha[]> => (await pg.query(sql, params)).rows as Linha[]
  const n = async (sql: string, params: unknown[] = []): Promise<number> => Number((await q(sql, params))[0]!.n)

  async function cenario(opts: { site?: string; sync?: boolean } = {}): Promise<Cen> {
    const site = opts.site ?? (await seedSite(sb)).siteId
    if (!opts.site) sites.push(site)
    const x = randomUUID().replace(/-/g, '')
    const uc = 'UC' + x.slice(0, 22)
    const slug = 'teste-' + x.slice(0, 8)
    const r = await q(`insert into public.youtube_channels (site_id, channel_id, locale, handle, name, uploads_playlist_id, slug, sync_enabled)
      values ($1, $2, 'pt', $3, 'Teste', $4, $5, $6) returning id`, [site, uc, '@t' + x.slice(0, 8), 'UU' + x.slice(2, 24), slug, opts.sync ?? true])
    return { site, canal: String(r[0]!.id), uc, slug }
  }
  async function video(c: Cen, publicado: string = `${d(-120)}T12:00:00Z`): Promise<Vid> {
    const yt = 'y' + randomUUID().replace(/-/g, '').slice(0, 10)
    const r = await q(`insert into public.youtube_videos (site_id, channel_id, youtube_video_id, title, published_at)
      values ($1, $2, $3, 'Teste', $4) returning id`, [c.site, c.canal, yt, publicado])
    return { id: String(r[0]!.id), yt }
  }
  /** Diário do vídeo: [n, views][] */
  async function diario(c: Cen, v: Vid, dias: Array<[number, number]>): Promise<void> {
    for (const [i, views] of dias) {
      await pg.query(`insert into public.yt_own_video_daily (youtube_video_id, day_pt, site_id, video_id, channel_id, views, metric_version)
        values ($1, $2, $3, $4, $5, $6, $7) on conflict (youtube_video_id, day_pt) do update set views = excluded.views`,
      [v.yt, dia(i), c.site, v.id, c.canal, views, metricVersion(dia(i))])
    }
  }
  /** Cobertura direta, pela função de fusão (a mesma que o banco usa). */
  const cobrir = (c: Cen, v: Vid, conjunto: string, de: string, ate: string) => sb.rpc('yt_own_dim_coverage_extend', {
    p_video: v.yt, p_set: conjunto, p_from: de, p_to: ate, p_site: c.site, p_video_id: v.id, p_channel: c.canal, p_source: 'analytics_api',
  })
  const coberturaDe = async (v: Vid, conjunto: string): Promise<Array<[string, string]>> =>
    (await q(`select covered_from::text as a, covered_to::text as b from public.yt_own_video_coverage where youtube_video_id = $1 and metric_set = $2 order by covered_from`, [v.yt, conjunto]))
      .map(r => [String(r.a), String(r.b)])
  const dimRow = (n_: number, valor: string, views: number | null, extra: Linha = {}): Linha =>
    ({ day_pt: dia(n_), dim_value: valor, views, metric_version: metricVersion(dia(n_)), ...extra })
  const aplicarDim = (c: Cen, v: Vid, kind: string, de: number, ate: number, rows: Linha[]): PromiseLike<Rpc> => sb.rpc('yt_own_dim_apply', {
    p_video: v.yt, p_kind: kind, p_from: dia(de), p_to: dia(ate), p_rows: rows, p_site: c.site, p_video_id: v.id, p_channel: c.canal,
  }) as PromiseLike<Rpc>
  const dimsDe = async (v: Vid, kind: string): Promise<Array<[string, string, number | null]>> =>
    (await q(`select day_pt::text as dia, dim_value, views from public.yt_own_video_dim_daily where youtube_video_id = $1 and dim_kind = $2 order by day_pt, dim_value`, [v.yt, kind]))
      .map(r => [String(r.dia), String(r.dim_value), r.views === null ? null : Number(r.views)])
  const dados = (r: Rpc): Record<string, unknown> => {
    expect(r.error, JSON.stringify(r.error)).toBeNull()
    return r.data as Record<string, unknown>
  }
  const SETS = ['trafego', 'dispositivo', 'pais', 'inscrito'] as const
  const KINDS = ['traffic_source', 'device_os', 'country', 'subscribed_status'] as const

  // ── relatórios do Reporting ──
  const TIPO_DETALHE = 'channel_traffic_source_a3'
  const TIPO_ALCANCE = 'channel_reach_combined_a1'
  async function relatorio(c: Cen, o: {
    id?: string; tipo?: string; dia: string; criado: string; status?: string; normalizado?: boolean; baixadoEm?: string; fim?: string
  }): Promise<string> {
    const id = o.id ?? 'rep-' + randomUUID().slice(0, 12)
    await pg.query(`insert into public.yt_reporting_reports (report_id, site_id, job_id, channel_id, report_type_id, start_time, end_time, create_time, download_url, status, downloaded_at, normalized_at)
      values ($1, $2, 'job-e11', $3, $4, $5, $6, $7, 'https://exemplo.invalid/x', $8, $9, $10)`,
    [id, c.site, c.canal, o.tipo ?? TIPO_DETALHE, `${o.dia}T00:00:00Z`, o.fim ?? `${addDays(o.dia, 1)}T00:00:00Z`, o.criado, o.status ?? 'baixado',
      o.baixadoEm ?? o.criado, o.normalizado ? o.criado : null])
    return id
  }
  const detRow = (v: Vid, diaStr: string, tipo: string, texto: string, views: number | null, minutos: number | null = null, extra: Linha = {}): Linha => ({
    youtube_video_id: v.yt, video_id: v.id, day_pt: diaStr, source_type: tipo, detail: texto, detail_hash: sha256(texto), views,
    ...(minutos !== null ? { watch_time_minutes: minutos } : {}), metric_version: metricVersion(diaStr), ...extra,
  })
  const alcRow = (v: Vid, diaStr: string, origem: string, aparelho: string, so: string, imp: number, cliques?: number, extra: Linha = {}): Linha => ({
    youtube_video_id: v.yt, video_id: v.id, day_pt: diaStr, traffic_source_type: origem, device_type: aparelho, operating_system: so,
    thumbnail_impressions: imp, ...(cliques !== undefined ? { thumbnail_clicks_est: cliques } : {}), metric_version: metricVersion(diaStr), ...extra,
  })
  const aplicarDetalhe = (id: string, rows: Linha[], semPar: Linha | null = null): PromiseLike<Rpc> =>
    sb.rpc('yt_own_traffic_detail_apply', { p_report_id: id, p_rows: rows, p_unmatched: semPar }) as PromiseLike<Rpc>
  const aplicarAlcance = (id: string, rows: Linha[], semPar: Linha | null = null): PromiseLike<Rpc> =>
    sb.rpc('yt_own_reach_dim_apply', { p_report_id: id, p_rows: rows, p_unmatched: semPar }) as PromiseLike<Rpc>
  const normalizadoEm = async (id: string): Promise<unknown> => (await q('select normalized_at from public.yt_reporting_reports where report_id = $1', [id]))[0]!.normalized_at
  const detalheDe = async (c: Cen, diaStr?: string): Promise<Linha[]> =>
    q(`select youtube_video_id, day_pt::text as dia, source_type, detail, views, watch_time_minutes, source_report_id from public.yt_own_video_traffic_detail_daily
       where channel_id = $1 and ($2::date is null or day_pt = $2) order by day_pt, youtube_video_id, source_type, detail`, [c.canal, diaStr ?? null])
  const alcanceDe = async (c: Cen, diaStr?: string): Promise<Linha[]> =>
    q(`select youtube_video_id, day_pt::text as dia, traffic_source_type, device_type, operating_system, thumbnail_impressions, thumbnail_clicks_est, source_report_id from public.yt_own_video_reach_dim_daily
       where channel_id = $1 and ($2::date is null or day_pt = $2) order by day_pt, youtube_video_id, traffic_source_type, device_type, operating_system`, [c.canal, diaStr ?? null])
  const prova = async (c: Cen, hoje: string, desde: string): Promise<Record<string, unknown>> =>
    dados(await sb.rpc('yt_own_dim_prova', { p_site: c.site, p_hoje: hoje, p_desde: desde }) as Rpc)

  // ═════════════════════════ A. schema ═════════════════════════
  describe('schema das três tabelas', () => {
    const colunas = async (tabela: string): Promise<Record<string, string>> =>
      Object.fromEntries((await q(`select column_name, udt_name, is_nullable from information_schema.columns
        where table_schema = 'public' and table_name = $1 order by ordinal_position`, [tabela]))
        .map(r => [String(r.column_name), `${r.udt_name}|${r.is_nullable === 'NO' ? 'nn' : 'null'}`]))
    const pk = async (t: string): Promise<string> => String((await q(`select pg_get_constraintdef(oid) as def from pg_constraint where conrelid = $1::regclass and contype = 'p'`, ['public.' + t]))[0]!.def)
    const fks = async (t: string): Promise<string[]> =>
      (await q(`select a.attname as col, k.confdeltype as acao, k.confrelid::regclass::text as alvo from pg_constraint k
        join pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1] where k.conrelid = $1::regclass and k.contype = 'f' order by 1`, ['public.' + t]))
        .map(r => `${r.col}:${r.alvo}:${r.acao}`)
    const indice = async (t: string, nome: string): Promise<string> =>
      String((await q(`select indexdef from pg_indexes where schemaname = 'public' and tablename = $1 and indexname = $2`, [t, nome]))[0]?.indexdef)
    const checks = async (t: string): Promise<string> =>
      (await q(`select pg_get_constraintdef(oid) as def from pg_constraint where conrelid = $1::regclass and contype = 'c' order by conname`, ['public.' + t])).map(r => String(r.def)).join('\n')
    const FKS = ['channel_id:youtube_channels:r', 'site_id:sites:c', 'video_id:youtube_videos:n']

    it('yt_own_video_dim_daily: colunas, tipos, chave, índice, FKs e checks (o que dimensoes-step e ler-dimensoes gravam e leem)', async () => {
      expect(await colunas('yt_own_video_dim_daily')).toEqual({
        youtube_video_id: 'text|nn', day_pt: 'date|nn', dim_kind: 'text|nn', dim_value: 'text|nn', site_id: 'uuid|nn', video_id: 'uuid|null',
        channel_id: 'uuid|nn', views: 'int8|null', engaged_views: 'int8|null', watch_time_minutes: 'numeric|null', source: 'text|nn',
        collected_at: 'timestamptz|nn', metric_version: 'text|nn',
      })
      expect(await pk('yt_own_video_dim_daily')).toBe('PRIMARY KEY (youtube_video_id, day_pt, dim_kind, dim_value)')
      expect(await indice('yt_own_video_dim_daily', 'idx_yt_own_video_dim_daily_channel')).toContain('(channel_id, dim_kind, day_pt)')
      expect(await fks('yt_own_video_dim_daily')).toEqual(FKS)
      const c = await checks('yt_own_video_dim_daily')
      for (const k of ['traffic_source', 'device_os', 'country', 'subscribed_status']) expect(c).toContain(`'${k}'`)
      expect(c).toContain("'analytics_api'")
    })

    it('yt_own_video_traffic_detail_daily: colunas, tipos, chave, índice, FKs e checks', async () => {
      expect(await colunas('yt_own_video_traffic_detail_daily')).toEqual({
        youtube_video_id: 'text|nn', day_pt: 'date|nn', source_type: 'text|nn', detail: 'text|nn', detail_hash: 'text|nn', site_id: 'uuid|nn',
        video_id: 'uuid|null', channel_id: 'uuid|nn', views: 'int8|null', watch_time_minutes: 'numeric|null', source: 'text|nn',
        source_report_id: 'text|nn', report_create_time: 'timestamptz|nn', collected_at: 'timestamptz|nn', metric_version: 'text|nn',
      })
      expect(await pk('yt_own_video_traffic_detail_daily')).toBe('PRIMARY KEY (youtube_video_id, day_pt, source_type, detail_hash)')
      expect(await indice('yt_own_video_traffic_detail_daily', 'idx_yt_own_traffic_detail_channel_day')).toContain('(channel_id, day_pt, source_type)')
      expect(await fks('yt_own_video_traffic_detail_daily')).toEqual(FKS)
      expect(await checks('yt_own_video_traffic_detail_daily')).toContain("'reporting_api'")
    })

    it('yt_own_video_reach_dim_daily: colunas, tipos, chave, índice, FKs e checks', async () => {
      expect(await colunas('yt_own_video_reach_dim_daily')).toEqual({
        youtube_video_id: 'text|nn', day_pt: 'date|nn', traffic_source_type: 'text|nn', device_type: 'text|nn', operating_system: 'text|nn',
        site_id: 'uuid|nn', video_id: 'uuid|null', channel_id: 'uuid|nn', thumbnail_impressions: 'int8|null', thumbnail_clicks_est: 'numeric|null',
        source_report_id: 'text|nn', report_create_time: 'timestamptz|nn', collected_at: 'timestamptz|nn', metric_version: 'text|nn',
      })
      expect(await pk('yt_own_video_reach_dim_daily')).toBe('PRIMARY KEY (youtube_video_id, day_pt, traffic_source_type, device_type, operating_system)')
      expect(await indice('yt_own_video_reach_dim_daily', 'idx_yt_own_reach_dim_channel_day')).toContain('(channel_id, day_pt)')
      expect(await fks('yt_own_video_reach_dim_daily')).toEqual(FKS)
    })

    it('sem period_days; chaves e carimbos NOT NULL; as métricas são anuláveis (nulo é nulo, nunca zero) (itens 226 e 249)', async () => {
      const tabelas = ['yt_own_video_dim_daily', 'yt_own_video_traffic_detail_daily', 'yt_own_video_reach_dim_daily']
      expect(await n(`select count(*) as n from information_schema.columns where table_schema = 'public' and table_name = any($1) and column_name = 'period_days'`, [tabelas])).toBe(0)
      for (const t of tabelas) {
        const cols = await colunas(t)
        for (const k of ['youtube_video_id', 'day_pt', 'site_id', 'channel_id', 'metric_version']) expect(cols[k], `${t}.${k}`).toMatch(/\|nn$/)
        expect(cols.video_id, `${t}.video_id`).toMatch(/\|null$/)
        for (const k of ['views', 'engaged_views', 'watch_time_minutes', 'thumbnail_impressions', 'thumbnail_clicks_est']) if (k in cols) expect(cols[k], `${t}.${k}`).toMatch(/\|null$/)
      }
      // nenhuma coluna de métrica tem default (um default 0 transformaria "não medido" em zero)
      expect(await n(`select count(*) as n from information_schema.columns where table_schema = 'public' and table_name = any($1)
        and column_name in ('views','engaged_views','watch_time_minutes','thumbnail_impressions','thumbnail_clicks_est') and column_default is not null`, [tabelas])).toBe(0)
    })

    it('checks, um de cada vez com o resto da linha válido; a linha boa é aceita; nulo é guardado como nulo', async () => {
      const c = await cenario(); const v = await video(c)
      const tenta = async (sql: string, params: unknown[]): Promise<string> => {
        await pg.query('savepoint s')
        try { await pg.query(sql, params); await pg.query('release savepoint s'); return 'ok' } catch (e) { await pg.query('rollback to savepoint s'); return (e as { code?: string }).code ?? 'erro' }
      }
      await pg.query('begin')
      try {
        const dimIns = (kind: string, valor: string, views: number | null, eng: number | null, min: number | null, fonte = 'analytics_api'): Promise<string> =>
          tenta(`insert into public.yt_own_video_dim_daily (youtube_video_id, day_pt, dim_kind, dim_value, site_id, channel_id, views, engaged_views, watch_time_minutes, source, metric_version)
            values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'v')`, [v.yt, dia(1), kind, valor, c.site, c.canal, views, eng, min, fonte])
        expect(await dimIns('traffic_source', 'YT_SEARCH', 3, null, null)).toBe('ok')
        expect(await dimIns('device_os', 'MOBILE|ANDROID', null, null, 0.5)).toBe('ok') // só minutos: views fica nulo
        expect(await dimIns('country', 'BR', null, 2, null)).toBe('ok') // só engaged
        expect(await dimIns('idade', 'X', 1, null, null)).toBe('23514')
        expect(await dimIns('country', 'b r', 1, null, null)).toBe('23514')
        expect(await dimIns('country', 'x'.repeat(81), 1, null, null)).toBe('23514')
        expect(await dimIns('country', 'US', 0, 0, 0)).toBe('23514') // esparsa: linha zerada
        expect(await dimIns('country', 'US', null, null, null)).toBe('23514') // esparsa: sem nenhuma métrica
        expect(await dimIns('country', 'US', 1, null, null, 'reporting_api')).toBe('23514')
        const lida = await pg.query(`select views, engaged_views, watch_time_minutes from public.yt_own_video_dim_daily where youtube_video_id = $1 and dim_value = 'MOBILE|ANDROID'`, [v.yt])
        expect(lida.rows[0]).toEqual({ views: null, engaged_views: null, watch_time_minutes: '0.5' })

        const detIns = (tipo: string, texto: string, hash: string, views: number | null, min: number | null, fonte = 'reporting_api'): Promise<string> =>
          tenta(`insert into public.yt_own_video_traffic_detail_daily (youtube_video_id, day_pt, source_type, detail, detail_hash, site_id, channel_id, views, watch_time_minutes, source, source_report_id, report_create_time, metric_version)
            values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'r', now(), 'v')`, [v.yt, dia(1), tipo, texto, hash, c.site, c.canal, views, min, fonte])
        expect(await detIns('4', 'termo', sha256('termo'), 2, null)).toBe('ok')
        expect(await detIns('4', '', sha256(''), null, 1.5)).toBe('ok') // sem detalhe = texto vazio, minutos sem views
        expect(await detIns('4', 'x', sha256('x'), 0, 0)).toBe('23514')
        expect(await detIns('4', 'y', sha256('y'), null, null)).toBe('23514')
        expect(await detIns('4', 'z'.repeat(301), sha256('z'), 1, null)).toBe('23514') // detalhe passa de 300
        expect(await detIns('4', 'z'.repeat(300), sha256('z300'), 1, null)).toBe('ok')
        expect(await detIns('4', 'w', 'ABC', 1, null)).toBe('23514') // hash fora de 64 hex minúsculos
        expect(await detIns('4 x', 'w', sha256('w'), 1, null)).toBe('23514')
        expect(await detIns('4', 'w', sha256('w'), 1, null, 'analytics_api')).toBe('23514')

        const alcIns = (imp: number | null, cliques: number | null, aparelho = 'DESKTOP'): Promise<string> =>
          tenta(`insert into public.yt_own_video_reach_dim_daily (youtube_video_id, day_pt, traffic_source_type, device_type, operating_system, site_id, channel_id, thumbnail_impressions, thumbnail_clicks_est, source_report_id, report_create_time, metric_version)
            values ($1, $2, '1', $3, 'WINDOWS', $4, $5, $6, $7, 'r', now(), 'v')`, [v.yt, dia(1), aparelho, c.site, c.canal, imp, cliques])
        expect(await alcIns(100, null, 'A1')).toBe('ok') // cliques ausentes: nulo
        expect(await alcIns(100, 0, 'A2')).toBe('ok')
        expect(await alcIns(100, 100, 'A3')).toBe('ok')
        expect(await alcIns(100, 100.5, 'A4')).toBe('23514') // mais cliques que impressões
        expect(await alcIns(100, -1, 'A5')).toBe('23514')
        expect(await alcIns(0, null, 'A6')).toBe('23514') // esparsa
        expect(await alcIns(null, null, 'A7')).toBe('23514')
        expect(await alcIns(10, 1, 'a b')).toBe('23514')
        const lidaAlc = await pg.query(`select thumbnail_clicks_est from public.yt_own_video_reach_dim_daily where youtube_video_id = $1 and device_type = 'A1'`, [v.yt])
        expect(lidaAlc.rows[0]!.thumbnail_clicks_est).toBeNull()
      } finally {
        await pg.query('rollback')
      }
    })
  })

  // ═════════════════════════ B. cobertura ═════════════════════════
  describe('yt_own_dim_coverage_extend', () => {
    it('funde vizinhos: 05, depois 07, depois 06 vira um intervalo só; nunca encolhe; intervalo afastado fica separado', async () => {
      const c = await cenario(); const v = await video(c)
      expect((await cobrir(c, v, 'pais', dia(5), dia(5))).error).toBeNull()
      expect((await cobrir(c, v, 'pais', dia(7), dia(7))).error).toBeNull()
      expect(await coberturaDe(v, 'pais')).toEqual([[dia(5), dia(5)], [dia(7), dia(7)]])
      await cobrir(c, v, 'pais', dia(6), dia(6))
      expect(await coberturaDe(v, 'pais')).toEqual([[dia(5), dia(7)]])
      await cobrir(c, v, 'pais', dia(6), dia(6)) // dentro do que já está: não encolhe
      await cobrir(c, v, 'pais', dia(5), dia(5))
      expect(await coberturaDe(v, 'pais')).toEqual([[dia(5), dia(7)]])
      await cobrir(c, v, 'pais', dia(20), dia(22)) // longe: outro intervalo
      expect(await coberturaDe(v, 'pais')).toEqual([[dia(5), dia(7)], [dia(20), dia(22)]])
      await cobrir(c, v, 'pais', dia(3), dia(30)) // engole os dois
      expect(await coberturaDe(v, 'pais')).toEqual([[dia(3), dia(30)]])
      expect(await coberturaDe(v, 'inscrito')).toEqual([]) // conjuntos independentes
    })
    it('janela invertida ou com data nula não grava nada (e não lança)', async () => {
      const c = await cenario(); const v = await video(c)
      expect((await cobrir(c, v, 'pais', dia(9), dia(5))).error).toBeNull()
      const nulo = await sb.rpc('yt_own_dim_coverage_extend', { p_video: v.yt, p_set: 'pais', p_from: null, p_to: dia(5), p_site: c.site, p_video_id: v.id, p_channel: c.canal, p_source: 'analytics_api' })
      expect(nulo.error).toBeNull()
      expect(await coberturaDe(v, 'pais')).toEqual([])
    })
    it('conjunto ou fonte fora do catálogo da cobertura é recusado pelo check da MG14, e nada fica', async () => {
      const c = await cenario(); const v = await video(c)
      const r = await cobrir(c, v, 'idade', dia(1), dia(2))
      expect(r.error?.code).toBe('23514')
      expect(await coberturaDe(v, 'idade')).toEqual([])
    })
  })

  // ═════════════════════════ C. yt_own_dim_apply ═════════════════════════
  describe('yt_own_dim_apply', () => {
    /** Vídeo com `base` de dia(0) a dia(base) e o diário pedido. */
    async function pronto(base: number, diarioDias: Array<[number, number]>): Promise<{ c: Cen; v: Vid }> {
      const c = await cenario(); const v = await video(c)
      await cobrir(c, v, 'base', dia(0), dia(base))
      await diario(c, v, diarioDias)
      return { c, v }
    }

    it('teto da base (item 227): a linha além do último dia coberto da base não entra, é contada, e a cobertura para na base', async () => {
      const { c, v } = await pronto(8, [[5, 2], [8, 1]])
      const r = dados(await aplicarDim(c, v, 'traffic_source', 0, 10, [dimRow(5, 'YT_SEARCH', 2), dimRow(10, 'YT_SEARCH', 1)]))
      expect(r).toMatchObject({ status: 'gravado', base_ate: dia(8), coberto_ate: dia(8), gravadas: 1, apagadas: 0, fora_do_teto: 1 })
      expect(await dimsDe(v, 'traffic_source')).toEqual([[dia(5), 'YT_SEARCH', 2]])
      expect(await coberturaDe(v, 'trafego')).toEqual([[dia(0), dia(8)]])
    })

    it('linha zerada não entra (item 85): não é contada em `gravadas`; a de views nulo entra só se houver outra métrica; `insert` direto de zero falha', async () => {
      const { c, v } = await pronto(10, [[5, 4]])
      const r = dados(await aplicarDim(c, v, 'country', 0, 10, [
        dimRow(5, 'BR', 4), dimRow(5, 'US', 0, { watch_time_minutes: 0 }), dimRow(5, 'PT', null, { watch_time_minutes: 0.5 }), dimRow(5, 'ES', null),
      ]))
      expect(r).toMatchObject({ status: 'gravado', gravadas: 2 })
      expect(await dimsDe(v, 'country')).toEqual([[dia(5), 'BR', 4], [dia(5), 'PT', null]]) // views ausente fica nulo, não zero
    })

    it('resposta vazia mantém o dia com view: as linhas gravadas ficam e o dia é contado em dias_mantidos', async () => {
      const { c, v } = await pronto(10, [[5, 3]])
      await aplicarDim(c, v, 'traffic_source', 0, 10, [dimRow(5, 'YT_SEARCH', 1), dimRow(5, 'EXT_URL', 2)])
      const r = dados(await aplicarDim(c, v, 'traffic_source', 0, 10, []))
      expect(r).toMatchObject({ status: 'gravado', apagadas: 0, gravadas: 0, dias_mantidos: 1, dias_em_revisao: 0 })
      expect((await dimsDe(v, 'traffic_source')).length).toBe(2)
    })

    it('diário revisado para baixo e resposta vazia: a linha antiga sai (dados m-3)', async () => {
      const { c, v } = await pronto(10, [[5, 2]])
      await aplicarDim(c, v, 'traffic_source', 0, 10, [dimRow(5, 'YT_SEARCH', 2)])
      await diario(c, v, [[5, 1]])
      const r = dados(await aplicarDim(c, v, 'traffic_source', 0, 10, []))
      expect(r).toMatchObject({ apagadas: 1, dias_mantidos: 0, dias_em_revisao: 0 })
      expect(await dimsDe(v, 'traffic_source')).toEqual([])
    })

    it('diário revisado a zero limpa o dia (zero view não tem origem)', async () => {
      const { c, v } = await pronto(10, [[5, 2]])
      await aplicarDim(c, v, 'traffic_source', 0, 10, [dimRow(5, 'YT_SEARCH', 2)])
      await diario(c, v, [[5, 0]])
      const r = dados(await aplicarDim(c, v, 'traffic_source', 0, 10, []))
      expect(r).toMatchObject({ apagadas: 1, dias_mantidos: 0 })
      expect(await dimsDe(v, 'traffic_source')).toEqual([])
    })

    it('dia com linha é substituído inteiro: A e B, depois só A, e B some; outro dia e outro kind ficam', async () => {
      const { c, v } = await pronto(10, [[5, 5], [6, 2]])
      await aplicarDim(c, v, 'traffic_source', 0, 10, [dimRow(5, 'A', 3), dimRow(5, 'B', 2), dimRow(6, 'A', 2)])
      await aplicarDim(c, v, 'device_os', 0, 10, [dimRow(5, 'MOBILE|ANDROID', 5)])
      const r = dados(await aplicarDim(c, v, 'traffic_source', 5, 5, [dimRow(5, 'A', 5)]))
      expect(r).toMatchObject({ apagadas: 2, gravadas: 1 })
      expect(await dimsDe(v, 'traffic_source')).toEqual([[dia(5), 'A', 5], [dia(6), 'A', 2]])
      expect((await dimsDe(v, 'device_os')).length).toBe(1)
    })

    it('em revisão é contada: soma das linhas passa das views do diário', async () => {
      const { c, v } = await pronto(10, [[5, 1]])
      const r = dados(await aplicarDim(c, v, 'traffic_source', 0, 10, [dimRow(5, 'A', 3)]))
      expect(r).toMatchObject({ status: 'gravado', gravadas: 1, dias_em_revisao: 1 })
    })

    it('vídeo sem base, ou com base anterior à janela: base_sem_cobertura, 0 linhas, 0 cobertura', async () => {
      const c = await cenario(); const v = await video(c)
      const r1 = dados(await aplicarDim(c, v, 'traffic_source', 0, 10, [dimRow(5, 'A', 3)]))
      expect(r1).toMatchObject({ status: 'base_sem_cobertura', base_ate: null, coberto_ate: null, gravadas: 0, fora_do_teto: 1 })
      await cobrir(c, v, 'base', dia(0), dia(2))
      const r2 = dados(await aplicarDim(c, v, 'traffic_source', 5, 10, [dimRow(5, 'A', 3)]))
      expect(r2).toMatchObject({ status: 'base_sem_cobertura', base_ate: dia(2), gravadas: 0 })
      expect(await dimsDe(v, 'traffic_source')).toEqual([])
      expect(await coberturaDe(v, 'trafego')).toEqual([])
    })

    it('kind desconhecido, linha fora da janela, janela invertida, p_rows que não é lista, e nulos: exceção; nada gravado', async () => {
      const { c, v } = await pronto(10, [[5, 3]])
      const erros = [
        await aplicarDim(c, v, 'idade', 0, 10, [dimRow(5, 'A', 1)]),
        await aplicarDim(c, v, 'traffic_source', 6, 10, [dimRow(5, 'A', 1)]), // linha de dia(5) numa janela que começa em dia(6)
        await aplicarDim(c, v, 'traffic_source', 6, 10, [dimRow(11, 'A', 1)]),
        await aplicarDim(c, v, 'traffic_source', 8, 6, []),
        await sb.rpc('yt_own_dim_apply', { p_video: v.yt, p_kind: 'traffic_source', p_from: dia(0), p_to: dia(10), p_rows: { a: 1 }, p_site: c.site, p_video_id: v.id, p_channel: c.canal }),
        await sb.rpc('yt_own_dim_apply', { p_video: v.yt, p_kind: 'traffic_source', p_from: dia(0), p_to: dia(10), p_rows: null, p_site: c.site, p_video_id: v.id, p_channel: c.canal }),
        await sb.rpc('yt_own_dim_apply', { p_video: v.yt, p_kind: null, p_from: dia(0), p_to: dia(10), p_rows: [], p_site: c.site, p_video_id: v.id, p_channel: c.canal }),
        await aplicarDim(c, v, 'traffic_source', 0, 10, [dimRow(5, 'valor inválido', 1)]), // check da coluna
        await aplicarDim(c, v, 'traffic_source', 0, 10, [dimRow(5, 'A', 1), dimRow(5, 'A', 1)]), // chave repetida
      ]
      erros.forEach((e, i) => expect(e.error, `caso ${i}`).not.toBeNull())
      expect(await dimsDe(v, 'traffic_source')).toEqual([])
      expect(await coberturaDe(v, 'trafego')).toEqual([])
    })

    it('a mesma janela duas vezes dá o mesmo estado (idempotente) e a cobertura não duplica', async () => {
      const { c, v } = await pronto(10, [[5, 3], [6, 1]])
      const rows = [dimRow(5, 'A', 2), dimRow(5, 'B', 1), dimRow(6, 'A', 1)]
      await aplicarDim(c, v, 'traffic_source', 0, 10, rows)
      const antes = await dimsDe(v, 'traffic_source')
      const r = dados(await aplicarDim(c, v, 'traffic_source', 0, 10, rows))
      expect(r).toMatchObject({ gravadas: 3, apagadas: 3, dias_em_revisao: 0 })
      expect(await dimsDe(v, 'traffic_source')).toEqual(antes)
      expect(await coberturaDe(v, 'trafego')).toEqual([[dia(0), dia(10)]])
    })

    it('país: view só no dia X, uma gravação com a janela inteira cobre os dias sem view (dados C-1)', async () => {
      const { c, v } = await pronto(11, [[4, 5]])
      for (const kind of KINDS) await aplicarDim(c, v, kind, 3, 13, kind === 'country' ? [dimRow(4, 'BR', 5)] : [])
      expect(await coberturaDe(v, 'pais')).toEqual([[dia(3), dia(11)]])
      expect((await prova(c, d(-1), dia(0))).faltando_cobertura).toBe(0)
    })

    it('país: 45 dias depois sem view nova, a cobertura anda pelo idle e a linha antiga fica', async () => {
      const { c, v } = await pronto(11, [[4, 5]])
      for (const kind of KINDS) await aplicarDim(c, v, kind, 3, 13, kind === 'country' ? [dimRow(4, 'BR', 5)] : [])
      await cobrir(c, v, 'base', dia(12), dia(50))
      const r = dados(await sb.rpc('yt_own_dim_cover_idle', { p_channel: c.canal, p_inicio: dia(0), p_janela: dia(45), p_to: dia(52) }) as Rpc)
      expect(r).toMatchObject({ videos_com_base: 1, conjuntos_cobertos: 4, videos_com_view: 0 })
      expect(await coberturaDe(v, 'pais')).toEqual([[dia(3), dia(50)]])
      expect(await dimsDe(v, 'country')).toEqual([[dia(4), 'BR', 5]])
      expect((await prova(c, dia(55), dia(0))).faltando_cobertura).toBe(0)
    })

    it('país: a gravação cortada no dia anterior ao que falhou deixa a prova vermelha, e a seguinte a fecha sem deixar buraco (dados I-5)', async () => {
      const { c, v } = await pronto(26, [[20, 1], [22, 1], [24, 1]])
      for (const s of ['trafego', 'dispositivo', 'inscrito']) await cobrir(c, v, s, dia(0), dia(26))
      await aplicarDim(c, v, 'country', 0, 21, [dimRow(20, 'BR', 1)])
      expect(await coberturaDe(v, 'pais')).toEqual([[dia(0), dia(21)]])
      expect((await prova(c, dia(32), dia(0))).faltando_cobertura).toBe(1)
      await aplicarDim(c, v, 'country', 19, 26, [dimRow(20, 'BR', 1), dimRow(22, 'BR', 1), dimRow(24, 'BR', 1)])
      expect(await coberturaDe(v, 'pais')).toEqual([[dia(0), dia(26)]])
      expect((await prova(c, dia(32), dia(0))).faltando_cobertura).toBe(0)
      expect((await dimsDe(v, 'country')).length).toBe(3)
    })
  })

  // ═════════════════════════ D. yt_own_dim_cover_idle ═════════════════════════
  describe('yt_own_dim_cover_idle', () => {
    it('cobre quem não tem view e pula quem tem: B ganha os 4 conjuntos, A nenhum; videos_com_view conta A', async () => {
      const c = await cenario(); const a = await video(c); const b = await video(c)
      for (const v of [a, b]) await cobrir(c, v, 'base', dia(0), dia(10))
      await diario(c, a, [[5, 3]])
      const r = dados(await sb.rpc('yt_own_dim_cover_idle', { p_channel: c.canal, p_inicio: dia(0), p_janela: dia(0), p_to: dia(10) }) as Rpc)
      expect(r).toEqual({ videos_com_base: 2, conjuntos_cobertos: 4, videos_com_view: 1 })
      for (const s of SETS) { expect(await coberturaDe(b, s)).toEqual([[dia(0), dia(10)]]); expect(await coberturaDe(a, s)).toEqual([]) }
    })
    it('limpa dimensão de dia sem view (o diário zerou) e estende a cobertura; tabela vazia devolve zeros', async () => {
      const c = await cenario()
      const vazio = dados(await sb.rpc('yt_own_dim_cover_idle', { p_channel: c.canal, p_inicio: dia(0), p_janela: dia(0), p_to: dia(10) }) as Rpc)
      expect(vazio).toEqual({ videos_com_base: 0, conjuntos_cobertos: 0, videos_com_view: 0 })
      const v = await video(c)
      await cobrir(c, v, 'base', dia(0), dia(10))
      await diario(c, v, [[5, 2]])
      await aplicarDim(c, v, 'traffic_source', 0, 10, [dimRow(5, 'A', 2)])
      await diario(c, v, [[5, 0]])
      await sb.rpc('yt_own_dim_cover_idle', { p_channel: c.canal, p_inicio: dia(0), p_janela: dia(0), p_to: dia(10) })
      expect(await dimsDe(v, 'traffic_source')).toEqual([])
      expect(await coberturaDe(v, 'trafego')).toEqual([[dia(0), dia(10)]])
    })
    it('datas nulas lançam; é idempotente; só mexe no canal pedido', async () => {
      const c = await cenario(); const outro = await cenario(); const v = await video(c); const vo = await video(outro)
      await cobrir(c, v, 'base', dia(0), dia(10)); await cobrir(outro, vo, 'base', dia(0), dia(10))
      expect((await sb.rpc('yt_own_dim_cover_idle', { p_channel: c.canal, p_inicio: null, p_janela: dia(0), p_to: dia(10) })).error).not.toBeNull()
      const p = { p_channel: c.canal, p_inicio: dia(0), p_janela: dia(0), p_to: dia(10) }
      await sb.rpc('yt_own_dim_cover_idle', p)
      const depois1 = await coberturaDe(v, 'pais')
      const r2 = dados(await sb.rpc('yt_own_dim_cover_idle', p) as Rpc)
      expect(await coberturaDe(v, 'pais')).toEqual(depois1)
      expect(r2).toMatchObject({ videos_com_base: 1 })
      expect(await coberturaDe(vo, 'pais')).toEqual([])
    })
  })

  // ═════════════════════════ E. normalizadores: detalhe e alcance ═════════════════════════
  describe('yt_own_traffic_detail_apply e yt_own_reach_dim_apply', () => {
    const T = (h: number): string => `${d(-20)}T${String(h).padStart(2, '0')}:00:00Z`
    const DIA = d(-30)

    it('relatório refeito substitui o dia inteiro (item 249): k3 some, um só source_report_id, soma de B; outro dia e outro canal intactos', async () => {
      const c = await cenario(); const outro = await cenario(); const v = await video(c); const vo = await video(outro)
      const ra = await relatorio(c, { dia: DIA, criado: T(1) })
      const rb = await relatorio(c, { dia: DIA, criado: T(5) })
      const rOutroDia = await relatorio(c, { dia: d(-31), criado: T(2) })
      const rOutroCanal = await relatorio(outro, { dia: DIA, criado: T(2) })
      expect(dados(await aplicarDetalhe(rOutroDia, [detRow(v, d(-31), '4', 'k1', 7)]))).toMatchObject({ status: 'gravado', gravadas: 1 })
      expect(dados(await aplicarDetalhe(rOutroCanal, [detRow(vo, DIA, '4', 'k1', 9)]))).toMatchObject({ status: 'gravado', gravadas: 1 })
      const antesOutros = [await detalheDe(c, d(-31)), await detalheDe(outro)]
      expect(dados(await aplicarDetalhe(ra, [detRow(v, DIA, '4', 'k1', 1), detRow(v, DIA, '4', 'k2', 2), detRow(v, DIA, '4', 'k3', 3)]))).toMatchObject({ status: 'gravado', dia: DIA, gravadas: 3, apagadas: 0 })
      expect(dados(await aplicarDetalhe(rb, [detRow(v, DIA, '4', 'k1', 10), detRow(v, DIA, '4', 'k2', 20)]))).toMatchObject({ status: 'gravado', gravadas: 2, apagadas: 3 })
      const hoje = await detalheDe(c, DIA)
      expect(hoje.map(r => [r.detail, Number(r.views)])).toEqual([['k1', 10], ['k2', 20]])
      expect(await n(`select count(distinct source_report_id) as n from public.yt_own_video_traffic_detail_daily where channel_id = $1 and day_pt = $2`, [c.canal, DIA])).toBe(1)
      expect(await detalheDe(c, d(-31))).toEqual(antesOutros[0])
      expect(await detalheDe(outro)).toEqual(antesOutros[1])
      expect(await normalizadoEm(rb)).not.toBeNull()
    })

    it('dois na fila: o mais velho grava; o mais novo que falha não esvazia o dia (dados I-1)', async () => {
      const c = await cenario(); const v = await video(c)
      const ra = await relatorio(c, { dia: DIA, criado: T(1) })
      const rb = await relatorio(c, { dia: DIA, criado: T(5) }) // baixado e sem normalizar
      expect(dados(await aplicarDetalhe(ra, [detRow(v, DIA, '4', 'k1', 1)]))).toMatchObject({ status: 'gravado', gravadas: 1 })
      await pg.query(`update public.yt_reporting_reports set status = 'erro', error = 'forma_inesperada' where report_id = $1`, [rb])
      const linhas = await detalheDe(c, DIA)
      expect(linhas.length).toBe(1)
      expect(new Set(linhas.map(r => r.source_report_id))).toEqual(new Set([ra]))
    })

    it('o mais velho chegando depois não muda nada (item 87): sai superado, linhas iguais, normalized_at preenchido', async () => {
      const c = await cenario(); const v = await video(c)
      const ra = await relatorio(c, { dia: DIA, criado: T(1) })
      const rb = await relatorio(c, { dia: DIA, criado: T(5) })
      await aplicarDetalhe(rb, [detRow(v, DIA, '4', 'k1', 10)])
      const antes = await detalheDe(c, DIA)
      expect(dados(await aplicarDetalhe(ra, [detRow(v, DIA, '4', 'k1', 1), detRow(v, DIA, '4', 'k9', 9)]))).toMatchObject({ status: 'superado', gravadas: 0, apagadas: 0, videos_cobertos: 0 })
      expect(await detalheDe(c, DIA)).toEqual(antes)
      expect(await normalizadoEm(ra)).not.toBeNull()
    })

    it('o mesmo relatório duas vezes dá as mesmas linhas', async () => {
      const c = await cenario(); const v = await video(c)
      const rb = await relatorio(c, { dia: DIA, criado: T(5) })
      const rows = [detRow(v, DIA, '4', 'k1', 10), detRow(v, DIA, '9', 'site.com', 3, 1.25)]
      await aplicarDetalhe(rb, rows)
      const antes = await detalheDe(c, DIA)
      expect(dados(await aplicarDetalhe(rb, rows))).toMatchObject({ status: 'gravado', gravadas: 2, apagadas: 2 })
      expect(await detalheDe(c, DIA)).toEqual(antes)
      expect(await coberturaDe(v, 'detalhe')).toEqual([[DIA, DIA]])
    })

    it('relatório novo VAZIO apaga o dia (OP-13); a cobertura fica; o antigo reprocessado sai superado', async () => {
      const c = await cenario(); const v = await video(c)
      const ra = await relatorio(c, { dia: DIA, criado: T(1) })
      const rb = await relatorio(c, { dia: DIA, criado: T(5), status: 'vazio' })
      await aplicarDetalhe(ra, [detRow(v, DIA, '4', 'k1', 1)])
      expect((await detalheDe(c, DIA)).length).toBe(1)
      expect(dados(await aplicarDetalhe(rb, []))).toMatchObject({ status: 'gravado', gravadas: 0, apagadas: 1 })
      expect(await detalheDe(c, DIA)).toEqual([])
      expect(await coberturaDe(v, 'detalhe')).toEqual([[DIA, DIA]])
      expect(dados(await aplicarDetalhe(ra, [detRow(v, DIA, '4', 'k1', 1)]))).toMatchObject({ status: 'superado' })
      expect(await detalheDe(c, DIA)).toEqual([])
    })

    it('refazer a fila inteira (normalized_at = null nos quatro) dá o mesmo estado, na ordem de create_time', async () => {
      const c = await cenario(); const v = await video(c)
      const D2 = d(-29)
      const ids = [
        await relatorio(c, { dia: DIA, criado: T(1) }), await relatorio(c, { dia: DIA, criado: T(5) }),
        await relatorio(c, { dia: D2, criado: T(2) }), await relatorio(c, { dia: D2, criado: T(6) }),
      ]
      const corpos: Record<string, Linha[]> = {
        [ids[0]!]: [detRow(v, DIA, '4', 'k1', 1), detRow(v, DIA, '4', 'k3', 3)], [ids[1]!]: [detRow(v, DIA, '4', 'k1', 10)],
        [ids[2]!]: [detRow(v, D2, '4', 'k1', 2)], [ids[3]!]: [detRow(v, D2, '4', 'k1', 20), detRow(v, D2, '4', 'k2', 21)],
      }
      for (const id of ids) await aplicarDetalhe(id, corpos[id]!)
      const estado = async (): Promise<unknown> => (await detalheDe(c)).map(r => [r.dia, r.detail, Number(r.views), r.source_report_id])
      const antes = await estado()
      await pg.query(`update public.yt_reporting_reports set normalized_at = null where channel_id = $1`, [c.canal])
      for (const id of ids) await aplicarDetalhe(id, corpos[id]!)
      expect(await estado()).toEqual(antes)
      expect(await n(`select count(*) as n from public.yt_reporting_reports where channel_id = $1 and normalized_at is null`, [c.canal])).toBe(0)
    })

    it('mais novo ainda só listado não bloqueia o mais velho; quando vira baixado e é aplicado, substitui', async () => {
      const c = await cenario(); const v = await video(c)
      const ra = await relatorio(c, { dia: DIA, criado: T(1) })
      const rb = await relatorio(c, { dia: DIA, criado: T(5), status: 'listado' })
      expect(dados(await aplicarDetalhe(ra, [detRow(v, DIA, '4', 'k1', 1)]))).toMatchObject({ status: 'gravado' })
      await pg.query(`update public.yt_reporting_reports set status = 'baixado', downloaded_at = now() where report_id = $1`, [rb])
      expect(dados(await aplicarDetalhe(rb, [detRow(v, DIA, '4', 'k2', 2)]))).toMatchObject({ status: 'gravado', apagadas: 1 })
      expect((await detalheDe(c, DIA)).map(r => r.detail)).toEqual(['k2'])
    })

    it('dia diferente do relatório, tipo errado, estado errado, relatório inexistente, mais de um dia, chave repetida e linha zerada: exceção; nada gravado; normalized_at continua nulo', async () => {
      const c = await cenario(); const v = await video(c)
      const r = await relatorio(c, { dia: DIA, criado: T(1) })
      const rAlc = await relatorio(c, { dia: DIA, criado: T(1), tipo: TIPO_ALCANCE })
      const rListado = await relatorio(c, { dia: DIA, criado: T(2), status: 'listado' })
      const rLongo = await relatorio(c, { dia: d(-40), criado: T(2), fim: `${d(-38)}T00:00:00Z` })
      const casos: Array<[string, Rpc]> = [
        ['dia diferente', await aplicarDetalhe(r, [detRow(v, d(-31), '4', 'k', 1)])],
        ['tipo errado', await aplicarDetalhe(rAlc, [])],
        ['estado listado', await aplicarDetalhe(rListado, [])],
        ['inexistente', await aplicarDetalhe('nao-existe', [])],
        ['mais de um dia', await aplicarDetalhe(rLongo, [])],
        ['chave repetida', await aplicarDetalhe(r, [detRow(v, DIA, '4', 'k', 1), detRow(v, DIA, '4', 'k', 2)])],
        ['linha zerada', await aplicarDetalhe(r, [detRow(v, DIA, '4', 'k', 0, 0)])],
        ['p_rows nulo', await sb.rpc('yt_own_traffic_detail_apply', { p_report_id: r, p_rows: null, p_unmatched: null }) as Rpc],
        ['detalhe de 301', await aplicarDetalhe(r, [detRow(v, DIA, '4', 'z'.repeat(301), 1)])],
      ]
      for (const [nome, res] of casos) expect(res.error, nome).not.toBeNull()
      expect(casos.find(([nome]) => nome === 'linha zerada')![1].error?.code).toBe('23514')
      expect(casos.find(([nome]) => nome === 'chave repetida')![1].error?.code).toBe('23505')
      expect(casos.find(([nome]) => nome === 'dia diferente')![1].error?.code).toBe('P0001')
      expect(await detalheDe(c)).toEqual([])
      expect(await normalizadoEm(r)).toBeNull()
      expect(await coberturaDe(v, 'detalhe')).toEqual([])
    })

    it('sem par ganha cobertura: vídeo fora de youtube_videos entra com video_id nulo, tem cobertura do dia e o unmatched é gravado; vídeo do canal sem linha também é coberto', async () => {
      const c = await cenario(); const v = await video(c); const sozinho = await video(c)
      const r = await relatorio(c, { dia: DIA, criado: T(1) })
      const semPar = 'zzzzzzzzzzz'
      const linha = detRow({ id: '', yt: semPar }, DIA, '4', 'k', 5)
      delete linha.video_id
      const res = dados(await aplicarDetalhe(r, [detRow(v, DIA, '4', 'k', 1), linha], { count: 1, ids: [semPar] }))
      expect(res).toMatchObject({ status: 'gravado', gravadas: 2, videos_cobertos: 3 })
      const lidas = await q(`select youtube_video_id, video_id from public.yt_own_video_traffic_detail_daily where channel_id = $1 order by 1`, [c.canal])
      expect(lidas.find(x => x.youtube_video_id === semPar)!.video_id).toBeNull()
      expect(lidas.find(x => x.youtube_video_id === v.yt)!.video_id).toBe(v.id)
      expect(await coberturaDe({ id: '', yt: semPar }, 'detalhe')).toEqual([[DIA, DIA]])
      expect(await coberturaDe(sozinho, 'detalhe')).toEqual([[DIA, DIA]])
      expect((await q('select unmatched_video_ids from public.yt_reporting_reports where report_id = $1', [r]))[0]!.unmatched_video_ids).toEqual({ count: 1, ids: [semPar] })
    })

    it('alcance: grava, cliques ausentes ficam NULOS (nunca zero), reaplicar é idempotente, o mais velho sai superado, o vazio apaga o dia', async () => {
      const c = await cenario(); const v = await video(c)
      const ra = await relatorio(c, { dia: DIA, criado: T(1), tipo: TIPO_ALCANCE })
      const rb = await relatorio(c, { dia: DIA, criado: T(5), tipo: TIPO_ALCANCE })
      const rv = await relatorio(c, { dia: DIA, criado: T(9), tipo: TIPO_ALCANCE, status: 'vazio' })
      const rows = [alcRow(v, DIA, '1', 'MOBILE', 'ANDROID', 100, 7.5), alcRow(v, DIA, '1', 'DESKTOP', 'WINDOWS', 50)]
      expect(dados(await aplicarAlcance(rb, rows))).toMatchObject({ status: 'gravado', gravadas: 2, apagadas: 0 })
      const lido = await alcanceDe(c, DIA)
      expect(lido.map(r => [r.device_type, Number(r.thumbnail_impressions), r.thumbnail_clicks_est === null ? null : Number(r.thumbnail_clicks_est)])).toEqual([['DESKTOP', 50, null], ['MOBILE', 100, 7.5]])
      expect(dados(await aplicarAlcance(rb, rows))).toMatchObject({ status: 'gravado', gravadas: 2, apagadas: 2 })
      expect(await alcanceDe(c, DIA)).toEqual(lido)
      expect(dados(await aplicarAlcance(ra, [alcRow(v, DIA, '1', 'TV', 'OTHER', 1)]))).toMatchObject({ status: 'superado' })
      expect(await alcanceDe(c, DIA)).toEqual(lido)
      expect(dados(await aplicarAlcance(rv, []))).toMatchObject({ status: 'gravado', gravadas: 0, apagadas: 2 })
      expect(await alcanceDe(c, DIA)).toEqual([])
      expect(await coberturaDe(v, 'alcance_dim')).toEqual([[DIA, DIA]])
    })

    it('alcance: dia diferente, tipo errado, cliques acima das impressões, impressões zero e chave repetida: exceção; nada gravado', async () => {
      const c = await cenario(); const v = await video(c)
      const r = await relatorio(c, { dia: DIA, criado: T(1), tipo: TIPO_ALCANCE })
      const rDet = await relatorio(c, { dia: DIA, criado: T(1) })
      const casos: Array<[string, Rpc]> = [
        ['dia diferente', await aplicarAlcance(r, [alcRow(v, d(-31), '1', 'M', 'A', 5)])],
        ['tipo errado', await aplicarAlcance(rDet, [])],
        ['cliques acima', await aplicarAlcance(r, [alcRow(v, DIA, '1', 'M', 'A', 5, 6)])],
        ['impressões zero', await aplicarAlcance(r, [alcRow(v, DIA, '1', 'M', 'A', 0)])],
        ['chave repetida', await aplicarAlcance(r, [alcRow(v, DIA, '1', 'M', 'A', 5), alcRow(v, DIA, '1', 'M', 'A', 6)])],
      ]
      for (const [nome, res] of casos) expect(res.error, nome).not.toBeNull()
      expect(await alcanceDe(c)).toEqual([])
      expect(await normalizadoEm(r)).toBeNull()
    })
  })

  // ═════════════════════════ F. yt_own_dim_prova ═════════════════════════
  describe('yt_own_dim_prova', () => {
    const DESDE = dia(0)
    it('parâmetro nulo lança (R9): p_site, p_hoje e p_desde', async () => {
      const c = await cenario()
      for (const p of [{ p_site: null, p_hoje: HOJE, p_desde: DESDE }, { p_site: c.site, p_hoje: null, p_desde: DESDE }, { p_site: c.site, p_hoje: HOJE, p_desde: null }]) {
        const r = await sb.rpc('yt_own_dim_prova', p)
        expect(r.error, JSON.stringify(p)).not.toBeNull()
      }
    })
    it('tabela vazia: site com vídeos antigos e nada mais → faltando 0, com_base 0, sem_base = nº de vídeos, base_ate nulo, tudo o mais 0; as oito chaves', async () => {
      const c = await cenario(); await video(c); await video(c)
      const p = await prova(c, HOJE, DESDE)
      expect(p).toEqual({
        faltando_cobertura: 0, videos_com_base: 0, videos_base_antes_do_inicio: 0, videos_sem_base: 2, base_ate: null,
        dias_dois_relatorios_detalhe: 0, dias_dois_relatorios_alcance: 0, pendentes_normalizar: 0,
      })
    })
    it('outro site não entra (R5): vídeos, base, relatórios e linhas de outro site não mudam os números', async () => {
      const c = await cenario(); await video(c)
      const antes = await prova(c, HOJE, DESDE)
      const o = await cenario(); const vo = await video(o); await video(o)
      await cobrir(o, vo, 'base', dia(0), dia(10))
      const r1 = await relatorio(o, { dia: d(-5), criado: d(-4) + 'T01:00:00Z', baixadoEm: `${d(-4)}T01:00:00Z` })
      await aplicarDetalhe(r1, [detRow(vo, d(-5), '4', 'k', 1)])
      const r2 = await relatorio(o, { dia: d(-5), criado: d(-3) + 'T01:00:00Z' })
      await pg.query(`insert into public.yt_own_video_traffic_detail_daily (youtube_video_id, day_pt, source_type, detail, detail_hash, site_id, channel_id, views, source_report_id, report_create_time, metric_version)
        values ($1, $2, '4', 'x', $3, $4, $5, 1, $6, now(), 'v')`, [vo.yt, d(-5), sha256('x'), o.site, o.canal, r2])
      expect(await prova(c, HOJE, DESDE)).toEqual(antes)
      expect((await prova(o, HOJE, DESDE)).dias_dois_relatorios_detalhe).toBe(1)
    })
    it('sobe: base em 2 vídeos e nenhuma dimensão → faltando 8; não sobe quando os quatro conjuntos cobrem até menor(hoje − 4, base)', async () => {
      const c = await cenario(); const a = await video(c); const b = await video(c)
      for (const v of [a, b]) await cobrir(c, v, 'base', dia(0), dia(10))
      expect(await prova(c, HOJE, DESDE)).toMatchObject({ faltando_cobertura: 8, videos_com_base: 2, base_ate: dia(10) })
      for (const v of [a, b]) for (const s of SETS) await cobrir(c, v, s, dia(0), dia(10))
      expect((await prova(c, HOJE, DESDE)).faltando_cobertura).toBe(0)
    })
    it('a tolerância de 4 dias: com a base perto de hoje, a cobertura precisa chegar só a hoje − 4', async () => {
      const c = await cenario(); const v = await video(c)
      await cobrir(c, v, 'base', dia(0), d(-1))
      for (const s of SETS) await cobrir(c, v, s, dia(0), d(-4))
      expect((await prova(c, HOJE, DESDE)).faltando_cobertura).toBe(0)
      await pg.query(`delete from public.yt_own_video_coverage where youtube_video_id = $1 and metric_set = 'pais'`, [v.yt])
      await cobrir(c, v, 'pais', dia(0), d(-5))
      expect((await prova(c, HOJE, DESDE)).faltando_cobertura).toBe(1)
    })
    it('não sobe por canal desligado (sync_enabled = false): o canal sai da prova inteira', async () => {
      const c = await cenario({ sync: false }); const v = await video(c)
      await cobrir(c, v, 'base', dia(0), dia(10))
      expect(await prova(c, HOJE, DESDE)).toMatchObject({ faltando_cobertura: 0, videos_com_base: 0, videos_sem_base: 0, base_ate: null })
    })
    it('não sobe por vídeo com base anterior à data de partida (software I3): vai em videos_base_antes_do_inicio', async () => {
      const c = await cenario(); const v = await video(c)
      await cobrir(c, v, 'base', '2019-01-01', '2019-03-01')
      expect(await prova(c, HOJE, DESDE)).toMatchObject({ faltando_cobertura: 0, videos_com_base: 1, videos_base_antes_do_inicio: 1, videos_sem_base: 0 })
    })
    it('videos_sem_base não sobe por vídeo publicado anteontem e sobe cinco dias depois (software I3)', async () => {
      const c = await cenario()
      await video(c, `${d(-30)}T12:00:00Z`)
      expect((await prova(c, d(-28), DESDE)).videos_sem_base).toBe(0) // publicação + 2
      expect((await prova(c, d(-27), DESDE)).videos_sem_base).toBe(0) // publicação + 3: ainda na carência
      expect((await prova(c, d(-26), DESDE)).videos_sem_base).toBe(1) // publicação + 4: a fronteira (<= hoje − 4)
      expect((await prova(c, d(-25), DESDE)).videos_sem_base).toBe(1) // publicação + 5
    })
    it('base_ate é o MENOR entre os canais ligados que têm base (dados m-4); canal parado não se esconde atrás de outro', async () => {
      const t = await cenario(); const u = await cenario({ site: t.site })
      const vt = await video(t); const vu = await video(u)
      await cobrir(t, vt, 'base', dia(0), dia(26)); await cobrir(u, vu, 'base', dia(0), dia(10))
      expect((await prova(t, HOJE, DESDE)).base_ate).toBe(dia(10))
    })
    it('dois relatórios no dia: insert direto de duas linhas do mesmo (canal, dia) com source_report_id diferentes → detalhe 1, alcance 0; com um só, 0; dia com mais de 60 dias, 0', async () => {
      const c = await cenario(); const v = await video(c)
      const ins = async (diaStr: string, texto: string, rep: string): Promise<void> => {
        await pg.query(`insert into public.yt_own_video_traffic_detail_daily (youtube_video_id, day_pt, source_type, detail, detail_hash, site_id, channel_id, views, source_report_id, report_create_time, metric_version)
          values ($1, $2, '4', $3, $4, $5, $6, 1, $7, now(), 'v')`, [v.yt, diaStr, texto, sha256(texto), c.site, c.canal, rep])
      }
      await ins(d(-5), 'a', 'r1')
      expect(await prova(c, HOJE, DESDE)).toMatchObject({ dias_dois_relatorios_detalhe: 0, dias_dois_relatorios_alcance: 0 })
      await ins(d(-5), 'b', 'r2')
      expect(await prova(c, HOJE, DESDE)).toMatchObject({ dias_dois_relatorios_detalhe: 1, dias_dois_relatorios_alcance: 0 })
      await ins(d(-70), 'a', 'r1'); await ins(d(-70), 'b', 'r2')
      expect((await prova(c, HOJE, DESDE)).dias_dois_relatorios_detalhe).toBe(1)
      await pg.query(`insert into public.yt_own_video_reach_dim_daily (youtube_video_id, day_pt, traffic_source_type, device_type, operating_system, site_id, channel_id, thumbnail_impressions, source_report_id, report_create_time, metric_version)
        values ($1, $2, '1', 'A', 'B', $3, $4, 5, 'r1', now(), 'v'), ($1, $2, '1', 'C', 'D', $3, $4, 5, 'r2', now(), 'v')`, [v.yt, d(-6), c.site, c.canal])
      expect(await prova(c, HOJE, DESDE)).toMatchObject({ dias_dois_relatorios_detalhe: 1, dias_dois_relatorios_alcance: 1 })
    })
    it('pendentes: baixado há 3 dias sem normalizar conta; o de 1 dia, o de erro, o normalizado e o de canal desligado não (software I3)', async () => {
      const c = await cenario(); const desligado = await cenario({ site: c.site, sync: false })
      const antigo = `${d(-3)}T00:00:00Z`
      await relatorio(c, { dia: d(-10), criado: antigo, baixadoEm: antigo })
      await relatorio(c, { dia: d(-11), criado: antigo, baixadoEm: antigo, tipo: TIPO_ALCANCE, status: 'vazio' })
      expect((await prova(c, HOJE, DESDE)).pendentes_normalizar).toBe(2)
      await relatorio(c, { dia: d(-12), criado: `${d(-1)}T00:00:00Z`, baixadoEm: `${d(-1)}T00:00:00Z` })
      await relatorio(c, { dia: d(-13), criado: `${d(-5)}T00:00:00Z`, baixadoEm: `${d(-5)}T00:00:00Z`, status: 'erro' })
      await relatorio(c, { dia: d(-14), criado: antigo, baixadoEm: antigo, normalizado: true })
      await relatorio(desligado, { dia: d(-10), criado: antigo, baixadoEm: antigo })
      await relatorio(c, { dia: d(-15), criado: antigo, baixadoEm: antigo, tipo: 'channel_reach_basic_a1' }) // outro tipo: não conta
      expect((await prova(c, HOJE, DESDE)).pendentes_normalizar).toBe(2)
    })
  })

  // ═════════════════════════ G. remover canal ═════════════════════════
  describe('youtube_channel_removal_impact e youtube_channel_remove (item 93, R1)', () => {
    it('`serie_coletada` conta as três tabelas, a cobertura, relatórios e uma tabela de "outra etapa" presa por restrict; `youtube_channel_remove` recusa e não apaga', async () => {
      const c = await cenario(); const v = await video(c)
      const inventada = 'zz_e11_teste_' + randomUUID().replace(/-/g, '').slice(0, 8)
      tabelasInventadas.push(inventada)
      await pg.query(`create table public.${inventada} (id serial primary key, channel_id uuid not null references public.youtube_channels(id) on delete restrict)`)
      await pg.query(`insert into public.${inventada} (channel_id) values ($1)`, [c.canal])
      try {
        await cobrir(c, v, 'base', dia(0), dia(10))
        await diario(c, v, [[5, 4]])
        await aplicarDim(c, v, 'traffic_source', 0, 10, [dimRow(5, 'A', 3), dimRow(5, 'B', 1)])
        const rd = await relatorio(c, { dia: d(-30), criado: `${d(-20)}T01:00:00Z` })
        await aplicarDetalhe(rd, [detRow(v, d(-30), '4', 'k', 1)])
        const ra = await relatorio(c, { dia: d(-30), criado: `${d(-20)}T01:00:00Z`, tipo: TIPO_ALCANCE })
        await aplicarAlcance(ra, [alcRow(v, d(-30), '1', 'M', 'A', 5)])

        const presas = await q(`select k.conrelid::regclass::text as tabela, a.attname::text as coluna from pg_constraint k
          join pg_class r on r.oid = k.conrelid join pg_namespace ns on ns.oid = r.relnamespace
          join pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1]
          where k.contype = 'f' and k.confrelid = 'public.youtube_channels'::regclass and k.confdeltype = 'r' and ns.nspname = 'public' and cardinality(k.conkey) = 1 order by 1`)
        const tabelas = presas.map(r => String(r.tabela))
        const NOVAS = ['yt_own_video_dim_daily', 'yt_own_video_traffic_detail_daily', 'yt_own_video_reach_dim_daily']
        for (const t of [...NOVAS, 'yt_own_video_coverage', 'yt_reporting_reports', inventada]) expect(tabelas, `${t} preso ao canal`).toContain(t)
        let esperado = 0; let dasNovas = 0
        for (const t of presas) {
          const nLinhas = Number((await q(`select count(*) as n from ${String(t.tabela)} where ${String(t.coluna)} = $1`, [c.canal]))[0]!.n)
          esperado += nLinhas
          if (NOVAS.includes(String(t.tabela))) dasNovas += nLinhas
        }
        expect(dasNovas).toBe(4) // 2 de dimensão + 1 de detalhe + 1 de alcance
        expect(esperado).toBeGreaterThanOrEqual(4 + 1 /* cobertura base */ + 4 /* trafego, detalhe, alcance_dim + diário */ + 2 /* relatórios */ + 1 /* inventada */)

        const impacto = await sb.rpc('youtube_channel_removal_impact', { p_site_id: c.site, p_channel_id: c.canal })
        expect(impacto.error).toBeNull()
        expect(impacto.data).toMatchObject({ status: 'ok', slug: c.slug, videos: 1 })
        expect(Number((impacto.data as { serie_coletada: number }).serie_coletada)).toBe(esperado)

        const errado = await sb.rpc('youtube_channel_remove', { p_site_id: c.site, p_channel_id: c.canal, p_confirm_slug: 'outro' })
        expect(errado.data).toMatchObject({ status: 'slug_mismatch' })
        const r = await sb.rpc('youtube_channel_remove', { p_site_id: c.site, p_channel_id: c.canal, p_confirm_slug: c.slug })
        expect(r.error).toBeNull()
        expect(r.data).toMatchObject({ status: 'serie_coletada' })
        expect(Number((r.data as { serie_coletada: number }).serie_coletada)).toBe(esperado)
        expect(await n('select count(*) as n from public.youtube_channels where id = $1', [c.canal])).toBe(1)
        expect(await n('select count(*) as n from public.yt_own_video_dim_daily where channel_id = $1', [c.canal])).toBe(2)
      } finally {
        await pg.query(`drop table if exists public.${inventada}`)
      }
    })
    it('o corpo da função de impacto é o único (md5 fixo, o da MG14) e é o texto do bloco entre as marcas do arquivo da MG7', async () => {
      const r = await q(`select md5(prosrc) as m from pg_proc where oid = 'public.youtube_channel_removal_impact(uuid,uuid)'::regprocedure`)
      expect(r[0]!.m).toBe(CORPO_UNICO_MD5)
      const sql = readFileSync(MG7_SQL, 'utf8')
      const ini = sql.indexOf('-- >>> corpo único: youtube_channel_removal_impact (início)')
      const fim = sql.indexOf('-- <<< corpo único: youtube_channel_removal_impact (fim)')
      expect(ini).toBeGreaterThan(-1)
      expect(fim).toBeGreaterThan(ini)
      const bloco = sql.slice(ini, fim)
      const abre = bloco.indexOf(' as $$') + ' as $$'.length
      expect(md5(bloco.slice(abre, bloco.indexOf('$$;', abre)))).toBe(CORPO_UNICO_MD5)
    })
  })

  // ═════════════════════════ H. permissões das funções ═════════════════════════
  describe('permissões das funções (por catálogo, sem chamar)', () => {
    const FNS = [
      'public.yt_own_dim_coverage_extend(text,text,date,date,uuid,uuid,uuid,text)',
      'public.yt_own_dim_apply(text,text,date,date,jsonb,uuid,uuid,uuid)',
      'public.yt_own_dim_cover_idle(uuid,date,date,date)',
      'public.yt_own_traffic_detail_apply(text,jsonb,jsonb)',
      'public.yt_own_reach_dim_apply(text,jsonb,jsonb)',
      'public.yt_own_dim_prova(uuid,date,date)',
      'public.youtube_channel_removal_impact(uuid,uuid)',
    ]
    it('has_function_privilege: só service_role executa as seis da MG7 e a de impacto; PUBLIC não tem execute', async () => {
      for (const fn of FNS) {
        const r = await q(`select r, has_function_privilege(r, $1::regprocedure, 'execute') as ok from unnest(array['anon', 'authenticated', 'service_role']) as r`, [fn])
        expect(Object.fromEntries(r.map(x => [x.r, x.ok])), fn).toEqual({ anon: false, authenticated: false, service_role: true })
        const publico = await q(`select count(*) as n from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a where p.oid = $1::regprocedure and a.grantee = 0`, [fn])
        expect(Number(publico[0]!.n), `PUBLIC em ${fn}`).toBe(0)
      }
    })
    it('as seis têm search_path vazio; só há uma versão de cada nome (a prova é a de três parâmetros)', async () => {
      for (const fn of FNS.slice(0, 6)) {
        const r = await q(`select proconfig, prosecdef from pg_proc where oid = $1::regprocedure`, [fn])
        expect(r[0]!.proconfig, fn).toEqual(['search_path=""'])
      }
      const nomes = ['yt_own_dim_coverage_extend', 'yt_own_dim_apply', 'yt_own_dim_cover_idle', 'yt_own_traffic_detail_apply', 'yt_own_reach_dim_apply', 'yt_own_dim_prova']
      for (const nome of nomes) expect(await n(`select count(*) as n from pg_proc where pronamespace = 'public'::regnamespace and proname = $1`, [nome]), nome).toBe(1)
    })
  })

  // ═════════════════════════ I. o arquivo da MG7 ═════════════════════════
  describe('o arquivo da MG7', () => {
    it('aplica duas vezes seguidas sem erro, na transação desfeita; não muda o corpo da função de impacto nem o número de funções', async () => {
      expect(existsSync(MG7_SQL), MG7_SQL).toBe(true)
      const sql = readFileSync(MG7_SQL, 'utf8')
      const funcoes = (): Promise<number> => n(`select count(*) as n from pg_proc where pronamespace = 'public'::regnamespace and (proname like 'yt_own_dim\\_%' or proname in ('yt_own_traffic_detail_apply', 'yt_own_reach_dim_apply'))`)
      const antes = await funcoes()
      await pg.query('begin')
      try {
        await pg.query(sql); await pg.query(sql)
        expect(await funcoes()).toBe(antes)
        expect(String((await q(`select md5(prosrc) as m from pg_proc where oid = 'public.youtube_channel_removal_impact(uuid,uuid)'::regprocedure`))[0]!.m)).toBe(CORPO_UNICO_MD5)
        expect(await n(`select count(*) as n from pg_policies where schemaname = 'public' and tablename like 'yt_own_video_%dim_daily' or tablename = 'yt_own_video_traffic_detail_daily'`)).toBe(3)
      } finally {
        await pg.query('rollback')
      }
    })
    it('recusa sem a MG14: a guarda do começo lança "MG7 depende da MG14" quando a cobertura não existe (o bloco, com outro nome de tabela)', async () => {
      const sql = readFileSync(MG7_SQL, 'utf8')
      const ini = sql.indexOf('do $$ begin')
      const guarda = sql.slice(ini, sql.indexOf('end $$;', ini) + 'end $$;'.length).replace('public.yt_own_video_coverage', 'public.zz_nao_existe_e11')
      await pg.query('begin')
      try {
        await expect(pg.query(guarda)).rejects.toThrow(/MG7 depende da MG14/)
      } finally {
        await pg.query('rollback')
      }
    })
    it('com can_view_private_site existente a policy a usa (a MG11 antes da MG7); sem ela, usa can_edit_site', async () => {
      const sql = readFileSync(MG7_SQL, 'utf8')
      const usa = async (): Promise<string[]> => (await q(`select qual from pg_policies where schemaname = 'public' and policyname in
        ('yt_own_video_dim_daily_select', 'yt_own_video_traffic_detail_daily_select', 'yt_own_video_reach_dim_daily_select') order by tablename`)).map(r => String(r.qual))
      await pg.query('begin')
      try {
        if (!(await n(`select count(*) as n from pg_proc where proname = 'can_view_private_site'`))) {
          await pg.query(`create function public.can_view_private_site(p_site uuid) returns boolean language sql stable as $$ select false $$`)
        }
        await pg.query(sql)
        const comStub = await usa()
        expect(comStub).toHaveLength(3)
        for (const x of comStub) expect(x).toContain('can_view_private_site(site_id)')
      } finally {
        await pg.query('rollback')
      }
    })
  })

  // ═════════════════════════ J. banco × TypeScript ═════════════════════════
  describe('banco e TypeScript casam', () => {
    const fonte = (arq: string): string => readFileSync(`${RAIZ}apps/web/src/lib/youtube/coleta/${arq}`, 'utf8')
    const argsDoBanco = async (nome: string): Promise<string[]> =>
      (await q(`select unnest(proargnames) as n from pg_proc where oid = $1::regprocedure`, [nome])).map(r => String(r.n))

    it('os nomes de parâmetro que o TypeScript manda são os das funções', async () => {
      const dim = fonte('dimensoes-step.ts')
      const apply = dim.slice(dim.indexOf("rpc('yt_own_dim_apply', {"), dim.indexOf('})', dim.indexOf("rpc('yt_own_dim_apply', {")))
      expect([...apply.matchAll(/(p_\w+):/g)].map(m => m[1]!).sort()).toEqual((await argsDoBanco('public.yt_own_dim_apply(text,text,date,date,jsonb,uuid,uuid,uuid)')).sort())
      const idle = dim.slice(dim.indexOf("rpc('yt_own_dim_cover_idle', {"), dim.indexOf('})', dim.indexOf("rpc('yt_own_dim_cover_idle', {")))
      expect([...idle.matchAll(/(p_\w+):/g)].map(m => m[1]!).sort()).toEqual((await argsDoBanco('public.yt_own_dim_cover_idle(uuid,date,date,date)')).sort())
      const norm = fonte('normalizadores-step.ts')
      const rep = norm.slice(norm.indexOf('rpc(funcao, {'), norm.indexOf('})', norm.indexOf('rpc(funcao, {')))
      const nomesRep = [...rep.matchAll(/(p_\w+):/g)].map(m => m[1]!).sort()
      expect(nomesRep).toEqual((await argsDoBanco('public.yt_own_traffic_detail_apply(text,jsonb,jsonb)')).sort())
      expect(nomesRep).toEqual((await argsDoBanco('public.yt_own_reach_dim_apply(text,jsonb,jsonb)')).sort())
      expect(fonte('normalizadores-step.ts')).toContain("funcao: 'yt_own_traffic_detail_apply'")
      expect(fonte('normalizadores-step.ts')).toContain("funcao: 'yt_own_reach_dim_apply'")
      expect(fonte('e11-config.ts')).toContain("rpc('yt_own_dim_prova', { p_site: p.site, p_hoje: p.hoje, p_desde: p.desde })")
      expect((await argsDoBanco('public.yt_own_dim_prova(uuid,date,date)')).sort()).toEqual(['p_desde', 'p_hoje', 'p_site'])
    })

    it('as chaves do jsonb que o TypeScript monta são as colunas que as funções leem (dim, detalhe, alcance)', async () => {
      const dim = fonte('dimensoes-step.ts')
      const lin = dim.slice(dim.indexOf('function linhaApply'), dim.indexOf('export async function passoDimensoes'))
      expect([...lin.matchAll(/^\s+(\w+):/gm)].map(m => m[1]!).sort()).toEqual(['day_pt', 'dim_value', 'engaged_views', 'metric_version', 'views', 'watch_time_minutes'])
      const sql = readFileSync(MG7_SQL, 'utf8')
      const recordset = (fn: string): string => { const i = sql.indexOf(`function public.${fn}(`); return sql.slice(i, sql.indexOf('end $$;', i)) }
      expect(recordset('yt_own_dim_apply')).toContain('day_pt date, dim_value text, views bigint, engaged_views bigint, watch_time_minutes numeric, metric_version text')
      const norm = fonte('normalizadores-step.ts')
      for (const k of ['youtube_video_id', 'day_pt', 'source_type', 'detail', 'detail_hash', 'views', 'watch_time_minutes', 'metric_version']) expect(norm, k).toContain(k)
      expect(recordset('yt_own_traffic_detail_apply')).toContain('youtube_video_id text, video_id uuid, source_type text, detail text, detail_hash text,\n    views bigint, watch_time_minutes numeric, metric_version text')
      for (const k of ['traffic_source_type', 'device_type', 'operating_system', 'thumbnail_impressions', 'thumbnail_clicks_est']) expect(norm, k).toContain(k)
      expect(recordset('yt_own_reach_dim_apply')).toContain('youtube_video_id text, video_id uuid, traffic_source_type text, device_type text, operating_system text,\n    thumbnail_impressions bigint, thumbnail_clicks_est numeric, metric_version text')
    })

    it('os kinds das tentativas do E11 (dimensoes, normalizador_trafego, normalizador_alcance_dim) são aceitos pelo banco', async () => {
      const c = await cenario()
      for (const kind of COLLECTION_KINDS.filter(k => k === 'dimensoes' || k.startsWith('normalizador_'))) {
        const r = await pg.query(`insert into public.yt_own_collection_attempts (scope_type, scope_id, kind, attempt_day, site_id, channel_id, outcome)
          values ('canal', $1, $2, $3, $4, $5, 'ok') returning kind`, [c.canal, kind, d(-1), c.site, c.canal])
        expect(r.rows[0].kind).toBe(kind)
      }
    })

    it('a prova do banco é lida por lerProva/chamarProva/schemaE11 (as oito chaves, base_ate como data ou nulo)', async () => {
      const c = await cenario(); const v = await video(c)
      const vazia = await chamarProva(sb, { site: c.site, hoje: HOJE, desde: DESDE_TESTE }, Date.now() + 20_000)
      expect(vazia).toMatchObject({ ok: true })
      await cobrir(c, v, 'base', dia(0), dia(10))
      const bruta = dados(await sb.rpc('yt_own_dim_prova', { p_site: c.site, p_hoje: HOJE, p_desde: dia(0) }) as Rpc)
      expect(Object.keys(bruta).sort()).toEqual([
        'base_ate', 'dias_dois_relatorios_alcance', 'dias_dois_relatorios_detalhe', 'faltando_cobertura', 'pendentes_normalizar', 'videos_base_antes_do_inicio', 'videos_com_base', 'videos_sem_base',
      ])
      const lida = lerProva(bruta)
      expect(lida).toMatchObject({ ok: true, prova: { faltando_cobertura: 4, videos_com_base: 1, base_ate: dia(10) } })
      const guarda = await schemaE11(sb, { site: c.site, hoje: HOJE, desde: dia(0) }, Date.now() + 20_000)
      expect(guarda).toMatchObject({ ok: true })
    })

    it('a janela de um conjunto (janelaDoConjunto, TypeScript) é a mesma de yt_own_dim_cover_idle (SQL)', async () => {
      const c = await cenario(); const v = await video(c)
      await cobrir(c, v, 'base', dia(0), dia(40)); await cobrir(c, v, 'pais', dia(0), dia(20))
      // sem view no diário: o SQL cobre exatamente a janela que o TypeScript calcula
      const hoje = dia(42)
      const j = janelaDoConjunto({ hoje, desde: dia(0), baseAte: dia(40), ultimoCoberto: dia(20) })
      expect(j).not.toBeNull()
      await sb.rpc('yt_own_dim_cover_idle', { p_channel: c.canal, p_inicio: dia(0), p_janela: addDays(hoje, -10), p_to: hoje })
      expect(await coberturaDe(v, 'pais')).toEqual([[dia(0), j!.ate]])
      expect(j!.de).toBe(dia(20) < addDays(hoje, -10) ? dia(20) : addDays(hoje, -10))
    })

    it('o TypeScript lê o que o banco devolve: parsers reais (CSV de tráfego e de alcance) → função → leitor real (lerDimensoes e lerDetalheDaOrigem)', async () => {
      const c = await cenario(); const v = await video(c)
      const DIA_R = d(-3)
      const ymd = DIA_R.replace(/-/g, '')
      const cabT = CABECALHO_TRAFEGO.join(',')
      const linhaT = (origem: string, detalhe: string, views: number, min: number, video_ = v.yt): string =>
        `${ymd},${c.uc},${video_},ON_DEMAND,SUBSCRIBED,BR,${origem},${detalhe},${views},0,${min},0,0,0,0`
      const csvT = [cabT,
        linhaT('4', 'termo pesquisado', 3, 1.5), linhaT('4', 'termo pesquisado', 2, 0.5), // somam
        linhaT('9', 'https://site.exemplo/p?q=segredo#f', 4, 2), // URL cortada no ? e hash do inteiro
        linhaT('3', '', 0, 0), // zerada: sai
        linhaT('4', 'a'.repeat(400), 1, 0.25), // detalhe passa de 300: cortado, hash do inteiro
        linhaT('9', 'https://site.exemplo/p', 1, 0), // mesmo detalhe normalizado do outro: soma
      ].join('\n')
      const agT = agregarTrafego(lerTrafego(csvT))
      expect(agT.descartadasZeradas).toBe(1)
      const rd = await relatorio(c, { dia: DIA_R, criado: `${d(-2)}T01:00:00Z` })
      const rowsT = agT.linhas.map(a => ({
        youtube_video_id: a.videoId, video_id: v.id, day_pt: a.day, source_type: a.sourceType, detail: a.detail, detail_hash: a.detailHash,
        views: a.views, watch_time_minutes: a.watchTimeMinutes, metric_version: metricVersion(a.day),
      }))
      expect(dados(await aplicarDetalhe(rd, rowsT))).toMatchObject({ status: 'gravado', gravadas: agT.linhas.length })

      const cabA = CABECALHO_ALCANCE_COMBINADO.join(',')
      const linhaA = (origem: string, ap: string, so: string, imp: number, ctr: string): string => `${ymd},${c.uc},${v.yt},${ap},${so},${origem},,${imp},${ctr}`
      const csvA = [cabA, linhaA('1', 'MOBILE', 'ANDROID', 100, '0.05'), linhaA('1', 'MOBILE', 'ANDROID', 100, '0.10'), linhaA('1', 'DESKTOP', 'WINDOWS', 40, ''), linhaA('3', 'TV', 'OTHER', 0, '0.1')].join('\n')
      const agA = agregarAlcanceCombinado(lerAlcanceCombinado(csvA))
      const ra = await relatorio(c, { dia: DIA_R, criado: `${d(-2)}T01:00:00Z`, tipo: TIPO_ALCANCE })
      const rowsA = agA.linhas.map(a => ({
        youtube_video_id: a.videoId, video_id: v.id, day_pt: a.day, traffic_source_type: a.trafficSourceType, device_type: a.deviceType,
        operating_system: a.operatingSystem, thumbnail_impressions: a.impressions, ...(a.clicksEst !== null ? { thumbnail_clicks_est: a.clicksEst } : {}),
        metric_version: metricVersion(a.day),
      }))
      expect(dados(await aplicarAlcance(ra, rowsA))).toMatchObject({ status: 'gravado', gravadas: 2 })
      const alc = await alcanceDe(c, DIA_R)
      expect(alc.map(r => [r.device_type, Number(r.thumbnail_impressions), r.thumbnail_clicks_est === null ? null : Number(r.thumbnail_clicks_est)])).toEqual([['DESKTOP', 40, null], ['MOBILE', 200, 15]])

      // a API: uma linha por dimensão, de um dia que o diário viu
      await cobrir(c, v, 'base', d(-10), d(-1)); await diario(c, v, [])
      await pg.query(`insert into public.yt_own_video_daily (youtube_video_id, day_pt, site_id, video_id, channel_id, views, metric_version) values ($1, $2, $3, $4, $5, 6, $6) on conflict (youtube_video_id, day_pt) do update set views = 6`,
        [v.yt, DIA_R, c.site, v.id, c.canal, metricVersion(DIA_R)])
      const aplicado = dados(await sb.rpc('yt_own_dim_apply', {
        p_video: v.yt, p_kind: 'traffic_source', p_from: d(-8), p_to: d(-1),
        p_rows: [{ day_pt: DIA_R, dim_value: 'YT_SEARCH', views: 4, engaged_views: 3, watch_time_minutes: 2.5, metric_version: metricVersion(DIA_R) }, { day_pt: DIA_R, dim_value: 'EXT_URL', views: 2, watch_time_minutes: 0.5, metric_version: metricVersion(DIA_R) }],
        p_site: c.site, p_video_id: v.id, p_channel: c.canal,
      }) as Rpc)
      expect(aplicado).toMatchObject({ status: 'gravado', gravadas: 2, dias_em_revisao: 0 })

      // o leitor real, com o token real (guarda simulada), contra o banco
      const edicao = await provarEdicao(c.site)
      expect(edicao).not.toBeNull()
      const pedido = { edicao, canalId: c.canal, hoje: HOJE, ytIds: [v.yt], de: d(-8), ate: d(-1), desde: { trafego: d(-30), dispositivo: d(-30), pais: d(-30), inscrito: d(-30), detalhe: d(-30), alcance_dim: d(-30) } }
      const lido = await lerDimensoes(sb, pedido)
      expect(lido.acesso).toBe('ok')
      if (lido.acesso !== 'ok') return
      const trafego = lido.dado.conjuntos.trafego.videos.find(x => x.ytId === v.yt)!.dias.find(x => x.dia === DIA_R)!
      expect(JSON.stringify(trafego)).toContain('YT_SEARCH')
      const alcDim = lido.dado.conjuntos.alcance_dim.videos.find(x => x.ytId === v.yt)!.dias.find(x => x.dia === DIA_R)!
      expect(JSON.stringify(alcDim)).toContain('200')
      expect(lido.dado.descartados).toBe(0)
      const det = await lerDetalheDaOrigem(sb, pedido)
      expect(det.acesso).toBe('ok')
      if (det.acesso !== 'ok') return
      const detDia = det.dado.conjunto.videos.find(x => x.ytId === v.yt)!.dias.find(x => x.dia === DIA_R)!
      // 4 grupos: termo (5 views), URL sem query (5 views), detalhe longo (1) — 3 linhas úteis
      expect(JSON.stringify(detDia)).toContain('termo pesquisado')
      expect(JSON.stringify(detDia)).not.toContain('segredo') // a query da URL nunca chegou ao banco
      expect(await n(`select count(*) as n from public.yt_own_video_traffic_detail_daily where channel_id = $1 and detail like '%segredo%'`, [c.canal])).toBe(0)
      expect(await n(`select max(char_length(detail)) as n from public.yt_own_video_traffic_detail_daily where channel_id = $1`, [c.canal])).toBeLessThanOrEqual(300)
      expect(await n(`select count(*) as n from public.yt_own_video_traffic_detail_daily where channel_id = $1`, [c.canal])).toBe(agT.linhas.length)
    })
  })

  const DESDE_TESTE = dia(0)
})
