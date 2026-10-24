// @vitest-environment node
// M10a (Tarefas 2 e 3): forma do SQL, a TRAVA M10a-1 como teste e as colunas/gatilho/política no banco.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import pg from 'pg'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { M10A_SQL, M10A_EM_MIGRATION, m10aNoBanco } from './video-antigo-m10a-caminho'

const pular = skipIfNoLocalDb() || (!M10A_EM_MIGRATION && !(await m10aNoBanco()))

describe.skipIf(skipIfNoLocalDb())('M10a: forma do SQL e TRAVA M10a-1', () => {
  it('o SQL abre com set lock_timeout', () => {
    expect(readFileSync(M10A_SQL, 'utf8')).toContain("set lock_timeout")
  })
  it('as guardas (E10, índice da E9, md5 das 4 funções) vêm antes de qualquer escrita', () => {
    const sql = readFileSync(M10A_SQL, 'utf8')
    const guarda = sql.indexOf('_divergente')
    expect(guarda).toBeGreaterThan(0)
    const primeiraEscrita = sql.search(/^\s*(alter table|create (or replace )?(table|function|trigger|index)|insert into|drop (trigger|function))/mi)
    expect(guarda).toBeLessThan(primeiraEscrita)
    for (const g of ['competitor_channel_pause_covers', 'idx_competitor_readings_video', 'M10a:pin_competitor_video_ausente']) {
      const i = sql.indexOf(g)
      expect(i, g).toBeGreaterThan(0)
      expect(i, g).toBeLessThan(primeiraEscrita)
    }
  })
  it('sem md5 placeholder no SQL', () => {
    expect(readFileSync(M10A_SQL, 'utf8')).not.toContain('@@')
  })
  it('TRAVA M10a-1: enquanto M10A_SQL é o rascunho, não há *_observatorio_m10a_* em supabase/migrations', () => {
    const dir = path.resolve(__dirname, '../../../../supabase/migrations')
    const achados = readdirSync(dir).filter(f => f.includes('_observatorio_m10a_'))
    if (M10A_EM_MIGRATION) expect(achados.length).toBe(1)
    else expect(achados).toEqual([])
  })
})

const TETO_CP29 = 100 // CP29 (14/10): retirada cheia de 100 vídeos em 77 ms locais; o teto nasce 100.

/** Executa dentro de savepoint e devolve o erro (ou null); a transação externa segue viva. */
async function tenta(c: pg.Client, sql: string, params: unknown[] = []): Promise<(Error & { code?: string; message: string }) | null> {
  await c.query('savepoint t')
  try {
    await c.query(sql, params)
    await c.query('release savepoint t')
    return null
  } catch (e) {
    await c.query('rollback to savepoint t')
    return e as Error & { code?: string }
  }
}

describe.skipIf(pular)('M10a: banco (pula até a Tarefa 5b se o rascunho não foi aplicado)', () => {
  let c: pg.Client
  beforeAll(async () => {
    c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL })
    await c.connect()
  })
  afterAll(async () => { await c.end() })

  /** Site, canal e vídeo mínimos, dentro de uma transação aberta pelo teste. */
  async function semear(): Promise<{ siteId: string; videoId: string }> {
    const slug = 'm10a-' + Math.random().toString(36).slice(2, 10)
    const org = await c.query(`insert into public.organizations (name, slug, parent_org_id) values ($1, $1, (select id from public.organizations order by created_at limit 1)) returning id`, [slug])
    const site = await c.query(`insert into public.sites (org_id, name, slug, primary_domain) values ($1, $2, $2, $3) returning id`, [org.rows[0].id, slug, slug + '.invalid'])
    const ch = await c.query(`insert into public.competitor_channels (site_id, channel_id, channel_name, video_limit) values ($1, $2, $2, 50) returning id`, [site.rows[0].id, 'UC' + slug])
    const v = await c.query(`insert into public.competitor_videos (competitor_channel_id, video_id, title, published_at) values ($1, $2, 'v', now() - interval '30 days') returning id`, [ch.rows[0].id, 'v' + slug])
    return { siteId: site.rows[0].id, videoId: v.rows[0].id }
  }
  async function emTransacao(fn: () => Promise<void>) {
    await c.query('begin')
    try { await fn() } finally { await c.query('rollback') }
  }

  it('as seis colunas existem, anuláveis e sem padrão; toda linha existente as tem nulas', async () => {
    const r = await c.query(`select column_name, is_nullable, column_default, data_type from information_schema.columns
      where table_schema = 'public' and table_name = 'competitor_videos' and column_name like 'archive\_%' order by 1`)
    expect(r.rows.map(x => x.column_name)).toEqual(['archive_comment_count', 'archive_dropped_at', 'archive_frozen_at', 'archive_like_count', 'archive_stats_at', 'archive_view_count'])
    for (const x of r.rows) { expect(x.is_nullable).toBe('YES'); expect(x.column_default).toBeNull() }
    const n = await c.query(`select count(*)::int n from public.competitor_videos where archive_frozen_at is not null or archive_dropped_at is not null
      or archive_view_count is not null or archive_like_count is not null or archive_comment_count is not null or archive_stats_at is not null`)
    expect(n.rows[0].n).toBe(0)
  })

  it('o gatilho de imutabilidade recusa cada transição proibida e aceita as válidas', async () => {
    await emTransacao(async () => {
      const { videoId } = await semear()
      expect(await tenta(c, `update public.competitor_videos set archive_frozen_at = now() where id = $1`, [videoId])).toBeNull()
      const e1 = await tenta(c, `update public.competitor_videos set archive_frozen_at = now() + interval '1 day' where id = $1`, [videoId])
      expect(e1?.message).toBe('archive_frozen_imutavel')
      expect(e1?.code).toBe('P0001')
      // contagens mudam sem mudar archive_frozen_at: recusa
      const e2 = await tenta(c, `update public.competitor_videos set archive_view_count = 5 where id = $1`, [videoId])
      expect(e2?.message).toBe('contagens_do_arquivo_imutaveis')
      // contagens gravadas junto de uma nova marca: passa (no descongelar/recongelar)
      expect(await tenta(c, `update public.competitor_videos set archive_frozen_at = null, archive_view_count = null where id = $1`, [videoId])).toBeNull()
      expect(await tenta(c, `update public.competitor_videos set archive_frozen_at = now(), archive_view_count = 5, archive_like_count = 2, archive_comment_count = 1, archive_stats_at = now() where id = $1`, [videoId])).toBeNull()
      // voltar a nulo sem limpar as contagens
      const e3 = await tenta(c, `update public.competitor_videos set archive_frozen_at = null where id = $1`, [videoId])
      expect(e3?.message).toBe('descongelar_sem_limpar')
      // limpando as quatro: passa
      expect(await tenta(c, `update public.competitor_videos set archive_frozen_at = null, archive_view_count = null, archive_like_count = null, archive_comment_count = null, archive_stats_at = null where id = $1`, [videoId])).toBeNull()
    })
  })

  it('retirada sem congelamento recusa; depois de retirado, qualquer mudança nas seis recusa', async () => {
    await emTransacao(async () => {
      const { videoId } = await semear()
      const e1 = await tenta(c, `update public.competitor_videos set archive_dropped_at = now() where id = $1`, [videoId])
      expect(e1?.message).toBe('retirada_sem_congelamento')
      // Phil M-2: congelar e retirar no MESMO update também recusa (a ordem dos estágios é invariante do banco)
      const e1b = await tenta(c, `update public.competitor_videos set archive_frozen_at = now(), archive_dropped_at = now() where id = $1`, [videoId])
      expect(e1b?.message).toBe('retirada_sem_congelamento')
      expect(await tenta(c, `update public.competitor_videos set archive_frozen_at = now() where id = $1`, [videoId])).toBeNull()
      expect(await tenta(c, `update public.competitor_videos set archive_dropped_at = now() where id = $1`, [videoId])).toBeNull()
      for (const set of [`archive_frozen_at = null`, `archive_dropped_at = null`, `archive_view_count = 1`, `archive_like_count = 1`, `archive_comment_count = 1`, `archive_stats_at = now()`]) {
        const e = await tenta(c, `update public.competitor_videos set ${set} where id = $1`, [videoId])
        expect(e?.message, set).toBe('ja_no_arquivo')
      }
      // colunas fora das seis seguem livres no vídeo retirado
      expect(await tenta(c, `update public.competitor_videos set title = 'novo' where id = $1`, [videoId])).toBeNull()
    })
  })

  it('guarda md5 (Yannis I-3): corpo instalado diferente recusa com M10a:<função>_divergente e nada é escrito; reaplicar sobre o próprio resultado passa', async () => {
    const sql = readFileSync(M10A_SQL, 'utf8')
    await emTransacao(async () => {
      await c.query(sql)
      expect(await tenta(c, sql)).toBeNull() // idempotente: o corpo "depois" também é aceito
    })
    const mutantes: Array<[string, string]> = [
      ['competitor_series_health', 'p_site_id uuid, p_now timestamptz'],
      ['competitor_channel_removal_impact', 'p_site_id uuid, p_channel_id uuid'],
    ]
    for (const [nome, args] of mutantes) {
      await emTransacao(async () => {
        await c.query(sql)
        await c.query(`create or replace function public.${nome}(${args}) returns jsonb language sql as $b$ select '{}'::jsonb $b$`)
        const e = await tenta(c, sql)
        expect(e?.message).toBe(`M10a:${nome}_divergente`)
      })
    }
  })

  it('update que não cita as seis colunas (o da sincronização) não dispara o gatilho', async () => {
    await emTransacao(async () => {
      const { videoId } = await semear()
      await c.query(`set local track_functions = 'all'`)
      const chamadas = async () => {
        const r = await c.query(`select coalesce(pg_stat_get_xact_function_calls('public.competitor_videos_archive_guard'::regproc), 0)::int n`)
        return r.rows[0].n as number
      }
      const antes = await chamadas()
      await c.query(`update public.competitor_videos set view_count = 7, last_seen_at = now() where id = $1`, [videoId])
      expect(await chamadas()).toBe(antes)
      await c.query(`update public.competitor_videos set archive_frozen_at = now() where id = $1`, [videoId])
      expect(await chamadas()).toBe(antes + 1)
    })
  })

  it('política: todo site anterior à migration tem linha (os criados depois não: classe fechada), 24, fechada, teto da CP29; check, RLS e privilégios', async () => {
    const sem = await c.query(`select count(*)::int n from public.sites s where s.created_at < (select min(updated_at) from public.obs_archive_video_policy) and not exists (select 1 from public.obs_archive_video_policy p where p.site_id = s.id)`)
    expect(sem.rows[0].n).toBe(0)
    const r = await c.query(`select distinct h_meses, released, teto_unidade, teto_auto_minimo, teto_auto_fracao::float8 f from public.obs_archive_video_policy`)
    expect(r.rows).toEqual([{ h_meses: 24, released: false, teto_unidade: TETO_CP29, teto_auto_minimo: 25, f: 0.05 }])
    await emTransacao(async () => {
      const e = await tenta(c, `update public.obs_archive_video_policy set h_meses = 11`)
      expect(e?.code).toBe('23514')
      // site novo depois da migration não ganha linha sozinho
      const { siteId } = await semear()
      const n = await c.query(`select count(*)::int n from public.obs_archive_video_policy where site_id = $1`, [siteId])
      expect(n.rows[0].n).toBe(0)
    })
    await emTransacao(async () => {
      await c.query('set local role service_role')
      for (const sql of [`update public.obs_archive_video_policy set released = true`, `insert into public.obs_archive_video_policy (site_id) values (gen_random_uuid())`, `delete from public.obs_archive_video_policy`]) {
        const e = await tenta(c, sql)
        expect(e?.code, sql).toBe('42501')
      }
      const e = await tenta(c, `select 1 from public.obs_archive_video_policy limit 1`)
      expect(e).toBeNull()
    })
    const priv = await c.query(`select has_table_privilege('service_role','public.obs_archive_video_policy','select') sr,
      has_table_privilege('authenticated','public.obs_archive_video_policy','select') au,
      has_table_privilege('anon','public.obs_archive_video_policy','select') an,
      (select relrowsecurity from pg_class where oid = 'public.obs_archive_video_policy'::regclass) rls`)
    expect(priv.rows[0]).toEqual({ sr: true, au: false, an: false, rls: true })
  })

  it('subir H não muda nenhum vídeo', async () => {
    const conta = async () => (await c.query(`select count(*)::int n from public.competitor_videos where archive_frozen_at is not null`)).rows[0].n
    const antes = await conta()
    await emTransacao(async () => {
      await c.query(`update public.obs_archive_video_policy set h_meses = 36`)
      expect(await conta()).toBe(antes)
    })
    expect(await conta()).toBe(antes)
  })
})
