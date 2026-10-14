// @vitest-environment node
/**
 * A5 · E17 passo 0 (MG11): o schema do direito "ver desempenho privado", contra o banco local.
 * Cada `it` abre uma transação, aplica a MG11 inteira dentro dela (`garantirMg11`), afirma e DESFAZ: nada fica gravado.
 * Banco: SÓ o `bythiago_int` (fora da CI):
 *   HAS_LOCAL_DB=1 NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421 SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres \
 *   npx vitest run test/integration/observatorio-a5-e17-p0-schema.test.ts --no-file-parallelism
 * Erro 55P03 ou `lock_timeout` = banco ocupado por outro teste: esperar um minuto e repetir (não é falha do schema).
 * Função sem EXECUTE NUNCA é chamada aqui como anon/authenticated (derruba este Postgres): o privilégio vai por `has_function_privilege`.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Client } from 'pg'
import { randomUUID } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { garantirMg11, lerSqlDaMg11 } from '../helpers/mg11'

vi.setConfig({ testTimeout: 60_000 })

const PG_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const DOZE = [
  'yt_own_video_daily', 'yt_own_video_reach_daily', 'yt_own_video_meta_daily', 'yt_own_video_coverage',
  'yt_own_video_retention', 'yt_own_video_dim_daily', 'yt_own_video_traffic_detail_daily', 'yt_own_video_reach_dim_daily',
  'yt_own_video_versions', 'yt_own_versions_state', 'competitor_video_comments', 'competitor_video_comment_marks',
] as const

const FUNCOES_SO_SERVICE_ROLE = [
  'public.is_super_admin_as(uuid)', 'public.is_org_admin_as(uuid, uuid)', 'public.can_view_site_as(uuid, uuid)',
  'public.can_edit_site_as(uuid, uuid)', 'public.can_view_private_site_as(uuid, uuid)',
  'public.obs_ai_rate_hit(uuid, timestamp with time zone)', 'public.tg_site_private_viewers_audit()',
] as const

/** A V1 do plano (seção 2), letra por letra, com os dois acréscimos do controlador de 14/10 no fim (índice com `at` e dois checks de validade). */
const V1 = `select (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity and c.relname in ('site_private_viewers','obs_ai_access_log','obs_ai_rate')) as tabelas_com_rls_de_3, (select count(*) from pg_policies where schemaname='public' and tablename in ('site_private_viewers','obs_ai_access_log','obs_ai_rate')) as policies_de_2, (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('is_super_admin_as','is_org_admin_as','can_view_site_as','can_edit_site_as','can_view_private_site_as','obs_ai_rate_hit') and not has_function_privilege('anon',p.oid,'execute') and not has_function_privilege('authenticated',p.oid,'execute') and has_function_privilege('service_role',p.oid,'execute')) as funcoes_so_service_role_de_6, (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='can_view_private_site' and has_function_privilege('anon',p.oid,'execute') and has_function_privilege('authenticated',p.oid,'execute') and has_function_privilege('service_role',p.oid,'execute')) as funcao_de_sessao_de_1, (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('is_super_admin_as','is_org_admin_as','can_view_site_as','can_edit_site_as','can_view_private_site_as','can_view_private_site','obs_ai_rate_hit','tg_site_private_viewers_audit') and p.proconfig @> array['search_path=""']) as funcoes_com_search_path_vazio_de_8, (select count(*) from information_schema.columns where table_schema='public' and table_name='pipeline_api_keys' and column_name in ('user_id','expires_at')) as colunas_novas_de_2, (select count(*) from pg_constraint where conrelid='public.pipeline_api_keys'::regclass and conname='pipeline_api_keys_observatorio_leitura_sozinha') as check_de_1, (select count(*) from pg_trigger where tgrelid='public.site_private_viewers'::regclass and tgname='audit_site_private_viewers' and not tgisinternal) as gatilho_de_1, (select count(*) from pg_indexes where schemaname='public' and tablename='obs_ai_access_log' and indexname='idx_oaal_at' and indexdef like '%USING btree (at)') as indice_at_de_1, (select count(*) from pg_constraint where conrelid='public.pipeline_api_keys'::regclass and conname in ('pipeline_api_keys_expires_at_finita','pipeline_api_keys_perfil_exige_validade')) as checks_de_validade_de_2`

interface Semente { site: string; siteB: string; usuario: string; outro: string }

describe.skipIf(skipIfNoLocalDb())('A5 E17 passo 0 (MG11): schema do direito, das chaves por pessoa, do registro de acesso e do contador (banco local)', () => {
  let pg: Client

  beforeAll(async () => {
    pg = new Client({ connectionString: PG_URL })
    await pg.connect()
  })
  afterAll(async () => {
    await pg.end()
  })

  /** Abre a transação, roda o corpo e DESFAZ sempre. */
  async function emTransacao<T>(corpo: () => Promise<T>): Promise<T> {
    await pg.query('begin')
    try {
      return await corpo()
    } finally {
      await pg.query('rollback')
    }
  }

  /** Roda um comando num ponto de salvamento e devolve o código SQLSTATE do erro, ou null se passou. */
  async function codigoDoErro(sql: string, params: unknown[] = []): Promise<string | null> {
    await pg.query('savepoint tentativa')
    try {
      await pg.query(sql, params)
      await pg.query('release savepoint tentativa')
      return null
    } catch (e) {
      await pg.query('rollback to savepoint tentativa')
      return (e as { code?: string }).code ?? 'sem-codigo'
    }
  }

  /** Dois sites em duas organizações filhas da raiz (a que houver; cria se não houver) e dois usuários sem papel. Tudo dentro da transação do teste. */
  async function semear(): Promise<Semente> {
    const sufixo = randomUUID().slice(0, 8)
    const raiz = await pg.query<{ id: string }>('select id from public.organizations where parent_org_id is null limit 1')
    let raizId = raiz.rows[0]?.id
    if (!raizId) {
      raizId = randomUUID()
      await pg.query(`insert into public.organizations (id, name, slug, parent_org_id) values ($1, 'Raiz MG11', $2, null)`, [raizId, `mg11-raiz-${sufixo}`])
    }
    const site = randomUUID()
    const siteB = randomUUID()
    for (const [id, rotulo] of [[site, 'a'], [siteB, 'b']] as const) {
      const org = randomUUID()
      await pg.query(`insert into public.organizations (id, name, slug, parent_org_id) values ($1, $2, $3, $4)`, [org, `Org MG11 ${rotulo}`, `mg11-org-${rotulo}-${sufixo}`, raizId])
      await pg.query(
        `insert into public.sites (id, org_id, name, slug, domains, primary_domain) values ($1, $2, $3, $4, $5, $6)`,
        [id, org, `Site MG11 ${rotulo}`, `mg11-site-${rotulo}-${sufixo}`, [`mg11-${rotulo}-${sufixo}.test`], `mg11-${rotulo}-${sufixo}.test`],
      )
    }
    const usuario = randomUUID()
    const outro = randomUUID()
    for (const [id, nome] of [[usuario, 'usuario'], [outro, 'outro']] as const) {
      await pg.query(`insert into auth.users (id, aud, role, email) values ($1, 'authenticated', 'authenticated', $2)`, [id, `${nome}-${sufixo}@mg11.test`])
    }
    return { site, siteB, usuario, outro }
  }

  async function tabelasDaListaQueExistem(): Promise<string[]> {
    const r = await pg.query<{ t: string }>(
      `select t from unnest($1::text[]) as t where to_regclass('public.' || t) is not null order by t`, [DOZE as unknown as string[]],
    )
    return r.rows.map((x) => x.t)
  }

  it('a migration aplica duas vezes seguidas sem erro, nos dois estados (ainda não aplicada e já aplicada)', async () => {
    await emTransacao(async () => {
      const antes = await garantirMg11(pg)
      expect(['ja_aplicada', 'aplicada_na_transacao']).toContain(antes)
      // segundo estado: agora ela JÁ está na transação, e o arquivo roda de novo por cima
      expect(await garantirMg11(pg)).toBe('ja_aplicada')
      await pg.query(lerSqlDaMg11())
    })
  })

  it('V1 dá 3, 2, 6, 1, 8, 2, 1, 1, 1, 2', async () => {
    await emTransacao(async () => {
      await garantirMg11(pg)
      const r = await pg.query(V1)
      expect(Object.values(r.rows[0]).map(Number)).toEqual([3, 2, 6, 1, 8, 2, 1, 1, 1, 2])
    })
  })

  it('as cinco _as, obs_ai_rate_hit e a função do gatilho não são executáveis por anon nem por authenticated (só se confere, nunca se chama)', async () => {
    await emTransacao(async () => {
      await garantirMg11(pg)
      for (const f of FUNCOES_SO_SERVICE_ROLE) {
        const r = await pg.query<{ anon: boolean; auth: boolean }>(
          `select has_function_privilege('anon', $1::regprocedure, 'execute') as anon, has_function_privilege('authenticated', $1::regprocedure, 'execute') as auth`, [f],
        )
        expect(r.rows[0], f).toEqual({ anon: false, auth: false })
      }
      // service_role executa as cinco _as e o contador (a função do gatilho só roda como gatilho)
      for (const f of FUNCOES_SO_SERVICE_ROLE.filter((x) => !x.includes('tg_site_private_viewers_audit'))) {
        const r = await pg.query<{ sr: boolean }>(`select has_function_privilege('service_role', $1::regprocedure, 'execute') as sr`, [f])
        expect(r.rows[0].sr, f).toBe(true)
      }
    })
  })

  it('a função de sessão é executável por anon, authenticated e service_role', async () => {
    await emTransacao(async () => {
      await garantirMg11(pg)
      const r = await pg.query<{ papel: string; ok: boolean }>(
        `select p as papel, has_function_privilege(p, 'public.can_view_private_site(uuid)'::regprocedure, 'execute') as ok from unnest(array['anon','authenticated','service_role']) as p`,
      )
      expect(r.rows.map((x) => [x.papel, x.ok])).toEqual([['anon', true], ['authenticated', true], ['service_role', true]])
    })
  })

  it('as oito funções têm search_path vazio e nenhuma cita app.site_id nem current_setting no corpo', async () => {
    await emTransacao(async () => {
      await garantirMg11(pg)
      const r = await pg.query<{ proname: string; vazio: boolean; cita: boolean }>(
        `select p.proname, coalesce(p.proconfig @> array['search_path=""'], false) as vazio,
                (p.prosrc ilike '%app.site_id%' or p.prosrc ilike '%current_setting%') as cita
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname in ('is_super_admin_as','is_org_admin_as','can_view_site_as','can_edit_site_as','can_view_private_site_as','can_view_private_site','obs_ai_rate_hit','tg_site_private_viewers_audit')
          order by 1`,
      )
      expect(r.rows).toHaveLength(8)
      for (const x of r.rows) {
        expect(x.vazio, `${x.proname}: search_path vazio`).toBe(true)
        expect(x.cita, `${x.proname}: cita o GUC`).toBe(false)
      }
    })
  })

  it('sem as funções de RBAC a migration recusa com a frase "MG11 depende"', async () => {
    await emTransacao(async () => {
      await pg.query('alter function public.can_edit_site(uuid) rename to can_edit_site_x')
      const sql = lerSqlDaMg11()
      const guardas = sql.slice(sql.indexOf('do $$'), sql.indexOf('end $$;') + 'end $$;'.length)
      expect(guardas.startsWith('do $$')).toBe(true)
      await expect(pg.query(guardas)).rejects.toThrow(/MG11 depende/)
    })
  })

  it('policy de outro nome numa das doze faz a migration recusar, e depois do rollback nada mudou', async () => {
    const existentes = await tabelasDaListaQueExistem()
    expect(existentes.length, 'nenhuma tabela da lista das doze existe: banco errado').toBeGreaterThan(0)
    const alvo = existentes[0]
    const fotografia = async () => (await pg.query(`select policyname, qual from pg_policies where schemaname = 'public' and tablename = $1 order by 1`, [alvo])).rows
    const antes = await fotografia()
    await emTransacao(async () => {
      await pg.query(`create policy "intrusa" on public.${alvo} for select using (true)`)
      await expect(pg.query(lerSqlDaMg11())).rejects.toThrow(/tem policy fora do padrão \(intrusa\)/)
    })
    expect(await fotografia()).toEqual(antes)
  })

  it('tabela da lista que não existe é pulada, não é erro (dado ausente)', async () => {
    await emTransacao(async () => {
      let derrubada: string | null = null
      for (const t of await tabelasDaListaQueExistem()) {
        if ((await codigoDoErro(`drop table public.${t}`)) === null) { derrubada = t; break }
      }
      expect(derrubada, 'nenhuma tabela da lista pôde ser derrubada sem dependente').not.toBeNull()
      await pg.query(lerSqlDaMg11())
      const r = await pg.query<{ ausente: boolean }>(`select to_regclass('public.' || $1::text) is null as ausente`, [derrubada])
      expect(r.rows[0].ausente).toBe(true)
    })
  })

  it('usuário nulo, site nulo e site inexistente dão false, nunca nulo', async () => {
    await emTransacao(async () => {
      await garantirMg11(pg)
      const s = await semear()
      const r = await pg.query<{ a: unknown; b: unknown; c: unknown; d: unknown }>(
        `select public.can_view_private_site_as(null, $1::uuid) as a, public.can_view_private_site_as($2::uuid, null) as b,
                public.can_view_private_site_as($2::uuid, gen_random_uuid()) as c, public.can_view_private_site($1::uuid) as d`, [s.site, s.usuario],
      )
      expect(r.rows[0]).toEqual({ a: false, b: false, c: false, d: false })
    })
  })

  it('as colunas novas de pipeline_api_keys são anuláveis e nenhuma linha existente mudou', async () => {
    await emTransacao(async () => {
      const foto = `select count(*)::int as n, md5(coalesce(string_agg((to_jsonb(t) - 'user_id' - 'expires_at')::text, '|' order by t.id), '')) as h from public.pipeline_api_keys t`
      const antes = (await pg.query<{ n: number; h: string }>(foto)).rows[0]
      await garantirMg11(pg)
      const depois = (await pg.query<{ n: number; h: string }>(foto)).rows[0]
      expect(depois).toEqual(antes)
      const colunas = await pg.query<{ column_name: string; is_nullable: string; column_default: string | null }>(
        `select column_name, is_nullable, column_default from information_schema.columns where table_schema = 'public' and table_name = 'pipeline_api_keys' and column_name in ('user_id', 'expires_at') order by 1`,
      )
      expect(colunas.rows).toEqual([
        { column_name: 'expires_at', is_nullable: 'YES', column_default: null },
        { column_name: 'user_id', is_nullable: 'YES', column_default: null },
      ])
      const preenchidas = await pg.query<{ n: number }>('select count(*)::int as n from public.pipeline_api_keys where user_id is not null or expires_at is not null')
      expect(preenchidas.rows[0].n).toBe(0)
    })
  })

  it('o gatilho de rastro dispara em insert e em update de revoked_at, e em mais nada', async () => {
    await emTransacao(async () => {
      await garantirMg11(pg)
      const r = await pg.query<{ def: string }>(
        `select pg_get_triggerdef(oid) as def from pg_trigger where tgrelid = 'public.site_private_viewers'::regclass and tgname = 'audit_site_private_viewers' and not tgisinternal`,
      )
      expect(r.rows).toHaveLength(1)
      expect(r.rows[0].def).toContain('AFTER INSERT OR UPDATE OF revoked_at ON public.site_private_viewers')
      expect(r.rows[0].def).toContain('FOR EACH ROW')
      expect(r.rows[0].def).not.toMatch(/DELETE/)
    })
  })

  it('site_private_viewers tem as seis colunas, com revoked_by anulável e chave para auth.users com on delete set null', async () => {
    await emTransacao(async () => {
      await garantirMg11(pg)
      const cols = await pg.query<{ column_name: string; is_nullable: string }>(
        `select column_name, is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'site_private_viewers' order by ordinal_position`,
      )
      expect(cols.rows.map((c) => c.column_name)).toEqual(['site_id', 'user_id', 'granted_by', 'granted_at', 'revoked_at', 'revoked_by'])
      expect(cols.rows.find((c) => c.column_name === 'revoked_by')?.is_nullable).toBe('YES')
      const fk = await pg.query<{ coluna: string; del: string; alvo: string }>(
        `select a.attname as coluna, c.confdeltype as del, c.confrelid::regclass::text as alvo
           from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
          where c.conrelid = 'public.site_private_viewers'::regclass and c.contype = 'f' order by 1`,
      )
      const por = Object.fromEntries(fk.rows.map((x) => [x.coluna, x]))
      expect(por.granted_by).toMatchObject({ del: 'n', alvo: 'auth.users' })
      expect(por.revoked_by).toMatchObject({ del: 'n', alvo: 'auth.users' }) // confdeltype 'n' = set null
      expect(por.user_id).toMatchObject({ del: 'c', alvo: 'auth.users' })
      expect(por.site_id).toMatchObject({ del: 'c', alvo: 'sites' })
    })
  })

  it('revoked_by numa linha em vigor é recusado (23514); numa linha retirada entra; reconceder, que limpa as duas colunas, passa', async () => {
    await emTransacao(async () => {
      await garantirMg11(pg)
      const s = await semear()
      await pg.query('insert into public.site_private_viewers (site_id, user_id, granted_by) values ($1, $2, $3)', [s.site, s.usuario, s.outro])
      expect(await codigoDoErro('update public.site_private_viewers set revoked_by = granted_by where user_id = $1', [s.usuario])).toBe('23514')
      expect(await codigoDoErro('update public.site_private_viewers set revoked_at = now(), revoked_by = $2 where user_id = $1', [s.usuario, s.outro])).toBeNull()
      expect(await codigoDoErro('update public.site_private_viewers set revoked_at = null, revoked_by = null where user_id = $1', [s.usuario])).toBeNull()
      const r = await pg.query('select revoked_at, revoked_by from public.site_private_viewers where user_id = $1', [s.usuario])
      expect(r.rows[0]).toEqual({ revoked_at: null, revoked_by: null })
    })
  })

  // ── acréscimos do controlador de 14/10 (vêm do degrau 2 da E17) ─────────────────────────────────────────────────────────────
  it('(controlador 14/10) obs_ai_access_log tem índice com at na frente, e o planejador o usa para "a linha mais antiga"', async () => {
    await emTransacao(async () => {
      await garantirMg11(pg)
      const r = await pg.query<{ coluna: string }>(
        `select a.attname as coluna from pg_index i join pg_class c on c.oid = i.indexrelid
           join pg_attribute a on a.attrelid = i.indrelid and a.attnum = i.indkey[0]
          where c.relname = 'idx_oaal_at' and i.indrelid = 'public.obs_ai_access_log'::regclass`,
      )
      expect(r.rows).toEqual([{ coluna: 'at' }])
      await pg.query('set local enable_seqscan = off')
      const plano = await pg.query<{ 'QUERY PLAN': string }>('explain select at from public.obs_ai_access_log order by at asc limit 1')
      expect(plano.rows.map((x) => x['QUERY PLAN']).join('\n')).toContain('idx_oaal_at')
    })
  })

  it('(controlador 14/10) expires_at tem de ser finita: infinity e -infinity são recusados (23514), data finita e nula passam', async () => {
    await emTransacao(async () => {
      await garantirMg11(pg)
      const s = await semear()
      const inserir = (nome: string, validade: string | null) => codigoDoErro(
        `insert into public.pipeline_api_keys (site_id, name, key_hash, permissions, expires_at) values ($1, $2, $3, array['read'], $4)`,
        [s.site, nome, `hash-${nome}`, validade],
      )
      expect(await inserir('infinita', 'infinity')).toBe('23514')
      expect(await inserir('menos-infinita', '-infinity')).toBe('23514')
      expect(await inserir('finita', new Date(Date.now() + 86_400_000).toISOString())).toBeNull()
      expect(await inserir('nula', null)).toBeNull()
      // e o update que a tornaria infinita
      expect(await codigoDoErro(`update public.pipeline_api_keys set expires_at = 'infinity' where name = 'finita'`)).toBe('23514')
    })
  })

  it('(controlador 14/10) a chave do perfil observatorio_leitura exige validade; a chave comum continua entrando sem ela (as de hoje)', async () => {
    await emTransacao(async () => {
      await garantirMg11(pg)
      const s = await semear()
      const amanha = new Date(Date.now() + 86_400_000).toISOString()
      const inserir = (nome: string, permissoes: string[], validade: string | null) => codigoDoErro(
        `insert into public.pipeline_api_keys (site_id, name, key_hash, permissions, expires_at) values ($1, $2, $3, $4::text[], $5)`,
        [s.site, nome, `hash-${nome}`, permissoes, validade],
      )
      expect(await inserir('perfil-sem-validade', ['observatorio_leitura'], null)).toBe('23514')
      expect(await inserir('perfil-com-validade', ['observatorio_leitura'], amanha)).toBeNull()
      expect(await inserir('mista-com-validade', ['observatorio_leitura', 'read'], amanha)).toBe('23514') // a outra trava: perfil não se mistura
      expect(await codigoDoErro(`update public.pipeline_api_keys set expires_at = null where name = 'perfil-com-validade'`)).toBe('23514')
      expect(await inserir('comum-sem-validade', ['read'], null)).toBeNull()
      expect(await inserir('comum-so-write', ['write'], null)).toBeNull()
    })
  })

  it('as chaves ativas de hoje continuam compatíveis com os dois checks novos (nenhuma linha viola)', async () => {
    await emTransacao(async () => {
      await garantirMg11(pg)
      // a migration já falharia se alguma linha existente violasse; aqui se afirma pelo catálogo que os dois estão validados
      const r = await pg.query<{ conname: string; convalidated: boolean }>(
        `select conname, convalidated from pg_constraint where conrelid = 'public.pipeline_api_keys'::regclass and conname in ('pipeline_api_keys_expires_at_finita', 'pipeline_api_keys_perfil_exige_validade') order by 1`,
      )
      expect(r.rows).toEqual([
        { conname: 'pipeline_api_keys_expires_at_finita', convalidated: true },
        { conname: 'pipeline_api_keys_perfil_exige_validade', convalidated: true },
      ])
    })
  })

  it('nenhum teste commitado desta etapa desliga a conferência de forma do auxiliar', () => {
    const pasta = join(__dirname)
    const termo = ['conferir', 'Forma'].join('') // montado, para este arquivo não se achar a si mesmo
    const arquivos = readdirSync(pasta).filter((f) => /^observatorio-a5-e17-p0-.*\.test\.ts$/.test(f))
    expect(arquivos).toContain('observatorio-a5-e17-p0-schema.test.ts')
    for (const f of arquivos) {
      expect(readFileSync(join(pasta, f), 'utf8').includes(termo), f).toBe(false)
    }
  })
})
