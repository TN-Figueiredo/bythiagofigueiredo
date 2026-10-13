// @vitest-environment node
/**
 * A5 · E16 parte 1 e E15 parte 1 (Tarefa 3): RLS e privilégios das nove tabelas e das onze funções, contra Postgres de verdade.
 * Banco: SÓ o `bythiago_int`. Rodar com:
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/observatorio-a5-e16-e15-rls.test.ts --no-file-parallelism
 *
 * REGRA DESTE POSTGRES LOCAL: chamar função sem EXECUTE como anon/authenticated DERRUBA o servidor (SIGSEGV). Aqui as funções
 * são conferidas pelo CATÁLOGO (`has_function_privilege`, `pg_proc`), nunca chamadas. As TABELAS são lidas e escritas como
 * anon/authenticated (devolvem zero linha ou erro de RLS/permissão), com o GUC `app.site_id` FORJADO para o site alheio.
 * Cada teste cria os SEUS dois sites, os seus usuários e as suas linhas; afterAll limpa tudo, inclusive em falha.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { seedSite } from '../helpers/db-seed'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const HORA = 3_600_000
/** Uma hora cheia, 10 dias atrás: nada aqui depende do relógio de parede. */
const P = Math.floor((Date.now() - 10 * 24 * HORA) / HORA) * HORA
const iso = (ms: number): string => new Date(ms).toISOString()

/** As sete tabelas de leitura horária (leitura por `can_view_site`) e as duas da agenda. */
const HORARIAS = [
  'competitor_video_hourly', 'competitor_channel_hour_map', 'competitor_hour_fold_log',
  'yt_own_public_video_hourly', 'yt_own_public_video_early', 'yt_own_public_hour_map', 'yt_own_public_hour_fold_log',
] as const
const AGENDA = ['competitor_agenda_runs', 'competitor_agenda_lease'] as const
const NOVE = [...HORARIAS, ...AGENDA] as const
type Tabela = (typeof NOVE)[number]

/** As oito funções novas e as três recriadas (assinaturas como o banco as registra). */
const FUNCOES = [
  'public.competitor_agenda_lease_take(text, uuid, interval)',
  'public.competitor_agenda_lease_release(text, uuid)',
  'public.competitor_agenda_claim(text, text, smallint, interval, boolean)',
  'public.competitor_agenda_finish(text, text, text, integer, integer, text, integer, jsonb)',
  'public.competitor_agenda_defer(text, text, text)',
  'public.competitor_agenda_exhaust(text, text, smallint, interval)',
  'public.competitor_agenda_state(text[], text[])',
  'public.competitor_hourly_health(uuid, timestamptz, integer, integer)',
  'public.competitor_channel_removal_impact(uuid, uuid)',
  'public.youtube_channel_removal_impact(uuid, uuid)',
  'public.competitor_capture_health(uuid, timestamptz)',
] as const

type Who = 'anon' | 'sem' | 'a' | 'b'
interface Cenario {
  siteA: string; siteB: string
  users: { sem: string; a: string; b: string }
  conc: { canal: string; video: string }
  dono: { canal: string; yt: string; video: string }
  tarefa: string; lease: string
}
interface Resultado { rows: number; data: Record<string, unknown>[]; error: string | null }

describe.skipIf(skipIfNoLocalDb())('A5 E16 e E15 parte 1: RLS e privilégios (banco local, GUC forjado)', () => {
  let pg: Client
  let sb: ReturnType<typeof getSupabaseServiceClient>
  const sites: string[] = []
  const usuarios: string[] = []
  const tarefas: string[] = []
  const leases: string[] = []

  beforeAll(async () => {
    sb = getSupabaseServiceClient()
    pg = new Client({ connectionString: PG_URL }); await pg.connect()
  })
  afterAll(async () => {
    try {
      if (sites.length > 0) {
        for (const t of ['yt_own_public_hour_fold_log', 'yt_own_public_hour_map', 'yt_own_public_video_early', 'yt_own_public_video_hourly', 'youtube_videos', 'youtube_channels']) {
          await pg.query(`delete from public.${t} where site_id = any($1::uuid[])`, [sites])
        }
        await pg.query('delete from public.site_memberships where site_id = any($1::uuid[])', [sites])
        // os vínculos acima geram linhas em audit_log (trigger), e a FK delas impede apagar o site
        await pg.query('delete from public.audit_log where site_id = any($1::uuid[])', [sites])
      }
      if (usuarios.length > 0) await pg.query('delete from auth.users where id = any($1::uuid[])', [usuarios])
      if (sites.length > 0) await pg.query('delete from public.sites where id = any($1::uuid[])', [sites])
      if (tarefas.length > 0) await pg.query('delete from public.competitor_agenda_runs where task = any($1::text[])', [tarefas])
      if (leases.length > 0) await pg.query('delete from public.competitor_agenda_lease where name = any($1::text[])', [leases])
    } finally {
      await pg.end()
    }
  })

  /**
   * O INSERT de uma linha de `tabela` no site A. A `variante` muda só a chave: 0 é a linha semeada pelo cenário,
   * 1 é a tentativa de escrita do teste (que o RLS tem de recusar).
   */
  function inserir(c: Cenario, tabela: Tabela, variante: 0 | 1): [string, unknown[]] {
    const mes = variante === 0 ? '2026-01-01' : '2026-02-01'
    const slot = iso(P - variante * HORA)
    const vetores168 = `array_fill(0::bigint, array[168]), array_fill(0, array[168]), array_fill(0, array[168]), array_fill(0::real, array[168]), array_fill(0::real, array[168]), array_fill(0::real, array[168]), array_fill(0, array[168])`
    switch (tabela) {
      case 'competitor_video_hourly':
        return [`insert into public.competitor_video_hourly (video_id, hour_slot, taken_at, site_id, views) values ($1, $2, $2, $3, 1)`, [c.conc.video, slot, c.siteA]]
      case 'competitor_channel_hour_map':
        return [`insert into public.competitor_channel_hour_map (competitor_channel_id, month, format, phase, site_id, views_sum, likes_sum, comments_sum, views_share, likes_share, comments_share, n_intervals)
                 values ($1, $2, 'longo', 'lancamento', $3, ${vetores168})`, [c.conc.canal, mes, c.siteA]]
      case 'competitor_hour_fold_log':
        return [`insert into public.competitor_hour_fold_log (video_id, day, site_id, intervals_clean, intervals_long) values ($1, $2, $3, 1, 0)`, [c.conc.video, mes, c.siteA]]
      case 'yt_own_public_video_hourly':
        return [`insert into public.yt_own_public_video_hourly (youtube_video_id, hour_slot, taken_at, site_id, video_id, channel_id, views) values ($1, $2, $2, $3, $4, $5, 1)`,
          [c.dono.yt, slot, c.siteA, c.dono.video, c.dono.canal]]
      case 'yt_own_public_video_early':
        return [`insert into public.yt_own_public_video_early (youtube_video_id, taken_at, site_id, video_id, channel_id, views) values ($1, $2, $3, $4, $5, 1)`,
          [c.dono.yt, slot, c.siteA, c.dono.video, c.dono.canal]]
      case 'yt_own_public_hour_map':
        return [`insert into public.yt_own_public_hour_map (channel_id, month, format, phase, site_id, views_sum, likes_sum, comments_sum, views_share, likes_share, comments_share, n_intervals)
                 values ($1, $2, 'longo', 'lancamento', $3, ${vetores168})`, [c.dono.canal, mes, c.siteA]]
      case 'yt_own_public_hour_fold_log':
        return [`insert into public.yt_own_public_hour_fold_log (youtube_video_id, day, site_id, channel_id, intervals_clean, intervals_long) values ($1, $2, $3, $4, 1, 0)`,
          [c.dono.yt, mes, c.siteA, c.dono.canal]]
      case 'competitor_agenda_runs':
        return [`insert into public.competitor_agenda_runs (task, period_key, status) values ($1, $2, 'ok')`, [c.tarefa, 'k' + variante]]
      case 'competitor_agenda_lease':
        return [`insert into public.competitor_agenda_lease (name, holder, expires_at) values ($1, $2, $3)`,
          [variante === 0 ? c.lease : c.lease + '-1', randomUUID(), iso(P)]]
    }
  }
  /** O filtro que acha a linha semeada de cada tabela (e só a ela), com o parâmetro em $1. */
  function filtro(c: Cenario, tabela: Tabela): [string, unknown] {
    if (tabela === 'competitor_agenda_runs') return ['task = $1', c.tarefa]
    if (tabela === 'competitor_agenda_lease') return ['name = $1', c.lease]
    return ['site_id = $1', c.siteA]
  }

  /** Dois sites, três usuários (sem papel, membro de A, membro de B) e uma linha em cada uma das nove tabelas, no site A. */
  async function cenario(): Promise<Cenario> {
    const siteA = (await seedSite(sb)).siteId; sites.push(siteA)
    const siteB = (await seedSite(sb)).siteId; sites.push(siteB)
    const users = { sem: randomUUID(), a: randomUUID(), b: randomUUID() }
    for (const id of Object.values(users)) {
      usuarios.push(id)
      await pg.query(`insert into auth.users (id, aud, role, email) values ($1, 'authenticated', 'authenticated', $2)`, [id, id + '@a5.test'])
    }
    await pg.query(`insert into public.site_memberships (site_id, user_id, role) values ($1, $2, 'editor'), ($3, $4, 'editor')`, [siteA, users.a, siteB, users.b])
    const n = randomUUID().replace(/-/g, '')
    const canal = String((await pg.query(`insert into public.competitor_channels (site_id, channel_id, channel_name) values ($1, $2, 'Teste') returning id`, [siteA, 'UC' + n.slice(0, 20)])).rows[0].id)
    const video = String((await pg.query(`insert into public.competitor_videos (competitor_channel_id, video_id, published_at) values ($1, $2, $3) returning id`, [canal, 'v' + n.slice(0, 10), iso(P - 24 * HORA)])).rows[0].id)
    const yc = String((await pg.query(`insert into public.youtube_channels (site_id, channel_id, locale, handle, name, uploads_playlist_id, slug) values ($1, $2, 'pt', $3, 'T', $4, $5) returning id`,
      [siteA, 'UC' + n.slice(10, 30), '@t' + n.slice(0, 8), 'UU' + n.slice(0, 20), 'teste-' + n.slice(0, 8)])).rows[0].id)
    const yt = 'y' + n.slice(0, 10)
    const yv = String((await pg.query(`insert into public.youtube_videos (site_id, channel_id, youtube_video_id, title, published_at) values ($1, $2, $3, 'T', $4) returning id`, [siteA, yc, yt, iso(P - 24 * HORA)])).rows[0].id)
    const c: Cenario = { siteA, siteB, users, conc: { canal, video }, dono: { canal: yc, yt, video: yv }, tarefa: 'teste-' + randomUUID(), lease: 'teste-' + randomUUID() }
    tarefas.push(c.tarefa); leases.push(c.lease)
    for (const t of NOVE) { const [sql, params] = inserir(c, t, 0); await pg.query(sql, params) }
    return c
  }

  /**
   * Roda `sql` como `who` numa transação desfeita, com o GUC `app.site_id` FORJADO para o site A (o site de que o usuário B
   * NÃO é membro). Devolve linhas ou o erro. Papel `anon`/`authenticated` sem superusuário, como no PostgREST.
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
  const contar = async (c: Cenario, who: Who, tabela: Tabela): Promise<Resultado> => {
    const [onde, param] = filtro(c, tabela)
    return como(c, who, `select 1 from public.${tabela} where ${onde}`, [param])
  }

  it('as sete tabelas de leitura horária: membro do site lê, de fora não lê, mesmo com o GUC forjado', async () => {
    const c = await cenario()
    for (const t of HORARIAS) {
      // controle: a linha existe de verdade (o superusuário a vê), senão "0 linhas" não prova nada
      const [onde, param] = filtro(c, t)
      expect((await pg.query(`select 1 from public.${t} where ${onde}`, [param])).rowCount, `${t}: semente`).toBe(1)
      expect(await contar(c, 'a', t), `${t}: membro de A`).toMatchObject({ rows: 1, error: null })
      // quem é de B, sem papel e anônimo: zero linhas (o anon pode receber "permission denied", que também é "não lê")
      expect((await contar(c, 'b', t)).rows, `${t}: membro de B com GUC forjado para A`).toBe(0)
      expect((await contar(c, 'sem', t)).rows, `${t}: usuário sem papel`).toBe(0)
      expect((await contar(c, 'anon', t)).rows, `${t}: anônimo`).toBe(0)
      expect((await contar(c, 'b', t)).error, `${t}: membro de B sem erro de SQL`).toBeNull()
    }
  })

  it('competitor_agenda_runs: staff lê, anônimo e usuário sem papel não', async () => {
    const c = await cenario()
    // a policy é `is_member_staff()`: papel editor/reporter em QUALQUER site (não é por site)
    expect(await contar(c, 'a', 'competitor_agenda_runs')).toMatchObject({ rows: 1, error: null })
    expect(await contar(c, 'b', 'competitor_agenda_runs')).toMatchObject({ rows: 1, error: null })
    expect((await contar(c, 'sem', 'competitor_agenda_runs')).rows).toBe(0)
    expect((await contar(c, 'anon', 'competitor_agenda_runs')).rows).toBe(0)
  })

  it('competitor_agenda_lease: ninguém lê fora o serviço', async () => {
    const c = await cenario()
    expect((await pg.query('select 1 from public.competitor_agenda_lease where name = $1', [c.lease])).rowCount, 'semente').toBe(1)
    for (const who of ['a', 'b', 'sem', 'anon'] as const) expect((await contar(c, who, 'competitor_agenda_lease')).rows, who).toBe(0)
    // o service_role (o cliente do cron) lê
    const viaServico = await sb.from('competitor_agenda_lease').select('name').eq('name', c.lease)
    expect(viaServico.error).toBeNull()
    expect(viaServico.data).toEqual([{ name: c.lease }])
  })

  it('nenhuma das nove aceita escrita de authenticated', async () => {
    const c = await cenario()
    for (const t of NOVE) {
      for (const who of ['a', 'b', 'sem', 'anon'] as const) {
        const [sql, params] = inserir(c, t, 1)
        const r = await como(c, who, sql, params)
        // não basta "qualquer erro": coluna com nome errado passaria como se fosse RLS
        expect(r.error, `${t}: insert direto de ${who} tinha de falhar por RLS ou por falta de permissão`).toMatch(/row-level security|permission denied/)
      }
    }
    // nem alterar nem apagar a linha existente (sem policy de escrita, o membro nem a enxerga para escrever)
    for (const t of NOVE) {
      const [onde, param] = filtro(c, t)
      const apagar = await como(c, 'a', `delete from public.${t} where ${onde}`, [param])
      expect(apagar.rows, `${t}: delete`).toBe(0)
    }
    const atualizar = await como(c, 'a', `update public.competitor_video_hourly set views = 999 where site_id = $1`, [c.siteA])
    expect(atualizar.rows, 'update de leitura horária').toBe(0)
    // controle: nada do que foi tentado mudou o banco
    for (const t of NOVE) {
      const [onde, param] = filtro(c, t)
      expect((await pg.query(`select 1 from public.${t} where ${onde}`, [param])).rowCount, `${t}: a linha semeada continua, única`).toBe(1)
    }
  })

  it('as nove tabelas têm RLS ligado e só policy de leitura (nenhuma de escrita)', async () => {
    const t = await pg.query(`select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = any($1::text[]) order by 1`, [NOVE as readonly string[]])
    expect(t.rows).toHaveLength(NOVE.length)
    expect(t.rows.filter(r => r.relrowsecurity !== true).map(r => r.relname)).toEqual([])
    const p = await pg.query(`select tablename, cmd from pg_policies where schemaname = 'public' and tablename = any($1::text[]) order by 1`, [NOVE as readonly string[]])
    expect(p.rows.filter(r => r.cmd !== 'SELECT')).toEqual([])
    expect(p.rows.map(r => r.tablename).sort()).toEqual([...HORARIAS, 'competitor_agenda_runs'].sort())   // o arrendamento não tem policy nenhuma
  })

  it('as onze funções: só service_role executa', async () => {
    // NUNCA a chamada: neste Postgres local a chamada negada derruba o servidor. Só o catálogo, e o catálogo com cada papel ativo.
    const r = await pg.query(`select f,
        has_function_privilege('anon', f::regprocedure, 'execute') as anon,
        has_function_privilege('authenticated', f::regprocedure, 'execute') as authenticated,
        has_function_privilege('service_role', f::regprocedure, 'execute') as service_role,
        exists (select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a where p.oid = f::regprocedure and a.grantee = 0) as public_ok
      from unnest($1::text[]) as f`, [FUNCOES as readonly string[]])
    expect(r.rows).toHaveLength(FUNCOES.length)
    expect(r.rows.map(x => [x.f, x.anon, x.authenticated, x.service_role, x.public_ok])).toEqual(FUNCOES.map(f => [f, false, false, true, false]))
    // a mesma pergunta feita de dentro de cada papel (é o que o executor consulta)
    const c = await cenario()
    for (const who of ['anon', 'a'] as const) {
      const dentro = await como(c, who, `select f, has_function_privilege(current_user, f::regprocedure, 'execute') as ok from unnest($1::text[]) as f`, [FUNCOES as readonly string[]])
      expect(dentro.error).toBeNull()
      expect(dentro.data.filter(x => x.ok !== false).map(x => x.f), `${who}: funções que o papel consegue executar`).toEqual([])
    }
    // o service_role executa de verdade (a única chamada deste arquivo): a prova da leitura horária de um site vazio
    const viaServico = await sb.rpc('competitor_hourly_health', { p_site_id: c.siteB, p_now: iso(P), p_age_days: 14, p_cap: 25 })
    expect(viaServico.error).toBeNull()
    expect(viaServico.data).toMatchObject({ videos_cobrados: 0 })
  })

  it('as onze funções têm search_path vazio', async () => {
    const r = await pg.query(`select f, p.proconfig from unnest($1::text[]) as f join pg_proc p on p.oid = f::regprocedure`, [FUNCOES as readonly string[]])
    expect(r.rows).toHaveLength(FUNCOES.length)
    // `set search_path = ''` fica registrado como search_path=""
    expect(r.rows.filter(x => !Array.isArray(x.proconfig) || !x.proconfig.includes('search_path=""')).map(x => x.f)).toEqual([])
  })
})
