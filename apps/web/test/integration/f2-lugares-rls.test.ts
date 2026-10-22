// @vitest-environment node
/**
 * F2 T2: RLS de lugares / lugar_aliases / video_lugares contra Postgres de verdade. Banco: SÓ o `bythiago_int`:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/f2-lugares-rls.test.ts --no-file-parallelism
 * Tudo dentro de begin/rollback; a leitura roda como `authenticated` com o GUC `app.site_id` FORJADO para o site alheio.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { emTransacao, criarSite, criarUsuario, escalar } from '../helpers/mg6'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

describe.skipIf(skipIfNoLocalDb())('F2 T2: RLS de video_lugares, lugares e lugar_aliases (GUC forjado)', () => {
  let pg: Client
  beforeAll(async () => { pg = new Client({ connectionString: PG_URL }); await pg.connect() })
  afterAll(async () => {
    try { await pg.query('rollback') } catch { /* nada aberto */ }
    await pg.end()
  })

  interface Resultado { rows: number; error: string | null }
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

  async function cena(): Promise<{ siteA: string; siteB: string; editorA: string; editorB: string }> {
    const a = await criarSite(pg)
    const b = await criarSite(pg)
    const editorA = await criarUsuario(pg)
    const editorB = await criarUsuario(pg)
    await pg.query(`insert into public.site_memberships (site_id, user_id, role) values ($1, $2, 'editor')`, [a.site, editorA])
    await pg.query(`insert into public.site_memberships (site_id, user_id, role) values ($1, $2, 'editor')`, [b.site, editorB])
    for (const s of [a.site, b.site]) {
      await pg.query(
        `insert into public.video_lugares (video_id, site_id, origem, chaves, fonte, entrada_hash, semente_versao, computado_em)
         values ($1, $2, 'competidor', '{pais:VN}', 'texto', 'h', 1, now())`, [randomUUID(), s])
    }
    return { siteA: a.site, siteB: b.site, editorA, editorB }
  }

  it('tabelas com RLS ligada; lugares e lugar_aliases sem nenhuma policy', async () => {
    const r = await pg.query(`select c.relname, c.relrowsecurity,
        (select count(*)::int from pg_policy p where p.polrelid = c.oid) as policies
      from pg_class c where c.relnamespace = 'public'::regnamespace and c.relname in ('lugares','lugar_aliases','video_lugares')`)
    const por = new Map(r.rows.map((x: { relname: string; relrowsecurity: boolean; policies: number }) => [x.relname, x]))
    for (const t of ['lugares', 'lugar_aliases', 'video_lugares']) expect(por.get(t)?.relrowsecurity, t).toBe(true)
    expect(por.get('lugares')?.policies).toBe(0)
    expect(por.get('lugar_aliases')?.policies).toBe(0)
    expect(por.get('video_lugares')?.policies).toBe(1)
  })

  it('authenticated sem can_edit_site lê 0 linhas de video_lugares mesmo com app.site_id falsificado', async () => {
    await emTransacao(pg, async () => {
      const c = await cena()
      expect(await escalar<number>(pg, `select count(*)::int from public.video_lugares where site_id = $1`, [c.siteA])).toBe(1)
      const estranho = await criarUsuario(pg)
      const r = await como(estranho, c.siteA, `select * from public.video_lugares`)
      expect(r.error).toBeNull()
      expect(r.rows).toBe(0)
      // editor do B com o GUC apontando para A: só vê a linha do B
      const cruzado = await como(c.editorB, c.siteA, `select * from public.video_lugares where site_id = $1`, [c.siteA])
      expect(cruzado.error).toBeNull()
      expect(cruzado.rows).toBe(0)
    })
  })

  it('editor do site lê as linhas do seu site (controle do zero acima)', async () => {
    await emTransacao(pg, async () => {
      const c = await cena()
      const r = await como(c.editorA, c.siteA, `select * from public.video_lugares where site_id = $1`, [c.siteA])
      expect(r.error).toBeNull()
      expect(r.rows).toBe(1)
    })
  })

  it('authenticated não lê lugar_aliases nem lugares (com linhas de verdade no banco)', async () => {
    await emTransacao(pg, async () => {
      const c = await cena()
      expect(await escalar<number>(pg, `select count(*)::int from public.lugar_aliases`)).toBeGreaterThan(0)
      for (const t of ['lugar_aliases', 'lugares']) {
        const r = await como(c.editorA, c.siteA, `select * from public.${t}`)
        expect(r.error !== null || r.rows === 0, `${t} legível: ${r.rows} linhas`).toBe(true)
      }
    })
  })

  it('insert/update/delete por authenticated recusado nas três tabelas', async () => {
    await emTransacao(pg, async () => {
      const c = await cena()
      const tentativas = [
        `insert into public.lugares (slug, pais_iso2, nivel) values ('pais:ZZ', 'ZZ', 'pais')`,
        `insert into public.lugar_aliases (alias_norm, slug, semente_versao) values ('zz', 'pais:VN', 1)`,
        `insert into public.video_lugares (video_id, site_id, origem, chaves, fonte, entrada_hash, semente_versao, computado_em)
           values (gen_random_uuid(), '${c.siteA}', 'proprio', '{}', 'texto', 'h', 1, now())`,
        `update public.video_lugares set chaves = '{}'`,
        `delete from public.video_lugares`,
        `delete from public.lugares`,
      ]
      for (const sql of tentativas) {
        const r = await como(c.editorA, c.siteA, sql)
        expect(r.error !== null || r.rows === 0, sql).toBe(true)
        expect(r.rows, sql).toBe(0)
      }
      expect(await escalar<number>(pg, `select count(*)::int from public.video_lugares where site_id = $1`, [c.siteA])).toBe(1)
    })
  })

  it('o total de aliases no banco é o total do JSON', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const j = JSON.parse(readFileSync(resolve(__dirname, '../../data/lugares/semente-v1.json'), 'utf8')) as { lugares: Array<{ aliases: unknown[] }> }
    const total = j.lugares.reduce((n, l) => n + l.aliases.length, 0)
    expect(await escalar<number>(pg, `select count(*)::int from public.lugar_aliases`)).toBe(total)
  })
})
