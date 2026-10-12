// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite } from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const READ = ['competitor_field_versions', 'competitor_video_early', 'competitor_video_tier_spans'] as const
const EDIT = ['competitor_raw', 'competitor_removed_items'] as const
const ALL = [...READ, ...EDIT]
/** As dez funções novas da MG1 e da MG2 (assinaturas completas, como o banco as registra). */
const FUNCTIONS = [
  'public.apply_competitor_field_plan(uuid, uuid, jsonb, jsonb)',
  'public.apply_competitor_raw_plan(uuid, uuid, jsonb, jsonb)',
  'public.competitor_mark_missing(uuid, uuid[], timestamptz)',
  'public.competitor_channel_mark_missing(uuid, timestamptz)',
  'public.youtube_quota_add(uuid, date, integer, jsonb, jsonb)',
  'public.jsonb_num_merge(jsonb, jsonb, jsonb)',
  'public.competitor_capture_health(uuid, timestamptz)',
  'public.competitor_channel_removal_impact(uuid, uuid)',
  'public.apply_competitor_tier_plan(uuid, uuid, jsonb, date)',
  'public.competitor_series_health(uuid, timestamptz)',
] as const
type Who = 'anon' | 'fora' | 'leitor' | 'editor'

describe.skipIf(skipIfNoLocalDb())('A5 E1 e E2: RLS das tabelas novas com GUC forjado (item 11)', () => {
  // criado no beforeAll: no corpo do describe ele rodaria também sem banco (HAS_LOCAL_DB ausente) e quebraria a coleta
  let sb: ReturnType<typeof getSupabaseServiceClient>
  const users: Record<Exclude<Who, 'anon'>, string> = { fora: randomUUID(), leitor: randomUUID(), editor: randomUUID() }
  let pg: Client, siteId = '', ch = '', vid = ''
  beforeAll(async () => {
    sb = getSupabaseServiceClient()
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
    siteId = (await seedSite(sb)).siteId
    // os três usuários e os dois vínculos, direto no banco (o cliente pg conecta como postgres)
    for (const id of Object.values(users)) await pg.query(`insert into auth.users (id, aud, role, email) values ($1, 'authenticated', 'authenticated', $2)`, [id, id + '@a5.test'])
    await pg.query(`insert into public.site_memberships (site_id, user_id, role) values ($1, $2, 'reporter'), ($1, $3, 'editor')`, [siteId, users.leitor, users.editor])
    ch = (await sb.from('competitor_channels').insert({ site_id: siteId, channel_id: 'UCa5rls', channel_name: 'RLS' }).select('id').single()).data!.id
    vid = (await sb.from('competitor_videos').insert({ competitor_channel_id: ch, video_id: 'a5rlsvid001' }).select('id').single()).data!.id
    const now = new Date().toISOString(), today = now.slice(0, 10)
    // uma linha em cada uma das cinco tabelas, pelo cliente de serviço
    expect((await sb.rpc('apply_competitor_field_plan', { p_site_id: siteId, p_channel_id: ch, p_close: [], p_open: [{ video_id: vid, field: 'tags', value: [], value_hash: 'h', first_seen_at: now, window_start: null, precision: 'first' }] })).error).toBeNull()
    expect((await sb.rpc('apply_competitor_raw_plan', { p_site_id: siteId, p_channel_id: ch, p_close: [], p_open: [{ video_id: vid, raw_sha256: 'r', first_seen_at: now, raw: { id: 'x' } }] })).error).toBeNull()
    expect((await sb.rpc('apply_competitor_tier_plan', { p_site_id: siteId, p_channel_id: ch, p_changes: [{ video_id: vid, tier: 'diaria' }], p_today: today })).error).toBeNull()
    expect((await sb.from('competitor_video_early').insert({ video_id: vid, taken_at: now, site_id: siteId, views: 1 })).error).toBeNull()
    expect((await sb.from('competitor_removed_items').insert({ site_id: siteId, kind: 'video', youtube_id: 'a5rlsgone01', decided_by: users.editor, rows_deleted: {} })).error).toBeNull()
  })
  afterAll(async () => {
    await sb.from('competitor_removed_items').delete().eq('site_id', siteId)
    await sb.from('competitor_channels').delete().eq('site_id', siteId)
    await pg.query('delete from public.site_memberships where site_id = $1', [siteId])
    await pg.query('delete from auth.users where id = any($1)', [Object.values(users)])
    // os vínculos acima geram linhas em audit_log (trigger), e a FK delas impede apagar o site
    await pg.query('delete from public.audit_log where site_id = $1', [siteId])
    await sb.from('sites').delete().eq('id', siteId)
    await pg.end()
  })

  /** Roda `sql` como `who`, com o GUC app.site_id FORJADO para o site, numa transação desfeita. Devolve as linhas ou o erro. */
  async function as(who: Who, sql: string, params: unknown[] = []): Promise<{ rows: number; data: Record<string, unknown>[]; error: string | null }> {
    await pg.query('begin')
    try {
      if (who !== 'anon') await pg.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: users[who], role: 'authenticated' })])
      await pg.query(`select set_config('app.site_id', $1, true)`, [siteId])
      await pg.query(who === 'anon' ? 'set local role anon' : 'set local role authenticated')
      const r = await pg.query(sql, params)
      return { rows: r.rowCount ?? 0, data: r.rows, error: null }
    } catch (e) {
      return { rows: 0, data: [], error: e instanceof Error ? e.message : String(e) }
    } finally {
      await pg.query('rollback')
    }
  }
  const sees = (who: Who, table: string): boolean => (who === 'editor') || (who === 'leitor' && (READ as readonly string[]).includes(table))

  for (const who of ['anon', 'fora', 'leitor', 'editor'] as const) {
    for (const table of ALL) {
      it(`${who} lê ${table}: ${sees(who, table) ? 'a linha do site' : 'nada'}`, async () => {
        const r = await as(who, `select 1 from public.${table} where site_id = $1`, [siteId])
        // anon pode receber "permission denied" (sem grant) em vez de zero linhas: os dois são "não lê"
        if (sees(who, table)) expect(r).toMatchObject({ rows: 1, error: null })
        else expect(r.rows).toBe(0)
      })
      it(`${who} não insere em ${table}`, async () => {
        const direct = table === 'competitor_video_early'
          ? await as(who, `insert into public.competitor_video_early (video_id, taken_at, site_id, views) values ($1, now() + interval '1 second', $2, 1)`, [vid, siteId])
          : table === 'competitor_video_tier_spans'
            ? await as(who, `insert into public.competitor_video_tier_spans (video_id, from_date, tier, site_id) values ($1, current_date + 400, 'diaria', $2)`, [vid, siteId])
            : table === 'competitor_removed_items'
              ? await as(who, `insert into public.competitor_removed_items (site_id, kind, youtube_id, decided_by, rows_deleted) values ($1, 'video', 'a5rlsnew0001', $2, '{}')`, [siteId, randomUUID()])
              : table === 'competitor_raw'
                ? await as(who, `insert into public.competitor_raw (site_id, competitor_channel_id, raw_sha256, first_seen_at, last_seen_at, is_current, raw) values ($1, $2, 'z', now(), now(), false, '{}')`, [siteId, ch])
                : await as(who, `insert into public.competitor_field_versions (site_id, competitor_channel_id, field, value_hash, first_seen_at, last_seen_at, precision, is_current) values ($1, $2, 'name', 'z', now(), now(), 'first', false)`, [siteId, ch])
        // (fecho do portão: M-n2) não basta "qualquer erro": coluna com nome errado passaria como se fosse RLS
        expect(direct.error, 'insert direto tinha de falhar por RLS ou por falta de permissão').toMatch(/row-level security|permission denied/)
      })
    }
    it(`${who} não executa nenhuma das ${FUNCTIONS.length} funções novas`, async () => {
      // Não chamamos a função: neste Postgres local (17.6 arm64, com supautils/pgaudit) QUALQUER chamada negada
      // por falta de EXECUTE (inclusive de funções antigas, como cleanup_excess_auto_snapshots) derruba o servidor
      // com SIGSEGV e reinicia o banco para todo mundo. A pergunta "quem pode executar" é respondida pelo
      // próprio catálogo, com o papel de `who` ativo: has_function_privilege é o que o executor consulta.
      const r = await as(who, `select f, has_function_privilege(current_user, f::regprocedure, 'execute') as ok from unnest($1::text[]) as f`, [FUNCTIONS as readonly string[]])
      expect(r.error).toBeNull()
      expect(r.data).toHaveLength(FUNCTIONS.length)
      expect(r.data.filter((x) => x.ok !== false).map((x) => x.f), 'funções que este papel consegue executar').toEqual([])
    })
  }

  it('controle: o service_role executa as dez funções e nenhuma tem EXECUTE para PUBLIC', async () => {
    const r = await pg.query(`select f, has_function_privilege('service_role', f::regprocedure, 'execute') as ok from unnest($1::text[]) as f`, [FUNCTIONS as readonly string[]])
    expect(r.rows).toHaveLength(FUNCTIONS.length)
    expect(r.rows.filter((x) => x.ok !== true)).toEqual([])
    const pub = await pg.query(`select f from unnest($1::text[]) as f where exists (select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a where p.oid = f::regprocedure and a.grantee = 0)`, [FUNCTIONS as readonly string[]])
    expect(pub.rows).toEqual([])
  })
})
