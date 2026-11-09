// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { EXCECOES } from '../helpers/views-excecoes'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const CONSULTA = `
select c.relname, c.relkind
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('v','m')
  and (has_any_column_privilege('anon', c.oid, 'select') or has_any_column_privilege('authenticated', c.oid, 'select'))
  and (c.relkind = 'm' or not exists (select 1 from unnest(coalesce(c.reloptions, '{}')) o
                                      where o ~* '^security_invoker=(on|true|yes|1)$'))
order by 1`

describe.skipIf(skipIfNoLocalDb())('public: views/mvs legíveis por anon/authenticated', () => {
  let db: Client
  beforeAll(async () => { db = new Client({ connectionString: PG_URL }); await db.connect() })
  afterAll(async () => { await db.end() })

  it('só EXCECOES aparecem', async () => {
    const r = await db.query<{ relname: string }>(CONSULTA)
    expect(r.rows.map(x => x.relname).sort()).toEqual(Object.keys(EXCECOES).sort())
  })

  it('negativo: view sem invoker com grant só de coluna a anon aparece', async () => {
    await db.query('begin')
    try {
      await db.query('create view public.zz_teste_view_anon as select 1 as a, 2 as b')
      await db.query('revoke all on public.zz_teste_view_anon from anon, authenticated')
      await db.query('grant select (a) on public.zz_teste_view_anon to anon')
      const r = await db.query<{ relname: string }>(CONSULTA)
      expect(r.rows.map(x => x.relname)).toContain('zz_teste_view_anon')
    } finally { await db.query('rollback') }
  })
})
