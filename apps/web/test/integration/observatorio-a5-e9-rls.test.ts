// @vitest-environment node
/**
 * A5 · E9 (Tarefa 2): RLS e privilégios da MG18, contra Postgres de verdade (SÓ o `bythiago_int`). Rodar com:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/observatorio-a5-e9-rls.test.ts --no-file-parallelism
 *
 * REGRA DESTE POSTGRES LOCAL: chamar função sem EXECUTE como anon/authenticated DERRUBA o servidor (SIGSEGV). As treze funções são
 * conferidas pelo CATÁLOGO (`has_function_privilege`), nunca chamadas. As TABELAS são lidas e escritas como authenticated, com o
 * GUC `app.site_id` FORJADO para o site alheio (o editor de outro site não lê, mesmo com o GUC apontando para cá).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { semearCena, criarSite, criarUsuario, escalar } from '../helpers/mg6'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const TABELAS = ['competitor_missing_baseline', 'competitor_removed_items'] as const
const TREZE = [
  'competitor_jsonb_sum', 'competitor_cascade_counts', 'competitor_purge_preview', 'competitor_video_purge', 'competitor_channel_purge',
  'competitor_comments_purge', 'competitor_missing_keep', 'competitor_return_decide', 'competitor_removed_blobs_done',
  'competitor_missing_proof', 'competitor_missing_count', 'competitor_comments_preview', 'competitor_removed_comment_groups',
]

describe.skipIf(skipIfNoLocalDb())('A5 E9 Tarefa 2: RLS e privilégios da MG18 (banco local, GUC forjado, tudo desfeito)', () => {
  let pg: Client
  beforeAll(async () => { pg = new Client({ connectionString: PG_URL }); await pg.connect() })
  afterAll(async () => { try { await pg.query('rollback') } catch { /* nada aberto */ } await pg.end() })

  async function dentro<T>(fn: () => Promise<T>): Promise<T> {
    await pg.query('begin')
    try { return await fn() } finally { await pg.query('rollback') }
  }

  async function como(quem: string, guc: string, sql: string): Promise<{ rows: number; error: string | null }> {
    await pg.query('savepoint como')
    try {
      await pg.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: quem, role: 'authenticated' })])
      await pg.query(`select set_config('app.site_id', $1, true)`, [guc])
      await pg.query('set local role authenticated')
      const r = await pg.query(sql)
      return { rows: r.rowCount ?? 0, error: null }
    } catch (e) {
      return { rows: 0, error: e instanceof Error ? e.message : String(e) }
    } finally {
      await pg.query('rollback to savepoint como')
      await pg.query('release savepoint como')
    }
  }

  async function cenario() {
    const c = await semearCena(pg)
    const editor = await criarUsuario(pg)
    await pg.query(`insert into public.site_memberships (site_id, user_id, role) values ($1, $2, 'editor')`, [c.site, editor])
    const reporter = await criarUsuario(pg)
    await pg.query(`insert into public.site_memberships (site_id, user_id, role) values ($1, $2, 'reporter')`, [c.site, reporter])
    const x = await criarSite(pg)
    const editorX = await criarUsuario(pg)
    await pg.query(`insert into public.site_memberships (site_id, user_id, role) values ($1, $2, 'editor')`, [x.site, editorX])
    const solto = await criarUsuario(pg)
    await pg.query(`insert into public.competitor_removed_items (site_id, kind, youtube_id, decided_by, rows_deleted) values ($1, 'video', 'vid-rls', $2, '{}'::jsonb)`, [c.site, c.admin])
    await pg.query(`update public.competitor_videos set missing_since = current_date - 1 where id = $1`, [c.videoA])
    await pg.query(`select public.competitor_missing_proof($1, now())`, [c.site]) // grava o piso
    return { c, editor, reporter, editorX, solto }
  }

  it('o controle: o superusuário vê uma linha em cada tabela', async () => {
    await dentro(async () => {
      const { c } = await cenario()
      for (const t of TABELAS) expect(await escalar<number>(pg, `select count(*)::int from public.${t} where site_id = $1`, [c.site]), t).toBeGreaterThan(0)
    })
  })

  it('usuário sem vínculo e reporter não leem as duas; editor do site lê; editor de OUTRO site, com o GUC forjado para este, não lê', async () => {
    await dentro(async () => {
      const { c, editor, reporter, editorX, solto } = await cenario()
      for (const t of TABELAS) {
        const sql = `select * from public.${t} where site_id = '${c.site}'`
        expect((await como(solto, '', sql)).rows, `${t} sem vínculo`).toBe(0)
        expect((await como(reporter, c.site, sql)).rows, `${t} reporter`).toBe(0)
        expect((await como(editor, c.site, sql)).rows, `${t} editor`).toBeGreaterThan(0)
        expect((await como(editorX, c.site, sql)).rows, `${t} editor de outro site, GUC forjado`).toBe(0)
      }
    })
  })

  it('anon não tem select; authenticated não tem insert, update nem delete nas duas (privilégio e tentativa)', async () => {
    await dentro(async () => {
      const { c, editor } = await cenario()
      for (const t of TABELAS) {
        // a tabela da MG18 não dá select ao anon; a do MG1 é da RLS (zero linhas), conferido pela tentativa logo abaixo
        if (t === 'competitor_missing_baseline') expect(await escalar<boolean>(pg, `select has_table_privilege('anon', 'public.${t}', 'select')`), `${t} anon select`).toBe(false)
        // o MG1 deixou os privilégios padrão na outra tabela: lá quem barra a escrita é a RLS (sem policy de escrita), provada abaixo
        for (const p of t === 'competitor_missing_baseline' ? ['insert', 'update', 'delete', 'truncate'] : []) {
          expect(await escalar<boolean>(pg, `select has_table_privilege('authenticated', 'public.${t}', '${p}')`), `${t} authenticated ${p}`).toBe(false)
        }
      }
      for (const t of TABELAS) {
        await pg.query('savepoint anon')
        let linhas = 0
        try { await pg.query('set local role anon'); linhas = (await pg.query(`select * from public.${t}`)).rowCount ?? 0 } catch { linhas = 0 }
        await pg.query('rollback to savepoint anon')
        expect(linhas, `${t} anon lê`).toBe(0)
      }
      const del = await como(editor, c.site, `delete from public.competitor_removed_items where site_id = '${c.site}'`)
      expect(del.error !== null || del.rows === 0).toBe(true)
      const ins = await como(editor, c.site, `insert into public.competitor_removed_items (site_id, kind, youtube_id, decided_by, rows_deleted) values ('${c.site}', 'video', 'tentativa', '${editor}', '{}'::jsonb)`)
      expect(ins.error).not.toBeNull()
      const upd = await como(editor, c.site, `update public.competitor_removed_items set purge_count = 9 where site_id = '${c.site}'`)
      expect(upd.error !== null || upd.rows === 0).toBe(true)
    })
  })

  it('as treze funções: has_function_privilege falso para anon e authenticated, verdadeiro para service_role', async () => {
    const r = await pg.query(
      `select p.proname, has_function_privilege('anon', p.oid, 'execute') as anon, has_function_privilege('authenticated', p.oid, 'execute') as auth,
              has_function_privilege('service_role', p.oid, 'execute') as srv
         from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = any($1::text[])`, [TREZE])
    expect(r.rows.map((l: { proname: string }) => l.proname).sort()).toEqual([...TREZE].sort())
    for (const l of r.rows as Array<{ proname: string; anon: boolean; auth: boolean; srv: boolean }>) {
      expect([l.proname, l.anon, l.auth, l.srv]).toEqual([l.proname, false, false, true])
    }
  })
})
