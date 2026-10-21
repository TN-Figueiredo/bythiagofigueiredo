// @vitest-environment node
/**
 * A5 · F1: RLS e privilégios de `obs_unarchived_deletions` e das funções novas. Banco: SÓ o `bythiago_int`. Cada caso termina em rollback.
 * Papel não superusuário (`set local role authenticated`), com o GUC `app.site_id` forjado para o site alheio.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { emTransacao, semearCena, q1, escalar, type Cena } from '../helpers/mg6'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const FUNCOES = [
  'public.competitor_channel_request_removal(uuid, uuid, uuid, text)', 'public.competitor_channel_cancel_removal(uuid, uuid, uuid)',
  'public.competitor_channel_delete_unarchived(uuid, uuid, uuid, text, text)', 'public.obs_unarchived_blobs_done(uuid, bigint, text[])',
  'public.obs_unarchived_watch_sweep(timestamptz)', 'public.competitor_channel_removal_extra(uuid, uuid)', 'public.obs_f1_video_compartilhado(uuid, uuid)',
  'public.competitor_channel_pause_stops_watch()', 'public.obs_nome_normalizado(text)',
]

describe.skipIf(skipIfNoLocalDb())('F1: RLS de obs_unarchived_deletions (GUC forjado, papel sem superusuário)', () => {
  let pg: Client
  beforeAll(async () => { pg = new Client({ connectionString: PG_URL }); await pg.connect() })
  afterAll(async () => { try { await pg.query('rollback') } catch { /* nada aberto */ } await pg.end() })

  async function semear(): Promise<{ a: Cena; b: Cena }> {
    const a = await semearCena(pg, { semWatch: true })
    const b = await semearCena(pg, { semWatch: true })
    await pg.query(
      `insert into public.obs_unarchived_deletions (site_id, channel_ref, channel_name, youtube_channel_id, reason, deleted_at, deleted_by, rows_deleted)
       values ($1, 'x', 'Canal', 'UCx', 'teste', now(), $2, '{}'::jsonb)`, [a.site, a.admin])
    return { a, b }
  }
  async function lerComo(usuario: string | null, guc: string, site: string): Promise<number> {
    await pg.query('savepoint s')
    try {
      if (usuario) await pg.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: usuario, role: 'authenticated' })])
      await pg.query(`select set_config('app.site_id', $1, true)`, [guc])
      await pg.query(usuario ? 'set local role authenticated' : 'set local role anon')
      return (await pg.query(`select 1 from public.obs_unarchived_deletions where site_id = $1`, [site])).rowCount ?? 0
    } finally { await pg.query('rollback to savepoint s') }
  }

  it('catálogo: RLS ligada e forçada, uma policy de select, nenhuma de escrita', async () => {
    await emTransacao(pg, async () => {
      const r = await q1(pg, `select relrowsecurity, relforcerowsecurity from pg_class where oid = 'public.obs_unarchived_deletions'::regclass`)
      expect([r.relrowsecurity, r.relforcerowsecurity]).toEqual([true, true])
      const pol = await pg.query(`select policyname, cmd from pg_policies where schemaname = 'public' and tablename = 'obs_unarchived_deletions'`)
      expect(pol.rows).toEqual([{ policyname: 'obs_unarchived_deletions_select', cmd: 'SELECT' }])
    })
  })

  it('anon não lê; admin do site lê a sua; editor de outro site lê 0, mesmo com o GUC forjado', async () => {
    await emTransacao(pg, async () => {
      const { a, b } = await semear()
      expect((await pg.query(`select has_table_privilege('anon', 'public.obs_unarchived_deletions', 'select') as x`)).rows[0].x).toBe(false)
      expect(await lerComo(a.admin, a.site, a.site)).toBe(1)
      expect(await lerComo(a.comum, a.site, a.site)).toBe(0)
      for (const guc of [a.site, b.site, '']) expect(await lerComo(b.admin, guc, a.site), `GUC ${guc || 'vazio'}`).toBe(0)
    })
  })

  it('authenticated não escreve (42501) e as funções só executam como service_role', async () => {
    await emTransacao(pg, async () => {
      const { a } = await semear()
      for (const priv of ['insert', 'update', 'delete', 'truncate']) {
        expect((await pg.query(`select has_table_privilege('authenticated', 'public.obs_unarchived_deletions', $1) as x`, [priv])).rows[0].x, priv).toBe(false)
      }
      await pg.query('savepoint w')
      await pg.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: a.admin, role: 'authenticated' })])
      await pg.query('set local role authenticated')
      await expect(pg.query(`delete from public.obs_unarchived_deletions`)).rejects.toMatchObject({ code: '42501' })
      await pg.query('rollback to savepoint w')
      for (const f of FUNCOES) {
        const r = await q1(pg, `select has_function_privilege('anon', $1, 'EXECUTE') a, has_function_privilege('authenticated', $1, 'EXECUTE') u, has_function_privilege('service_role', $1, 'EXECUTE') s`, [f])
        expect([f, r.a, r.u, r.s]).toEqual([f, false, false, true])
      }
      expect(await escalar<number>(pg, `select count(*)::int from public.obs_unarchived_deletions`)).toBe(1)
    })
  })
})
