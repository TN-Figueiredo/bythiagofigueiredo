// @vitest-environment node
/**
 * F2 T4: RLS de niche_signals, niche_signals_estado e niche_outliers_vistos (GUC app.site_id forjado, como não-superusuário).
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/f2-niche-signals-rls.test.ts --no-file-parallelism
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { criarSite, criarUsuario } from '../helpers/mg6'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const TABELAS = ['niche_signals', 'niche_signals_estado', 'niche_outliers_vistos']

describe.skipIf(skipIfNoLocalDb())('F2 T4: RLS de niche_signals* (GUC forjado)', () => {
  let pg: Client
  beforeAll(async () => { pg = new Client({ connectionString: PG_URL }); await pg.connect() })
  afterAll(async () => {
    try { await pg.query('rollback') } catch { /* nada aberto */ }
    await pg.end()
  })

  async function como(quem: string, guc: string, sql: string, params: unknown[] = []): Promise<{ rows: number; error: string | null }> {
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

  async function cena() {
    const a = await criarSite(pg)
    const b = await criarSite(pg)
    const editorA = await criarUsuario(pg)
    await pg.query(`insert into public.site_memberships (site_id, user_id, role) values ($1, $2, 'editor')`, [a.site, editorA])
    for (const s of [a.site, b.site]) {
      await pg.query(
        `insert into public.niche_signals (site_id, kind, subject_key, rule_version, evidence, forca, acao, first_seen_at, computed_at, expires_at, motivo)
         values ($1, 'destino', 'pais:VN', 'v', '{}', 1, 'video_novo', now(), now(), now() + interval '30 days', 'm')`, [s])
      await pg.query(`insert into public.niche_signals_estado (site_id, computed_at, rule_version, contagens) values ($1, now(), 'v', '{}')`, [s])
      await pg.query(
        `insert into public.niche_outliers_vistos (site_id, video_id, canal_id, formato, published_at, n_canal, primeiro_visto_em, ultimo_visto_em, mult_max, vpd7_max, chaves)
         values ($1, $2, $3, 'long', now(), 9, now(), now(), 5, 1, '{pais:VN}')`, [s, randomUUID(), randomUUID()])
    }
    return { siteA: a.site, siteB: b.site, editorA }
  }

  it('RLS ligada e uma policy de leitura em cada tabela', async () => {
    const r = await pg.query(`select c.relname, c.relrowsecurity, (select count(*)::int from pg_policy p where p.polrelid = c.oid) as policies
      from pg_class c where c.relnamespace = 'public'::regnamespace and c.relname = any($1)`, [TABELAS])
    expect(r.rows).toHaveLength(3)
    for (const x of r.rows) { expect(x.relrowsecurity, x.relname).toBe(true); expect(x.policies, x.relname).toBe(1) }
  })

  it('não-membro com GUC falsificado lê 0 linhas', async () => {
    await pg.query('begin')
    try {
      const c = await cena()
      const estranho = await criarUsuario(pg)
      for (const t of TABELAS) {
        const r = await como(estranho, c.siteA, `select * from public.${t}`)
        expect(r.error, t).toBeNull()
        expect(r.rows, t).toBe(0)
      }
    } finally { await pg.query('rollback') }
  })

  it('editor lê o seu site e não o alheio; escrita por authenticated é recusada', async () => {
    await pg.query('begin')
    try {
      const c = await cena()
      for (const t of TABELAS) {
        const meu = await como(c.editorA, c.siteB, `select * from public.${t} where site_id = $1`, [c.siteA])
        expect(meu.rows, t).toBe(1)
        const alheio = await como(c.editorA, c.siteA, `select * from public.${t} where site_id = $1`, [c.siteB])
        expect(alheio.rows, t).toBe(0)
        const del = await como(c.editorA, c.siteA, `delete from public.${t}`)
        expect(del.error !== null || del.rows === 0, t).toBe(true)
        expect(del.rows, t).toBe(0)
      }
      const upd = await como(c.editorA, c.siteA, `update public.niche_signals set status = 'feito'`)
      expect(upd.rows).toBe(0)
    } finally { await pg.query('rollback') }
  })
})
