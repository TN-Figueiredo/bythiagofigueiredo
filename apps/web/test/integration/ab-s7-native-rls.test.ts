// @vitest-environment node
/**
 * S7 fase 1 (T6, C-9): RLS e privilégios das três tabelas novas, com o GUC `app.site_id` FORJADO. Banco: SÓ o `bythiago_int`.
 *   HAS_LOCAL_DB=1 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres npx vitest run test/integration/ab-s7-native --no-file-parallelism
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite } from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

vi.setConfig({ testTimeout: 60_000 })
const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const TABELAS = ['ab_native_tests', 'ab_native_avaliacoes', 'ab_guarda_liberacoes'] as const
const INSERTS: Record<(typeof TABELAS)[number], string> = {
  ab_native_tests: `insert into public.ab_native_tests (site_id, video_id, youtube_video_id, origem, campos, estado, variantes_titulo, primeira_vista, versao_regra)
    values ($1, $2, 'abcdefghijk', 'detectado', '{titulo}', 'sem_desfecho', '["a","b"]', now(), 1)`,
  ab_native_avaliacoes: `insert into public.ab_native_avaliacoes (site_id, video_id, avaliada_em, estado_14, versao_regra) values ($1, $2, now(), 'sem_leitura', 1)`,
  ab_guarda_liberacoes: `insert into public.ab_guarda_liberacoes (site_id, video_id, motivo_na_hora, valido_ate) values ($1, $2, 'x', now())`,
}
type Who = 'anon' | 'sem' | 'leitor' | 'editor' | 'editorB'
interface Resultado { rows: number; code: string | null }

describe.skipIf(skipIfNoLocalDb())('S7 f1: RLS das tabelas do registro do teste nativo (GUC forjado)', () => {
  let pg: Client
  let sb: ReturnType<typeof getSupabaseServiceClient>
  const sites: string[] = []
  const usuarios: string[] = []
  let siteA: string, siteB: string, videoId: string
  const users = { sem: randomUUID(), leitor: randomUUID(), editor: randomUUID(), editorB: randomUUID() }

  beforeAll(async () => {
    sb = getSupabaseServiceClient()
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
    siteA = (await seedSite(sb)).siteId; sites.push(siteA)
    siteB = (await seedSite(sb)).siteId; sites.push(siteB)
    for (const id of Object.values(users)) {
      usuarios.push(id)
      await pg.query(`insert into auth.users (id, aud, role, email) values ($1, 'authenticated', 'authenticated', $2)`, [id, id + '@s7.test'])
    }
    await pg.query(`insert into public.site_memberships (site_id, user_id, role) values ($1, $2, 'reporter'), ($1, $3, 'editor'), ($4, $5, 'editor')`, [siteA, users.leitor, users.editor, siteB, users.editorB])
    const k = randomUUID().replace(/-/g, '')
    const canal = String((await pg.query(`insert into public.youtube_channels (site_id, channel_id, locale, handle, name, uploads_playlist_id, slug)
      values ($1, $2, 'pt', $3, 'Teste', $4, $5) returning id`, [siteA, 'UC' + k.slice(0, 20), '@r' + k.slice(0, 8), 'UU' + k.slice(0, 20), 'r7-' + k.slice(0, 8)])).rows[0].id)
    videoId = String((await pg.query(`insert into public.youtube_videos (site_id, channel_id, youtube_video_id, title, published_at) values ($1, $2, $3, 'T', now()) returning id`, [siteA, canal, 'y' + k.slice(0, 10)])).rows[0].id)
    const t = String((await pg.query(`insert into public.ab_native_tests (site_id, video_id, youtube_video_id, origem, campos, estado, variantes_titulo, primeira_vista, versao_regra)
      values ($1, $2, 'abcdefghijk', 'detectado', '{titulo}', 'em_andamento', '["a","b"]', now(), 1) returning id`, [siteA, videoId])).rows[0].id)
    await pg.query(`insert into public.ab_native_avaliacoes (site_id, video_id, avaliada_em, estado_14, versao_regra, registro_id) values ($1, $2, now(), 'sem_leitura', 1, $3)`, [siteA, videoId, t])
    await pg.query(`insert into public.ab_guarda_liberacoes (site_id, video_id, motivo_na_hora, valido_ate, liberado_por) values ($1, $2, 'x', now() + interval '14 days', $3)`, [siteA, videoId, users.editor])
  })
  afterAll(async () => {
    try {
      await pg.query('delete from public.site_memberships where site_id = any($1::uuid[])', [sites])
      await pg.query('delete from public.audit_log where site_id = any($1::uuid[])', [sites])
      await pg.query('delete from auth.users where id = any($1::uuid[])', [usuarios])
      await pg.query('delete from public.youtube_videos where site_id = any($1::uuid[])', [sites])
      await pg.query('delete from public.youtube_channels where site_id = any($1::uuid[])', [sites])
      await pg.query('delete from public.sites where id = any($1::uuid[])', [sites])
    } finally {
      await pg.end()
    }
  })

  async function como(who: Who, sql: string, params: unknown[] = [], guc: string = siteA): Promise<Resultado> {
    await pg.query('begin')
    try {
      if (who !== 'anon') await pg.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: users[who], role: 'authenticated' })])
      await pg.query(`select set_config('app.site_id', $1, true)`, [guc])
      await pg.query(who === 'anon' ? 'set local role anon' : 'set local role authenticated')
      const r = await pg.query(sql, params)
      return { rows: r.rowCount ?? 0, code: null }
    } catch (e) {
      return { rows: 0, code: (e as { code?: string }).code ?? null }
    } finally {
      await pg.query('rollback')
    }
  }
  const ler = (who: Who, t: string, guc?: string): Promise<Resultado> => como(who, `select 1 from public.${t} where site_id = $1`, [siteA], guc)

  it('policy de leitura usa can_edit_site, nunca o GUC', async () => {
    const pol = await pg.query(`select tablename, qual, cmd from pg_policies where schemaname = 'public' and tablename = any($1) order by 1`, [TABELAS])
    expect(pol.rows).toHaveLength(3)
    for (const p of pol.rows) {
      expect(p.cmd).toBe('SELECT')
      expect(String(p.qual), p.tablename).toContain('can_edit_site(site_id)')
      expect(String(p.qual)).not.toMatch(/app\.site_id|site_visible|true/)
    }
  })

  it('sem vínculo, reporter e editor de outro site leem zero; o editor lê (controle positivo); GUC forjado não ajuda', async () => {
    for (const t of TABELAS) {
      for (const who of ['sem', 'leitor', 'editorB'] as const) {
        const r = await ler(who, t)
        expect(r.code, `${who} em ${t}`).toBeNull()
        expect(r.rows, `${who} lê ${t}`).toBe(0)
      }
      expect((await ler('editorB', t, siteB)).rows).toBe(0)
      expect((await ler('sem', t, '')).rows).toBe(0)
      expect((await ler('editor', t)).rows, `editor lê ${t}`).toBe(1)
    }
  })

  it('anon sem select (42501); a service role lê', async () => {
    for (const t of TABELAS) {
      expect((await ler('anon', t)).code, `anon em ${t}`).toBe('42501')
      const svc = await sb.from(t).select('site_id').eq('site_id', siteA)
      expect(svc.error).toBeNull()
      expect(svc.data).toHaveLength(1)
    }
  })

  it('authenticated recebe 42501 em insert, update, delete e truncate', async () => {
    for (const t of TABELAS) {
      for (const who of ['editor', 'leitor', 'sem', 'editorB'] as const) {
        expect((await como(who, `update public.${t} set site_id = site_id where site_id = $1`, [siteA])).code, `update ${who} ${t}`).toBe('42501')
        expect((await como(who, `delete from public.${t} where site_id = $1`, [siteA])).code, `delete ${who} ${t}`).toBe('42501')
        expect((await como(who, `truncate public.${t}`)).code, `truncate ${who} ${t}`).toBe('42501')
        expect((await como(who, INSERTS[t], [siteA, videoId])).code, `insert ${who} ${t}`).toBe('42501')
      }
    }
  })

  it('apagar o usuário de liberado_por não falha (set null)', async () => {
    const u = randomUUID()
    await pg.query(`insert into auth.users (id, aud, role, email) values ($1, 'authenticated', 'authenticated', $2)`, [u, u + '@s7.test'])
    const id = String((await pg.query(`insert into public.ab_guarda_liberacoes (site_id, video_id, motivo_na_hora, valido_ate, liberado_por) values ($1, $2, 'x', now() + interval '14 days', $3) returning id`, [siteA, videoId, u])).rows[0].id)
    await pg.query('delete from auth.users where id = $1', [u])
    expect((await pg.query('select liberado_por from public.ab_guarda_liberacoes where id = $1', [id])).rows[0].liberado_por).toBeNull()
    await pg.query('delete from public.ab_guarda_liberacoes where id = $1', [id])
  })

  it('has_function_privilege: nega public/anon/authenticated e concede service_role nas quatro funções', async () => {
    const fns = ['yt_watch_reter(uuid,text,timestamptz)', 'ab_native_ultimas(uuid[])', 'ab_native_poda(timestamptz,integer)', 'ab_native_reproduzir(uuid,uuid,jsonb,jsonb)']
    for (const f of fns) {
      for (const quem of ['anon', 'authenticated']) {
        expect((await pg.query(`select has_function_privilege($1, $2, 'execute') as p`, [quem, 'public.' + f])).rows[0].p, `${quem} ${f}`).toBe(false)
      }
      expect((await pg.query(`select has_function_privilege('service_role', $1, 'execute') as p`, ['public.' + f])).rows[0].p, `service_role ${f}`).toBe(true)
      const acl = (await pg.query(`select proacl::text as a from pg_proc where oid = to_regprocedure($1)`, ['public.' + f])).rows[0].a as string
      expect(acl, `public em ${f}`).not.toMatch(/(^\{|,)=X/)
    }
  })
})
