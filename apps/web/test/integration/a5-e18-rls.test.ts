// @vitest-environment node
/**
 * A5 · E18 (MG12): RLS e privilégios das duas tabelas de versões do vídeo próprio, contra o banco local, com o GUC `app.site_id` FORJADO.
 * O dado é PRIVADO: nada para `anon`; `authenticated` só lê se puder editar o site (ou ver o desempenho privado, se a MG11 existir);
 * nenhuma policy de escrita. Banco: SÓ o `bythiago_int`:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/a5-e18-rls.test.ts --no-file-parallelism
 * Função sem EXECUTE nunca é CHAMADA aqui como anon/authenticated (derruba este Postgres): `has_function_privilege` em `a5-e18-schema.test.ts`.
 * Item 191 (as doze tabelas com `can_view_private_site`): a varredura das doze é do passo 0 da E17; aqui só as duas desta etapa.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite } from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { apagarSites } from '../helpers/limpa-cena'

vi.setConfig({ testTimeout: 60_000 })

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const TABELAS = ['yt_own_video_versions', 'yt_own_versions_state'] as const
type Tabela = (typeof TABELAS)[number]
type Who = 'anon' | 'sem' | 'leitor' | 'editor' | 'editorB'
interface Cenario { siteA: string; siteB: string; users: Record<Exclude<Who, 'anon'>, string>; canal: string }
interface Resultado { rows: number; error: string | null; code: string | null }

describe.skipIf(skipIfNoLocalDb())('A5 E18 (MG12): RLS e privilégios das duas tabelas (banco local, GUC forjado)', () => {
  let pg: Client
  let sb: ReturnType<typeof getSupabaseServiceClient>
  const sites: string[] = []
  const usuarios: string[] = []

  beforeAll(async () => {
    sb = getSupabaseServiceClient()
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
  })
  afterAll(async () => {
    try {
      if (sites.length > 0) {
        for (const t of [...TABELAS, 'youtube_channels']) await pg.query(`delete from public.${t} where site_id = any($1::uuid[])`, [sites])
        await pg.query('delete from public.site_memberships where site_id = any($1::uuid[])', [sites])
        await pg.query('delete from public.audit_log where site_id = any($1::uuid[])', [sites])
      }
      if (usuarios.length > 0) await pg.query('delete from auth.users where id = any($1::uuid[])', [usuarios])
      if (sites.length > 0) await apagarSites(pg, 'id = any($1::uuid[])', [sites])
    } finally {
      await pg.end()
    }
  })

  /** Dois sites; usuários: sem papel, leitor (reporter de A), editor de A, editor de B. No site A, uma linha em cada tabela. */
  async function cenario(): Promise<Cenario> {
    const siteA = (await seedSite(sb)).siteId; sites.push(siteA)
    const siteB = (await seedSite(sb)).siteId; sites.push(siteB)
    const users = { sem: randomUUID(), leitor: randomUUID(), editor: randomUUID(), editorB: randomUUID() }
    for (const id of Object.values(users)) {
      usuarios.push(id)
      await pg.query(`insert into auth.users (id, aud, role, email) values ($1, 'authenticated', 'authenticated', $2)`, [id, id + '@a5.test'])
    }
    await pg.query(`insert into public.site_memberships (site_id, user_id, role) values ($1, $2, 'reporter'), ($1, $3, 'editor'), ($4, $5, 'editor')`, [siteA, users.leitor, users.editor, siteB, users.editorB])
    const x = randomUUID().replace(/-/g, '')
    const canal = String((await pg.query(`insert into public.youtube_channels (site_id, channel_id, locale, handle, name, uploads_playlist_id, slug)
      values ($1, $2, 'pt', $3, 'Teste', $4, $5) returning id`, [siteA, 'UC' + x.slice(0, 22), '@t' + x.slice(0, 8), 'UU' + x.slice(2, 24), 'teste-' + x.slice(0, 8)])).rows[0].id)
    const hoje = new Date().toISOString()
    await pg.query(`insert into public.yt_own_video_versions (youtube_video_id, site_id, channel_id, field, value_text, value_hash, first_day_pt, last_day_pt,
        first_seen_at, last_seen_at, window_precision, origin) values ($1, $2, $3, 'title', 'Titulo', $4, current_date - 5, current_date - 5, $5, $5, 'first', 'linha_de_base')`,
      ['y' + x.slice(0, 10), siteA, canal, x.slice(0, 32), hoje])
    await pg.query(`insert into public.yt_own_versions_state (channel_id, site_id, tracking_since, derived_through) values ($1, $2, current_date - 5, current_date - 5)`, [canal, siteA])
    return { siteA, siteB, users, canal }
  }

  /** Roda `sql` como `who` numa transação desfeita, com o GUC `app.site_id` forjado (por padrão, o do site A). Papel sem superusuário. */
  async function como(c: Cenario, who: Who, sql: string, params: unknown[] = [], guc: string = c.siteA): Promise<Resultado> {
    await pg.query('begin')
    try {
      if (who !== 'anon') await pg.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: c.users[who], role: 'authenticated' })])
      await pg.query(`select set_config('app.site_id', $1, true)`, [guc])
      await pg.query(who === 'anon' ? 'set local role anon' : 'set local role authenticated')
      const r = await pg.query(sql, params)
      return { rows: r.rowCount ?? 0, error: null, code: null }
    } catch (e) {
      return { rows: 0, error: e instanceof Error ? e.message : String(e), code: (e as { code?: string }).code ?? null }
    } finally {
      await pg.query('rollback')
    }
  }
  const ler = (c: Cenario, who: Who, t: Tabela, guc?: string): Promise<Resultado> => como(c, who, `select 1 from public.${t} where site_id = $1`, [c.siteA], guc)

  it('policy: can_view_private_site se a MG11 existir no banco, senão can_edit_site; nunca o GUC (itens 190 e 191, as duas desta etapa)', async () => {
    const mg11 = (await pg.query(`select to_regprocedure('public.can_view_private_site(uuid)') is not null as ok`)).rows[0].ok as boolean
    const pol = await pg.query(`select tablename, qual from pg_policies where schemaname = 'public' and tablename = any($1) order by 1`, [TABELAS])
    expect(pol.rows).toHaveLength(2)
    for (const p of pol.rows) {
      expect(String(p.qual), p.tablename).toContain(mg11 ? 'can_view_private_site(site_id)' : 'can_edit_site(site_id)')
      expect(String(p.qual)).not.toMatch(/app\.site_id|site_visible|true/)
    }
  })

  it('usuário sem vínculo, leitor (reporter) e editor de OUTRO site leem zero linha, forjando o GUC; o editor lê (controle positivo)', async () => {
    const c = await cenario()
    for (const t of TABELAS) {
      for (const who of ['sem', 'leitor', 'editorB'] as const) {
        const r = await ler(c, who, t)
        expect(r.error, `${who} em ${t}`).toBeNull()
        expect(r.rows, `${who} lê ${t}, GUC do site A`).toBe(0)
      }
      expect((await ler(c, 'sem', t, c.siteB)).rows, `${t}: sem, GUC do site B`).toBe(0)
      expect((await ler(c, 'sem', t, '')).rows, `${t}: sem, GUC vazio`).toBe(0)
      expect((await ler(c, 'editorB', t, c.siteB)).rows, `${t}: editor de B, GUC do próprio site`).toBe(0)
      expect((await como(c, 'sem', `select 1 from public.${t}`, [], c.siteA)).rows, `${t}: sem, sem filtro`).toBe(0)
      expect((await ler(c, 'editor', t, '')).rows, `${t}: editor, GUC vazio`).toBe(1)
      expect((await ler(c, 'editor', t, c.siteA)).rows, `${t}: editor, GUC do site`).toBe(1)
      expect((await ler(c, 'editor', t, c.siteB)).rows, `${t}: editor, GUC de outro site`).toBe(1)
    }
  })

  it('o editor só vê o próprio site: linha de outro site semeada não aparece para ele (mutação de site)', async () => {
    const c = await cenario()
    const d = await cenario() // outro par de sites, com a sua linha
    for (const t of TABELAS) {
      const r = await como(c, 'editor', `select 1 from public.${t}`, [], '')
      expect(r.rows, `${t}: editor sem filtro vê só a do próprio site`).toBe(1)
      expect((await pg.query(`select count(*)::int as n from public.${t} where site_id = any($1::uuid[])`, [[c.siteA, d.siteA]])).rows[0].n).toBe(2)
    }
  })

  it('anon não tem select (permission denied); a service role lê tudo', async () => {
    const c = await cenario()
    for (const t of TABELAS) {
      expect((await ler(c, 'anon', t)).code, `anon em ${t}`).toBe('42501')
      expect((await como(c, 'anon', `select 1 from public.${t}`, [], '')).code).toBe('42501')
      const svc = await sb.from(t).select('site_id').eq('site_id', c.siteA)
      expect(svc.error).toBeNull()
      expect(svc.data).toHaveLength(1)
    }
  })

  it('nenhuma policy de escrita: editor e os demais são barrados em insert, update, delete e truncate; nada muda', async () => {
    const c = await cenario()
    const insercoes: Record<Tabela, [string, unknown[]]> = {
      yt_own_video_versions: [`insert into public.yt_own_video_versions (youtube_video_id, site_id, channel_id, field, value_text, value_hash, first_day_pt, last_day_pt, first_seen_at, last_seen_at, window_precision, origin)
        values ('x', $1, $2, 'title', 'T', $3, current_date - 4, current_date - 4, now(), now(), 'first', 'linha_de_base')`, [c.siteA, c.canal, 'b'.repeat(32)]],
      yt_own_versions_state: [`insert into public.yt_own_versions_state (channel_id, site_id, tracking_since, derived_through) values ($1, $2, current_date - 4, current_date - 4)`, [c.canal, c.siteA]],
    }
    for (const t of TABELAS) {
      for (const who of ['editor', 'leitor', 'sem', 'editorB'] as const) {
        const [sql, params] = insercoes[t]
        expect((await como(c, who, sql, params)).code, `insert de ${who} em ${t}`).toBe('42501')
        expect((await como(c, who, `update public.${t} set site_id = site_id where site_id = $1`, [c.siteA])).code, `update de ${who} em ${t}`).toBe('42501')
        expect((await como(c, who, `delete from public.${t} where site_id = $1`, [c.siteA])).code, `delete de ${who} em ${t}`).toBe('42501')
        expect((await como(c, who, `truncate public.${t}`)).code, `truncate de ${who} em ${t}`).toBe('42501')
      }
      expect((await pg.query(`select count(*)::int as n from public.${t} where site_id = $1`, [c.siteA])).rows[0].n).toBe(1)
    }
  })
})
