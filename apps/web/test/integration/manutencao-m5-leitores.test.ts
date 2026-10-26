// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { q1, SITE_TESTE } from '../helpers/m3b'
import { prepararM5 } from '../helpers/m5'

/** Banco de integração (54422), nunca o 54322 do navegador. */
const URL_INT = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54422/postgres'

describe.skipIf(skipIfNoLocalDb())('M5 parte 1: online desde', () => {
  let c: Client
  beforeEach(async () => { c = new Client({ connectionString: URL_INT }); await c.connect(); await c.query('begin'); await prepararM5(c, 1) })
  afterEach(async () => { await c.query('rollback'); await c.end() })

  const fora = (site: string, classe: string, tabela: string, mes: string, col: 'detached_at' | 'dropped_at') =>
    c.query(`insert into public.obs_archive_months (site_id, class, table_name, month, ${col}) values ($1, $2, $3, $4, now())`, [site, classe, tabela, mes])
  const linha = (tabela: string) => q1(c, `select online_since::text as d, divergencia from public.obs_archive_online_since($1) where table_name = $2`, [SITE_TESTE, tabela])

  it('window_months da política: serie 6, horaria 3', async () => {
    const r = await c.query(`select class, table_name, window_months from public.obs_archive_policy() where class in ('serie','horaria')`)
    for (const l of r.rows) expect(l.window_months, l.table_name).toBe(l.class === 'serie' ? 6 : 3)
  })
  it('nenhum mês saiu: só horária e série, todas nulas, sem divergência', async () => {
    const r = await c.query(`select class, table_name, online_since, divergencia from public.obs_archive_online_since($1) order by 2`, [SITE_TESTE])
    expect(r.rows.map(x => x.table_name)).toEqual(['competitor_video_daily', 'competitor_video_early', 'competitor_video_hourly'])
    expect(r.rows.every(x => x.online_since === null && x.divergencia === false)).toBe(true)
    expect(new Set(r.rows.map(x => x.class))).toEqual(new Set(['serie', 'horaria']))
  })
  it('mês destacado conta como fora; trazer de volta recua', async () => {
    await fora(SITE_TESTE, 'serie', 'competitor_video_daily', '2027-04-01', 'detached_at')
    expect((await linha('competitor_video_daily')).d).toBe('2027-05-01')
    await c.query(`update public.obs_archive_months set detached_at = null where site_id = $1`, [SITE_TESTE])
    expect((await linha('competitor_video_daily')).d).toBeNull()
  })
  it('descartado e destacado: vale o mês seguinte ao último fora', async () => {
    await fora(SITE_TESTE, 'serie', 'competitor_video_daily', '2027-03-01', 'dropped_at')
    await fora(SITE_TESTE, 'serie', 'competitor_video_daily', '2027-04-01', 'detached_at')
    expect((await linha('competitor_video_daily')).d).toBe('2027-05-01')
  })
  it('a saída é da tabela, não do site: o mês de outro site também conta', async () => {
    await fora(randomUUID(), 'serie', 'competitor_video_daily', '2027-04-01', 'dropped_at')
    expect((await linha('competitor_video_daily')).d).toBe('2027-05-01')
  })
  it('registro vazio com a partição mais antiga depois do primeiro mês: divergência, nunca "nada saiu"', async () => {
    expect((await q1(c, `select relkind::text as k from pg_class where oid = 'public.competitor_video_daily'::regclass`)).k).toBe('p')
    await c.query(`insert into public.obs_archive_switch (site_id, class, first_month) values ($1, 'serie', '2020-01-01')`, [SITE_TESTE])
    const r = await linha('competitor_video_daily')
    expect(r).toMatchObject({ d: null, divergencia: true })
  })
  it('a função é só de service_role', async () => {
    const r = await q1(c, `select has_function_privilege('anon', 'public.obs_archive_online_since(uuid)', 'execute') as anon,
                                 has_function_privilege('authenticated', 'public.obs_archive_online_since(uuid)', 'execute') as auth,
                                 has_function_privilege('service_role', 'public.obs_archive_online_since(uuid)', 'execute') as svc`)
    expect(r).toEqual({ anon: false, auth: false, svc: true })
  })
})
