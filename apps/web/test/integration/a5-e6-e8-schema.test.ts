// @vitest-environment node
/**
 * A5 · E6 (dieta do diário, MG14) e E8 (curva de retenção, MG5): o SQL dos apêndices A e B contra Postgres de verdade, e o
 * TypeScript da coleta (`coleta/cobertura.ts`, `diario-step.ts`, `retencao-regra.ts`, `retencao-step.ts`, `atraso-permanente.ts`,
 * `kinds.ts`) contra o banco real. Banco: SÓ o `bythiago_int`. Rodar com:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/a5-e6-e8-schema.test.ts --no-file-parallelism
 *
 * O banco é dividido com outras etapas: cada teste cria o SEU site e o SEU canal e só olha para eles; o arquivo semeia e limpa.
 * Função sem EXECUTE nunca é CHAMADA aqui como anon/authenticated (derruba este Postgres): o privilégio se confere por catálogo.
 * Datas: todas relativas a hoje (UTC) ou passadas e fixas; nada no futuro.
 * O trecho "── 2." da MG14 (a carga) é lido do arquivo de migration (supabase/migrations/, Tarefa 1b) e roda dentro
 * de uma transação DESFEITA, porque ele varre o diário inteiro do banco compartilhado.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Client } from 'pg'
import { createClient } from '@supabase/supabase-js'
import { createHash, randomUUID } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite, signUserJwt, SUPABASE_URL, ANON_KEY } from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { COLLECTION_KINDS, KIND_RE, ehKind } from '@/lib/youtube/coleta/kinds'
import { lerCoberturaBase } from '@/lib/youtube/coleta/cobertura'
import { addDays, dayPt, utcDay } from '@/lib/youtube/coleta/day-pt'
import { metricVersion } from '@/lib/youtube/coleta/metric-version'
import { diarioDoVideo, type DiaDoVideo, type ValoresDiario } from '@/lib/youtube/coleta/analytics-diario'
import { retencaoDoVideo } from '@/lib/youtube/coleta/analytics-retencao'
import { lerFatos } from '@/lib/youtube/coleta/retencao-regra'
import { youtubeNaoDevolveu } from '@/lib/youtube/coleta/atraso-permanente'

vi.setConfig({ testTimeout: 60_000 })

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const RAIZ = fileURLToPath(new URL('../../../../', import.meta.url))
const HOJE = utcDay(new Date())
const d = (n: number): string => addDays(HOJE, n)
/** Dia n da série de teste das funções de gravação: 80 dias atrás + n. */
const B0 = d(-80)
const dia = (n: number): string => addDays(B0, n)
const CORPO_UNICO_MD5 = '4827d5ad12a0120b52ebc1280491b00c'

type Linha = Record<string, unknown>
interface Cen { site: string; canal: string; uc: string; slug: string }
interface Vid { id: string; yt: string }

function lerSql(nome: 'mg14' | 'mg5'): string {
  // Tarefa 1b: o SQL vem SEMPRE de supabase/migrations/ (nunca de .superpowers/, pasta ignorada pelo git que não existe na CI).
  const marca = nome === 'mg14' ? 'observatorio_a5_e6_dieta_cobertura' : 'observatorio_a5_e8_retencao'
  const dir = `${RAIZ}supabase/migrations/`
  const achado = readdirSync(dir).find(f => f.includes(marca))
  if (!achado) throw new Error(`a migration de ${nome} (${marca}) não existe em supabase/migrations/`)
  return readFileSync(dir + achado, 'utf8')
}

const md5 = (s: string): string => createHash('md5').update(s).digest('hex')

describe.skipIf(skipIfNoLocalDb())('A5 E6 e E8: schema, funções SQL e o TypeScript da coleta contra o banco (bythiago_int)', () => {
  let pg: Client
  let sb: ReturnType<typeof getSupabaseServiceClient>
  const sites: string[] = []
  const usuarios: string[] = []
  /** Sites dos testes de `yt_own_daily_apply`: o teste de invariante olha só para eles. */
  const sitesApply: string[] = []

  beforeAll(async () => {
    sb = getSupabaseServiceClient()
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
  })
  afterAll(async () => {
    try {
      if (sites.length > 0) {
        // FK "restrict" do canal: as tabelas presas a ele primeiro, depois vídeos, canais, e o site leva o resto por cascata
        for (const t of ['yt_own_video_retention', 'yt_own_video_coverage', 'yt_own_video_daily', 'yt_own_collection_attempts', 'youtube_videos', 'youtube_channels']) {
          await pg.query(`delete from public.${t} where site_id = any($1::uuid[])`, [sites])
        }
        await pg.query('delete from public.site_memberships where site_id = any($1::uuid[])', [sites])
        await pg.query('delete from public.audit_log where site_id = any($1::uuid[])', [sites])
      }
      if (usuarios.length > 0) await pg.query('delete from auth.users where id = any($1::uuid[])', [usuarios])
      if (sites.length > 0) await pg.query('delete from public.sites where id = any($1::uuid[])', [sites])
    } finally {
      await pg.end()
    }
  })

  // ───────────────────────── semeadura e leitura ─────────────────────────
  const q = async (sql: string, params: unknown[] = []): Promise<Linha[]> => (await pg.query(sql, params)).rows as Linha[]

  async function cenario(paraApply = false): Promise<Cen> {
    const site = (await seedSite(sb)).siteId
    sites.push(site)
    if (paraApply) sitesApply.push(site)
    const n = randomUUID().replace(/-/g, '')
    const uc = 'UC' + n.slice(0, 22)
    const slug = 'teste-' + n.slice(0, 8)
    const r = await q(`insert into public.youtube_channels (site_id, channel_id, locale, handle, name, uploads_playlist_id, slug)
      values ($1, $2, 'pt', $3, 'Teste', $4, $5) returning id`, [site, uc, '@t' + n.slice(0, 8), 'UU' + n.slice(2, 24), slug])
    return { site, canal: String(r[0]!.id), uc, slug }
  }
  async function video(c: Cen, publicado: string = new Date(Date.parse(d(-120) + 'T12:00:00Z')).toISOString()): Promise<Vid> {
    const yt = 'y' + randomUUID().replace(/-/g, '').slice(0, 10)
    const r = await q(`insert into public.youtube_videos (site_id, channel_id, youtube_video_id, title, published_at)
      values ($1, $2, $3, 'Teste', $4) returning id`, [c.site, c.canal, yt, publicado])
    return { id: String(r[0]!.id), yt }
  }

  // ── O pacote que `coleta/diario-step.ts` monta (a cópia é conferida contra o fonte no teste "os nomes casam") ──
  const metricasZero = (views: number, extra: ValoresDiario = {}): ValoresDiario => ({
    views, watch_time_minutes: 0,
    avg_view_duration_seconds: views === 0 ? null : 30, avg_view_percentage: views === 0 ? null : 50,
    likes: 0, comments: 0, shares: 0, subscribers_gained: 0, subscribers_lost: 0, ...extra,
  })
  const diaDe = (n: number, valores: ValoresDiario): DiaDoVideo => ({ day: dia(n), valores })
  const pacote = (c: Cen, v: Vid, dias: DiaDoVideo[], sets: string[] = ['base']) => ({
    p_video: v.yt,
    p_ids: { site_id: c.site, channel_id: c.canal, video_id: v.id },
    p_rows: dias.map(x => ({ day_pt: x.day, metric_version: metricVersion(x.day), ...x.valores })),
    p_days_returned: dias.map(x => x.day),
    p_sets: sets,
  })
  const aplicar = (c: Cen, v: Vid, dias: DiaDoVideo[], sets: string[] = ['base']) => sb.rpc('yt_own_daily_apply', pacote(c, v, dias, sets))
  /** O que o passo decide antes de chamar a função (a mesma regra de `diario-step.ts`): `null` = forma inesperada, a função não é chamada. */
  function setsDoPasso(dias: DiaDoVideo[], estendidas: 'ok' | 'recusadas'): string[] | null {
    if (!dias.every(x => typeof x.valores.views === 'number')) return null
    if (estendidas === 'ok' && dias.every(x => typeof x.valores.engaged_views === 'number')) return ['base', 'estendidas']
    return ['base']
  }

  const diarioDe = async (v: Vid): Promise<Linha[]> =>
    (await sb.from('yt_own_video_daily').select('*').eq('youtube_video_id', v.yt).order('day_pt')).data as Linha[]
  const coberturaDe = async (v: Vid, set: string): Promise<Array<[string, string]>> =>
    ((await sb.from('yt_own_video_coverage').select('covered_from, covered_to').eq('youtube_video_id', v.yt).eq('metric_set', set).order('covered_from')).data as Array<{ covered_from: string; covered_to: string }>)
      .map(r => [r.covered_from, r.covered_to])
  const contar = async (tabela: string, v: Vid): Promise<number> =>
    Number((await q(`select count(*) as n from public.${tabela} where youtube_video_id = $1`, [v.yt]))[0]!.n)

  async function tentativa(c: Cen, o: { escopo?: 'video' | 'canal'; id: string; kind: string; dia: string; outcome: string; status?: number | null; error?: string | null; canal?: string }): Promise<void> {
    await pg.query(`insert into public.yt_own_collection_attempts (scope_type, scope_id, kind, attempt_day, site_id, channel_id, outcome, http_status, error)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`, [o.escopo ?? 'video', o.id, o.kind, o.dia, c.site, o.canal ?? c.canal, o.outcome, o.status ?? null, o.error ?? null])
  }
  const quatroDias = async (c: Cen, v: Vid, D: string, o: { outcome: string; status?: number | null; error?: string | null }): Promise<void> => {
    for (let k = 3; k >= 0; k--) await tentativa(c, { id: v.yt, kind: 'diario', dia: addDays(D, -k), ...o })
  }

  const ponto = (t: number, ratio: number, relative: number | null = null, imp: number | null = null) => ({ t, ratio, relative, segment_impressions: imp })
  function linhaRetencao(c: Cen, v: Vid, o: Linha = {}): Linha {
    return {
      youtube_video_id: v.yt, window_kind: 'vida', segment: 'organico', window_end: d(-3), window_start: d(-30), requested_end: d(-2),
      site_id: c.site, video_id: v.id, channel_id: c.canal,
      points: [ponto(0.01, 1.05, 0.5, 100), ponto(0.02, 0.9, 0.4, 90)], point_count: 2, metrics_returned: ['audienceWatchRatio', 'relativeRetentionPerformance'],
      views_at_read: 10, source: 'analytics_api', collected_at: new Date().toISOString(), metric_version: metricVersion(d(-3)), ...o,
    }
  }

  /** Chama `yt_own_retention_facts` e confere que o Zod de `lerFatos` aceita o que o banco devolve (e que nenhum campo some ou sobra). */
  async function fatos(c: Cen, hoje?: string): Promise<ReturnType<typeof lerFatos>> {
    const r = await sb.rpc('yt_own_retention_facts', hoje === undefined ? { p_channel_id: c.canal } : { p_channel_id: c.canal, p_hoje_utc: hoje })
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

  // ═════════════════════════ A. schema ═════════════════════════
  describe('schema das duas tabelas', () => {
    const colunas = async (tabela: string): Promise<Record<string, string>> =>
      Object.fromEntries((await q(`select column_name, udt_name, is_nullable, column_default from information_schema.columns
        where table_schema = 'public' and table_name = $1 order by ordinal_position`, [tabela]))
        .map(r => [String(r.column_name), `${r.udt_name}|${r.is_nullable === 'NO' ? 'nn' : 'null'}`]))

    it('yt_own_video_coverage: colunas, tipos, chave, índice, FKs e checks', async () => {
      expect(await colunas('yt_own_video_coverage')).toEqual({
        youtube_video_id: 'text|nn', metric_set: 'text|nn', covered_from: 'date|nn', covered_to: 'date|nn', site_id: 'uuid|nn',
        video_id: 'uuid|null', channel_id: 'uuid|nn', source: 'text|nn', collected_at: 'timestamptz|nn',
      })
      const pk = await q(`select pg_get_constraintdef(oid) as def from pg_constraint where conrelid = 'public.yt_own_video_coverage'::regclass and contype = 'p'`)
      expect(pk[0]!.def).toBe('PRIMARY KEY (youtube_video_id, metric_set, covered_from)')
      const idx = await q(`select indexdef from pg_indexes where schemaname = 'public' and tablename = 'yt_own_video_coverage' and indexname = 'idx_yt_own_video_coverage_channel'`)
      expect(String(idx[0]?.indexdef)).toContain('(channel_id, metric_set, covered_to)')
      const fks = await q(`select a.attname as col, k.confdeltype as acao, k.confrelid::regclass::text as alvo from pg_constraint k
        join pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1] where k.conrelid = 'public.yt_own_video_coverage'::regclass and k.contype = 'f' order by 1`)
      expect(fks.map(r => `${r.col}:${r.alvo}:${r.acao}`)).toEqual(['channel_id:youtube_channels:r', 'site_id:sites:c', 'video_id:youtube_videos:n'])
      const defs = (await q(`select pg_get_constraintdef(oid) as def from pg_constraint where conrelid = 'public.yt_own_video_coverage'::regclass and contype = 'c'`)).map(r => String(r.def)).join('\n')
      for (const conjunto of ['base', 'estendidas', 'trafego', 'dispositivo', 'pais', 'inscrito', 'detalhe', 'alcance_dim', 'meta_texto', 'meta_thumb']) expect(defs).toContain(`'${conjunto}'`)
      expect(defs).toContain('covered_to >= covered_from')
      expect(defs).toContain("'analytics_api'")
      expect(defs).toContain("'reporting_api'")
    })

    it('yt_own_video_coverage: conjunto inventado, fonte inventada e intervalo invertido são recusados; a linha boa entra', async () => {
      const c = await cenario(); const v = await video(c)
      const base = { youtube_video_id: v.yt, metric_set: 'base', covered_from: d(-10), covered_to: d(-9), site_id: c.site, video_id: v.id, channel_id: c.canal }
      for (const ruim of [{ metric_set: 'inventado' }, { source: 'x' }, { covered_from: d(-9), covered_to: d(-10) }]) {
        expect((await sb.from('yt_own_video_coverage').insert({ ...base, ...ruim })).error?.code, JSON.stringify(ruim)).toBe('23514')
      }
      expect((await sb.from('yt_own_video_coverage').insert(base)).error).toBeNull()
      expect((await sb.from('yt_own_video_coverage').insert(base)).error?.code).toBe('23505')
    })

    it('yt_own_video_retention: colunas, tipos, chave, índice, FKs e checks', async () => {
      expect(await colunas('yt_own_video_retention')).toEqual({
        youtube_video_id: 'text|nn', window_kind: 'text|nn', segment: 'text|nn', window_end: 'date|nn', window_start: 'date|nn', requested_end: 'date|nn',
        site_id: 'uuid|nn', video_id: 'uuid|null', channel_id: 'uuid|nn', points: 'jsonb|nn', point_count: 'int4|nn', metrics_returned: '_text|nn',
        views_at_read: 'int8|null', source: 'text|nn', collected_at: 'timestamptz|nn', metric_version: 'text|nn',
      })
      const pk = await q(`select pg_get_constraintdef(oid) as def from pg_constraint where conrelid = 'public.yt_own_video_retention'::regclass and contype = 'p'`)
      expect(pk[0]!.def).toBe('PRIMARY KEY (youtube_video_id, window_kind, segment, window_end)')
      const idx = await q(`select indexdef from pg_indexes where schemaname = 'public' and tablename = 'yt_own_video_retention' and indexname = 'idx_yt_own_video_retention_channel'`)
      expect(String(idx[0]?.indexdef)).toContain('(channel_id, window_end)')
      const fks = await q(`select a.attname as col, k.confdeltype as acao, k.confrelid::regclass::text as alvo from pg_constraint k
        join pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1] where k.conrelid = 'public.yt_own_video_retention'::regclass and k.contype = 'f' order by 1`)
      expect(fks.map(r => `${r.col}:${r.alvo}:${r.acao}`)).toEqual(['channel_id:youtube_channels:r', 'site_id:sites:c', 'video_id:youtube_videos:n'])
    })

    it('a chave do upsert do passo "retenção" é a chave primária da tabela', async () => {
      const fonte = readFileSync(`${RAIZ}apps/web/src/lib/youtube/coleta/retencao-step.ts`, 'utf8')
      const m = /const CHAVE_DA_CURVA = '([^']+)'/.exec(fonte)
      expect(m, 'CHAVE_DA_CURVA no fonte').not.toBeNull()
      const pk = await q(`select a.attname from pg_constraint k join pg_attribute a on a.attrelid = k.conrelid and a.attnum = any(k.conkey)
        where k.conrelid = 'public.yt_own_video_retention'::regclass and k.contype = 'p'`)
      expect(m![1]!.split(',').sort()).toEqual(pk.map(r => String(r.attname)).sort())
    })

    it('RLS ligada nas duas tabelas, uma policy de leitura em cada e nenhuma de escrita', async () => {
      const rls = await q(`select relname, relrowsecurity from pg_class where oid in ('public.yt_own_video_coverage'::regclass, 'public.yt_own_video_retention'::regclass) order by 1`)
      expect(rls.map(r => [r.relname, r.relrowsecurity])).toEqual([['yt_own_video_coverage', true], ['yt_own_video_retention', true]])
      const pol = await q(`select tablename, policyname, cmd, qual from pg_policies where schemaname = 'public' and tablename in ('yt_own_video_coverage', 'yt_own_video_retention') order by 1`)
      expect(pol.map(r => [r.tablename, r.policyname, r.cmd])).toEqual([
        ['yt_own_video_coverage', 'yt_own_video_coverage_select', 'SELECT'],
        ['yt_own_video_retention', 'yt_own_video_retention_select', 'SELECT'],
      ])
      // a leitura é por quem EDITA o site (ou pelo direito "ver desempenho privado", se existir): nunca pelo GUC
      for (const p of pol) {
        expect(String(p.qual)).toMatch(/can_edit_site\(site_id\)|can_view_private_site\(site_id\)/)
        expect(String(p.qual)).not.toMatch(/app\.site_id|site_visible/)
      }
    })
  })

  // ═════════════════════════ B. a carga da cobertura (trecho "── 2." da MG14) ═════════════════════════
  describe('MG14: carga inicial da cobertura', () => {
    it('a cobertura nasce do diário existente: uma ilha por sequência de dias, só onde o conjunto foi medido, e rodar de novo não cria nada', async () => {
      const trecho = (() => {
        const sql = lerSql('mg14')
        const ini = sql.indexOf('-- ── 2.')
        const fim = sql.indexOf('-- ── 3.')
        expect(ini).toBeGreaterThan(-1)
        expect(fim).toBeGreaterThan(ini)
        return sql.slice(ini, fim)
      })()
      const c = await cenario()
      const v1 = await video(c); const v2 = await video(c); const v3 = await video(c)
      const linha = async (v: Vid, n: number, views: number | null, engaged: number | null): Promise<void> => {
        await pg.query(`insert into public.yt_own_video_daily (youtube_video_id, day_pt, site_id, video_id, channel_id, views, engaged_views, metric_version)
          values ($1, $2, $3, $4, $5, $6, $7, $8)`, [v.yt, dia(n), c.site, v.id, c.canal, views, engaged, metricVersion(dia(n))])
      }
      // v1: dias 1,2,3 com views; dia 4 com views NULO e engaged 5; dias 6,7 com views (buraco no dia 5). engaged nos dias 1, 2, 4.
      await linha(v1, 1, 3, 3); await linha(v1, 2, 4, 4); await linha(v1, 3, 5, null); await linha(v1, 4, null, 5); await linha(v1, 6, 1, null); await linha(v1, 7, 2, null)
      // v2: só linha com views nulo e engaged: nenhum intervalo base, um intervalo estendidas
      await linha(v2, 1, null, 7)
      // v3: um vídeo que JÁ tem cobertura base: a carga não cria intervalo picado por cima
      await linha(v3, 1, 1, null); await linha(v3, 2, 1, null)
      await pg.query(`insert into public.yt_own_video_coverage (youtube_video_id, metric_set, covered_from, covered_to, site_id, video_id, channel_id)
        values ($1, 'base', $2, $3, $4, $5, $6)`, [v3.yt, dia(1), dia(30), c.site, v3.id, c.canal])

      const ler = async (v: Vid): Promise<Linha[]> => q(`select metric_set, covered_from::text as de, covered_to::text as ate, site_id, channel_id, video_id, source
        from public.yt_own_video_coverage where youtube_video_id = $1 order by metric_set, covered_from`, [v.yt])
      await pg.query('begin')
      try {
        await pg.query(trecho)
        const a1 = await ler(v1); const a2 = await ler(v2); const a3 = await ler(v3)
        expect(a1.map(r => `${r.metric_set} ${r.de} ${r.ate}`)).toEqual([
          `base ${dia(1)} ${dia(3)}`, `base ${dia(6)} ${dia(7)}`,
          `estendidas ${dia(1)} ${dia(2)}`, `estendidas ${dia(4)} ${dia(4)}`,
        ])
        for (const r of a1) expect(r).toMatchObject({ site_id: c.site, channel_id: c.canal, video_id: v1.id, source: 'analytics_api' })
        expect(a2.map(r => `${r.metric_set} ${r.de} ${r.ate}`)).toEqual([`estendidas ${dia(1)} ${dia(1)}`])
        // v3 já tinha base: só ganha o que lhe falta (estendidas não: engaged nulo)
        expect(a3.map(r => `${r.metric_set} ${r.de} ${r.ate}`)).toEqual([`base ${dia(1)} ${dia(30)}`])
        // de novo: nada muda, nem o collected_at
        await pg.query(trecho)
        expect(await ler(v1)).toEqual(a1)
        expect(await ler(v2)).toEqual(a2)
        expect(await ler(v3)).toEqual(a3)
        const todas = async (): Promise<Linha[]> => q(`select * from public.yt_own_video_coverage where site_id = $1 order by youtube_video_id, metric_set, covered_from`, [c.site])
        const antes = await todas()
        await pg.query(trecho)
        expect(await todas()).toEqual(antes)
      } finally {
        await pg.query('rollback')
      }
      // a carga é global (varre o banco todo): ficou só dentro da transação desfeita
      expect(await ler(v1)).toEqual([])
      expect(await ler(v2)).toEqual([])
    })
  })

  // ═════════════════════════ C. yt_own_daily_apply ═════════════════════════
  describe('yt_own_daily_apply', () => {
    const RETORNO = ['apagadas', 'atualizadas', 'dias', 'inseridas', 'intervalos']

    it('apply: dia com atividade entra, dia de zero não', async () => {
      const c = await cenario(true); const v = await video(c)
      const dias = Array.from({ length: 9 }, (_, i) => diaDe(i, metricasZero(i === 4 ? 2 : 0)))
      const r = await aplicar(c, v, dias)
      expect(r.error).toBeNull()
      expect(r.data).toEqual({ dias: 9, atualizadas: 0, inseridas: 1, apagadas: 0, intervalos: 1 })
      expect(Object.keys(r.data as object).sort(), 'o retorno que o Zod do passo lê').toEqual(RETORNO)
      expect((await diarioDe(v)).map(x => [x.day_pt, x.views])).toEqual([[dia(4), 2]])
      expect(await coberturaDe(v, 'base')).toEqual([[dia(0), dia(8)]])
      expect(await coberturaDe(v, 'estendidas')).toEqual([])
    })

    it('apply: dia revisado para zero perde a linha e continua coberto (item 46)', async () => {
      const c = await cenario(true); const v = await video(c)
      const ate = (views: number) => Array.from({ length: 9 }, (_, i) => diaDe(i, metricasZero(i === 4 ? views : 0)))
      await aplicar(c, v, ate(2))
      const cob = await coberturaDe(v, 'base')
      const r = await aplicar(c, v, ate(0))
      expect(r.error).toBeNull()
      expect(r.data).toMatchObject({ apagadas: 1, inseridas: 0 })
      expect(await diarioDe(v)).toEqual([])
      expect(await coberturaDe(v, 'base')).toEqual(cob)
    })

    it('apply: chave ausente não apaga valor gravado', async () => {
      const c = await cenario(true); const v = await video(c)
      const r1 = await aplicar(c, v, [diaDe(0, { ...metricasZero(5), engaged_views: 5, card_impressions: 7, card_click_rate: 0.1 })], ['base', 'estendidas'])
      expect(r1.error).toBeNull()
      const r2 = await aplicar(c, v, [diaDe(0, metricasZero(0))], ['base'])
      expect(r2.error).toBeNull()
      expect(r2.data).toMatchObject({ atualizadas: 1, apagadas: 0 })
      const [linha] = await diarioDe(v)
      expect(linha).toMatchObject({ views: 0, card_impressions: 7, engaged_views: 5, card_click_rate: 0.1 })
    })

    it('apply: chave presente e nula grava nulo (e ausente deixa como está)', async () => {
      const c = await cenario(true); const v = await video(c)
      await aplicar(c, v, [diaDe(0, metricasZero(5, { avg_view_percentage: 41.5, avg_view_duration_seconds: 20 }))])
      expect((await diarioDe(v))[0]).toMatchObject({ avg_view_percentage: 41.5, avg_view_duration_seconds: 20 })
      const { avg_view_percentage: _ausente, ...semPercentagem } = metricasZero(5, { avg_view_duration_seconds: 21 })
      void _ausente
      await aplicar(c, v, [diaDe(0, semPercentagem)])
      expect((await diarioDe(v))[0]).toMatchObject({ avg_view_percentage: 41.5, avg_view_duration_seconds: 21 })
      await aplicar(c, v, [diaDe(0, metricasZero(5, { avg_view_percentage: null }))])
      expect((await diarioDe(v))[0]).toMatchObject({ avg_view_percentage: null })
    })

    it('apply: buraco parte o intervalo e o dia que chega depois funde', async () => {
      const c = await cenario(true); const v = await video(c)
      await aplicar(c, v, [20, 21, 23].map(n => diaDe(n, metricasZero(1))))
      expect(await coberturaDe(v, 'base')).toEqual([[dia(20), dia(21)], [dia(23), dia(23)]])
      const r = await aplicar(c, v, Array.from({ length: 7 }, (_, i) => diaDe(16 + i, metricasZero(1))))
      expect(r.error).toBeNull()
      expect(await coberturaDe(v, 'base')).toEqual([[dia(16), dia(23)]])
      // dia vizinho (sem sobrepor) também funde
      await aplicar(c, v, [diaDe(24, metricasZero(1))])
      expect(await coberturaDe(v, 'base')).toEqual([[dia(16), dia(24)]])
    })

    it('apply: conjuntos independentes', async () => {
      const c = await cenario(true); const v = await video(c)
      await aplicar(c, v, [1, 2, 3].map(n => diaDe(n, metricasZero(1, { engaged_views: 1 }))), ['base', 'estendidas'])
      await aplicar(c, v, [5, 6].map(n => diaDe(n, metricasZero(1))), ['base'])
      expect(await coberturaDe(v, 'base')).toEqual([[dia(1), dia(3)], [dia(5), dia(6)]])
      expect(await coberturaDe(v, 'estendidas')).toEqual([[dia(1), dia(3)]])
    })

    it('apply recusa dia sem `views` no conjunto base, e nada é gravado (a função não aceita "views ausente")', async () => {
      const c = await cenario(true); const v = await video(c)
      const bom = diaDe(0, metricasZero(5))
      const { views: _v, ...semViews } = metricasZero(0)
      void _v
      const casos: Array<[string, ValoresDiario]> = [
        ['chave ausente', semViews],
        ['views nulo', { ...metricasZero(0), views: null as unknown as number }],
        ['views texto', { ...metricasZero(0), views: '3' as unknown as number }],
      ]
      for (const [nome, valores] of casos) {
        const r = await aplicar(c, v, [bom, diaDe(1, valores)])
        expect(r.error?.code, nome).toBe('22023')
        expect(await contar('yt_own_video_daily', v), nome).toBe(0)
        expect(await contar('yt_own_video_coverage', v), nome).toBe(0)
      }
    })

    it('apply recusa `estendidas` sem engaged_views; a mesma resposta só com `base` é aceita', async () => {
      const c = await cenario(true); const v = await video(c)
      const dias = [0, 1].map(n => diaDe(n, metricasZero(1)))
      const recusa = await aplicar(c, v, dias, ['base', 'estendidas'])
      expect(recusa.error?.code).toBe('22023')
      expect(await contar('yt_own_video_coverage', v)).toBe(0)
      const ok = await aplicar(c, v, dias, ['base'])
      expect(ok.error).toBeNull()
      expect(await coberturaDe(v, 'base')).toEqual([[dia(0), dia(1)]])
      expect(await coberturaDe(v, 'estendidas')).toEqual([])
    })

    it('apply não apaga linha com `views` nulo; só a chamada de `base` com views 0 a tira, e o dia fica coberto nos dois', async () => {
      const c = await cenario(true); const v = await video(c)
      await pg.query(`insert into public.yt_own_video_daily (youtube_video_id, day_pt, site_id, video_id, channel_id, views, engaged_views, metric_version)
        values ($1, $2, $3, $4, $5, null, 0, $6)`, [v.yt, dia(3), c.site, v.id, c.canal, metricVersion(dia(3))])
      const zeroEstendidas = diaDe(3, { engaged_views: 0, watch_time_minutes: 0, likes: 0, comments: 0, shares: 0, subscribers_gained: 0, subscribers_lost: 0, card_impressions: 0 })
      const r1 = await aplicar(c, v, [zeroEstendidas], ['estendidas'])
      expect(r1.error).toBeNull()
      expect(r1.data).toMatchObject({ apagadas: 0 })
      expect((await diarioDe(v)).map(x => [x.day_pt, x.views, x.engaged_views])).toEqual([[dia(3), null, 0]])
      expect(await coberturaDe(v, 'base')).toEqual([])
      expect(await coberturaDe(v, 'estendidas')).toEqual([[dia(3), dia(3)]])
      const r2 = await aplicar(c, v, [diaDe(3, metricasZero(0))], ['base'])
      expect(r2.error).toBeNull()
      expect(r2.data).toMatchObject({ apagadas: 1 })
      expect(await diarioDe(v)).toEqual([])
      expect(await coberturaDe(v, 'base')).toEqual([[dia(3), dia(3)]])
      expect(await coberturaDe(v, 'estendidas')).toEqual([[dia(3), dia(3)]])
    })

    it('apply recusa linha sem metric_version, mesmo em dia de zero', async () => {
      const c = await cenario(true); const v = await video(c)
      for (const rows of [[{ day_pt: dia(0), views: 0 }], [{ day_pt: dia(0), views: 0, metric_version: '' }]]) {
        const r = await sb.rpc('yt_own_daily_apply', { p_video: v.yt, p_ids: { site_id: c.site, channel_id: c.canal, video_id: v.id }, p_rows: rows, p_days_returned: [dia(0)], p_sets: ['base'] })
        expect(r.error?.code).toBe('22023')
      }
      expect(await contar('yt_own_video_coverage', v)).toBe(0)
    })

    it('apply: recusa dias divergentes, dia repetido, conjunto de fora e p_ids sem canal, e nada é gravado', async () => {
      const c = await cenario(true); const v = await video(c)
      const ids = { site_id: c.site, channel_id: c.canal, video_id: v.id }
      const linha = (n: number) => ({ day_pt: dia(n), metric_version: metricVersion(dia(n)), ...metricasZero(1) })
      const chamadas: Array<[string, Record<string, unknown>]> = [
        ['dias divergentes', { p_video: v.yt, p_ids: ids, p_rows: [linha(0), linha(1)], p_days_returned: [dia(0), dia(2)], p_sets: ['base'] }],
        ['dia repetido', { p_video: v.yt, p_ids: ids, p_rows: [linha(0), linha(0)], p_days_returned: [dia(0), dia(0)], p_sets: ['base'] }],
        ['conjunto de fora', { p_video: v.yt, p_ids: ids, p_rows: [linha(0)], p_days_returned: [dia(0)], p_sets: ['trafego'] }],
        ['p_ids sem canal', { p_video: v.yt, p_ids: { site_id: c.site }, p_rows: [linha(0)], p_days_returned: [dia(0)], p_sets: ['base'] }],
      ]
      for (const [nome, args] of chamadas) {
        const r = await sb.rpc('yt_own_daily_apply', args)
        expect(r.error?.code, nome).toBe('22023')
      }
      expect(await contar('yt_own_video_daily', v)).toBe(0)
      expect(await contar('yt_own_video_coverage', v)).toBe(0)
    })

    it('apply com parâmetro nulo: p_video, p_ids e p_sets recusam; p_rows e p_days_returned nulos viram "resposta vazia" (SQL NULL)', async () => {
      const c = await cenario(true); const v = await video(c)
      const ids = JSON.stringify({ site_id: c.site, channel_id: c.canal, video_id: v.id })
      const chamar = (video: string | null, p_ids: string | null, rows: string | null, days: string[] | null, sets: string[] | null) =>
        pg.query('select public.yt_own_daily_apply($1::text, $2::jsonb, $3::jsonb, $4::date[], $5::text[]) as r', [video, p_ids, rows, days, sets])
      const rows = JSON.stringify([{ day_pt: dia(0), metric_version: metricVersion(dia(0)), ...metricasZero(1) }])
      await expect(chamar(null, ids, rows, [dia(0)], ['base'])).rejects.toMatchObject({ code: '22023' })
      await expect(chamar(v.yt, null, rows, [dia(0)], ['base'])).rejects.toMatchObject({ code: '22023' })
      await expect(chamar(v.yt, ids, rows, [dia(0)], null)).rejects.toMatchObject({ code: '22023' })
      const vazio = await chamar(v.yt, ids, null, null, ['base'])
      expect(vazio.rows[0].r).toEqual({ dias: 0, atualizadas: 0, inseridas: 0, apagadas: 0, intervalos: 0 })
      expect(await contar('yt_own_video_daily', v)).toBe(0)
      expect(await contar('yt_own_video_coverage', v)).toBe(0)
    })

    it('apply: resposta vazia não mexe em nada', async () => {
      const c = await cenario(true); const v = await video(c)
      await aplicar(c, v, [diaDe(0, metricasZero(3)), diaDe(1, metricasZero(0))])
      const antes = { d: await diarioDe(v), c: await coberturaDe(v, 'base') }
      const r = await sb.rpc('yt_own_daily_apply', { p_video: v.yt, p_ids: { site_id: c.site, channel_id: c.canal, video_id: v.id }, p_rows: [], p_days_returned: [], p_sets: ['base'] })
      expect(r.error).toBeNull()
      expect(r.data).toEqual({ dias: 0, atualizadas: 0, inseridas: 0, apagadas: 0, intervalos: 0 })
      expect({ d: await diarioDe(v), c: await coberturaDe(v, 'base') }).toEqual(antes)
    })

    it('apply: metric_version fora da lista derruba a chamada inteira (nada fica); todo valor de metricVersion() do TypeScript é aceito, inclusive nas viradas', async () => {
      const c = await cenario(true); const v = await video(c)
      const ruim = await sb.rpc('yt_own_daily_apply', {
        p_video: v.yt, p_ids: { site_id: c.site, channel_id: c.canal, video_id: v.id },
        p_rows: [{ day_pt: dia(0), metric_version: 'qualquer', ...metricasZero(1) }], p_days_returned: [dia(0)], p_sets: ['base'],
      })
      expect(ruim.error?.code).toBe('23514')
      expect(await contar('yt_own_video_coverage', v)).toBe(0)
      const viradas = ['2025-03-30', '2025-03-31', '2026-08-26', '2026-08-27']
      expect(new Set(viradas.map(metricVersion)).size, 'as três versões do catálogo').toBe(3)
      const dias: DiaDoVideo[] = viradas.map(day => ({ day, valores: metricasZero(1) }))
      const ok = await aplicar(c, v, dias)
      expect(ok.error).toBeNull()
      expect((await diarioDe(v)).map(x => [x.day_pt, x.metric_version])).toEqual(viradas.map(day => [day, metricVersion(day)]))
    })

    it('o pacote que o passo monta, a partir de uma resposta da Analytics API lida por `diarioDoVideo`, é aceito pelo banco (dia de zero sai, médias nulas, estendidas)', async () => {
      const c = await cenario(true); const v = await video(c)
      const colunas: Record<string, (n: number) => number | null> = {
        views: n => (n === 3 ? 4 : 0), engagedViews: n => (n === 3 ? 4 : 0), estimatedMinutesWatched: () => 0, averageViewDuration: n => (n === 3 ? 12 : 0),
        averageViewPercentage: n => (n === 3 ? 33.5 : 0), likes: () => 0, comments: () => 0, shares: () => 0, subscribersGained: () => 0, subscribersLost: () => 0,
        cardImpressions: () => 0, cardClickRate: () => 0,
      }
      const api = (recusar: boolean): typeof fetch => async (input) => {
        const metricas = (new URL(String(input)).searchParams.get('metrics') ?? '').split(',')
        if (recusar && metricas.includes('engagedViews')) return new Response(JSON.stringify({ error: { code: 400, errors: [{ reason: 'badRequest' }] } }), { status: 400 })
        const dias = Array.from({ length: 6 }, (_, i) => i)
        return new Response(JSON.stringify({
          columnHeaders: [{ name: 'day' }, ...metricas.map(name => ({ name }))],
          rows: dias.map(n => [dia(n), ...metricas.map(m => colunas[m]!(n))]),
        }), { status: 200 })
      }
      const r = await diarioDoVideo({ token: 't', canalUc: c.uc, videoId: v.yt, inicio: dia(0), fim: dia(5), f: api(false) })
      expect(r.estendidas).toBe('ok')
      // dias de zero: as médias vêm nulas (chave presente), nunca 0
      expect(r.dias[0]!.valores).toMatchObject({ views: 0, avg_view_percentage: null, avg_view_duration_seconds: null, card_click_rate: null })
      const sets = setsDoPasso(r.dias, r.estendidas)
      expect(sets).toEqual(['base', 'estendidas'])
      const res = await aplicar(c, v, r.dias, sets!)
      expect(res.error).toBeNull()
      expect(res.data).toEqual({ dias: 6, atualizadas: 0, inseridas: 1, apagadas: 0, intervalos: 2 })
      expect((await diarioDe(v)).map(x => [x.day_pt, x.views, x.engaged_views, x.avg_view_percentage])).toEqual([[dia(3), 4, 4, 33.5]])
      expect(await coberturaDe(v, 'base')).toEqual([[dia(0), dia(5)]])
      expect(await coberturaDe(v, 'estendidas')).toEqual([[dia(0), dia(5)]])

      // a API recusa as estendidas: o passo grava só `base`, e a estendidas não avança
      const v2 = await video(c)
      const r2 = await diarioDoVideo({ token: 't', canalUc: c.uc, videoId: v2.yt, inicio: dia(0), fim: dia(5), f: api(true) })
      expect(r2.estendidas).toBe('recusadas')
      const sets2 = setsDoPasso(r2.dias, r2.estendidas)
      expect(sets2).toEqual(['base'])
      expect((await aplicar(c, v2, r2.dias, sets2!)).error).toBeNull()
      expect(await coberturaDe(v2, 'base')).toEqual([[dia(0), dia(5)]])
      expect(await coberturaDe(v2, 'estendidas')).toEqual([])

      // `views` ausente numa célula: o passo nem chama a função (forma inesperada); se chamasse, o banco recusaria
      const v3 = await video(c)
      const semViews: typeof fetch = async (input) => {
        const metricas = (new URL(String(input)).searchParams.get('metrics') ?? '').split(',')
        return new Response(JSON.stringify({
          columnHeaders: [{ name: 'day' }, ...metricas.map(name => ({ name }))],
          rows: [[dia(0), ...metricas.map(m => (m === 'views' ? null : 0))], [dia(1), ...metricas.map(() => 0)]],
        }), { status: 200 })
      }
      const r3 = await diarioDoVideo({ token: 't', canalUc: c.uc, videoId: v3.yt, inicio: dia(0), fim: dia(1), f: semViews })
      expect(setsDoPasso(r3.dias, r3.estendidas)).toBeNull()
      const banco = await aplicar(c, v3, r3.dias, ['base'])
      expect(banco.error?.code).toBe('22023')
      expect(await contar('yt_own_video_coverage', v3)).toBe(0)
    })

    it('lerCoberturaBase (TypeScript) lê o que a função gravou: maior dia por vídeo, nº de intervalos, só o conjunto base; canal vazio é mapa vazio', async () => {
      const c = await cenario(true)
      const v1 = await video(c); const v2 = await video(c); const v3 = await video(c)
      await aplicar(c, v1, [1, 2, 3, 5, 6].map(n => diaDe(n, metricasZero(1))))
      await aplicar(c, v2, [10, 11].map(n => diaDe(n, metricasZero(0, { engaged_views: 0 }))), ['base', 'estendidas'])
      await aplicar(c, v3, [4].map(n => diaDe(n, metricasZero(1, { engaged_views: 1 }))), ['estendidas', 'base'])
      const vazio = await cenario()
      const falhas: string[] = []
      const lida = await lerCoberturaBase({ supabase: sb, falhas }, { id: c.canal, site_id: c.site, name: 'Teste' })
      expect(falhas).toEqual([])
      expect(lida).toBeInstanceOf(Map)
      const mapa = lida as Exclude<typeof lida, string>
      expect([...mapa.keys()].sort()).toEqual([v1.yt, v2.yt, v3.yt].sort())
      expect(mapa.get(v1.yt)).toMatchObject({ ate: dia(6), intervalos: 2 })
      expect(mapa.get(v2.yt)).toMatchObject({ ate: dia(11), intervalos: 1 })
      expect(mapa.get(v3.yt)).toMatchObject({ ate: dia(4), intervalos: 1 })
      expect(Number.isNaN(Date.parse(mapa.get(v1.yt)!.coletadoEm))).toBe(false)
      const nada = await lerCoberturaBase({ supabase: sb, falhas }, { id: vazio.canal, site_id: vazio.site, name: 'Vazio' })
      expect(nada).toBeInstanceOf(Map)
      expect((nada as Map<string, unknown>).size).toBe(0)
      // outro site não enxerga a cobertura do primeiro
      const cruzada = await lerCoberturaBase({ supabase: sb, falhas }, { id: c.canal, site_id: vazio.site, name: 'Cruzado' })
      expect((cruzada as Map<string, unknown>).size).toBe(0)
    })

    it('invariante: nenhuma linha medida fora da cobertura do seu conjunto, nenhum intervalo sobreposto ou vizinho (só nos sites destes testes)', async () => {
      expect(sitesApply.length).toBeGreaterThan(5)
      const fora = await q(`select count(*) as n from public.yt_own_video_daily t where t.site_id = any($1::uuid[]) and (
          (t.views is not null and not exists (select 1 from public.yt_own_video_coverage c where c.youtube_video_id = t.youtube_video_id and c.metric_set = 'base' and t.day_pt between c.covered_from and c.covered_to))
       or (t.engaged_views is not null and not exists (select 1 from public.yt_own_video_coverage c where c.youtube_video_id = t.youtube_video_id and c.metric_set = 'estendidas' and t.day_pt between c.covered_from and c.covered_to)))`, [sitesApply])
      expect(Number(fora[0]!.n)).toBe(0)
      const sobrepostos = await q(`select count(*) as n from public.yt_own_video_coverage a join public.yt_own_video_coverage b
          on a.youtube_video_id = b.youtube_video_id and a.metric_set = b.metric_set and a.covered_from < b.covered_from and b.covered_from <= a.covered_to + 1
        where a.site_id = any($1::uuid[])`, [sitesApply])
      expect(Number(sobrepostos[0]!.n)).toBe(0)
      const total = await q('select count(*) as n from public.yt_own_video_coverage where site_id = any($1::uuid[])', [sitesApply])
      expect(Number(total[0]!.n), 'a invariante não é vácua').toBeGreaterThan(10)
    })
  })

  // ═════════════════════════ D. kind das tentativas ═════════════════════════
  describe('kind de yt_own_collection_attempts', () => {
    it('todo valor de COLLECTION_KINDS é aceito (função e insert direto); texto fora da forma é recusado; o check do banco e KIND_RE concordam', async () => {
      const c = await cenario()
      const def = String((await q(`select pg_get_constraintdef(oid) as def from pg_constraint where conname = 'yt_own_collection_attempts_kind_check'`))[0]?.def)
      expect(def).toContain('^[a-z0-9_]{1,40}$')
      for (const kind of COLLECTION_KINDS) {
        const id = 'k-' + randomUUID()
        const f = await sb.rpc('yt_own_attempt_record', { p_site_id: c.site, p_scope_type: 'video', p_scope_id: id, p_kind: kind, p_outcome: 'ok', p_http_status: null, p_error: null, p_channel_id: c.canal })
        expect(f.error, `função: ${kind}`).toBeNull()
        const direto = await sb.from('yt_own_collection_attempts').insert({ scope_type: 'video', scope_id: 'd-' + randomUUID(), kind, attempt_day: d(-1), site_id: c.site, channel_id: c.canal, outcome: 'ok' })
        expect(direto.error, `insert: ${kind}`).toBeNull()
        expect(ehKind(kind)).toBe(true)
      }
      const amostras = ['Ruim!', 'x'.repeat(41), 'a'.repeat(40), 'a', '', 'com espaço', 'MAIUSCULA', 'ruim-hifen', 'ñ', 'retencao_30d']
      for (const kind of amostras) {
        const esperado = KIND_RE.test(kind)
        const f = await sb.rpc('yt_own_attempt_record', { p_site_id: c.site, p_scope_type: 'video', p_scope_id: 'r-' + randomUUID(), p_kind: kind, p_outcome: 'ok', p_http_status: null, p_error: null, p_channel_id: c.canal })
        const direto = await sb.from('yt_own_collection_attempts').insert({ scope_type: 'video', scope_id: 'r-' + randomUUID(), kind, attempt_day: d(-1), site_id: c.site, channel_id: c.canal, outcome: 'ok' })
        expect(f.error === null, `função "${kind}"`).toBe(esperado)
        expect(direto.error === null, `insert "${kind}"`).toBe(esperado)
        if (!esperado) { expect(f.error?.code).toBe('23514'); expect(direto.error?.code).toBe('23514') }
      }
      // os dois sentidos: nenhum kind do catálogo é recusado e 'Ruim!' / 41 letras são
      expect(ehKind('Ruim!')).toBe(false)
      expect(KIND_RE.test('x'.repeat(41))).toBe(false)
    })

    it('os nomes de parâmetro e as chaves que o TypeScript manda casam com as funções do banco', async () => {
      const fonte = (arq: string): string => readFileSync(`${RAIZ}apps/web/src/lib/youtube/coleta/${arq}`, 'utf8')
      const argsDoBanco = async (nome: string): Promise<string[]> =>
        (await q(`select unnest(proargnames) as n from pg_proc where oid = $1::regprocedure`, [nome])).map(r => String(r.n))
      const chavesDe = (texto: string, abre: string): string[] => {
        const i = texto.indexOf(abre)
        expect(i, abre).toBeGreaterThan(-1)
        const fim = texto.indexOf('\n        })', i)
        const corpo = texto.slice(i + abre.length, fim === -1 ? i + 800 : fim)
        return [...corpo.matchAll(/^\s{10}(p_\w+):/gm)].map(m => m[1]!)
      }
      expect(chavesDe(fonte('diario-step.ts'), "rpc('yt_own_daily_apply', {").sort()).toEqual((await argsDoBanco('public.yt_own_daily_apply(text,jsonb,jsonb,date[],text[])')).sort())
      expect(fonte('retencao-step.ts')).toContain("rpc('yt_own_retention_facts', { p_channel_id: c.id, p_hoje_utc: hojeUtc })")
      expect((await argsDoBanco('public.yt_own_retention_facts(uuid,date)')).sort()).toEqual(['p_channel_id', 'p_hoje_utc'])
      const att = fonte('attempts.ts')
      const nomesAtt = [...att.slice(att.indexOf("rpc('yt_own_attempt_record'"), att.indexOf('})', att.indexOf("rpc('yt_own_attempt_record'"))).matchAll(/(p_\w+):/g)].map(m => m[1]!)
      expect(nomesAtt.sort()).toEqual((await argsDoBanco('public.yt_own_attempt_record(uuid,text,text,text,text,integer,text,uuid)')).sort())
    })
  })

  // ═════════════════════════ E. permissões e RLS ═════════════════════════
  describe('privilégios e RLS', () => {
    it('permissões: só service_role executa as três funções (por catálogo, sem chamar)', async () => {
      const fns = [
        'public.yt_own_daily_apply(text,jsonb,jsonb,date[],text[])',
        'public.yt_own_retention_facts(uuid,date)',
        'public.youtube_channel_removal_impact(uuid,uuid)',
      ]
      for (const fn of fns) {
        const r = await q(`select r, has_function_privilege(r, $1::regprocedure, 'execute') as ok from unnest(array['anon', 'authenticated', 'service_role']) as r`, [fn])
        expect(Object.fromEntries(r.map(x => [x.r, x.ok])), fn).toEqual({ anon: false, authenticated: false, service_role: true })
        const publico = await q(`select count(*) as n from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a where p.oid = $1::regprocedure and a.grantee = 0`, [fn])
        expect(Number(publico[0]!.n), `PUBLIC em ${fn}`).toBe(0)
      }
    })

    async function comoUsuario<T>(claims: Record<string, unknown> | null, siteForjado: string, f: () => Promise<T>): Promise<T> {
      await pg.query('begin')
      try {
        if (claims) await pg.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)])
        await pg.query(`select set_config('app.site_id', $1, true)`, [siteForjado])
        await pg.query('set local role authenticated')
        return await f()
      } finally {
        await pg.query('rollback')
      }
    }
    async function semente(): Promise<{ c: Cen; v: Vid; sem: string; editor: string }> {
      const c = await cenario(); const v = await video(c)
      await pg.query(`insert into public.yt_own_video_coverage (youtube_video_id, metric_set, covered_from, covered_to, site_id, video_id, channel_id) values ($1, 'base', $2, $3, $4, $5, $6)`,
        [v.yt, d(-10), d(-5), c.site, v.id, c.canal])
      const r = linhaRetencao(c, v)
      await pg.query(`insert into public.yt_own_video_retention (youtube_video_id, window_kind, segment, window_end, window_start, requested_end, site_id, video_id, channel_id, points, point_count, metrics_returned, views_at_read, metric_version)
        values ($1, 'vida', 'organico', $2, $3, $4, $5, $6, $7, $8::jsonb, 2, $9, 10, $10)`,
        [v.yt, r.window_end, r.window_start, r.requested_end, c.site, v.id, c.canal, JSON.stringify(r.points), r.metrics_returned, r.metric_version])
      const sem = randomUUID(); const editor = randomUUID()
      for (const id of [sem, editor]) {
        usuarios.push(id)
        await pg.query(`insert into auth.users (id, aud, role, email) values ($1, 'authenticated', 'authenticated', $2)`, [id, id + '@a5.test'])
      }
      await pg.query(`insert into public.site_memberships (site_id, user_id, role) values ($1, $2, 'editor')`, [c.site, editor])
      return { c, v, sem, editor }
    }

    it('RLS: sessão sem vínculo com o site não lê cobertura nem retenção (cliente authenticated pelo PostgREST); o editor lê', async () => {
      const { c, sem, editor } = await semente()
      const como = (id: string) => createClient(SUPABASE_URL, ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${signUserJwt(id).jwt}` } },
      })
      for (const tabela of ['yt_own_video_coverage', 'yt_own_video_retention']) {
        const r = await como(sem).from(tabela).select('youtube_video_id').eq('site_id', c.site)
        expect(r.error, tabela).toBeNull()
        expect(r.data, tabela).toEqual([])
        const e = await como(editor).from(tabela).select('youtube_video_id').eq('site_id', c.site)
        expect(e.error, `${tabela} (editor)`).toBeNull()
        expect(e.data, `${tabela} (editor)`).toHaveLength(1)
      }
    })

    it('RLS: o GUC `app.site_id` forjado não abre nada (as policies usam can_edit_site / can_view_private_site, que não confiam no GUC); sem policy de escrita', async () => {
      const { c, sem, editor } = await semente()
      const contagem = (tabela: string) => async (): Promise<number> => Number((await pg.query(`select count(*) as n from public.${tabela} where site_id = $1`, [c.site])).rows[0].n)
      for (const tabela of ['yt_own_video_coverage', 'yt_own_video_retention']) {
        expect(await comoUsuario({ sub: sem, role: 'authenticated' }, c.site, contagem(tabela)), `${tabela}: sem vínculo, GUC do site`).toBe(0)
        expect(await comoUsuario({ sub: randomUUID(), role: 'authenticated' }, c.site, contagem(tabela)), `${tabela}: usuário solto`).toBe(0)
        expect(await comoUsuario({ sub: editor, role: 'authenticated' }, '', contagem(tabela)), `${tabela}: editor (controle positivo, GUC vazio)`).toBe(1)
      }
      // nenhuma policy de escrita: o insert do editor é barrado pela RLS
      const escrita = await comoUsuario({ sub: editor, role: 'authenticated' }, c.site, async () => {
        try {
          await pg.query(`insert into public.yt_own_video_coverage (youtube_video_id, metric_set, covered_from, covered_to, site_id, channel_id) values ('x', 'base', $1, $1, $2, $3)`, [d(-2), c.site, c.canal])
          return 'inseriu'
        } catch (e) {
          return (e as { code?: string }).code ?? 'erro'
        }
      })
      expect(escrita).toBe('42501')
    })
  })

  // ═════════════════════════ F. remover canal ═════════════════════════
  describe('youtube_channel_removal_impact e youtube_channel_remove', () => {
    it('`serie_coletada` é a soma, pelo catálogo, do que está preso ao canal; `youtube_channel_remove` recusa e não apaga nada', async () => {
      const c = await cenario(); const v = await video(c)
      await pg.query(`insert into public.yt_own_video_daily (youtube_video_id, day_pt, site_id, video_id, channel_id, views, metric_version) values ($1, $2, $3, $4, $5, 1, $6), ($1, $7, $3, $4, $5, 2, $6)`,
        [v.yt, d(-9), c.site, v.id, c.canal, metricVersion(d(-9)), d(-8)])
      await pg.query(`insert into public.yt_own_video_coverage (youtube_video_id, metric_set, covered_from, covered_to, site_id, video_id, channel_id) values ($1, 'base', $2, $3, $4, $5, $6)`, [v.yt, d(-9), d(-8), c.site, v.id, c.canal])
      const ret = linhaRetencao(c, v)
      expect((await sb.from('yt_own_video_retention').insert(ret)).error).toBeNull()
      await tentativa(c, { id: v.yt, kind: 'diario', dia: d(-1), outcome: 'ok' })
      await tentativa(c, { id: v.yt, kind: 'retencao_vida', dia: d(-1), outcome: 'ok' })

      const presas = await q(`select k.conrelid::regclass::text as tabela, a.attname::text as coluna from pg_constraint k
        join pg_class r on r.oid = k.conrelid join pg_namespace n on n.oid = r.relnamespace
        join pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1]
        where k.contype = 'f' and k.confrelid = 'public.youtube_channels'::regclass and k.confdeltype = 'r' and n.nspname = 'public' and cardinality(k.conkey) = 1 order by 1`)
      const tabelas = presas.map(r => String(r.tabela))
      for (const t of ['yt_own_video_daily', 'yt_own_video_coverage', 'yt_own_video_retention', 'yt_own_collection_attempts']) expect(tabelas, `${t} preso ao canal`).toContain(t)
      let esperado = 0
      for (const t of presas) esperado += Number((await q(`select count(*) as n from ${String(t.tabela)} where ${String(t.coluna)} = $1`, [c.canal]))[0]!.n)
      expect(esperado).toBeGreaterThanOrEqual(6)

      const impacto = await sb.rpc('youtube_channel_removal_impact', { p_site_id: c.site, p_channel_id: c.canal })
      expect(impacto.error).toBeNull()
      expect(impacto.data).toMatchObject({ status: 'ok', slug: c.slug, videos: 1 })
      expect(Number((impacto.data as { serie_coletada: number }).serie_coletada)).toBe(esperado)

      const antes = Number((await q('select count(*) as n from public.youtube_videos where channel_id = $1', [c.canal]))[0]!.n)
      const errado = await sb.rpc('youtube_channel_remove', { p_site_id: c.site, p_channel_id: c.canal, p_confirm_slug: 'outro' })
      expect(errado.data).toMatchObject({ status: 'slug_mismatch' })
      const r = await sb.rpc('youtube_channel_remove', { p_site_id: c.site, p_channel_id: c.canal, p_confirm_slug: c.slug })
      expect(r.error).toBeNull()
      expect(r.data).toMatchObject({ status: 'serie_coletada' })
      expect(Number((r.data as { serie_coletada: number }).serie_coletada)).toBe(esperado)
      expect(Number((await q('select count(*) as n from public.youtube_channels where id = $1', [c.canal]))[0]!.n)).toBe(1)
      expect(Number((await q('select count(*) as n from public.youtube_videos where channel_id = $1', [c.canal]))[0]!.n)).toBe(antes)
    })

    it('o corpo da função de impacto é o único (md5 fixo) e é o texto do bloco entre as marcas do arquivo', async () => {
      const r = await q(`select md5(prosrc) as m, prosrc from pg_proc where oid = 'public.youtube_channel_removal_impact(uuid,uuid)'::regprocedure`)
      expect(r[0]!.m).toBe(CORPO_UNICO_MD5)
      const sql = lerSql('mg14')
      const ini = sql.indexOf('-- >>> corpo único: youtube_channel_removal_impact (início)')
      const fim = sql.indexOf('-- <<< corpo único: youtube_channel_removal_impact (fim)')
      expect(ini).toBeGreaterThan(-1)
      expect(fim).toBeGreaterThan(ini)
      const bloco = sql.slice(ini, fim)
      const abre = bloco.indexOf(' as $$') + ' as $$'.length
      const corpo = bloco.slice(abre, bloco.indexOf('$$;', abre))
      expect(md5(corpo)).toBe(CORPO_UNICO_MD5)
    })
  })

  // ═════════════════════════ G. retenção: checks da tabela e o upsert do passo ═════════════════════════
  describe('yt_own_video_retention', () => {
    it('checks, um de cada vez com o resto da linha válido; a linha boa é aceita', async () => {
      const c = await cenario(); const v = await video(c)
      const um = [ponto(0.01, 1)]
      const casos: Array<[string, Linha, string]> = [
        ['point_count 0', { points: [], point_count: 0 }, 'point_count > 0'],
        ['points de tamanho diferente', { points: [ponto(0.01, 1), ponto(0.02, 1), ponto(0.03, 1)], point_count: 2 }, 'jsonb_array_length(points) = point_count'],
        ['window_kind inventado', { window_kind: 'inventado' }, "'primeiros_30_dias'"],
        ['requested_end < window_end', { window_end: d(-3), requested_end: d(-4) }, 'requested_end >= window_end'],
        ['window_end < window_start', { window_end: d(-40), window_start: d(-30), requested_end: d(-40) }, 'window_end >= window_start'],
        ['points objeto', { points: {}, point_count: 1 }, "jsonb_typeof(points) = 'array'"],
        ['metrics_returned vazio', { metrics_returned: [] }, 'cardinality(metrics_returned) > 0'],
        ['metric_version vazia', { metric_version: '' }, "metric_version <> ''"],
        ['segmento inventado', { segment: 'pago' }, "'organico'"],
        ['fonte inventada', { source: 'reporting_api' }, "'analytics_api'"],
      ]
      for (const [nome, extra, trecho] of casos) {
        const r = await sb.from('yt_own_video_retention').insert(linhaRetencao(c, v, { points: um, point_count: 1, ...extra }))
        expect(r.error, nome).not.toBeNull()
        // o plano espera um `check` (23514). Se a expressão do check do "points objeto" lançar antes (22023), é achado: fica registrado aqui.
        expect(r.error?.code, `${nome}: ${r.error?.message}`).toBe('23514')
        const nomeCheck = /check constraint "([^"]+)"/.exec(r.error?.message ?? '')?.[1]
        expect(nomeCheck, nome).toBeDefined()
        const def = String((await q('select pg_get_constraintdef(oid) as def from pg_constraint where conname = $1 and conrelid = $2::regclass', [nomeCheck, 'public.yt_own_video_retention']))[0]?.def)
        expect(def, `${nome}: ${nomeCheck}`).toContain(trecho)
      }
      expect(await contar('yt_own_video_retention', v)).toBe(0)
      const boa = await sb.from('yt_own_video_retention').insert(linhaRetencao(c, v, { points: um, point_count: 1 }))
      expect(boa.error).toBeNull()
    })

    it('o upsert do passo "retenção" (16 colunas, chave da curva) grava a curva lida por `retencaoDoVideo`; reler a mesma janela troca a linha, não duplica', async () => {
      const c = await cenario(); const v = await video(c)
      const fonte = readFileSync(`${RAIZ}apps/web/src/lib/youtube/coleta/retencao-step.ts`, 'utf8')
      const ini = fonte.indexOf(".from('yt_own_video_retention').upsert(")
      const bloco = fonte.slice(ini, fonte.indexOf('{ onConflict', ini))
      const colunasDoPasso = [...bloco.matchAll(/^\s{14}(\w+):/gm)].map(m => m[1]!)
      expect(colunasDoPasso).toHaveLength(16)

      const resposta = (metricas: string[], linhas: Array<Array<number | null>>): typeof fetch => async (input) => {
        void input
        return new Response(JSON.stringify({ columnHeaders: [{ name: 'elapsedVideoTimeRatio' }, ...metricas.map(name => ({ name }))], rows: linhas }), { status: 200 })
      }
      const ler = (f: typeof fetch) => retencaoDoVideo({ token: 't', canalUc: c.uc, videoId: v.yt.padEnd(11, 'x').slice(0, 11), inicio: d(-30), fim: d(-2), f })
      const curva = await ler(resposta(['audienceWatchRatio', 'relativeRetentionPerformance', 'totalSegmentImpressions'], [[0.02, 0.9, 0.4, 90], [0.01, 1.2, null, 100]]))
      expect(curva.pontos.map(p => p.t)).toEqual([0.01, 0.02])
      // O objeto do `upsert` de `retencao-step.ts`, coluna por coluna (as colunas são conferidas contra o fonte logo abaixo).
      const linhaDoPasso = (r: typeof curva, viewsAtRead: number | null, windowEnd: string): Linha => ({
        youtube_video_id: v.yt, window_kind: 'vida', segment: 'organico', window_end: windowEnd, window_start: d(-30), requested_end: d(-2),
        site_id: c.site, video_id: v.id, channel_id: c.canal, points: r.pontos, point_count: r.pontos.length, metrics_returned: r.metricas,
        views_at_read: viewsAtRead, source: 'analytics_api', collected_at: new Date().toISOString(), metric_version: metricVersion(windowEnd),
      })
      const gravar = async (r: typeof curva, viewsAtRead: number | null, windowEnd: string) =>
        sb.from('yt_own_video_retention').upsert(linhaDoPasso(r, viewsAtRead, windowEnd), { onConflict: 'youtube_video_id,window_kind,segment,window_end' })
      expect(Object.keys(linhaDoPasso(curva, 0, d(-3))).sort(), 'as 16 colunas do passo').toEqual([...colunasDoPasso].sort())
      expect((await gravar(curva, 0, d(-3))).error).toBeNull()
      expect((await gravar(curva, 42, d(-3))).error).toBeNull()
      const lida = (await sb.from('yt_own_video_retention').select('*').eq('youtube_video_id', v.yt)).data as Linha[]
      expect(lida).toHaveLength(1)
      expect(lida[0]).toMatchObject({
        window_kind: 'vida', segment: 'organico', point_count: 2, views_at_read: 42, window_end: d(-3), requested_end: d(-2), metric_version: metricVersion(d(-3)),
        metrics_returned: ['audienceWatchRatio', 'relativeRetentionPerformance', 'totalSegmentImpressions'],
        points: [
          { t: 0.01, ratio: 1.2, relative: null, segment_impressions: 100 },
          { t: 0.02, ratio: 0.9, relative: 0.4, segment_impressions: 90 },
        ],
      })
      // uma leitura de outro dia é outra linha (histórico); views_at_read nulo é aceito ("não se sabia")
      expect((await gravar(curva, null, d(-4))).error).toBeNull()
      expect((await sb.from('yt_own_video_retention').select('window_end, views_at_read').eq('youtube_video_id', v.yt).order('window_end')).data)
        .toEqual([{ window_end: d(-4), views_at_read: null }, { window_end: d(-3), views_at_read: 42 }])

      // só as duas métricas básicas: segment_impressions fica nulo, nunca 0
      const basica = await ler(resposta(['audienceWatchRatio', 'relativeRetentionPerformance'], [[0.5, 0.7, 0.3]]))
      expect(basica.metricas).toEqual(['audienceWatchRatio', 'relativeRetentionPerformance'])
      const v2 = await video(c)
      expect((await sb.from('yt_own_video_retention').insert(linhaRetencao(c, v2, { points: basica.pontos, point_count: 1, metrics_returned: basica.metricas }))).error).toBeNull()
      const p = ((await sb.from('yt_own_video_retention').select('points').eq('youtube_video_id', v2.yt).single()).data as { points: Array<Record<string, unknown>> }).points
      expect(p[0]).toEqual({ t: 0.5, ratio: 0.7, relative: 0.3, segment_impressions: null })
    })
  })

  // ═════════════════════════ H. yt_own_retention_facts ═════════════════════════
  describe('yt_own_retention_facts', () => {
    const D = HOJE

    it('fatos: tabelas vazias (canal com 2 vídeos, nada coletado)', async () => {
      const c = await cenario(); const v1 = await video(c); const v2 = await video(c)
      const todos = await fatos(c, D)
      expect(todos.map(f => f.youtube_video_id).sort()).toEqual([v1.yt, v2.yt].sort())
      for (const f of todos) {
        expect(f).toMatchObject({
          fonte_ate: null, views_total: null, ultimo_dia_com_view: null, views_7d: null, views_30d: null, vida_window_end: null, vida_collected_at: null, vida_views_at_read: null,
          tem_7d: false, tem_30d: false, primeira_tent_dia: null, leva_ancora_dia: null, diario_tent_dia: null, diario_tent_resultado: null, diario_falhas_4d: 0,
          vida_tent_dia: null, vida_tent_resultado: null, vida_resposta_dia: null, d7_tent_dia: null, d7_tent_resultado: null, d7_resposta_dia: null,
          d30_tent_dia: null, d30_tent_resultado: null, d30_resposta_dia: null,
        })
        expect(f.site_id).toBe(c.site)
        expect(f.video_id).toBe(f.youtube_video_id === v1.yt ? v1.id : v2.id)
      }
    })

    it('fatos: canal que não existe e canal nulo devolvem lista vazia (SQL NULL pelo pg; JSON null pelo PostgREST)', async () => {
      const outro = await sb.rpc('yt_own_retention_facts', { p_channel_id: randomUUID(), p_hoje_utc: D })
      expect(outro.error).toBeNull()
      expect(outro.data).toEqual([])
      const nulo = await pg.query('select public.yt_own_retention_facts($1::uuid, $2::date) as r', [null, D])
      expect(nulo.rows[0].r).toEqual([])
      const nuloSemData = await pg.query('select public.yt_own_retention_facts($1::uuid) as r', [null])
      expect(nuloSemData.rows[0].r).toEqual([])
      const viaApi = await sb.rpc('yt_own_retention_facts', { p_channel_id: null, p_hoje_utc: null })
      expect(viaApi.error).toBeNull()
      expect(viaApi.data).toEqual([])
    })

    it('fatos: vídeo só com linhas do coletor antigo (sem cobertura) usa a última linha com views como fonte', async () => {
      const c = await cenario(); const v = await video(c, new Date(Date.parse(d(-20) + 'T12:00:00Z')).toISOString())
      for (let n = 10; n >= 3; n--) {
        await pg.query(`insert into public.yt_own_video_daily (youtube_video_id, day_pt, site_id, video_id, channel_id, views, metric_version) values ($1, $2, $3, $4, $5, $6, $7)`,
          [v.yt, d(-n), c.site, v.id, c.canal, n === 5 ? 0 : n, metricVersion(d(-n))])
      }
      const f = fato(await fatos(c, D), v)
      expect(f.fonte_ate).toBe(d(-3))
      expect(f.views_total).toBe(10 + 9 + 8 + 7 + 6 + 0 + 4 + 3)
      expect(f.ultimo_dia_com_view).toBe(d(-3))
    })

    it('fatos: vídeo coberto sem nenhuma view tem views_total 0 (não nulo) e ultimo_dia_com_view nulo', async () => {
      const c = await cenario(); const v = await video(c, new Date(Date.parse(d(-20) + 'T12:00:00Z')).toISOString())
      await pg.query(`insert into public.yt_own_video_coverage (youtube_video_id, metric_set, covered_from, covered_to, site_id, video_id, channel_id) values ($1, 'base', $2, $3, $4, $5, $6)`,
        [v.yt, d(-5), d(-4), c.site, v.id, c.canal])
      const f = fato(await fatos(c, D), v)
      expect(f.fonte_ate).toBe(d(-4))
      expect(f.views_total).toBe(0)
      expect(f.ultimo_dia_com_view).toBeNull()
    })

    it('fatos: cobertura maior que a última linha manda na fonte; só o conjunto base conta', async () => {
      const c = await cenario(); const v = await video(c, new Date(Date.parse(d(-20) + 'T12:00:00Z')).toISOString())
      await pg.query(`insert into public.yt_own_video_daily (youtube_video_id, day_pt, site_id, video_id, channel_id, views, metric_version) values ($1, $2, $3, $4, $5, 5, $6)`, [v.yt, d(-8), c.site, v.id, c.canal, metricVersion(d(-8))])
      await pg.query(`insert into public.yt_own_video_coverage (youtube_video_id, metric_set, covered_from, covered_to, site_id, video_id, channel_id) values ($1, 'base', $2, $3, $4, $5, $6), ($1, 'estendidas', $2, $7, $4, $5, $6)`,
        [v.yt, d(-9), d(-6), c.site, v.id, c.canal, d(-1)])
      const f = fato(await fatos(c, D), v)
      expect(f.fonte_ate).toBe(d(-6))
      expect(f.views_total).toBe(5)
    })

    it('fatos: views_7d e views_30d só existem depois que a fonte passou do fim da janela; a retenção gravada aparece (vida, 7 dias) e a leitura do Zod aceita as datas e o instante', async () => {
      const c = await cenario()
      const pub = d(-12)
      const v = await video(c, `${pub}T20:00:00Z`) // 13:00 do Pacífico: o mesmo dia
      for (let n = 0; n <= 9; n++) {
        await pg.query(`insert into public.yt_own_video_daily (youtube_video_id, day_pt, site_id, video_id, channel_id, views, metric_version) values ($1, $2, $3, $4, $5, $6, $7)`,
          [v.yt, addDays(pub, n), c.site, v.id, c.canal, 1, metricVersion(addDays(pub, n))])
      }
      const quando = new Date(Date.parse(d(-2) + 'T10:00:00Z')).toISOString()
      expect((await sb.from('yt_own_video_retention').insert([
        linhaRetencao(c, v, { window_kind: 'vida', window_end: addDays(pub, 9), window_start: pub, requested_end: d(-2), views_at_read: 10, collected_at: quando }),
        linhaRetencao(c, v, { window_kind: 'primeiros_7_dias', window_end: addDays(pub, 6), window_start: pub, requested_end: addDays(pub, 6), views_at_read: 7 }),
      ])).error).toBeNull()
      const f = fato(await fatos(c, D), v)
      expect(f.publicado_dia_pt).toBe(pub)
      expect(f.fonte_ate).toBe(addDays(pub, 9))
      expect(f.views_total).toBe(10)
      expect(f.views_7d).toBe(7)
      expect(f.views_30d).toBeNull()
      expect(f).toMatchObject({ vida_window_end: addDays(pub, 9), vida_views_at_read: 10, tem_7d: true, tem_30d: false })
      expect(Date.parse(f.vida_collected_at!)).toBe(Date.parse(quando))
    })

    it('fatos: última tentativa × última resposta × primeira tentativa (vida, 7d e 30d)', async () => {
      const c = await cenario(); const v = await video(c)
      await tentativa(c, { id: v.yt, kind: 'retencao_vida', dia: addDays(D, -10), outcome: 'ok' })
      await tentativa(c, { id: v.yt, kind: 'retencao_vida', dia: addDays(D, -3), outcome: 'nao_alcancado_orcamento' })
      await tentativa(c, { id: v.yt, kind: 'retencao_7d', dia: addDays(D, -6), outcome: 'sem_dado_na_janela' })
      await tentativa(c, { id: v.yt, kind: 'retencao_7d', dia: addDays(D, -2), outcome: 'erro_http', status: 500, error: 'http_500' })
      await tentativa(c, { id: v.yt, kind: 'retencao_30d', dia: addDays(D, -1), outcome: 'erro_http', status: 404, error: 'http_404' })
      const f = fato(await fatos(c, D), v)
      expect(f).toMatchObject({
        vida_tent_dia: addDays(D, -3), vida_tent_resultado: 'nao_alcancado_orcamento', vida_resposta_dia: addDays(D, -10), primeira_tent_dia: addDays(D, -10),
        d7_tent_dia: addDays(D, -2), d7_tent_resultado: 'erro_http', d7_resposta_dia: addDays(D, -6),
        d30_tent_dia: addDays(D, -1), d30_tent_resultado: 'erro_http', d30_resposta_dia: null,
      })
    })

    it('fatos: âncora da leva é a tentativa de canal `retencao_vida` mais antiga do PRÓPRIO canal, com qualquer resultado', async () => {
      const c = await cenario(); const v1 = await video(c); const v2 = await video(c)
      const outro = await q(`insert into public.youtube_channels (site_id, channel_id, locale, handle, name, uploads_playlist_id, slug) values ($1, $2, 'pt', $3, 'Outro', $4, $5) returning id`,
        [c.site, 'UC' + randomUUID().replace(/-/g, '').slice(0, 22), '@o' + randomUUID().slice(0, 8), 'UUo' + randomUUID().replace(/-/g, '').slice(0, 20), 'o-' + randomUUID().slice(0, 8)])
      const outroId = String(outro[0]!.id)
      const antes = await fatos(c, D)
      expect(antes.map(f => f.leva_ancora_dia)).toEqual([null, null])
      await tentativa(c, { escopo: 'canal', id: c.canal, kind: 'retencao_vida', dia: addDays(D, -9), outcome: 'nao_alcancado_orcamento' })
      await tentativa(c, { escopo: 'canal', id: c.canal, kind: 'retencao_vida', dia: addDays(D, -7), outcome: 'ok' })
      await tentativa(c, { escopo: 'canal', id: outroId, kind: 'retencao_vida', dia: addDays(D, -30), outcome: 'ok', canal: outroId })
      await tentativa(c, { escopo: 'canal', id: c.canal, kind: 'diario', dia: addDays(D, -30), outcome: 'ok' })
      const todos = await fatos(c, D)
      expect(todos.map(f => f.leva_ancora_dia)).toEqual([addDays(D, -9), addDays(D, -9)])
      expect(todos.map(f => f.youtube_video_id).sort()).toEqual([v1.yt, v2.yt].sort())
      // e o canal "outro" não tem vídeo: lista vazia, sem erro
      expect(await fatos({ ...c, canal: outroId }, D)).toEqual([])
    })

    it('fatos: o diário do vídeo nos 4 últimos dias (A: 4, B: 2, C: 3, D: 0); com p_hoje_utc = D + 1 a janela anda; p_hoje_utc nulo é current_date', async () => {
      const c = await cenario()
      const a = await video(c); const b = await video(c); const cc = await video(c); const dd = await video(c)
      const t = (v: Vid, n: number, outcome: string, status: number | null = null, error: string | null = null) =>
        tentativa(c, { id: v.yt, kind: 'diario', dia: addDays(D, n), outcome, status, error })
      await t(a, -3, 'sem_dado_na_janela'); await t(a, -2, 'erro_http', 404, 'http_404'); await t(a, -1, 'sem_dado_na_janela'); await t(a, 0, 'sem_dado_na_janela')
      await t(b, -3, 'sem_dado_na_janela'); await t(b, -2, 'ok'); await t(b, -1, 'nao_alcancado_orcamento'); await t(b, 0, 'sem_dado_na_janela')
      await t(cc, -2, 'sem_dado_na_janela'); await t(cc, -1, 'sem_dado_na_janela'); await t(cc, 0, 'sem_dado_na_janela')
      const todos = await fatos(c, D)
      expect([a, b, cc, dd].map(v => fato(todos, v).diario_falhas_4d)).toEqual([4, 2, 3, 0])
      expect(fato(todos, a)).toMatchObject({ diario_tent_resultado: 'sem_dado_na_janela', diario_tent_dia: D })
      expect(fato(todos, dd)).toMatchObject({ diario_tent_resultado: null, diario_tent_dia: null })
      // a janela anda com p_hoje_utc
      expect(fato(await fatos(c, addDays(D, 1)), a).diario_falhas_4d).toBe(3)
      expect(fato(await fatos(c, addDays(D, 3)), a).diario_falhas_4d).toBe(1)
      expect(fato(await fatos(c, addDays(D, 4)), a).diario_falhas_4d).toBe(0)
      // p_hoje_utc nulo = current_date do banco
      const cd = String((await q('select current_date::text as d'))[0]!.d)
      const e = await video(c)
      for (let k = 3; k >= 0; k--) await tentativa(c, { id: e.yt, kind: 'diario', dia: addDays(cd, -k), outcome: 'sem_dado_na_janela' })
      expect(fato(await fatos(c), e).diario_falhas_4d).toBe(4)
      const semAmanha = await pg.query('select public.yt_own_retention_facts($1::uuid, null) as r', [c.canal])
      expect((semAmanha.rows[0].r as Array<Record<string, unknown>>).find(x => x.youtube_video_id === e.yt)).toMatchObject({ diario_falhas_4d: 4 })
    })

    // Os mesmos casos estão em `youtubeNaoDevolveu` (atraso-permanente.test.ts, Tarefa 2b): mudou um, mude o outro. Aqui os DOIS lados
    // são exercitados no mesmo teste: o banco e a função TypeScript têm de dar a mesma resposta para cada caso.
    const NOSSAS: Array<[string, { outcome: string; status: number | null; error: string | null }]> = [
      ['erro_de_banco, sem status', { outcome: 'erro_http', status: null, error: 'erro_de_banco' }],
      ['forma_inesperada, status 200', { outcome: 'erro_http', status: 200, error: 'forma_inesperada' }],
      ['forma_inesperada, sem status', { outcome: 'erro_http', status: null, error: 'forma_inesperada' }],
      ['excecao, sem status', { outcome: 'erro_http', status: null, error: 'excecao' }],
      ['http_500', { outcome: 'erro_http', status: 500, error: 'http_500' }],
      ['http_429', { outcome: 'erro_http', status: 429, error: 'http_429' }],
      ['http_403_quotaExceeded', { outcome: 'erro_http', status: 403, error: 'http_403_quotaExceeded' }],
      ['http_403_rateLimitExceeded', { outcome: 'erro_http', status: 403, error: 'http_403_rateLimitExceeded' }],
      ['http_403_userRateLimitExceeded', { outcome: 'erro_http', status: 403, error: 'http_403_userRateLimitExceeded' }],
      ['formato antigo: HTTP 403 quotaExceeded', { outcome: 'erro_http', status: 403, error: 'HTTP 403 quotaExceeded' }],
      ['formato antigo: HTTP 403 dailyLimitExceeded', { outcome: 'erro_http', status: 403, error: 'HTTP 403 dailyLimitExceeded' }],
      ['400 (pedido nosso inválido)', { outcome: 'erro_http', status: 400, error: 'http_400' }],
      ['erro_http sem status nem erro', { outcome: 'erro_http', status: null, error: null }],
      ['nao_alcancado_orcamento', { outcome: 'nao_alcancado_orcamento', status: null, error: null }],
      ['sem_autorizacao', { outcome: 'sem_autorizacao', status: 401, error: null }],
      ['schema_ausente', { outcome: 'schema_ausente', status: null, error: null }],
    ]
    const DELE: Array<[string, { outcome: string; status: number | null; error: string | null }]> = [
      ['404 http_404', { outcome: 'erro_http', status: 404, error: 'http_404' }],
      ['404 http_404_notFound', { outcome: 'erro_http', status: 404, error: 'http_404_notFound' }],
      ['formato antigo: HTTP 404 notFound', { outcome: 'erro_http', status: 404, error: 'HTTP 404 notFound' }],
      ['404 com error nulo', { outcome: 'erro_http', status: 404, error: null }],
      ['410', { outcome: 'erro_http', status: 410, error: 'http_410' }],
      ['403 http_403_forbidden', { outcome: 'erro_http', status: 403, error: 'http_403_forbidden' }],
      ['403 http_403_limitexceeded (minúsculas: a regra distingue maiúsculas, como o `!~` do SQL)', { outcome: 'erro_http', status: 403, error: 'http_403_limitexceeded' }],
      ['sem_dado_na_janela', { outcome: 'sem_dado_na_janela', status: null, error: null }],
    ]

    it('fatos: falha NOSSA ou de cota, em quatro dias seguidos, não conta como "o YouTube não devolve o vídeo" (banco e TypeScript concordam)', async () => {
      const c = await cenario()
      const vs: Vid[] = []
      for (const [, caso] of NOSSAS) { const v = await video(c); vs.push(v); await quatroDias(c, v, D, caso) }
      const todos = await fatos(c, D)
      NOSSAS.forEach(([nome, caso], i) => {
        const f = fato(todos, vs[i]!)
        expect(f.diario_falhas_4d, `banco: ${nome}`).toBe(0)
        expect(youtubeNaoDevolveu({ outcome: caso.outcome, http_status: caso.status, error: caso.error }), `TypeScript: ${nome}`).toBe(false)
        expect(f.diario_tent_resultado, nome).toBe(caso.outcome)
      })
    })

    it('fatos: quatro dias de "o YouTube não devolveu" contam (banco e TypeScript concordam)', async () => {
      const c = await cenario()
      const vs: Vid[] = []
      for (const [, caso] of DELE) { const v = await video(c); vs.push(v); await quatroDias(c, v, D, caso) }
      const todos = await fatos(c, D)
      DELE.forEach(([nome, caso], i) => {
        expect(fato(todos, vs[i]!).diario_falhas_4d, `banco: ${nome}`).toBe(4)
        expect(youtubeNaoDevolveu({ outcome: caso.outcome, http_status: caso.status, error: caso.error }), `TypeScript: ${nome}`).toBe(true)
      })
    })

    it('fatos: dois motivos misturados (a falha nossa quebra a sequência)', async () => {
      const c = await cenario(); const m1 = await video(c); const m2 = await video(c)
      const t = (v: Vid, n: number, outcome: string, status: number | null = null, error: string | null = null) =>
        tentativa(c, { id: v.yt, kind: 'diario', dia: addDays(D, n), outcome, status, error })
      await t(m1, -3, 'sem_dado_na_janela'); await t(m1, -2, 'erro_http', null, 'erro_de_banco'); await t(m1, -1, 'sem_dado_na_janela'); await t(m1, 0, 'erro_http', null, 'erro_de_banco')
      await t(m2, -3, 'erro_http', 404, 'http_404'); await t(m2, -2, 'erro_http', 404, 'http_404'); await t(m2, -1, 'erro_http', 404, 'http_404'); await t(m2, 0, 'erro_http', null, 'erro_de_banco')
      const todos = await fatos(c, D)
      expect(fato(todos, m1).diario_falhas_4d).toBe(2)
      expect(fato(todos, m2).diario_falhas_4d).toBe(3)
    })

    it('fatos: tentativas de outro vídeo, de outro escopo ou de outro kind não entram no diário deste vídeo', async () => {
      const c = await cenario(); const v = await video(c); const w = await video(c)
      await quatroDias(c, w, D, { outcome: 'sem_dado_na_janela' })
      await tentativa(c, { id: v.yt, kind: 'meta', dia: D, outcome: 'sem_dado_na_janela' })
      await tentativa(c, { escopo: 'canal', id: v.yt, kind: 'diario', dia: D, outcome: 'sem_dado_na_janela' })
      const todos = await fatos(c, D)
      expect(fato(todos, v)).toMatchObject({ diario_falhas_4d: 0, diario_tent_dia: null, diario_tent_resultado: null })
      expect(fato(todos, w).diario_falhas_4d).toBe(4)
    })

    it('fatos: dia de publicação no Pacífico é o do `dayPt()` do código (UTC antes das 7h ou 8h cai no dia anterior)', async () => {
      const c = await cenario()
      const instantes = ['2026-03-10T02:00:00Z', '2026-01-15T07:30:00Z', '2026-01-15T08:00:00Z', '2026-06-30T06:59:00Z', '2026-07-01T07:00:00Z', '2025-11-02T08:30:00Z']
      const vs: Vid[] = []
      for (const i of instantes) vs.push(await video(c, i))
      const todos = await fatos(c, D)
      instantes.forEach((i, k) => {
        const f = fato(todos, vs[k]!)
        expect(f.publicado_dia_pt, i).toBe(dayPt(new Date(i)))
      })
      expect(fato(todos, vs[0]!).publicado_dia_pt).toBe('2026-03-09')
      expect(fato(todos, vs[1]!).publicado_dia_pt).toBe('2026-01-14')
      expect(fato(todos, vs[2]!).publicado_dia_pt).toBe('2026-01-15')
    })
  })
})
