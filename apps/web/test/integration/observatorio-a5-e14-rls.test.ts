// @vitest-environment node
/**
 * A5 · E14 (MG8): RLS e privilégios das quatro tabelas e das cinco funções dos comentários de destaque, contra Postgres de verdade,
 * com o GUC `app.site_id` FORJADO. Banco: SÓ o `bythiago_int`. Rodar com:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/observatorio-a5-e14-rls.test.ts --no-file-parallelism
 *
 * REGRA DESTE POSTGRES LOCAL: chamar função sem EXECUTE como anon/authenticated DERRUBA o servidor (SIGSEGV). Aqui as funções são
 * conferidas pelo CATÁLOGO (`has_function_privilege`, `pg_proc`), nunca chamadas por esses papéis; só o service_role chama de verdade.
 * As TABELAS são lidas e escritas como anon/authenticated (zero linha ou erro de RLS/permissão). Cada teste cria os SEUS dois sites,
 * os seus usuários e as suas linhas; o afterAll limpa tudo, inclusive em falha. DADO PESSOAL: só dado inventado.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite } from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { COMMENT_RULES } from '@/lib/youtube/observatorio/comentarios/regras'
import { lerImpacto, lerProva } from '@/lib/youtube/observatorio/comentarios/gravar'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const H = 3_600_000
const NOW = Date.now()
const iso = (ms: number): string => new Date(ms).toISOString()
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 })

const TABELAS = ['competitor_video_comment_snaps', 'competitor_video_comments', 'competitor_video_comment_marks', 'competitor_video_comment_authors'] as const
type Tabela = (typeof TABELAS)[number]
/** As cinco funções, com a assinatura que o banco registra. */
const FUNCOES = [
  'public.apply_competitor_comment_snap(uuid, smallint, jsonb, jsonb, text[])',
  'public.competitor_comment_identity_purge(uuid)',
  'public.competitor_comment_due(timestamptz, jsonb, interval, integer, text[], interval, timestamptz, uuid)',
  'public.competitor_comment_health(uuid, timestamptz, jsonb, integer, interval, timestamptz)',
  'public.competitor_channel_comment_impact(uuid, uuid)',
] as const
const NOMES = ['apply_competitor_comment_snap', 'competitor_comment_identity_purge', 'competitor_comment_due', 'competitor_comment_health', 'competitor_channel_comment_impact'] as const

type Who = 'anon' | 'sem' | 'leitor' | 'editor' | 'editorB'
interface Cenario {
  siteA: string; siteB: string
  users: { sem: string; leitor: string; editor: string; editorB: string }
  canal: string; video: string; criadorId: string; comumId: string
}
interface Resultado { rows: number; data: Record<string, unknown>[]; error: string | null }

describe.skipIf(skipIfNoLocalDb())('A5 E14 (MG8): RLS e privilégios (banco local, GUC forjado)', () => {
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

  /** Dois sites; usuários: sem papel, leitor (reporter de A), editor de A, editor de B. No site A, uma linha em cada uma das quatro tabelas. */
  async function cenario(): Promise<Cenario> {
    const siteA = (await seedSite(sb)).siteId; sites.push(siteA)
    const siteB = (await seedSite(sb)).siteId; sites.push(siteB)
    const users = { sem: randomUUID(), leitor: randomUUID(), editor: randomUUID(), editorB: randomUUID() }
    for (const id of Object.values(users)) {
      usuarios.push(id)
      await pg.query(`insert into auth.users (id, aud, role, email) values ($1, 'authenticated', 'authenticated', $2)`, [id, id + '@a5.test'])
    }
    await pg.query(`insert into public.site_memberships (site_id, user_id, role) values ($1, $2, 'reporter'), ($1, $3, 'editor'), ($4, $5, 'editor')`, [siteA, users.leitor, users.editor, siteB, users.editorB])
    const n = randomUUID().replace(/-/g, '')
    const canal = String((await pg.query(`insert into public.competitor_channels (site_id, channel_id, channel_name) values ($1, $2, 'Teste') returning id`, [siteA, 'UC' + n.slice(0, 20)])).rows[0].id)
    const taken = NOW - 2 * 60_000
    const video = String((await pg.query(`insert into public.competitor_videos (competitor_channel_id, video_id, published_at) values ($1, $2, $3) returning id`, [canal, 'v' + n.slice(0, 10), iso(taken - 30 * H)])).rows[0].id)
    const snap = { taken_at: iso(taken), from_h: 24, until_h: 72, status: 'ok', rule_version: 1, rule_params: {}, units_used: 1, pool_stats: null }
    const comentario = (id: string, criador: boolean): Record<string, unknown> => ({
      youtube_comment_id: id, parent_youtube_id: null, via: 'lote', body: 'texto inventado ' + id, body_truncated: false, published_at: iso(taken - 10 * H),
      is_creator: criador, author: criador ? null : { display_name: 'Autor ' + id, channel_id: 'UC' + id, avatar_url: 'https://img.invalid/' + id }, likes: 3, reply_count: 0, relevance_rank: 1, slot: 'curtidos',
    })
    const r = await pg.query('select public.apply_competitor_comment_snap($1::uuid, 1::smallint, $2::jsonb, $3::jsonb, $4::text[]) as r',
      [video, JSON.stringify(snap), JSON.stringify([comentario('cr' + n.slice(0, 8), true), comentario('cm' + n.slice(0, 8), false)]), []])
    expect(r.rows[0].r, 'semente').toMatchObject({ status: 'gravado', comentarios_novos: 2, identidades: 1 })
    const ids = await pg.query('select id, is_creator from public.competitor_video_comments where video_id = $1', [video])
    const criadorId = String(ids.rows.find((x) => x.is_creator === true).id)
    const comumId = String(ids.rows.find((x) => x.is_creator === false).id)
    return { siteA, siteB, users, canal, video, criadorId, comumId }
  }

  /**
   * Roda `sql` como `who` numa transação desfeita, com o GUC `app.site_id` FORJADO para o site A (o site de que o editor de B NÃO é
   * membro). Papel `anon`/`authenticated` sem superusuário, como no PostgREST.
   */
  async function como(c: Cenario, who: Who, sql: string, params: unknown[] = []): Promise<Resultado> {
    await pg.query('begin')
    try {
      if (who !== 'anon') await pg.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: c.users[who], role: 'authenticated' })])
      await pg.query(`select set_config('app.site_id', $1, true)`, [c.siteA])
      await pg.query(who === 'anon' ? 'set local role anon' : 'set local role authenticated')
      const r = await pg.query(sql, params)
      return { rows: r.rowCount ?? 0, data: r.rows as Record<string, unknown>[], error: null }
    } catch (e) {
      return { rows: 0, data: [], error: e instanceof Error ? e.message : String(e) }
    } finally {
      await pg.query('rollback')
    }
  }
  const contar = (c: Cenario, who: Who, tabela: Tabela): Promise<Resultado> => como(c, who, `select 1 from public.${tabela} where site_id = $1`, [c.siteA])

  /** O INSERT de uma linha NOVA de `tabela` no site A (a tentativa de escrita que o RLS tem de recusar). */
  function inserir(c: Cenario, tabela: Tabela): [string, unknown[]] {
    switch (tabela) {
      case 'competitor_video_comment_snaps':
        return [`insert into public.competitor_video_comment_snaps (video_id, mark, site_id, competitor_channel_id, taken_at, video_age_hours, status, rule_version, rule_params, units_used)
                 values ($1, 7, $2, $3, now(), 192, 'ok', 1, '{}', 1)`, [c.video, c.siteA, c.canal]]
      case 'competitor_video_comments':
        return [`insert into public.competitor_video_comments (site_id, competitor_channel_id, video_id, youtube_comment_id, body, published_at, is_creator, first_seen_at, last_seen_at)
                 values ($1, $2, $3, 'forjado-rls', 'x', now(), false, now(), now())`, [c.siteA, c.canal, c.video]]
      case 'competitor_video_comment_marks':
        return [`insert into public.competitor_video_comment_marks (comment_id, mark, site_id, likes) values ($1, 7, $2, 1)`, [c.comumId, c.siteA]]
      case 'competitor_video_comment_authors':
        return [`insert into public.competitor_video_comment_authors (comment_id, site_id, display_name, expires_at) values ($1, $2, 'forjado', now() + interval '28 days')`, [c.criadorId, c.siteA]]
    }
  }

  it('anônimo e usuário de fora: zero linhas nas quatro (mesmo com o GUC forjado), e o controle prova que as linhas existem', async () => {
    const c = await cenario()
    for (const t of TABELAS) {
      expect((await pg.query(`select 1 from public.${t} where site_id = $1`, [c.siteA])).rowCount, `${t}: semente`).toBeGreaterThanOrEqual(1)
      for (const who of ['anon', 'sem', 'editorB'] as const) {
        const r = await contar(c, who, t)
        expect(r.rows, `${t}: ${who}`).toBe(0)
        if (who !== 'anon') expect(r.error, `${t}: ${who} sem erro de SQL`).toBeNull()
      }
    }
  })

  it('leitor (reporter): lê o retrato; zero linhas de texto, de leitura e de identidade (sem a MG11)', async () => {
    const c = await cenario()
    expect(await contar(c, 'leitor', 'competitor_video_comment_snaps')).toMatchObject({ rows: 1, error: null })
    for (const t of ['competitor_video_comments', 'competitor_video_comment_marks', 'competitor_video_comment_authors'] as const) {
      expect(await contar(c, 'leitor', t), t).toMatchObject({ rows: 0, error: null })
    }
    // a identidade nunca chega ao leitor, nem pela coluna nem por junção
    const juncao = await como(c, 'leitor', `select a.display_name from public.competitor_video_comment_authors a join public.competitor_video_comments k on k.id = a.comment_id where k.video_id = $1`, [c.video])
    expect(juncao).toMatchObject({ rows: 0, error: null })
  })

  it('editor: lê as quatro', async () => {
    const c = await cenario()
    const esperado: Record<Tabela, number> = { competitor_video_comment_snaps: 1, competitor_video_comments: 2, competitor_video_comment_marks: 2, competitor_video_comment_authors: 1 }
    for (const t of TABELAS) expect(await contar(c, 'editor', t), t).toMatchObject({ rows: esperado[t], error: null })
    const nome = await como(c, 'editor', `select display_name from public.competitor_video_comment_authors where site_id = $1`, [c.siteA])
    expect(nome.data).toHaveLength(1)
    expect(String(nome.data[0]!.display_name)).toMatch(/^Autor /)
  })

  it('ninguém além do service_role insere, altera ou apaga nas quatro (tentativa por papel authenticated editor e por anon)', async () => {
    const c = await cenario()
    for (const t of TABELAS) {
      for (const who of ['editor', 'leitor', 'editorB', 'sem', 'anon'] as const) {
        const [sql, params] = inserir(c, t)
        const r = await como(c, who, sql, params)
        // não basta "qualquer erro": coluna com nome errado passaria como se fosse RLS
        expect(r.error, `${t}: insert direto de ${who} tinha de falhar por RLS ou por falta de permissão`).toMatch(/row-level security|permission denied/)
      }
      for (const who of ['editor', 'anon'] as const) {
        expect((await como(c, who, `delete from public.${t} where site_id = $1`, [c.siteA])).rows, `${t}: delete de ${who}`).toBe(0)
      }
    }
    expect((await como(c, 'editor', `update public.competitor_video_comments set body = 'trocado' where site_id = $1`, [c.siteA])).rows, 'update do texto').toBe(0)
    expect((await como(c, 'editor', `update public.competitor_video_comment_authors set display_name = 'trocado' where site_id = $1`, [c.siteA])).rows, 'update da identidade').toBe(0)
    expect((await como(c, 'editor', `update public.competitor_video_comment_marks set likes = 999 where site_id = $1`, [c.siteA])).rows, 'update da leitura').toBe(0)
    expect((await como(c, 'editor', `update public.competitor_video_comment_snaps set status = 'erro' where site_id = $1`, [c.siteA])).rows, 'update do retrato').toBe(0)
    // controle: nada do que foi tentado mudou o banco
    const depois = await pg.query(`select
      (select count(*) from public.competitor_video_comment_snaps where site_id = $1)::int as snaps,
      (select count(*) from public.competitor_video_comments where site_id = $1 and body like 'texto inventado%')::int as comentarios,
      (select count(*) from public.competitor_video_comment_marks where site_id = $1 and likes = 3)::int as leituras,
      (select count(*) from public.competitor_video_comment_authors where site_id = $1 and display_name like 'Autor %')::int as identidades`, [c.siteA])
    expect(depois.rows[0]).toEqual({ snaps: 1, comentarios: 2, leituras: 2, identidades: 1 })
  })

  it('as cinco funções: execute só para service_role, e uma função por nome (nenhuma sobrecarga); search_path vazio', async () => {
    // NUNCA a chamada como anon/authenticated: a chamada negada derruba o servidor. Só o catálogo.
    const r = await pg.query(`select f,
        has_function_privilege('anon', f::regprocedure, 'execute') as anon,
        has_function_privilege('authenticated', f::regprocedure, 'execute') as authenticated,
        has_function_privilege('service_role', f::regprocedure, 'execute') as service_role,
        exists (select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a where p.oid = f::regprocedure and a.grantee = 0) as public_ok
      from unnest($1::text[]) as f`, [FUNCOES as readonly string[]])
    expect(r.rows).toHaveLength(FUNCOES.length)
    expect(r.rows.map((x) => [x.f, x.anon, x.authenticated, x.service_role, x.public_ok])).toEqual(FUNCOES.map((f) => [f, false, false, true, false]))
    // uma função por nome
    const nomes = await pg.query(`select p.proname, count(*)::int as n from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = any($1::text[]) group by 1 order by 1`, [NOMES as readonly string[]])
    expect(nomes.rows).toEqual([...NOMES].sort().map((proname) => ({ proname, n: 1 })))
    // a mesma pergunta feita de dentro de cada papel (é o que o executor consulta)
    const c = await cenario()
    for (const who of ['anon', 'editor', 'leitor'] as const) {
      const dentro = await como(c, who, `select f, has_function_privilege(current_user, f::regprocedure, 'execute') as ok from unnest($1::text[]) as f`, [FUNCOES as readonly string[]])
      expect(dentro.error).toBeNull()
      expect(dentro.data.filter((x) => x.ok !== false).map((x) => x.f), `${who}: funções que o papel consegue executar`).toEqual([])
    }
    // search_path vazio, security invoker (RLS vale para quem chama)
    const cfg = await pg.query(`select f, p.proconfig, p.prosecdef from unnest($1::text[]) as f join pg_proc p on p.oid = f::regprocedure`, [FUNCOES as readonly string[]])
    expect(cfg.rows.filter((x) => !Array.isArray(x.proconfig) || !x.proconfig.includes('search_path=""')).map((x) => x.f)).toEqual([])
    expect(cfg.rows.filter((x) => x.prosecdef !== false).map((x) => x.f), 'security invoker').toEqual([])
  })

  it('o service_role executa de verdade (a única chamada de função deste arquivo), pelo cliente de serviço e pelas funções do TypeScript', async () => {
    const c = await cenario()
    const marcos = COMMENT_RULES.marks.map((m) => ({ mark: m.mark, from_h: m.fromH, until_h: m.untilH }))
    const prova = await lerProva(sb, { siteId: c.siteA, nowIso: iso(NOW), since: null })
    expect(prova).toMatchObject({ ok: true, prova: { comentarios_total: 2, identidades_total: 1, retratos_total: 1 } })
    expect(await lerImpacto(sb, c.siteA, c.canal)).toMatchObject({ comment_snaps: 1, comments: 2, comment_marks: 2, comment_authors: 1 })
    expect((await sb.rpc('competitor_comment_due', { p_now: iso(NOW), p_marks: marcos, p_retry_after: '20 hours', p_limit: 10, p_fast_reasons: [], p_retry_fast: '15 minutes', p_since: null, p_site_id: c.siteB })).data).toEqual([])
    const purga = await sb.rpc('competitor_comment_identity_purge', { p_site_id: c.siteB })
    expect(purga.error).toBeNull()
    expect(purga.data).toEqual({ apagadas: 0, comentarios_carimbados: 0, vencidas_ha_mais_de_1_dia: 0, restantes: 0 })
    // o cliente de serviço lê as quatro tabelas (bypassa o RLS)
    for (const t of TABELAS) {
      const l = await sb.from(t).select('site_id').eq('site_id', c.siteA)
      expect(l.error, t).toBeNull()
      expect((l.data ?? []).length, t).toBeGreaterThanOrEqual(1)
    }
  })

  it('as policies: o retrato é can_view_site; o texto, a leitura e a identidade são can_edit_site (sem a MG11); só SELECT; RLS ligado nas quatro', async () => {
    const rls = await pg.query(`select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = any($1::text[]) order by 1`, [TABELAS as readonly string[]])
    expect(rls.rows).toHaveLength(TABELAS.length)
    expect(rls.rows.filter((r) => r.relrowsecurity !== true).map((r) => r.relname)).toEqual([])
    const pol = await pg.query(`select tablename, policyname, cmd, qual from pg_policies where schemaname = 'public' and tablename = any($1::text[]) order by 1`, [TABELAS as readonly string[]])
    expect(pol.rows.filter((r) => r.cmd !== 'SELECT')).toEqual([])
    expect(pol.rows.map((r) => r.tablename)).toEqual([...TABELAS].sort())
    const por = Object.fromEntries(pol.rows.map((r) => [r.tablename as string, { nome: r.policyname as string, qual: String(r.qual) }]))
    expect(por.competitor_video_comment_snaps!.nome).toBe('competitor_video_comment_snaps_select')
    expect(por.competitor_video_comment_snaps!.qual).toMatch(/can_view_site\(site_id\)/)
    // a identidade é SEMPRE can_edit_site (a MG11 não a troca)
    expect(por.competitor_video_comment_authors!.nome).toBe('competitor_video_comment_authors_select')
    expect(por.competitor_video_comment_authors!.qual).toMatch(/can_edit_site\(site_id\)/)
    // o texto e a leitura: can_edit_site enquanto a MG11 não existe; can_view_private_site depois dela
    const mg11 = (await pg.query(`select to_regprocedure('public.can_view_private_site(uuid)') is not null as existe`)).rows[0].existe as boolean
    const esperada = mg11 ? /can_view_private_site\(site_id\)/ : /can_edit_site\(site_id\)/
    expect(por.competitor_video_comments!.qual).toMatch(esperada)
    expect(por.competitor_video_comment_marks!.qual).toMatch(esperada)
    expect(por.competitor_video_comments!.nome).toBe('competitor_video_comments_select')
    expect(por.competitor_video_comment_marks!.nome).toBe('competitor_video_comment_marks_select')
  })
})
