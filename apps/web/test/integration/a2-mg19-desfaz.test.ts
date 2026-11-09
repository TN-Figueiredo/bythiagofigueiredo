// @vitest-environment node
/**
 * A2 · MG19: o SQL de desfazer (Apêndice A do plano, `.superpowers/sdd/acesso-irma-ia/a2/desfaz-apendice-a.sql`), aplicado sobre o
 * banco pós-MG19 numa transação com rollback, devolve as policies e as funções ao que está em produção (corpos do `.out`).
 * Mutante que mata: desfazer com policy esquecida.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { skipIfNoLocalDb } from '../helpers/db-skip'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const SQL = readFileSync(join(__dirname, '../../../../.superpowers/sdd/acesso-irma-ia/a2/desfaz-apendice-a.sql'), 'utf8')

const norm = (s: string | null) => (s ?? '').replace(/[\s()"]+/g, '').replace(/public\./g, '').toLowerCase()

// o que o desfazer promete devolver: (tabela, policy, cmd, roles) com trechos que têm de aparecer / sumir
const ESPERADO: Array<{ schema: string; tabela: string; policy: string; cmd: string; tem: string[]; nao?: string[] }> = [
  { schema: 'public', tabela: 'blog_posts', policy: 'blog_posts_insert', cmd: 'INSERT', tem: ['reporter', 'owner_user_id'] },
  { schema: 'public', tabela: 'blog_posts', policy: 'blog_posts_select', cmd: 'SELECT', tem: ['reporter', 'owner_user_id'] },
  { schema: 'public', tabela: 'blog_posts', policy: 'blog_posts_update', cmd: 'UPDATE', tem: ['owner_user_id'] },
  { schema: 'public', tabela: 'blog_posts', policy: 'blog_posts_delete', cmd: 'DELETE', tem: ['owner_user_id'] },
  { schema: 'public', tabela: 'competitor_agenda_runs', policy: 'competitor_agenda_runs_select', cmd: 'SELECT', tem: ['is_member_staff'], nao: ['is_member_editor'] },
  { schema: 'public', tabela: 'obs_db_size_daily', policy: 'obs_db_size_daily_select', cmd: 'SELECT', tem: ['is_member_staff'], nao: ['is_member_editor'] },
  { schema: 'public', tabela: 'newsletter_types', policy: 'staff_manage_types', cmd: 'ALL', tem: ['is_member_staff'], nao: ['can_edit_site'] },
  { schema: 'storage', tabela: 'objects', policy: 'staff_delete_newsletter_assets', cmd: 'DELETE', tem: ['is_member_staff'], nao: ['is_member_editor'] },
  { schema: 'storage', tabela: 'objects', policy: 'staff_upload_newsletter_assets', cmd: 'INSERT', tem: ['is_member_staff'], nao: ['is_member_editor'] },
]

describe.skipIf(skipIfNoLocalDb())('A2 MG19: o desfazer devolve o estado de produção', () => {
  let pg: Client
  beforeAll(async () => { pg = new Client({ connectionString: PG_URL }); await pg.connect() })
  afterAll(async () => { await pg?.end() })

  it('aplicado numa transação: policies e funções voltam; depois do rollback a MG19 segue', async () => {
    await pg.query('begin')
    try {
      await pg.query(SQL)
      for (const e of ESPERADO) {
        const r = await pg.query(
          `select cmd, roles::text, qual, with_check from pg_policies where schemaname=$1 and tablename=$2 and policyname=$3`,
          [e.schema, e.tabela, e.policy],
        )
        expect(r.rowCount, e.policy).toBe(1)
        expect(r.rows[0].cmd, e.policy).toBe(e.cmd)
        const txt = norm(`${r.rows[0].qual}${r.rows[0].with_check}`)
        for (const t of e.tem) expect(txt, `${e.policy} tem ${t}`).toContain(t)
        for (const t of e.nao ?? []) expect(txt, `${e.policy} não tem ${t}`).not.toContain(t)
      }
      const nl = await pg.query(`select count(*)::int n from pg_policies where tablename='newsletter_types' and policyname='staff_read_types'`)
      expect(nl.rows[0].n).toBe(0)
      const f = await pg.query(
        `select pg_get_functiondef('public.can_view_site(uuid)'::regprocedure) a, pg_get_functiondef('public.user_accessible_sites()'::regprocedure) b`,
      )
      expect(norm(f.rows[0].a)).toContain(norm("FROM site_memberships WHERE site_id = p_site_id AND user_id = auth.uid()"))
      expect(norm(f.rows[0].a)).not.toContain('can_edit_site')
      expect(norm(f.rows[0].b)).toContain(norm('WHERE public.can_view_site(s.id)'))
    } finally {
      await pg.query('rollback')
    }
    const depois = await pg.query(`select pg_get_functiondef('public.can_view_site(uuid)'::regprocedure) a`)
    expect(norm(depois.rows[0].a)).toContain('can_edit_site')
  })
})
