// @vitest-environment node
/**
 * A5 · E4 (Tarefa 9): RLS e privilégios das duas tabelas da MG4 e das três funções, contra Postgres de verdade. Banco: SÓ o `bythiago_int`.
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/observatorio-a5-e4-rls.test.ts --no-file-parallelism
 *
 * REGRA DESTE POSTGRES LOCAL: chamar função sem EXECUTE como anon/authenticated DERRUBA o servidor (SIGSEGV). As três funções são
 * conferidas pelo CATÁLOGO (`has_function_privilege`), nunca chamadas. As TABELAS são lidas e escritas como authenticated (zero
 * linha ou "permission denied"), com o GUC `app.site_id` FORJADO para o site alheio. A MG4 não está aplicada de vez: cada teste
 * aplica a MG6 e o ensaio da MG4 na SUA transação, que termina em `rollback`.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { garantirMg6, q1, escalar, criarSite, criarCanal, criarUsuario } from '../helpers/mg6'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const MG4_FIXTURE = fileURLToPath(new URL('../fixtures/sql/a5-e4-mg4.sql', import.meta.url))
const DUAS = ['competitor_video_marks', 'competitor_video_mark_misses'] as const
const ANCORA = Date.UTC(2026, 7, 3, 10, 0)
const iso = (ms: number): string => new Date(ms).toISOString()

describe.skipIf(skipIfNoLocalDb())('A5 E4 Tarefa 9: RLS e privilégios da MG4 (banco local, GUC forjado, ensaio em transação desfeita)', () => {
  let pg: Client

  beforeAll(async () => {
    pg = new Client({ connectionString: PG_URL })
    await pg.connect()
  })
  afterAll(async () => {
    try { await pg.query('rollback') } catch { /* nada aberto */ }
    await pg.end()
  })

  async function dentro<T>(fn: () => Promise<T>): Promise<T> {
    await pg.query('begin')
    try {
      await garantirMg6(pg)
      await pg.query(readFileSync(process.env.E4_MG4_ARQUIVO && process.env.E4_MG4_ARQUIVO.length > 0 ? process.env.E4_MG4_ARQUIVO : MG4_FIXTURE, 'utf8'))
    } catch (e) {
      await pg.query('rollback')
      throw e
    }
    try { return await fn() } finally { await pg.query('rollback') }
  }

  interface Cena { site: string; siteX: string; membro: string; membroX: string; semVinculo: string; video: string }
  async function cena(): Promise<Cena> {
    const { site } = await criarSite(pg)
    const x = await criarSite(pg)
    const membro = await criarUsuario(pg), membroX = await criarUsuario(pg), semVinculo = await criarUsuario(pg)
    await pg.query(`insert into public.site_memberships (site_id, user_id, role) values ($1, $2, 'editor'), ($3, $4, 'editor')`, [site, membro, x.site, membroX])
    const canal = await criarCanal(pg, site)
    const video = (await q1(pg, `insert into public.competitor_videos (competitor_channel_id, video_id, published_at) values ($1, $2, $3) returning id`, [canal, 'e4r' + randomUUID().slice(0, 8), iso(ANCORA)])).id as string
    // linhas de verdade nas duas: o controle ("o superusuário as vê") dá sentido ao "zero linhas" de quem não pode
    await pg.query(`insert into public.competitor_video_marks (video_id, age_days, site_id, views, gap_hours, age_base_at, read_before_at, read_after_at) values ($1, 7, $2, 1, 1, $3, $3, $3)`, [video, site, iso(ANCORA)])
    await pg.query(`insert into public.competitor_video_mark_misses (video_id, age_days, site_id, reason, rule_version, age_base_at) values ($1, 1, $2, 'sem_leitura', 1, $3)`, [video, site, iso(ANCORA)])
    return { site, siteX: x.site, membro, membroX, semVinculo, video }
  }

  interface Resultado { rows: number; error: string | null }
  /** Roda `sql` como `authenticated` (usuário `quem`) com o GUC `app.site_id` forjado; tudo desfeito no savepoint. */
  async function como(quem: string, guc: string, sql: string, params: unknown[] = []): Promise<Resultado> {
    await pg.query('savepoint como')
    try {
      await pg.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: quem, role: 'authenticated' })])
      await pg.query(`select set_config('app.site_id', $1, true)`, [guc])
      await pg.query('set local role authenticated')
      const r = await pg.query(sql, params)
      return { rows: r.rowCount ?? 0, error: null }
    } catch (e) {
      return { rows: 0, error: e instanceof Error ? e.message : String(e) }
    } finally {
      await pg.query('rollback to savepoint como')
      await pg.query('release savepoint como')
    }
  }

  it('o controle: o superusuário vê as linhas plantadas nas duas tabelas', async () => {
    await dentro(async () => {
      const c = await cena()
      for (const t of DUAS) expect(await escalar<number>(pg, `select count(*)::int from public.${t} where video_id = $1`, [c.video])).toBe(1)
    })
  })

  it('usuário sem vínculo não lê nenhuma das duas tabelas, mesmo forjando o GUC app.site_id', async () => {
    await dentro(async () => {
      const c = await cena()
      for (const t of DUAS) {
        const r = await como(c.semVinculo, c.site, `select * from public.${t} where video_id = $1`, [c.video])
        expect(r.error, `${t}: ${r.error}`).toBeNull()
        expect(r.rows, `${t} lida por usuário sem vínculo`).toBe(0)
      }
    })
  })

  it('membro do site lê', async () => {
    await dentro(async () => {
      const c = await cena()
      for (const t of DUAS) {
        const r = await como(c.membro, c.site, `select * from public.${t} where video_id = $1`, [c.video])
        expect(r.error).toBeNull()
        expect(r.rows, t).toBe(1)
      }
    })
  })

  it('membro de outro site, com o GUC forjado para este, não lê', async () => {
    await dentro(async () => {
      const c = await cena()
      for (const t of DUAS) {
        const r = await como(c.membroX, c.site, `select * from public.${t} where video_id = $1`, [c.video])
        expect(r.error).toBeNull()
        expect(r.rows, `${t} lida por membro de outro site com o GUC forjado`).toBe(0)
      }
    })
  })

  it('anon não tem select; authenticated não tem insert, update nem delete (por privilégio e por tentativa)', async () => {
    await dentro(async () => {
      const c = await cena()
      for (const t of DUAS) {
        expect(await escalar<boolean>(pg, `select has_table_privilege('anon', $1, 'select')`, [`public.${t}`]), `anon lê ${t}`).toBe(false)
        for (const op of ['insert', 'update', 'delete']) {
          expect(await escalar<boolean>(pg, `select has_table_privilege('authenticated', $1, $2)`, [`public.${t}`, op]), `authenticated ${op} em ${t}`).toBe(false)
        }
      }
      const tentativas: Array<[string, string]> = [
        [`delete from public.competitor_video_marks where video_id = $1`, 'delete'],
        [`update public.competitor_video_mark_misses set reason = 'sem_leitura' where video_id = $1`, 'update'],
      ]
      for (const [sql, nome] of tentativas) {
        const r = await como(c.membro, c.site, sql, [c.video])
        expect(r.error, `${nome} como membro`).toContain('permission denied')
      }
      const ins = await como(c.membro, c.site, `insert into public.competitor_video_marks (video_id, age_days, site_id, views, gap_hours, age_base_at, read_before_at, read_after_at) values ($1, 30, $2, 1, 1, now(), now(), now())`, [c.video, c.site])
      expect(ins.error).toContain('permission denied')
    })
  })

  it('as três funções: has_function_privilege falso para anon e authenticated, verdadeiro para service_role', async () => {
    await dentro(async () => {
      const r = await pg.query(`select p.proname,
          has_function_privilege('anon', p.oid, 'execute') as anon,
          has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
          has_function_privilege('service_role', p.oid, 'execute') as service_role
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname in ('competitor_marks_pending', 'competitor_marks_apply', 'competitor_marks_health') order by 1`)
      expect(r.rows.map(x => x.proname)).toEqual(['competitor_marks_apply', 'competitor_marks_health', 'competitor_marks_pending'])
      for (const x of r.rows) expect([x.anon, x.authenticated, x.service_role], x.proname).toEqual([false, false, true])
    })
  })
})
