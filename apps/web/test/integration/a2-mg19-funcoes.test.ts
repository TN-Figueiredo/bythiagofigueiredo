// @vitest-environment node
/**
 * A2 · MG19: matriz por papel das funções de acesso ao CMS (banco local bythiago_int).
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run --no-file-parallelism test/integration/a2-mg19-funcoes.test.ts
 * Função sem EXECUTE nunca é chamada (SIGSEGV no Postgres local): o privilégio de anon é conferido por catálogo.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY, seedRbacScenario, cleanupRbacScenario, type RbacScenario } from '../helpers/db-seed'
import { comoUsuario } from '../helpers/pg-como'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

describe.skipIf(skipIfNoLocalDb())('A2 MG19: can_view_site = can_edit_site; o reporter só tem can_view_observatorio', () => {
  let pg: Client
  let admin: SupabaseClient
  let s: RbacScenario

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
    s = await seedRbacScenario(admin)
    pg = new Client({ connectionString: PG_URL })
    await pg.connect()
  })
  afterAll(async () => {
    await pg?.end()
    await cleanupRbacScenario(admin, s)
  })

  async function linha(userId: string, siteId: string) {
    return comoUsuario(pg, userId, async (q) => {
      const r = await q(
        `select public.can_view_site($1) v, public.can_edit_site($1) e, public.can_view_observatorio($1) o, public.is_member_staff() st`,
        [siteId],
      )
      const u = await q(`select user_role from public.user_accessible_sites() where site_id = $1`, [siteId])
      return { ...r.rows[0], papel: u.rows[0]?.user_role ?? null }
    })
  }

  it.each([
    ['super_admin', () => s.superAdminId, { v: true, e: true, o: true, st: true, papel: 'super_admin' }],
    ['org_admin', () => s.orgAdminId, { v: true, e: true, o: true, st: true, papel: 'org_admin' }],
    ['editor_a', () => s.editorAId, { v: true, e: true, o: true, st: true, papel: 'editor' }],
    ['reporter_a', () => s.reporterAId, { v: false, e: false, o: true, st: true, papel: 'reporter' }],
    ['random', () => s.randomId, { v: false, e: false, o: false, st: false, papel: null }],
  ])('%s no site A', async (_n, id, esperado) => {
    expect(await linha(id(), s.siteAId)).toEqual(esperado)
  })

  it('reporter_a no site B: nada', async () => {
    const r = await linha(s.reporterAId, s.siteBId)
    expect([r.v, r.e, r.o, r.papel]).toEqual([false, false, false, null])
  })

  it('can_view_site == can_edit_site em toda a matriz', async () => {
    for (const id of [s.superAdminId, s.orgAdminId, s.editorAId, s.reporterAId, s.randomId]) {
      for (const site of [s.siteAId, s.siteBId]) {
        const r = await linha(id, site)
        expect(r.v).toBe(r.e)
      }
    }
  })

  it('anon e public não executam can_view_observatorio nem is_member_editor (por catálogo)', async () => {
    const r = await pg.query(
      `select has_function_privilege('anon','public.can_view_observatorio(uuid)','EXECUTE') a1,
              has_function_privilege('authenticated','public.can_view_observatorio(uuid)','EXECUTE') a2,
              has_function_privilege('anon','public.is_member_editor()','EXECUTE') b1,
              has_function_privilege('authenticated','public.is_member_editor()','EXECUTE') b2`,
    )
    expect(r.rows[0]).toEqual({ a1: false, a2: true, b1: false, b2: true })
  })

  it('is_member_editor: editor sim, reporter não', async () => {
    const f = (id: string) => comoUsuario(pg, id, async (q) => (await q('select public.is_member_editor() x')).rows[0].x)
    expect(await f(s.editorAId)).toBe(true)
    expect(await f(s.reporterAId)).toBe(false)
    expect(await f(s.superAdminId)).toBe(true)
  })
})
