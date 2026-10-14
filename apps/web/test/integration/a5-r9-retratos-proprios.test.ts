// @vitest-environment node
/**
 * A5 · R9a (MG20): `yt_own_channel_snapshots` contra Postgres de verdade (check, RLS com GUC forjado, privilégios, upsert com
 * `ignoreDuplicates`, concorrência, cascade). O SQL vem de `test/fixtures/sql/a5-r9-mg20.sql` e é aplicado DUAS vezes (idempotência).
 * Banco: SÓ o `bythiago_int`:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/a5-r9-retratos-proprios.test.ts --no-file-parallelism
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite } from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

vi.setConfig({ testTimeout: 60_000 })

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const MG20 = readFileSync(fileURLToPath(new URL('../fixtures/sql/a5-r9-mg20.sql', import.meta.url)), 'utf8')
const T = 'public.yt_own_channel_snapshots'
const DIA = '2026-01-15'
const OPCOES = { onConflict: 'youtube_channel_id,snapshot_date', ignoreDuplicates: true } as const

type Who = 'anon' | 'sem' | 'membro' | 'outroSite'
interface Cen { siteA: string; siteB: string; canal: string; users: Record<Exclude<Who, 'anon'>, string> }

describe.skipIf(skipIfNoLocalDb())('A5 R9a (MG20): yt_own_channel_snapshots (banco local, GUC forjado)', () => {
  let pg: Client
  let sb: ReturnType<typeof getSupabaseServiceClient>
  const sites: string[] = []
  const usuarios: string[] = []

  beforeAll(async () => {
    sb = getSupabaseServiceClient()
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
    await pg.query(MG20)
    await pg.query(MG20) // idempotente: a segunda vez não dá erro
  })
  afterAll(async () => {
    try {
      if (sites.length > 0) {
        await pg.query('delete from public.youtube_channels where site_id = any($1::uuid[])', [sites]) // cascade apaga os retratos
        await pg.query('delete from public.site_memberships where site_id = any($1::uuid[])', [sites])
        await pg.query('delete from public.audit_log where site_id = any($1::uuid[])', [sites])
      }
      if (usuarios.length > 0) await pg.query('delete from auth.users where id = any($1::uuid[])', [usuarios])
      if (sites.length > 0) await pg.query('delete from public.sites where id = any($1::uuid[])', [sites])
    } finally {
      await pg.end()
    }
  })

  async function canalNovo(site: string): Promise<string> {
    const x = randomUUID().replace(/-/g, '')
    return String((await pg.query(`insert into public.youtube_channels (site_id, channel_id, locale, handle, name, uploads_playlist_id, slug)
      values ($1, $2, 'pt', $3, 'Teste', $4, $5) returning id`, [site, 'UC' + x.slice(0, 22), '@t' + x.slice(0, 8), 'UU' + x.slice(2, 24), 'teste-' + x.slice(0, 8)])).rows[0].id)
  }

  /** Dois sites; usuários: sem vínculo, membro (reporter) de A e membro de B. Um canal em A com um retrato. */
  async function cenario(): Promise<Cen> {
    const siteA = (await seedSite(sb)).siteId; sites.push(siteA)
    const siteB = (await seedSite(sb)).siteId; sites.push(siteB)
    const users = { sem: randomUUID(), membro: randomUUID(), outroSite: randomUUID() }
    for (const id of Object.values(users)) {
      usuarios.push(id)
      await pg.query(`insert into auth.users (id, aud, role, email) values ($1, 'authenticated', 'authenticated', $2)`, [id, id + '@a5.test'])
    }
    await pg.query(`insert into public.site_memberships (site_id, user_id, role) values ($1, $2, 'reporter'), ($3, $4, 'editor')`, [siteA, users.membro, siteB, users.outroSite])
    const canal = await canalNovo(siteA)
    await pg.query(`insert into ${T} (youtube_channel_id, snapshot_date, subscriber_count, view_count, video_count) values ($1, $2, 1420000, 5, 7)`, [canal, DIA])
    return { siteA, siteB, canal, users }
  }

  /** Lê como `who` numa transação desfeita, com o GUC app.site_id forjado (papel anon/authenticated sem superusuário). */
  async function lerComo(c: Cen, who: Who, guc: string): Promise<number> {
    await pg.query('begin')
    try {
      if (who !== 'anon') await pg.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: c.users[who], role: 'authenticated' })])
      await pg.query(`select set_config('app.site_id', $1, true)`, [guc])
      await pg.query(who === 'anon' ? 'set local role anon' : 'set local role authenticated')
      return (await pg.query(`select 1 from ${T} where youtube_channel_id = $1`, [c.canal])).rowCount ?? 0
    } finally {
      await pg.query('rollback')
    }
  }

  it('check: subscriber_count nulo com subscribers_hidden false falha; nulo com hidden true passa; negativo falha', async () => {
    const c = await cenario()
    await expect(pg.query(`insert into ${T} (youtube_channel_id, snapshot_date, subscriber_count, subscribers_hidden, view_count) values ($1, '2026-01-16', null, false, 10)`, [c.canal])).rejects.toThrow(/check/i)
    await pg.query(`insert into ${T} (youtube_channel_id, snapshot_date, subscriber_count, subscribers_hidden) values ($1, '2026-01-17', null, true)`, [c.canal])
    await expect(pg.query(`insert into ${T} (youtube_channel_id, snapshot_date, subscriber_count) values ($1, '2026-01-18', -1)`, [c.canal])).rejects.toThrow(/check/i)
  })

  it('RLS: membro do site lê as linhas do seu canal (controle positivo); sem vínculo e membro de outro site leem 0, forjando o GUC', async () => {
    const c = await cenario()
    for (const guc of [c.siteA, c.siteB, '']) {
      // a subconsulta em youtube_channels passa pela RLS dela (site_visible): com o GUC de OUTRO site o canal some (fecha, não abre)
      expect(await lerComo(c, 'membro', guc), `membro, GUC ${guc || 'vazio'}`).toBe(guc === c.siteB ? 0 : 1)
      expect(await lerComo(c, 'sem', guc), `sem vínculo, GUC ${guc || 'vazio'}`).toBe(0)
      expect(await lerComo(c, 'outroSite', guc), `membro de B, GUC ${guc || 'vazio'}`).toBe(0)
    }
  })

  it('privilégios: anon não tem nenhum; authenticated só SELECT', async () => {
    for (const priv of ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) {
      const r = await pg.query(`select has_table_privilege('anon', $1, $2) as a, has_table_privilege('authenticated', $1, $2) as u`, [T, priv])
      expect(r.rows[0].a, `anon ${priv}`).toBe(false)
      expect(r.rows[0].u, `authenticated ${priv}`).toBe(priv === 'SELECT')
    }
  })

  it('catálogo: RLS ligada, uma policy (SELECT) e nenhuma de escrita', async () => {
    const rls = await pg.query(`select relrowsecurity from pg_class where oid = $1::regclass`, [T])
    expect(rls.rows[0].relrowsecurity).toBe(true)
    const pol = await pg.query(`select policyname, cmd from pg_policies where schemaname = 'public' and tablename = 'yt_own_channel_snapshots'`)
    expect(pol.rows).toEqual([{ policyname: 'yt_own_channel_snapshots_select', cmd: 'SELECT' }])
  })

  it('dois upsert com ignoreDuplicates no mesmo canal e dia, números diferentes: fica o primeiro', async () => {
    const c = await cenario()
    const dia = '2026-02-01'
    const a = await sb.from('yt_own_channel_snapshots').upsert({ youtube_channel_id: c.canal, snapshot_date: dia, subscriber_count: 100, subscribers_hidden: false }, OPCOES)
    const b = await sb.from('yt_own_channel_snapshots').upsert({ youtube_channel_id: c.canal, snapshot_date: dia, subscriber_count: 999, subscribers_hidden: false }, OPCOES)
    expect(a.error).toBeNull(); expect(b.error).toBeNull()
    const r = await pg.query(`select subscriber_count from ${T} where youtube_channel_id = $1 and snapshot_date = $2`, [c.canal, dia])
    expect(r.rows.map(x => Number(x.subscriber_count))).toEqual([100])
  })

  it('os dois em Promise.all: nenhum erro, 1 linha', async () => {
    const c = await cenario()
    const dia = '2026-02-02'
    const mk = (n: number) => sb.from('yt_own_channel_snapshots').upsert({ youtube_channel_id: c.canal, snapshot_date: dia, subscriber_count: n, subscribers_hidden: false }, OPCOES)
    const [a, b] = await Promise.all([mk(1), mk(2)])
    expect(a.error).toBeNull(); expect(b.error).toBeNull()
    const r = await pg.query(`select count(*)::int as n from ${T} where youtube_channel_id = $1 and snapshot_date = $2`, [c.canal, dia])
    expect(r.rows[0].n).toBe(1)
  })

  it('apagar o youtube_channels apaga os retratos', async () => {
    const c = await cenario()
    expect((await pg.query(`select 1 from ${T} where youtube_channel_id = $1`, [c.canal])).rowCount).toBe(1)
    await pg.query('delete from public.youtube_channels where id = $1', [c.canal])
    expect((await pg.query(`select 1 from ${T} where youtube_channel_id = $1`, [c.canal])).rowCount).toBe(0)
  })
})
