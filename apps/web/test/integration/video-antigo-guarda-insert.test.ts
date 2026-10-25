// @vitest-environment node
// M10a (Tarefa 4): a guarda de insert do vídeo congelado nas 8 tabelas da classe video_antigo.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import pg from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { M10A_EM_MIGRATION, m10aNoBanco } from './video-antigo-m10a-caminho'
import { TABELAS_VIDEO_FORA_DA_CLASSE } from '@/lib/youtube/video-antigo/tabelas-fora-da-classe'

const pular = skipIfNoLocalDb() || (!M10A_EM_MIGRATION && !(await m10aNoBanco()))

/** $1 = video_id (ou null), $2 = site_id, $3 = competitor_channel_id. Linha mínima válida de cada tabela. */
const INSERTS: Record<string, string> = {
  competitor_video_versions: `insert into public.competitor_video_versions (video_id, field, value_hash, first_seen_at, last_seen_at, precision, is_current) values ($1, 'title', md5(random()::text), now(), now(), 'first', false)`,
  competitor_field_versions: `insert into public.competitor_field_versions (site_id, competitor_channel_id, video_id, field, value_hash, first_seen_at, last_seen_at, precision, is_current) values ($2, $3, $1, 'title', md5(random()::text), now(), now(), 'first', false)`,
  competitor_raw: `insert into public.competitor_raw (site_id, competitor_channel_id, video_id, raw_sha256, first_seen_at, last_seen_at, is_current, raw) values ($2, $3, $1, md5(random()::text), now(), now(), false, '{}'::jsonb)`,
  competitor_video_tier_spans: `insert into public.competitor_video_tier_spans (video_id, from_date, tier, site_id) values ($1, current_date - 400, 'semanal', $2)`,
  competitor_video_comment_snaps: `insert into public.competitor_video_comment_snaps (video_id, mark, site_id, competitor_channel_id, taken_at, video_age_hours, status, rule_version, rule_params, units_used) values ($1, 1, $2, $3, now(), 24, 'sem_comentarios', 1, '{}'::jsonb, 1)`,
  competitor_hour_fold_log: `insert into public.competitor_hour_fold_log (video_id, day, site_id, intervals_clean, intervals_long, folded_at) values ($1, current_date - 10, $2, 3, 0, now())`,
  competitor_changes: `insert into public.competitor_changes (video_id, site_id, change_type, old_title, new_title, detected_at) values ($1, $2, 'title', 'a', 'b', now())`,
  competitor_readings: `insert into public.competitor_readings (site_id, task_type, video_id, model, generated_at, sent, text) values ($2, 'video', $1, 'm10a', now(), '{}'::jsonb, '{"lead":"x"}'::jsonb)`,
}
const OITO = Object.keys(INSERTS).sort()
const PODE_NULO = ['competitor_field_versions', 'competitor_raw', 'competitor_readings']

type Err = (Error & { code?: string; detail?: string; hint?: string }) | null
async function tenta(c: pg.Client, sql: string, params: unknown[] = []): Promise<Err> {
  await c.query('savepoint t')
  try {
    const usados = Math.max(...[...sql.matchAll(/\$(\d)/g)].map(m => Number(m[1])))
    await c.query(sql, params.slice(0, usados)) // o servidor recusa parâmetro que a consulta não cita
    await c.query('rollback to savepoint t') // desfaz a linha que passou
    return null
  } catch (e) {
    await c.query('rollback to savepoint t')
    return e as Err
  }
}

describe.skipIf(pular)('M10a: guarda de insert do vídeo congelado (pula até a Tarefa 5b se o rascunho não foi aplicado)', () => {
  let c: pg.Client
  beforeAll(async () => {
    c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' })
    await c.connect()
    await c.query('begin')
    const slug = 'm10a-g-' + Math.random().toString(36).slice(2, 10)
    const org = await c.query(`insert into public.organizations (name, slug, parent_org_id) values ($1, $1, (select id from public.organizations order by created_at limit 1)) returning id`, [slug])
    const site = await c.query(`insert into public.sites (org_id, name, slug, primary_domain) values ($1, $2, $2, $3) returning id`, [org.rows[0].id, slug, slug + '.invalid'])
    fx.site = site.rows[0].id
    const ch = await c.query(`insert into public.competitor_channels (site_id, channel_id, channel_name, video_limit) values ($1, $2, $2, 50) returning id`, [fx.site, 'UC' + slug])
    fx.canal = ch.rows[0].id
    const v = await c.query(`insert into public.competitor_videos (competitor_channel_id, video_id, title, published_at) select $1, $2 || g, 'v', now() - interval '30 days' from generate_series(1, 2) g returning id`, [fx.canal, 'v' + slug])
    fx.ativo = v.rows[0].id
    fx.congelado = v.rows[1].id
    await c.query(`update public.competitor_videos set archive_frozen_at = now() where id = $1`, [fx.congelado])
  })
  afterAll(async () => { await c.query('rollback'); await c.end() })
  const fx = { site: '', canal: '', ativo: '', congelado: '' }

  it.each(OITO)('%s: vídeo congelado recusa com video_congelado e hint = tabela; o ativo passa', async (t) => {
    const e = await tenta(c, INSERTS[t]!, [fx.congelado, fx.site, fx.canal])
    expect(e?.message).toBe('video_congelado')
    expect(e?.code).toBe('P0001')
    expect(e?.detail).toBe(fx.congelado)
    expect(e?.hint).toBe(t)
    expect(await tenta(c, INSERTS[t]!, [fx.ativo, fx.site, fx.canal])).toBeNull()
  })

  it.each(OITO)('%s: service_role também recusa o congelado', async (t) => {
    await c.query('savepoint r')
    await c.query('set local role service_role')
    const e = await tenta(c, INSERTS[t]!, [fx.congelado, fx.site, fx.canal])
    await c.query('rollback to savepoint r')
    expect(e?.message).toBe('video_congelado')
  })

  it.each(PODE_NULO)('%s: video_id nulo passa sem consulta', async (t) => {
    expect(await tenta(c, INSERTS[t]!, [null, fx.site, fx.canal])).toBeNull()
  })

  it('catálogo: o gatilho está exatamente nas 8 tabelas e a função é security definer', async () => {
    const r = await c.query(`select c.relname from pg_trigger t join pg_class c on c.oid = t.tgrelid where t.tgname = 'obs_video_antigo_guarda' and not t.tgisinternal order by 1`)
    expect(r.rows.map(x => x.relname)).toEqual(OITO)
    const f = await c.query(`select prosecdef, proconfig from pg_proc where oid = 'public.obs_video_antigo_guarda_insert()'::regprocedure`)
    expect(f.rows[0].prosecdef).toBe(true)
    expect(f.rows[0].proconfig).toEqual(['search_path=""'])
    const p = await c.query(`select has_function_privilege('anon','public.obs_video_antigo_guarda_insert()','execute') an,
      has_function_privilege('authenticated','public.obs_video_antigo_guarda_insert()','execute') au,
      has_function_privilege('service_role','public.obs_video_antigo_guarda_insert()','execute') sr`)
    expect(p.rows[0]).toEqual({ an: false, au: false, sr: false })
  })

  it('custo da volta atrás: 50 linhas num comando com 1 vídeo congelado recusam inteiras', async () => {
    const sql = `insert into public.competitor_field_versions (site_id, competitor_channel_id, video_id, field, value_hash, first_seen_at, last_seen_at, precision, is_current)
      select $2, $3, case when g = 1 then $1::uuid else $4::uuid end, 'title', md5(g::text || random()::text), now(), now(), 'first', false from generate_series(1, 50) g`
    await c.query('savepoint b')
    let erro: Err = null
    try { await c.query(sql, [fx.congelado, fx.site, fx.canal, fx.ativo]) } catch (e) { erro = e as Err }
    await c.query('rollback to savepoint b')
    expect(erro?.message).toBe('video_congelado')
    const n = await c.query(`select count(*)::int n from public.competitor_field_versions where video_id = $1`, [fx.ativo])
    expect(n.rows[0].n).toBe(0)
  })

  it('upsert com on conflict do nothing de vídeo congelado também recusa', async () => {
    const sql = INSERTS.competitor_field_versions! + ' on conflict do nothing'
    const e = await tenta(c, sql, [fx.congelado, fx.site, fx.canal])
    expect(e?.message).toBe('video_congelado')
  })

  it('o índice idx_competitor_readings_video existe (E9) e cobre video_id; a M10a não o recria', async () => {
    const r = await c.query(`select indexdef from pg_indexes where schemaname = 'public' and indexname = 'idx_competitor_readings_video'`)
    expect(r.rowCount).toBe(1)
    expect(r.rows[0].indexdef).toContain('(video_id)')
  })

  // ── (rodada 0.6) forma: a próxima tabela por vídeo não fica fora da classe em silêncio ──────────────────────────────
  const CONHECIDAS = new Set<string>([...OITO, ...TABELAS_VIDEO_FORA_DA_CLASSE.map(t => t.tabela)])
  /** O universo: as tabelas do registro de arquivo (obs_archive_registry) mais as com FK RAIZ para competitor_videos (sem as partições da M2). */
  const SQL_UNIVERSO = `
    with registro as (select table_name::text as t from public.obs_archive_registry()),
    fk as (select cl.relname::text as t from pg_constraint k join pg_class cl on cl.oid = k.conrelid join pg_namespace n on n.oid = cl.relnamespace
            where k.confrelid = 'public.competitor_videos'::regclass and k.contype = 'f' and k.conparentid = 0 and not cl.relispartition and n.nspname = 'public'),
    universo as (select t from registro union select t from fk)
    select u.t,
      exists (select 1 from fk f where f.t = u.t) as fk_para_video,
      exists (select 1 from pg_attribute a join pg_class cl on cl.oid = a.attrelid join pg_namespace n on n.oid = cl.relnamespace
               where n.nspname = 'public' and cl.relname = u.t and a.attname = 'youtube_video_id' and not a.attisdropped) as tem_youtube_video_id
    from universo u order by 1`
  const faltando = async () => (await c.query(SQL_UNIVERSO)).rows.filter(r => (r.fk_para_video || r.tem_youtube_video_id) && !CONHECIDAS.has(r.t)).map(r => r.t as string)

  it('forma: toda tabela do universo com chave para o vídeo está nas 8 ou em TABELAS_VIDEO_FORA_DA_CLASSE', async () => {
    expect(await faltando()).toEqual([])
    expect(TABELAS_VIDEO_FORA_DA_CLASSE).toHaveLength(14)
    expect(new Set(TABELAS_VIDEO_FORA_DA_CLASSE.map(t => t.tabela)).size).toBe(14)
  })
  it('forma, mutante 1: tabela fictícia com FK para competitor_videos, fora das 8 e da lista, derruba o teste com o nome dela', async () => {
    await c.query('savepoint m1')
    try {
      await c.query(`create table public.zz_m10a_tabela_nova (id uuid primary key default gen_random_uuid(), video_id uuid references public.competitor_videos(id))`)
      expect(await faltando()).toEqual(['zz_m10a_tabela_nova'])
    } finally { await c.query('rollback to savepoint m1') }
  })
  it('forma, mutante 2: tirar competitor_playlist_items da lista derruba o teste com esse nome (pela coluna youtube_video_id)', async () => {
    const tem = (await c.query(SQL_UNIVERSO)).rows.some(r => r.t === 'competitor_playlist_items')
    if (!tem) return // fora do universo (sem FK e fora do registro): a lista é a rede de quem entrar no registro
    CONHECIDAS.delete('competitor_playlist_items')
    try { expect(await faltando()).toContain('competitor_playlist_items') } finally { CONHECIDAS.add('competitor_playlist_items') }
  })
  it.skip('herança do gatilho para partição nova: hoje nenhuma das 8 é particionada (a M2 converte só as três séries); ligar quando uma for', () => {})
  it('catálogo (item 10, condicional): se alguma das 8 for particionada, o gatilho não pode ser interno nas partições', async () => {
    const r = await c.query(`select cl.relname, t.tgisinternal from pg_trigger t join pg_class cl on cl.oid = t.tgrelid where t.tgname = 'obs_video_antigo_guarda' and cl.relispartition`)
    for (const row of r.rows) expect(row.tgisinternal).toBe(false)
  })
})
