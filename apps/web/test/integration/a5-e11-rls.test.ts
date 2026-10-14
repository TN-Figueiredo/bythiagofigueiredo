// @vitest-environment node
/**
 * A5 · E11 (MG7): RLS e privilégios das três tabelas novas do canal próprio, contra o banco local, com o GUC `app.site_id` FORJADO.
 * O dado é PRIVADO (views por origem, aparelho e país; termos pesquisados; impressões): nada para `anon`; `authenticated` só lê se
 * puder editar o site (ou ver o desempenho privado, se a MG11 já existir); nenhuma policy de escrita. Banco: SÓ o `bythiago_int`:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/a5-e11-rls.test.ts --no-file-parallelism
 * Função sem EXECUTE nunca é CHAMADA aqui como anon/authenticated (derruba este Postgres): o privilégio das funções está em
 * `a5-e11-schema.test.ts`, por catálogo.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Client } from 'pg'
import { createClient } from '@supabase/supabase-js'
import { createHash, randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite, signUserJwt, SUPABASE_URL, ANON_KEY } from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { addDays, utcDay } from '@/lib/youtube/coleta/day-pt'

vi.setConfig({ testTimeout: 60_000 })

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const TABELAS = ['yt_own_video_dim_daily', 'yt_own_video_traffic_detail_daily', 'yt_own_video_reach_dim_daily'] as const
type Tabela = (typeof TABELAS)[number]
type Who = 'anon' | 'sem' | 'leitor' | 'editor' | 'editorB'
interface Cenario { siteA: string; siteB: string; users: Record<Exclude<Who, 'anon'>, string>; canal: string; yt: string }
interface Resultado { rows: number; error: string | null; code: string | null }

const HOJE = utcDay(new Date())
const DIA = addDays(HOJE, -5)

describe.skipIf(skipIfNoLocalDb())('A5 E11 (MG7): RLS e privilégios das três tabelas (banco local, GUC forjado)', () => {
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
        // os vínculos acima geram linhas em audit_log (trigger), e a FK delas impede apagar o site
        await pg.query('delete from public.audit_log where site_id = any($1::uuid[])', [sites])
      }
      if (usuarios.length > 0) await pg.query('delete from auth.users where id = any($1::uuid[])', [usuarios])
      if (sites.length > 0) await pg.query('delete from public.sites where id = any($1::uuid[])', [sites])
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
    const yt = 'y' + x.slice(0, 10)
    await pg.query(`insert into public.yt_own_video_dim_daily (youtube_video_id, day_pt, dim_kind, dim_value, site_id, channel_id, views, metric_version) values ($1, $2, 'country', 'BR', $3, $4, 3, 'v')`, [yt, DIA, siteA, canal])
    await pg.query(`insert into public.yt_own_video_traffic_detail_daily (youtube_video_id, day_pt, source_type, detail, detail_hash, site_id, channel_id, views, source_report_id, report_create_time, metric_version)
      values ($1, $2, '4', 'termo privado', $3, $4, $5, 2, 'r1', now(), 'v')`, [yt, DIA, createHash('sha256').update('termo privado').digest('hex'), siteA, canal])
    await pg.query(`insert into public.yt_own_video_reach_dim_daily (youtube_video_id, day_pt, traffic_source_type, device_type, operating_system, site_id, channel_id, thumbnail_impressions, source_report_id, report_create_time, metric_version)
      values ($1, $2, '1', 'MOBILE', 'ANDROID', $3, $4, 50, 'r1', now(), 'v')`, [yt, DIA, siteA, canal])
    return { siteA, siteB, users, canal, yt }
  }

  /**
   * Roda `sql` como `who` numa transação desfeita, com o GUC `app.site_id` FORJADO para o site A (o site de que o editor de B NÃO é
   * membro), ou o que for passado. Papel `anon`/`authenticated` sem superusuário, como no PostgREST.
   */
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

  it('catálogo: RLS ligada nas três, uma policy de leitura em cada, nenhuma de escrita, nada pelo GUC', async () => {
    const rls = await pg.query(`select relname, relrowsecurity from pg_class where oid = any($1::regclass[]) order by 1`, [TABELAS.map(t => 'public.' + t)])
    expect(rls.rows.map(r => [r.relname, r.relrowsecurity])).toEqual(TABELAS.map(t => [t, true]).sort())
    const pol = await pg.query(`select tablename, policyname, cmd, roles, qual from pg_policies where schemaname = 'public' and tablename = any($1) order by 1`, [TABELAS])
    expect(pol.rows.map(r => [r.tablename, r.policyname, r.cmd])).toEqual([...TABELAS].sort().map(t => [t, t + '_select', 'SELECT']))
    for (const p of pol.rows) {
      // quem EDITA o site (ou tem o direito "ver desempenho privado", se existir): nunca pelo GUC nem por site_visible
      expect(String(p.qual)).toMatch(/can_edit_site\(site_id\)|can_view_private_site\(site_id\)/)
      expect(String(p.qual)).not.toMatch(/app\.site_id|site_visible|true/)
    }
  })

  it('privilégios de tabela: anon não tem nenhum; authenticated só SELECT (sem insert, update, delete, truncate, references, trigger)', async () => {
    for (const t of TABELAS) {
      for (const priv of ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) {
        const r = await pg.query(`select has_table_privilege('anon', $1, $2) as a, has_table_privilege('authenticated', $1, $2) as u`, ['public.' + t, priv])
        expect(r.rows[0].a, `anon ${priv} em ${t}`).toBe(false)
        expect(r.rows[0].u, `authenticated ${priv} em ${t}`).toBe(priv === 'SELECT')
      }
      const colunas = await pg.query(`select count(*) as n from information_schema.column_privileges where table_schema = 'public' and table_name = $1 and grantee in ('anon', 'PUBLIC') and privilege_type = 'SELECT'`, [t])
      expect(Number(colunas.rows[0].n), `anon/PUBLIC por coluna em ${t}`).toBe(0)
    }
  })

  it('usuário sem vínculo, leitor (reporter) e editor de OUTRO site não leem as três tabelas, forjando o GUC app.site_id; o editor lê (controle positivo)', async () => {
    const c = await cenario()
    for (const t of TABELAS) {
      for (const who of ['sem', 'leitor', 'editorB'] as const) {
        const r = await ler(c, who, t)
        expect(r.error, `${who} em ${t}`).toBeNull()
        expect(r.rows, `${who} lê ${t}, GUC do site A`).toBe(0)
      }
      // o GUC que o cliente seta não abre nada: nem o do site do editor de B, nem vazio, nem lixo
      expect((await ler(c, 'sem', t, c.siteB)).rows, `${t}: sem, GUC do site B`).toBe(0)
      expect((await ler(c, 'sem', t, '')).rows, `${t}: sem, GUC vazio`).toBe(0)
      expect((await ler(c, 'editorB', t, c.siteB)).rows, `${t}: editor de B, GUC do próprio site`).toBe(0)
      expect((await como(c, 'sem', `select 1 from public.${t}`, [], c.siteA)).rows, `${t}: sem, sem filtro nenhum`).toBe(0)
      // controle: as linhas existem e o editor do site A as vê, com o GUC vazio, do site A e do site B
      expect((await ler(c, 'editor', t, '')).rows, `${t}: editor, GUC vazio`).toBe(1)
      expect((await ler(c, 'editor', t, c.siteA)).rows, `${t}: editor, GUC do site`).toBe(1)
      expect((await ler(c, 'editor', t, c.siteB)).rows, `${t}: editor, GUC de outro site`).toBe(1)
    }
  })

  it('anon não tem select (permission denied, com o GUC forjado ou não); a service role lê tudo', async () => {
    const c = await cenario()
    for (const t of TABELAS) {
      const r = await ler(c, 'anon', t)
      expect(r.code, `anon em ${t}`).toBe('42501')
      expect(r.rows).toBe(0)
      expect((await como(c, 'anon', `select 1 from public.${t}`, [], '')).code).toBe('42501')
      const svc = await sb.from(t).select('youtube_video_id').eq('site_id', c.siteA)
      expect(svc.error).toBeNull()
      expect(svc.data).toHaveLength(1)
    }
  })

  it('nenhuma policy de escrita: o editor (e qualquer outro) é barrado em insert, update, delete e truncate; nada muda', async () => {
    const c = await cenario()
    const insercoes: Record<Tabela, [string, unknown[]]> = {
      yt_own_video_dim_daily: [`insert into public.yt_own_video_dim_daily (youtube_video_id, day_pt, dim_kind, dim_value, site_id, channel_id, views, metric_version) values ('x', $1, 'country', 'US', $2, $3, 1, 'v')`, [DIA, c.siteA, c.canal]],
      yt_own_video_traffic_detail_daily: [`insert into public.yt_own_video_traffic_detail_daily (youtube_video_id, day_pt, source_type, detail, detail_hash, site_id, channel_id, views, source_report_id, report_create_time, metric_version) values ('x', $1, '4', 'a', $4, $2, $3, 1, 'r', now(), 'v')`, [DIA, c.siteA, c.canal, '0'.repeat(64)]],
      yt_own_video_reach_dim_daily: [`insert into public.yt_own_video_reach_dim_daily (youtube_video_id, day_pt, traffic_source_type, device_type, operating_system, site_id, channel_id, thumbnail_impressions, source_report_id, report_create_time, metric_version) values ('x', $1, '1', 'A', 'B', $2, $3, 1, 'r', now(), 'v')`, [DIA, c.siteA, c.canal]],
    }
    for (const t of TABELAS) {
      for (const who of ['editor', 'leitor', 'sem', 'editorB'] as const) {
        const [sql, params] = insercoes[t]
        expect((await como(c, who, sql, params)).code, `insert de ${who} em ${t}`).toBe('42501')
        expect((await como(c, who, `update public.${t} set site_id = site_id where site_id = $1`, [c.siteA])).code, `update de ${who} em ${t}`).toBe('42501')
        expect((await como(c, who, `delete from public.${t} where site_id = $1`, [c.siteA])).code, `delete de ${who} em ${t}`).toBe('42501')
        expect((await como(c, who, `truncate public.${t}`)).code, `truncate de ${who} em ${t}`).toBe('42501')
      }
      expect((await pg.query(`select count(*) as n from public.${t} where site_id = $1`, [c.siteA])).rows[0].n).toBe('1')
    }
  })

  it('pelo PostgREST: sessão sem vínculo e o leitor leem lista vazia; o editor lê a sua linha; o editor de outro site não lê; anon não lê', async () => {
    const c = await cenario()
    const como_ = (id: string) => createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${signUserJwt(id).jwt}` } },
    })
    for (const t of TABELAS) {
      for (const id of [c.users.sem, c.users.leitor, c.users.editorB]) {
        const r = await como_(id).from(t).select('youtube_video_id').eq('site_id', c.siteA)
        expect(r.error, t).toBeNull()
        expect(r.data, t).toEqual([])
      }
      const e = await como_(c.users.editor).from(t).select('youtube_video_id').eq('site_id', c.siteA)
      expect(e.error, `${t} (editor)`).toBeNull()
      expect(e.data, `${t} (editor)`).toHaveLength(1)
      const anon = await createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } }).from(t).select('youtube_video_id').eq('site_id', c.siteA)
      expect(anon.data ?? [], `${t} (anon)`).toEqual([])
      const escrita = await como_(c.users.editor).from(t).delete().eq('site_id', c.siteA)
      expect(escrita.error, `delete do editor em ${t}`).not.toBeNull()
    }
    expect((await pg.query(`select count(*) as n from public.yt_own_video_dim_daily where site_id = $1`, [c.siteA])).rows[0].n).toBe('1')
  })
})
