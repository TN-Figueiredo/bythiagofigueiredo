// @vitest-environment node
/**
 * A5 · E6 (P3): os dois roteiros de volta da dieta do diário, `docs/ops/sql/dieta-diario-volta-a-restaurar-do-backup.sql` (A) e
 * `docs/ops/sql/dieta-diario-volta-b-recriar-da-cobertura.sql` (B), rodados DEPOIS da MG15 (o SQL de ensaio ou a migration),
 * dentro de transação desfeita, no `bythiago_int`. Mesmo molde e mesmos cuidados de `a5-e6-p3-dieta.test.ts`:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/a5-e6-p3-volta.test.ts --no-file-parallelism
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Client } from 'pg'
import { createHash, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite } from '../helpers/db-seed'
import { lerSqlMg15 } from '../helpers/mg15'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { metricVersion } from '@/lib/youtube/coleta/metric-version'
import type { DiarioResumo } from '@/lib/youtube/coleta/diario-step'

vi.setConfig({ testTimeout: 60_000 })

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const RAIZ = fileURLToPath(new URL('../../../../', import.meta.url))

type Linha = Record<string, unknown>

const lerSql = lerSqlMg15

/** Do começo da marca `-- >>> MG15 <nome> (início)` ao fim da linha da marca `-- <<< MG15 <nome> (fim)`. */
function trecho(sql: string, nome: string): { de: number; ate: number } {
  const de = sql.indexOf(`-- >>> MG15 ${nome} (início)`)
  const fim = sql.indexOf(`-- <<< MG15 ${nome} (fim)`)
  if (de < 0 || fim < 0 || fim < de) throw new Error(`marca MG15 ${nome} não achada no SQL`)
  const ate = sql.indexOf('\n', fim)
  return { de, ate: ate < 0 ? sql.length : ate }
}
function extrair(sql: string, nome: string): string {
  const { de, ate } = trecho(sql, nome)
  return sql.slice(de, ate)
}

const VARIANTE_Z = `-- >>> MG15 regra 2 (início)  (variante Z: média ou taxa nula OU ZERO sai; diferente de zero fica)
           (coalesce(d.avg_view_duration_seconds, 0) <> 0 or coalesce(d.avg_view_percentage, 0) <> 0
            or coalesce(d.card_click_rate, 0) <> 0) as com_media,
           -- <<< MG15 regra 2 (fim)`
function comVarianteZ(funcoes: string): string {
  const { de, ate } = trecho(funcoes, 'regra 2')
  return funcoes.slice(0, de) + VARIANTE_Z + funcoes.slice(ate)
}

const AGORA = '2026-03-10T15:00:00Z'
const HOJE = '2026-03-10'
const DIA0 = '2026-01-01'
const COBERTO_ATE = '2026-03-09'
const mais = (dia: string, n: number): string => new Date(Date.parse(dia + 'T00:00:00Z') + n * 86_400_000).toISOString().slice(0, 10)
const h = (n: number): string => new Date(Date.parse(AGORA) - n * 3_600_000).toISOString()
const md5 = (s: string): string => createHash('md5').update(s).digest('hex')

/** A execução boa do coletor novo. Tipada: se o tipo mudar, o teste deixa de compilar. Cada caso de recusa difere dela em UM campo. */
const BOM: DiarioResumo = {
  gravados: 12, tentativas: { ok: 36 }, pendentes: 0, ate: HOJE, estendidas_recusadas: 0,
  apagadas: 0, intervalos: 35, estendidas_ausentes: 0, atrasados_antigos: 0, com_buraco: 0,
}
type Exec = { ran: string; falhas: string[]; resumo: Record<string, unknown> }
const boaExec = (ran: string): Exec => ({ ran, falhas: [], resumo: { diario: { ...BOM } } })
/** Três dias seguidos; a última 3 horas antes de AGORA. Índice 2 = a mais recente. */
const tres = (): Exec[] => [boaExec(h(51)), boaExec(h(27)), boaExec(h(3))]
const comDiario = (e: Exec, mudanca: Record<string, unknown>): Exec => ({ ...e, resumo: { diario: { ...BOM, ...mudanca } } })
const comFalha = (e: Exec, f: string): Exec => ({ ...e, falhas: [f] })

const VAZIA = { views: 0, watch_time_minutes: 0, likes: 0, comments: 0, shares: 0, subscribers_gained: 0, subscribers_lost: 0 }

describe.skipIf(skipIfNoLocalDb())('A5 E6 P3: os roteiros de volta A (backup) e B (cobertura) (bythiago_int)', () => {
  let pg: Client
  let sb: ReturnType<typeof getSupabaseServiceClient>
  const sites: string[] = []
  let S1 = ''
  let S2 = ''
  let SQL = ''
  let BACKUP = ''
  let FUNCOES = ''

  beforeAll(async () => {
    SQL = lerSql()
    BACKUP = extrair(SQL, 'backup')
    FUNCOES = extrair(SQL, 'funções')
    sb = getSupabaseServiceClient()
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
    S1 = (await seedSite(sb)).siteId; sites.push(S1)
    S2 = (await seedSite(sb)).siteId; sites.push(S2)
  })
  afterAll(async () => {
    try {
      if (pg && sites.length > 0) await pg.query('delete from public.sites where id = any($1::uuid[])', [sites])
    } finally {
      if (pg) await pg.end()
    }
  })

  // ───────────────────────── infraestrutura ─────────────────────────
  const q = async (sql: string, params: unknown[] = []): Promise<Linha[]> => (await pg.query(sql, params)).rows as Linha[]
  const n = async (sql: string, params: unknown[] = []): Promise<number> => Number(Object.values((await q(sql, params))[0]!)[0])

  /** Tudo dentro de uma transação desfeita, com o backup e as funções criados nela. */
  async function tx(fn: () => Promise<void>, o: { funcoes?: string } = {}): Promise<void> {
    await pg.query('begin')
    try {
      await pg.query("set local lock_timeout = '5s'")
      await pg.query(BACKUP)
      await pg.query(o.funcoes ?? FUNCOES)
      await fn()
    } finally {
      await pg.query('rollback')
    }
  }
  /** Chama dentro de um savepoint: devolve o erro em vez de abortar a transação. */
  async function tenta(sql: string, params: unknown[] = []): Promise<{ ok: true; rows: Linha[] } | { ok: false; msg: string }> {
    await pg.query('savepoint s_tenta')
    try {
      const r = await pg.query(sql, params)
      await pg.query('release savepoint s_tenta')
      return { ok: true, rows: r.rows as Linha[] }
    } catch (e) {
      await pg.query('rollback to savepoint s_tenta')
      return { ok: false, msg: e instanceof Error ? e.message : String(e) }
    }
  }
  const chamar = (site: string, agora = AGORA) => tenta('select public.yt_own_daily_diet_p3($1::uuid, $2::timestamptz) as r', [site, agora])
  async function aceita(site: string, agora = AGORA): Promise<Linha> {
    const r = await chamar(site, agora)
    if (!r.ok) throw new Error('esperava aceitar, recusou: ' + r.msg)
    return r.rows[0]!.r as Linha
  }
  async function recusa(site: string, trecho: string, agora = AGORA): Promise<void> {
    const r = await chamar(site, agora)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.msg).toContain(trecho)
  }

  interface Cena { site: string; canal: string; v: Array<{ id: string; yt: string }> }
  async function cena(site: string, nVideos = 1): Promise<Cena> {
    const slug = 'teste-' + randomUUID().replace(/-/g, '').slice(0, 8)
    const c = await q(`insert into public.youtube_channels (site_id, channel_id, locale, handle, name, uploads_playlist_id, slug)
      values ($1, $2, 'pt', $3, 'Teste', $4, $5) returning id`,
      [site, 'UC' + randomUUID().replace(/-/g, '').slice(0, 22), '@' + slug, 'UU' + randomUUID().replace(/-/g, '').slice(0, 22), slug])
    const canal = String(c[0]!.id)
    const v: Cena['v'] = []
    for (let i = 0; i < nVideos; i++) {
      const yt = 'y' + randomUUID().replace(/-/g, '').slice(0, 10)
      const r = await q(`insert into public.youtube_videos (site_id, channel_id, youtube_video_id, title, published_at)
        values ($1, $2, $3, 'Teste', '2025-01-01T12:00:00Z') returning id`, [site, canal, yt])
      v.push({ id: String(r[0]!.id), yt })
    }
    return { site, canal, v }
  }
  async function cob(c: Cena, i: number, set: 'base' | 'estendidas', de: string, ate: string, coletada = h(3)): Promise<void> {
    await pg.query(`insert into public.yt_own_video_coverage (youtube_video_id, metric_set, covered_from, covered_to, site_id, video_id, channel_id, collected_at)
      values ($1, $2, $3, $4, $5, $6, $7, $8)`, [c.v[i]!.yt, set, de, ate, c.site, c.v[i]!.id, c.canal, coletada])
  }
  async function linha(c: Cena, i: number, dia: string, vals: Record<string, number | string | null>): Promise<void> {
    const cols = ['youtube_video_id', 'day_pt', 'site_id', 'video_id', 'channel_id', 'metric_version', ...Object.keys(vals)]
    const params: unknown[] = [c.v[i]!.yt, dia, c.site, c.v[i]!.id, c.canal, metricVersion(dia), ...Object.values(vals)]
    await pg.query(`insert into public.yt_own_video_daily (${cols.join(', ')}) values (${params.map((_, k) => '$' + (k + 1)).join(', ')})`, params)
  }
  async function execucoes(es: Exec[]): Promise<void> {
    await pg.query('delete from public.yt_own_collection_runs where ran_at > $1::timestamptz - interval \'10 days\' and ran_at <= $1::timestamptz', [AGORA])
    for (const e of es) {
      await pg.query(`insert into public.yt_own_collection_runs (ran_at, ms_total, ms_existente, falhas, resumo) values ($1, 1, 1, $2::text[], $3::jsonb)`,
        [e.ran, e.falhas, JSON.stringify(e.resumo)])
    }
  }
  const marca = (dia = HOJE) => pg.query(`comment on table public.yt_own_video_daily is 'P3 armada em ${dia}'`)
  const semMarca = () => pg.query('comment on table public.yt_own_video_daily is null')
  const diarioN = (site: string) => n('select count(*) from public.yt_own_video_daily where site_id = $1', [site])
  const backupN = (site?: string) => site
    ? n('select count(*) from public.yt_own_video_daily_zeros_bkp where site_id = $1', [site])
    : n('select count(*) from public.yt_own_video_daily_zeros_bkp')

  /** 40 dias de um vídeo: 30 vazias, 6 com view, 4 com views 0 e uma curtida. Cobertura base até COBERTO_ATE. Guardas prontas. */
  async function cenario40(site = S1, o: { preparar?: boolean } = {}): Promise<Cena> {
    const c = await cena(site)
    await cob(c, 0, 'base', DIA0, COBERTO_ATE)
    for (let i = 0; i < 40; i++) {
      const dia = mais(DIA0, i)
      const extra = { source: i % 2 === 0 ? 'analytics_api' : 'reporting_api', collected_at: `2026-02-20T10:${String(i).padStart(2, '0')}:00Z` }
      if (i < 30) await linha(c, 0, dia, { ...VAZIA, ...extra })
      else if (i < 36) await linha(c, 0, dia, { ...VAZIA, views: i - 29, avg_view_duration_seconds: 30, avg_view_percentage: 50, ...extra })
      else await linha(c, 0, dia, { ...VAZIA, likes: 1, ...extra })
    }
    if (o.preparar !== false) { await execucoes(tres()); await marca() }
    return c
  }
  const retratoSql = `select count(*) as pares, count(*) filter (where x.medido) as medidos, coalesce(sum(x.views),0) as soma,
      md5(string_agg(x.youtube_video_id || '|' || x.dia || '|' || x.medido || '|' || coalesce(x.views::text, '-'), ',' order by x.youtube_video_id, x.dia)) as retrato
    from (select v.youtube_video_id, g::date as dia,
            case when d.youtube_video_id is not null then d.views is not null else cb.ok end as medido,
            case when d.youtube_video_id is not null then d.views when cb.ok then 0 end as views
          from public.youtube_videos v
          cross join generate_series($2::date, $3::date, interval '1 day') g
          left join public.yt_own_video_daily d on d.youtube_video_id = v.youtube_video_id and d.day_pt = g::date
          cross join lateral (select exists (select 1 from public.yt_own_video_coverage c where c.site_id = v.site_id
              and c.youtube_video_id = v.youtube_video_id and c.metric_set = 'base' and g::date between c.covered_from and c.covered_to) as ok) cb
          where v.site_id = $1) x`
  const retrato = async (site: string): Promise<Linha> => (await q(retratoSql, [site, DIA0, COBERTO_ATE]))[0]!
  /** V5m: as duas médias só valem em dia com view. */
  const retratoMedias = async (site: string): Promise<string> => String((await q(
    `select md5(string_agg(d.youtube_video_id || '|' || d.day_pt || '|' || coalesce(d.avg_view_percentage::text, '-') || '|' || coalesce(d.avg_view_duration_seconds::text, '-'), ',' order by d.youtube_video_id, d.day_pt)) as m
       from public.yt_own_video_daily d where d.site_id = $1 and d.views > 0`, [site]))[0]!.m)
  const todasAsLinhas = async (site: string): Promise<string> => String((await q(
    `select md5(coalesce(string_agg(to_jsonb(d)::text, ',' order by d.youtube_video_id, d.day_pt), '')) as m from public.yt_own_video_daily d where d.site_id = $1`, [site]))[0]!.m)

  const ROT_A = readFileSync(`${RAIZ}docs/ops/sql/dieta-diario-volta-a-restaurar-do-backup.sql`, 'utf8')
  const ROT_B = (site: string): string => readFileSync(`${RAIZ}docs/ops/sql/dieta-diario-volta-b-recriar-da-cobertura.sql`, 'utf8').replaceAll('<UUID_DO_SITE>', site)
  const rodar = async (sql: string): Promise<number> => (await pg.query(sql)).rowCount ?? 0
  const md5Linhas = async (site: string): Promise<string> => String((await q(
    `select md5(coalesce(string_agg(to_jsonb(d)::text, ',' order by d.youtube_video_id, d.day_pt), '')) as m from public.yt_own_video_daily d where d.site_id = $1`, [site]))[0]!.m)

  it('os dois arquivos existem e têm uma instrução cada (sem begin nem commit)', () => {
    for (const t of [ROT_A, ROT_B(S1)]) {
      const codigo = t.split('\n').filter(l => !l.trim().startsWith('--')).join('\n')
      expect(codigo).not.toMatch(/\bbegin\b|\bcommit\b/i)
      expect(codigo.trim().endsWith(';')).toBe(true)
      expect(codigo.match(/;/g)?.length).toBe(1)
    }
    expect(ROT_B(S1)).not.toContain('<UUID_DO_SITE>')
  })

  it('volta A devolve as 40 linhas, iguais coluna por coluna; as telas não mudam (retrato)', async () => {
    await tx(async () => {
      await cenario40()
      const md5Antes = await md5Linhas(S1)
      const r0 = await retrato(S1)
      await aceita(S1)
      expect(await diarioN(S1)).toBe(10)
      const r1 = await retrato(S1)
      expect(await rodar(ROT_A)).toBe(30)
      expect(await diarioN(S1)).toBe(40)
      expect(await md5Linhas(S1)).toBe(md5Antes)
      const r2 = await retrato(S1)
      expect(r1).toEqual(r0); expect(r2).toEqual(r0)
    })
  })

  it('volta A com vídeo que saiu de youtube_videos: video_id nulo, sem exceção', async () => {
    await tx(async () => {
      const c = await cenario40()
      await aceita(S1)
      await pg.query('delete from public.youtube_videos where id = $1', [c.v[0]!.id])
      expect(await rodar(ROT_A)).toBe(30)
      expect(await n('select count(*) from public.yt_own_video_daily where site_id = $1 and video_id is null', [S1])).toBe(40)
    })
  })

  it('volta A não passa por cima de dia que ganhou atividade', async () => {
    await tx(async () => {
      const c = await cenario40()
      await aceita(S1)
      await linha(c, 0, mais(DIA0, 3), { ...VAZIA, views: 2 })
      expect(await rodar(ROT_A)).toBe(29)
      expect(await n('select views from public.yt_own_video_daily where youtube_video_id = $1 and day_pt = $2', [c.v[0]!.yt, mais(DIA0, 3)])).toBe(2)
    })
  })

  it('volta A duas vezes: nenhuma linha a mais; com o backup vazio: 0 linhas, sem erro', async () => {
    await tx(async () => {
      await cenario40()
      await aceita(S1)
      await rodar(ROT_A)
      expect(await rodar(ROT_A)).toBe(0)
      expect(await diarioN(S1)).toBe(40)
    })
    await tx(async () => {
      await cenario40()
      expect(await backupN()).toBe(0)
      expect(await rodar(ROT_A)).toBe(0)
    })
  })

  it('volta B: retrato igual ao de antes da P3; t volta aos dias cobertos', async () => {
    await tx(async () => {
      await cenario40()
      const r0 = await retrato(S1)
      await aceita(S1)
      await rodar(ROT_B(S1))
      expect(await retrato(S1)).toEqual(r0)
      // toda dia coberto tem linha: 2026-01-01 a 2026-03-09 = 68 dias
      expect(await diarioN(S1)).toBe(68)
      // as 10 linhas com atividade não foram tocadas
      expect(await n('select count(*) from public.yt_own_video_daily where site_id = $1 and (views > 0 or likes > 0)', [S1])).toBe(10)
    })
  })

  it('volta B: contagens em zero, média nula, estendidas só onde cobertas', async () => {
    await tx(async () => {
      const c = await cena(S1)
      await cob(c, 0, 'base', DIA0, mais(DIA0, 9)); await cob(c, 0, 'estendidas', DIA0, mais(DIA0, 4))
      // estendidas fora da base não criam linha: só a cobertura base manda
      await cob(c, 0, 'estendidas', mais(DIA0, 20), mais(DIA0, 22))
      expect(await rodar(ROT_B(S1))).toBe(10)
      const l = await q(`select day_pt::text as d, views, engaged_views, card_impressions, likes, avg_view_duration_seconds, avg_view_percentage, card_click_rate
        from public.yt_own_video_daily where site_id = $1 order by day_pt`, [S1])
      l.forEach((x, i) => {
        expect(Number(x.views)).toBe(0); expect(Number(x.likes)).toBe(0)
        expect(x.avg_view_duration_seconds).toBeNull(); expect(x.avg_view_percentage).toBeNull(); expect(x.card_click_rate).toBeNull()
        if (i < 5) { expect(Number(x.engaged_views)).toBe(0); expect(Number(x.card_impressions)).toBe(0) }
        else { expect(x.engaged_views).toBeNull(); expect(x.card_impressions).toBeNull() }
      })
    })
  })

  it('volta B: metric_version pelo dia, nas fronteiras', async () => {
    await tx(async () => {
      const c = await cena(S1)
      for (const dia of ['2025-03-30', '2025-03-31', '2026-08-26', '2026-08-27']) await cob(c, 0, 'base', dia, dia)
      expect(await rodar(ROT_B(S1))).toBe(4)
      const l = await q('select day_pt::text as d, metric_version as v from public.yt_own_video_daily where site_id = $1 order by day_pt', [S1])
      expect(l.map(x => x.v)).toEqual(['views_ate_2025-03-30', 'views_2025-03-31_a_2026-08-26', 'views_2025-03-31_a_2026-08-26', 'views_desde_2026-08-27'])
      for (const x of l) expect(x.v).toBe(metricVersion(String(x.d)))
    })
  })

  it('volta B não toca outro site; site errado não insere nada', async () => {
    await tx(async () => {
      const a = await cena(S1); await cob(a, 0, 'base', DIA0, mais(DIA0, 4))
      const b = await cena(S2); await cob(b, 0, 'base', DIA0, mais(DIA0, 4))
      expect(await rodar(ROT_B(S1))).toBe(5)
      expect(await diarioN(S2)).toBe(0)
      expect(await rodar(ROT_B(randomUUID()))).toBe(0)
    })
  })

  it('volta B com buraco na cobertura: nenhuma linha no dia do buraco; com vídeo que saiu: video_id nulo', async () => {
    await tx(async () => {
      const c = await cena(S1)
      await cob(c, 0, 'base', DIA0, mais(DIA0, 3)); await cob(c, 0, 'base', mais(DIA0, 5), mais(DIA0, 8))
      await pg.query('delete from public.youtube_videos where id = $1', [c.v[0]!.id])
      expect(await rodar(ROT_B(S1))).toBe(8)
      expect(await n('select count(*) from public.yt_own_video_daily where site_id = $1 and day_pt = $2', [S1, mais(DIA0, 4)])).toBe(0)
      expect(await n('select count(*) from public.yt_own_video_daily where site_id = $1 and video_id is null', [S1])).toBe(8)
    })
  })
})
