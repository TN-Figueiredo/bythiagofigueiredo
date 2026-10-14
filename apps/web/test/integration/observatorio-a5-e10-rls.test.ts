// @vitest-environment node
/**
 * A5 · E10 (Tarefa 1): RLS e privilégios das três tabelas novas da MG6 e das 17 funções, contra Postgres de verdade.
 * Banco: SÓ o `bythiago_int`. Rodar com:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/observatorio-a5-e10-rls.test.ts --no-file-parallelism
 *
 * REGRA DESTE POSTGRES LOCAL: chamar função sem EXECUTE como anon/authenticated DERRUBA o servidor (SIGSEGV). As 17 funções são
 * conferidas pelo CATÁLOGO (`has_function_privilege`), nunca chamadas. As TABELAS são lidas e escritas como authenticated
 * (zero linha ou "permission denied"), com o GUC `app.site_id` FORJADO para o site alheio.
 * A MG6 não está aplicada de vez: cada teste aplica o ensaio (`garantirMg6`) na SUA transação, que termina em `rollback`.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import {
  emTransacao, tenta, q1, escalar, semearCena, criarSite, criarUsuario, exportarConferirConfirmar, type Cena,
} from '../helpers/mg6'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const TRES = ['obs_archive_batches', 'competitor_collection_pauses', 'obs_db_size_daily'] as const
const COLUNAS_DO_SPEC = ['day', 'db_bytes', 'competitor_bytes', 'own_bytes', 'measured_at']
const FUNCOES_17 = [
  'obs_db_size_record', 'obs_archive_is_site_admin', 'competitor_channel_pause_covers', 'competitor_channel_pause', 'competitor_channel_unpause',
  'obs_archive_registry', 'obs_archive_excluded', 'obs_archive_uncovered', 'obs_archive_channel_counts', 'obs_archive_diff',
  'obs_archive_register', 'obs_archive_guard', 'obs_archive_verify', 'obs_archive_confirm_nas', 'competitor_channel_remove_archived',
  'obs_archive_blobs_done', 'competitor_archive_suggestions',
]

describe.skipIf(skipIfNoLocalDb())('A5 E10 Tarefa 1: RLS e privilégios da MG6 (banco local, GUC forjado, ensaio em transação desfeita)', () => {
  let pg: Client

  beforeAll(async () => {
    pg = new Client({ connectionString: PG_URL })
    await pg.connect()
  })
  afterAll(async () => {
    try { await pg.query('rollback') } catch { /* nada aberto */ }
    await pg.end()
  })

  interface Cenario extends Cena {
    /** Editor do site da cena (site_memberships, role editor). */
    editor: string
    /** Site X e o seu editor: o "outro site" dos testes de vazamento. */
    siteX: string
    editorX: string
  }

  async function cenario(): Promise<Cenario> {
    const c = await semearCena(pg)
    const editor = await criarUsuario(pg)
    await pg.query(`insert into public.site_memberships (site_id, user_id, role) values ($1, $2, 'editor')`, [c.site, editor])
    const x = await criarSite(pg)
    const editorX = await criarUsuario(pg)
    await pg.query(`insert into public.site_memberships (site_id, user_id, role) values ($1, $2, 'editor')`, [x.site, editorX])
    // linhas de verdade nas três: o controle ("o superusuário as vê") é o que dá sentido ao "zero linhas" de quem não pode
    await exportarConferirConfirmar(pg, c, c.canalA, 'lote-x')
    await pg.query(`select public.obs_db_size_record(now())`)
    return { ...c, editor, siteX: x.site, editorX }
  }

  interface Resultado { rows: number; data: Record<string, unknown>[]; error: string | null }
  /** Roda `sql` como `authenticated` (usuário `quem`) com o GUC `app.site_id` forjado; tudo desfeito no savepoint. */
  async function como(quem: string, guc: string, sql: string, params: unknown[] = []): Promise<Resultado> {
    await pg.query('savepoint como')
    try {
      await pg.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: quem, role: 'authenticated' })])
      await pg.query(`select set_config('app.site_id', $1, true)`, [guc])
      await pg.query('set local role authenticated')
      const r = await pg.query(sql, params)
      return { rows: r.rowCount ?? 0, data: r.rows as Record<string, unknown>[], error: null }
    } catch (e) {
      return { rows: 0, data: [], error: e instanceof Error ? e.message : String(e) }
    } finally {
      await pg.query('rollback to savepoint como')
      await pg.query('release savepoint como')
    }
  }

  it('anon não lê nenhuma das três tabelas (por has_table_privilege), e authenticated não grava em nenhuma', async () => {
    await emTransacao(pg, async () => {
      for (const t of TRES) {
        expect(await escalar<boolean>(pg, `select has_table_privilege('anon', $1, 'select')`, [`public.${t}`]), `anon lê ${t}`).toBe(false)
        for (const op of ['insert', 'update', 'delete']) {
          expect(await escalar<boolean>(pg, `select has_table_privilege('authenticated', $1, $2)`, [`public.${t}`, op]), `authenticated ${op} em ${t}`).toBe(false)
        }
      }
    })
  })

  it('usuário sem vínculo não lê obs_db_size_daily, forjando o GUC app.site_id', async () => {
    await emTransacao(pg, async () => {
      const c = await cenario()
      // controle: a linha existe de verdade
      expect(await escalar<number>(pg, `select count(*)::int from public.obs_db_size_daily`)).toBeGreaterThan(0)
      const r = await como(c.comum, c.site, `select ${COLUNAS_DO_SPEC.join(', ')} from public.obs_db_size_daily`)
      expect(r.error).toBeNull()
      expect(r.rows).toBe(0)
    })
  })

  it('editor de um site lê obs_db_size_daily (é o que is_member_staff dá), pedindo as cinco colunas pelo nome', async () => {
    await emTransacao(pg, async () => {
      const c = await cenario()
      const r = await como(c.editor, c.site, `select ${COLUNAS_DO_SPEC.join(', ')} from public.obs_db_size_daily`)
      expect(r.error).toBeNull()
      expect(r.rows).toBeGreaterThan(0)
    })
  })

  it('editor do site lê obs_archive_batches e competitor_collection_pauses do seu site', async () => {
    await emTransacao(pg, async () => {
      const c = await cenario()
      // controle: as duas têm linha do site (o export deixa o lote e a pausa)
      expect(await escalar<number>(pg, `select count(*)::int from public.obs_archive_batches where site_id = $1`, [c.site])).toBeGreaterThan(0)
      expect(await escalar<number>(pg, `select count(*)::int from public.competitor_collection_pauses where site_id = $1`, [c.site])).toBeGreaterThan(0)
      const lotes = await como(c.editor, c.site, `select id from public.obs_archive_batches where site_id = $1`, [c.site])
      const pausas = await como(c.editor, c.site, `select id from public.competitor_collection_pauses where site_id = $1`, [c.site])
      expect(lotes.error).toBeNull()
      expect(lotes.rows).toBeGreaterThan(0)
      expect(pausas.error).toBeNull()
      expect(pausas.rows).toBeGreaterThan(0)
    })
  })

  it('editor de outro site, com o GUC forjado para este, não lê as duas', async () => {
    await emTransacao(pg, async () => {
      const c = await cenario()
      const lotes = await como(c.editorX, c.site, `select id from public.obs_archive_batches where site_id = $1`, [c.site])
      const pausas = await como(c.editorX, c.site, `select id from public.competitor_collection_pauses where site_id = $1`, [c.site])
      expect([lotes.error, lotes.rows]).toEqual([null, 0])
      expect([pausas.error, pausas.rows]).toEqual([null, 0])
      // sem filtro nenhum também: a política é quem filtra, não a cláusula where do chamador
      const todos = await como(c.editorX, c.site, `select site_id from public.obs_archive_batches`)
      expect(todos.error).toBeNull()
      expect(todos.data.some(l => l.site_id === c.site)).toBe(false)
    })
  })

  it('authenticated não tem insert, update nem delete nas três (por privilégio e por tentativa)', async () => {
    await emTransacao(pg, async () => {
      const c = await cenario()
      const tentativas: [string, string][] = [
        ['obs_archive_batches', `update public.obs_archive_batches set row_count = 0 where site_id = '${c.site}'`],
        ['obs_archive_batches', `delete from public.obs_archive_batches where site_id = '${c.site}'`],
        ['competitor_collection_pauses', `delete from public.competitor_collection_pauses where site_id = '${c.site}'`],
        ['competitor_collection_pauses', `update public.competitor_collection_pauses set resumed_at = now() where site_id = '${c.site}'`],
        ['obs_db_size_daily', `delete from public.obs_db_size_daily`],
        ['obs_db_size_daily', `insert into public.obs_db_size_daily (day, db_bytes, competitor_bytes, own_bytes) values (current_date + 900, 1, 1, 1)`],
      ]
      for (const [tabela, sql] of tentativas) {
        const r = await como(c.editor, c.site, sql)
        expect(r.error, `${tabela}: ${sql.slice(0, 40)}`).toMatch(/permission denied/)
      }
      // controle: nada foi mexido
      expect(await escalar<number>(pg, `select count(*)::int from public.obs_archive_batches where site_id = $1 and row_count = 0`, [c.site])).toBe(0)
    })
  })

  it('authenticated não lê top_relations (só as cinco colunas do spec)', async () => {
    await emTransacao(pg, async () => {
      const c = await cenario()
      for (const col of COLUNAS_DO_SPEC) {
        expect(await escalar<boolean>(pg, `select has_column_privilege('authenticated', 'public.obs_db_size_daily', $1, 'select')`, [col]), col).toBe(true)
      }
      expect(await escalar<boolean>(pg, `select has_column_privilege('authenticated', 'public.obs_db_size_daily', 'top_relations', 'select')`)).toBe(false)
      const r = await como(c.editor, c.site, `select top_relations from public.obs_db_size_daily`)
      expect(r.error).toMatch(/permission denied/)
      const estrela = await como(c.editor, c.site, `select * from public.obs_db_size_daily`)
      expect(estrela.error).toMatch(/permission denied/)
      // service_role lê tudo
      expect(await escalar<boolean>(pg, `select has_column_privilege('service_role', 'public.obs_db_size_daily', 'top_relations', 'select')`)).toBe(true)
    })
  })

  it('as 17 funções: has_function_privilege falso para anon e authenticated, verdadeiro para service_role', async () => {
    await emTransacao(pg, async () => {
      const r = await pg.query(
        `select p.proname, has_function_privilege('anon', p.oid, 'execute') as anon, has_function_privilege('authenticated', p.oid, 'execute') as auth,
                has_function_privilege('service_role', p.oid, 'execute') as servico, p.prosecdef
           from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = any($1::text[]) order by 1`, [FUNCOES_17])
      expect(r.rows).toHaveLength(17)
      for (const l of r.rows as { proname: string; anon: boolean; auth: boolean; servico: boolean }[]) {
        expect([l.anon, l.auth, l.servico], l.proname).toEqual([false, false, true])
      }
      // as que gravam ou leem fora da RLS são security definer (e só o service_role as executa)
      const definer = (await pg.query(`select proname from pg_proc where pronamespace = 'public'::regnamespace and proname = any($1::text[]) and prosecdef order by 1`, [FUNCOES_17])).rows.map((x: { proname: string }) => x.proname)
      for (const n of ['obs_db_size_record', 'competitor_channel_pause', 'competitor_channel_unpause', 'obs_archive_register', 'obs_archive_verify', 'obs_archive_confirm_nas', 'competitor_channel_remove_archived', 'obs_archive_blobs_done']) {
        expect(definer, n).toContain(n)
      }
      // todas com search_path vazio
      const sem = await escalar<number>(pg, `select count(*)::int from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = any($1::text[]) and not coalesce(p.proconfig, '{}') @> array['search_path=""']`, [FUNCOES_17])
      expect(sem).toBe(0)
      // sanidade do harness: nenhuma função foi chamada como anon/authenticated
      expect(await q1(pg, `select 1 as ok`)).toEqual({ ok: 1 })
      expect((await tenta(pg, `select 1`)).ok).toBe(true)
    })
  })
})
