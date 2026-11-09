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

/** md5 do que está em PRODUÇÃO (a2/phil-leituras-prod-2.out, P1 e P8d/P8e, 09/11/2026): o desfazer tem de reproduzir byte a byte, não só trechos. */
const MD5_FUNCOES_PROD: Record<string, string> = {
  'public.can_view_site(uuid)': 'dbe5c7376c891d248fa1da2e6be55d6f',
  'public.user_accessible_sites()': 'fc27913dd98dbb757542ece94b24fad0',
  'public.can_edit_site(uuid)': 'c89c2d92ac84153c65e6e9c376210b3f',
  'public.is_member_staff()': '47727334953ca752feabbedefa432e8b',
}
/** md5(qual | with_check | roles) de cada policy em produção. */
const MD5_POLICIES_PROD: Record<string, string> = {
  'public.blog_posts:blog_posts_delete': '2abb0c95769b5f1cb6a482e67bf9cc82',
  'public.blog_posts:blog_posts_insert': 'b355cf508acf8dd5c7f0cdf0c45a2eeb',
  'public.blog_posts:blog_posts_select': '2ae86b5f2209298e7522512b76e2bdd7',
  'public.blog_posts:blog_posts_update': '4acb9c447d7093e61c4d4b87028974aa',
  'public.competitor_agenda_runs:competitor_agenda_runs_select': '75aeedf51c61d64a98c2ad6583acbd01',
  'public.newsletter_types:staff_manage_types': 'd176021c586516e64eaae93cdcef0ae9',
  'public.obs_db_size_daily:obs_db_size_daily_select': '75aeedf51c61d64a98c2ad6583acbd01',
  'storage.objects:staff_delete_newsletter_assets': '51cdfc0df8bb3e1261cc58d199ac9c7b',
  'storage.objects:staff_upload_newsletter_assets': '09708d85f7576cb0ab97b5e979e43b60',
}

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
      // Phil M2: o corpo inteiro, por md5, igual ao de produção
      for (const [fn, md5] of Object.entries(MD5_FUNCOES_PROD)) {
        const m = await pg.query(`select md5(pg_get_functiondef($1::regprocedure)) m`, [fn])
        expect(m.rows[0].m, `md5 de ${fn} depois do desfazer`).toBe(md5)
      }
      for (const [chave, md5] of Object.entries(MD5_POLICIES_PROD)) {
        const [sp, pol] = chave.split(':') as [string, string]
        const [schema, tabela] = sp.split('.') as [string, string]
        const m = await pg.query(
          `select md5(coalesce(qual,'')||'|'||coalesce(with_check,'')||'|'||roles::text) m from pg_policies where schemaname=$1 and tablename=$2 and policyname=$3`,
          [schema, tabela, pol],
        )
        expect(m.rows[0]?.m, `md5 da policy ${chave} depois do desfazer`).toBe(md5)
      }
    } finally {
      await pg.query('rollback')
    }
    const depois = await pg.query(`select pg_get_functiondef('public.can_view_site(uuid)'::regprocedure) a`)
    expect(norm(depois.rows[0].a)).toContain('can_edit_site')
  })
})
