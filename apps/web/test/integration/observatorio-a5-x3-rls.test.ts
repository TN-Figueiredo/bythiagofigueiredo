// @vitest-environment node
/**
 * A5 · X3 (Tarefa 1): RLS por comportamento das cinco tabelas, no molde do `observatorio-a5-e9-rls.test.ts`
 * (GUC `app.site_id` forjado como não superusuário). Só o `bythiago_int`, dentro de `begin … rollback` com a X3 aplicada na transação.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { semearCena, criarSite, criarUsuario, escalar } from '../helpers/mg6'
import { emTransacaoComX3 } from '../helpers/x3'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const CINCO = ['competitor_playlist_reads', 'competitor_playlists', 'competitor_playlist_versions', 'competitor_playlist_items', 'competitor_channel_sections'] as const

describe.skipIf(skipIfNoLocalDb())('A5 X3 Tarefa 1: RLS das cinco tabelas (banco local, GUC forjado, tudo desfeito)', () => {
  let pg: Client
  beforeAll(async () => { pg = new Client({ connectionString: PG_URL }); await pg.connect() })
  afterAll(async () => { try { await pg.query('rollback') } catch { /* nada aberto */ } await pg.end() })

  async function como(quem: string, guc: string, sql: string, papel = 'authenticated'): Promise<{ rows: number; code: string | null }> {
    await pg.query('savepoint como')
    try {
      await pg.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: quem, role: papel })])
      await pg.query(`select set_config('app.site_id', $1, true)`, [guc])
      await pg.query(`set local role ${papel}`)
      const r = await pg.query(sql)
      return { rows: r.rowCount ?? 0, code: null }
    } catch (e) {
      return { rows: 0, code: typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : 'erro' }
    } finally {
      await pg.query('rollback to savepoint como')
      await pg.query('release savepoint como')
    }
  }

  async function cenario() {
    const c = await semearCena(pg)
    const editor = await criarUsuario(pg)
    await pg.query(`insert into public.site_memberships (site_id, user_id, role) values ($1, $2, 'editor')`, [c.site, editor])
    const x = await criarSite(pg)
    const editorX = await criarUsuario(pg)
    await pg.query(`insert into public.site_memberships (site_id, user_id, role) values ($1, $2, 'editor')`, [x.site, editorX])
    // uma linha em cada tabela, pelo caminho das funções
    const r = (await pg.query(`select public.competitor_x3_playlists_record($1, $2, '2026-03-10T10:00:00Z', $3::jsonb, true) as r`,
      [c.site, c.canalA, JSON.stringify([{ playlist_id: 'PLrls01', title: 't', published_at: null, item_count: 1, privacy: 'public', state_sha256: 'h', raw: {} }])])).rows[0]
    const ref = (r.r as { ids: Record<string, string> }).ids['PLrls01']!
    await pg.query(`select public.competitor_x3_items_record($1, $2, $3, '2026-03-10T10:05:00Z', $4::jsonb, true, 'ok', null)`,
      [c.site, c.canalA, ref, JSON.stringify([{ item_id: 'i1', youtube_video_id: 'v0000000001', position: 0, added_at: null, video_published_at: null, video_owner_channel_id: null, privacy: 'public', note: null }])])
    await pg.query(`select public.competitor_x3_sections_record($1, $2, '2026-03-10T10:00:00Z', 'h', '{}'::jsonb)`, [c.site, c.canalA])
    await pg.query(`select public.competitor_x3_visit_close($1, $2, '2026-03-10T10:10:00Z', 'ok', null, 3, 0, null, null, false)`, [c.site, c.canalA])
    return { c, editor, editorX }
  }

  it('o controle: o superusuário vê uma linha em cada tabela', async () => {
    await emTransacaoComX3(pg, async () => {
      const { c } = await cenario()
      for (const t of CINCO) expect(await escalar<number>(pg, `select count(*)::int from public.${t} where site_id = $1`, [c.site]), t).toBeGreaterThan(0)
    })
  })

  it('editor do site lê; editor de OUTRO site com o GUC forjado para este lê zero; anon falha 42501; authenticated falha 42501 ao inserir', async () => {
    await emTransacaoComX3(pg, async () => {
      const { c, editor, editorX } = await cenario()
      for (const t of CINCO) {
        const sql = `select * from public.${t} where site_id = '${c.site}'`
        expect((await como(editor, c.site, sql)).rows, `${t} editor`).toBeGreaterThan(0)
        expect((await como(editorX, c.site, sql)).rows, `${t} editor de outro site, GUC forjado`).toBe(0)
        expect((await como(editor, c.site, sql, 'anon')).code, `${t} anon`).toBe('42501')
        const ins = await como(editor, c.site, `insert into public.${t} (site_id) values ('${c.site}')`)
        expect(ins.code, `${t} insert`).toBe('42501')
      }
    })
  })

  it('cada tabela tem exatamente uma política (uma permissiva a mais esquecida reprovaria)', async () => {
    await emTransacaoComX3(pg, async () => {
      for (const t of CINCO) {
        expect(await escalar<number>(pg, `select count(*)::int from pg_policies where schemaname = 'public' and tablename = $1`, [t]), t).toBe(1)
      }
    })
  })
})
