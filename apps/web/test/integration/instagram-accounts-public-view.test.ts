// @vitest-environment node
/**
 * DB-gated (A3, spec §0 linha A / §4 / §6).
 *
 * Dois vazamentos vivos:
 *  (a) `instagram_accounts_public` sem `security_invoker` + `ALTER DEFAULT
 *      PRIVILEGES … GRANT ALL ON TABLES TO "anon"` (schema.sql:7460) ⇒ a anon
 *      key lê a view de TODOS os sites.
 *  (b) `instagram_accounts_staff_read FOR SELECT TO authenticated`
 *      (20260507190000:98-101) + grant de TABELA herdado (schema.sql:7462) ⇒
 *      qualquer editor lê `access_token` em claro por PostgREST. RLS não filtra
 *      colunas — só derrubando o grant de tabela e re-concedendo a allow-list
 *      o PostgREST devolve 42501.
 *
 * O ratchet triplo do fim do arquivo é o que impede que um `add column` futuro
 * (M1/C1) reabra o buraco ou que um `grant` reabra `anon`.
 *
 * Os dois primeiros ratchets são escritos como REGRA, não como lista fixa de
 * nomes: eles varrem `information_schema.columns` (a lista viva de colunas) e
 * exigem, coluna a coluna, o `has_column_privilege(...)` efetivo. Uma lista
 * hardcoded seria invalidada em silêncio pelo commit que acrescenta 9 colunas
 * à tabela; a regra falha exatamente onde deve falhar.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { Client } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import {
  SUPABASE_URL, ANON_KEY, SERVICE_KEY,
  signUserJwt, seedSite, seedRbacScenario, cleanupRbacScenario, type RbacScenario,
} from '../helpers/db-seed'

const PG_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

/**
 * Colunas que NENHUM papel PostgREST (`authenticated`/`anon`) pode ler.
 * Toda coluna nova entra automaticamente na allow-list de `authenticated`;
 * uma coluna nova que seja segredo tem de ser acrescentada AQUI **e** ficar de
 * fora do `grant select (…)` da migration.
 */
const SECRET_COLUMNS = ['access_token']

/** `anon` recebe exatamente o que o EXISTS das policies *_public_read lê. */
const ANON_ALLOW_LIST = ['id', 'site_id']

/**
 * Piso de sanidade: se a tabela sumisse (ou a query voltasse vazia), os
 * ratchets passariam vacuamente. 17 = as 16 colunas da view + `access_token`
 * na data desta migration; o commit que acrescenta colunas só faz subir.
 */
const MIN_EXPECTED_COLUMNS = 17

interface ColumnPrivilegeRow {
  column_name: string
  authenticated_select: boolean
  anon_select: boolean
}

function clientFor(userId: string): SupabaseClient {
  const { jwt } = signUserJwt(userId)
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  })
}

describe.skipIf(skipIfNoLocalDb())('instagram_accounts column lockdown (A3)', () => {
  let admin: SupabaseClient
  let anon: SupabaseClient
  let pg: Client
  let s: RbacScenario
  let accountId: string

  /**
   * Privilégio EFETIVO de SELECT, coluna a coluna, para os dois papéis.
   * `has_column_privilege` é o único oráculo correto aqui: ele resolve grant de
   * tabela, grant de coluna e herança por role membership de uma vez só —
   * enquanto uma leitura crua de catálogo (`relacl`/`attacl`) confunde
   * "não há grant de coluna" com "não há privilégio".
   */
  async function columnPrivileges(): Promise<ColumnPrivilegeRow[]> {
    const { rows } = await pg.query<ColumnPrivilegeRow>(
      `select
         c.column_name,
         has_column_privilege('authenticated', 'public.instagram_accounts', c.column_name, 'SELECT')
           as authenticated_select,
         has_column_privilege('anon', 'public.instagram_accounts', c.column_name, 'SELECT')
           as anon_select
       from information_schema.columns c
       where c.table_schema = 'public' and c.table_name = 'instagram_accounts'
       order by c.column_name`,
    )
    return rows
  }

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
    anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })
    pg = new Client({ connectionString: PG_URL })
    await pg.connect()
    s = await seedRbacScenario(admin)

    const ins = await admin.from('instagram_accounts').insert({
      site_id: s.siteAId,
      locale: 'pt',
      handle: 'thiago.figueiredo',
      access_token: 'super-secret-token-value',
    }).select('id').single()
    expect(ins.error).toBeNull()
    accountId = (ins.data as { id: string }).id
  })

  afterAll(async () => {
    await admin.from('instagram_accounts').delete().eq('id', accountId)
    await cleanupRbacScenario(admin, s)
    await pg.end()
  })

  // ── View pública ────────────────────────────────────────────────
  it('anon cannot read instagram_accounts_public', async () => {
    const { error } = await anon.from('instagram_accounts_public').select('id').limit(1)
    expect(error).not.toBeNull()
    expect(error!.code).toBe('42501')
  })

  it('authenticated cannot read instagram_accounts_public either', async () => {
    const c = clientFor(s.editorAId)
    const { error } = await c.from('instagram_accounts_public').select('id').limit(1)
    expect(error).not.toBeNull()
    expect(error!.code).toBe('42501')
  })

  it('the service client still reads the view (home feed + /go linktree)', async () => {
    const { data, error } = await admin
      .from('instagram_accounts_public')
      .select('id, handle, site_id')
      .eq('id', accountId)
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  })

  it('the view carries no access_token column', async () => {
    const { rows } = await pg.query<{ column_name: string }>(
      `select column_name from information_schema.columns
        where table_schema = 'public' and table_name = 'instagram_accounts_public'`,
    )
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.map((r) => r.column_name)).not.toContain('access_token')
  })

  it('the view runs with security_invoker', async () => {
    const { rows } = await pg.query<{ opts: string[] | null }>(
      `select c.reloptions as opts from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relname = 'instagram_accounts_public'`,
    )
    expect(rows[0]?.opts ?? []).toContain('security_invoker=true')
  })

  // ── Tabela-base: authenticated ──────────────────────────────────
  it('authenticated with can_edit_site reads the allowed columns', async () => {
    const c = clientFor(s.editorAId)
    const { data, error } = await c
      .from('instagram_accounts').select('id, handle').eq('id', accountId)
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  })

  it('authenticated CANNOT read access_token', async () => {
    const c = clientFor(s.editorAId)
    const { error } = await c.from('instagram_accounts').select('access_token').eq('id', accountId)
    expect(error).not.toBeNull()
    expect(error!.code).toBe('42501')
  })

  it('authenticated select("*") is 42501 (observable API change — deliberate)', async () => {
    // O `select=*` do PostgREST expande para `SELECT *` no banco e bate no grant
    // de coluna. Fixar isto aqui é o que impede que uma feature futura
    // "conserte" o 42501 com um bypass por service client (§1(b)).
    const c = clientFor(s.editorAId)
    const { error } = await c.from('instagram_accounts').select('*').eq('id', accountId)
    expect(error).not.toBeNull()
    expect(error!.code).toBe('42501')
  })

  // ── Tabela-base: anon ───────────────────────────────────────────
  it('anon CANNOT read access_token', async () => {
    const { error } = await anon.from('instagram_accounts').select('access_token').limit(1)
    expect(error).not.toBeNull()
    expect(error!.code).toBe('42501')
  })

  it('anon CANNOT read handle from the base table', async () => {
    const { error } = await anon.from('instagram_accounts').select('handle').limit(1)
    expect(error).not.toBeNull()
    expect(error!.code).toBe('42501')
  })

  it('anon still reads posts through the public policy EXISTS (id, site_id)', async () => {
    // As policies *_public_read dereferenciam só `a.id` e `a.site_id`
    // (20260507190000:111-119 e :139-147) — o EXISTS continua executando.
    const { error } = await anon.from('instagram_posts').select('id').limit(1)
    expect(error).toBeNull()
  })

  it('anon still reads feed slots through the public policy EXISTS', async () => {
    const { error } = await anon.from('instagram_feed_slots').select('id').limit(1)
    expect(error).toBeNull()
  })

  // ── Ratchet triplo ──────────────────────────────────────────────
  it('ratchet (i): authenticated holds SELECT on EVERY column except the secrets', async () => {
    const rows = await columnPrivileges()
    // Sanidade: sem isto o ratchet passaria vacuamente se a query voltasse vazia.
    expect(rows.length).toBeGreaterThanOrEqual(MIN_EXPECTED_COLUMNS)
    expect(rows.map((r) => r.column_name)).toEqual(expect.arrayContaining(SECRET_COLUMNS))

    // REGRA, não lista: um `add column` (M1/C1) sem o `grant select (…)`
    // correspondente derruba este teste; um `grant` do segredo também.
    const actual = Object.fromEntries(rows.map((r) => [r.column_name, r.authenticated_select]))
    const expected = Object.fromEntries(
      rows.map((r) => [r.column_name, !SECRET_COLUMNS.includes(r.column_name)]),
    )
    expect(actual).toEqual(expected)
  })

  it('ratchet (ii): anon holds SELECT on EXACTLY {id, site_id}', async () => {
    const rows = await columnPrivileges()
    expect(rows.length).toBeGreaterThanOrEqual(MIN_EXPECTED_COLUMNS)

    const actual = Object.fromEntries(rows.map((r) => [r.column_name, r.anon_select]))
    const expected = Object.fromEntries(
      rows.map((r) => [r.column_name, ANON_ALLOW_LIST.includes(r.column_name)]),
    )
    expect(actual).toEqual(expected)
    // Redundante de propósito: deixa o diff do failure legível.
    expect(rows.filter((r) => r.anon_select).map((r) => r.column_name)).toEqual(ANON_ALLOW_LIST)
  })

  it('ratchet (iii): neither role holds ANY privilege on the public view', async () => {
    const { rows } = await pg.query<{ grantee: string }>(
      `select distinct grantee from information_schema.role_table_grants
        where table_schema = 'public' and table_name = 'instagram_accounts_public'
          and grantee in ('anon', 'authenticated')`,
    )
    expect(rows).toEqual([])
    // …e o privilégio EFETIVO também não existe (grant direto OU herdado).
    const { rows: eff } = await pg.query<{ a: boolean; b: boolean }>(
      `select has_table_privilege('authenticated', 'public.instagram_accounts_public', 'SELECT') as a,
              has_table_privilege('anon', 'public.instagram_accounts_public', 'SELECT') as b`,
    )
    expect(eff[0]).toEqual({ a: false, b: false })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// M1 (commit C1) — o que a migration instagram_token_health acrescenta ao
// lockdown de A3. Bloco NOVO: o describe de A3 acima continua valendo.
//
// Os dois ratchets de column privileges de A3 NÃO são reescritos nem
// duplicados aqui: eles já são REGRA ("toda coluna menos access_token" para
// authenticated, "exatamente {id, site_id}" para anon) e as 9 colunas de M1
// só passam porque a migration as concede a authenticated e a mais ninguém.
// Uma segunda cópia com lista literal reintroduziria a fragilidade que A3
// evitou de propósito. Este bloco assere só o que M1 cria.
// ─────────────────────────────────────────────────────────────────────────────

describe.skipIf(skipIfNoLocalDb())('M1 (C1) — DML fechado e schema novo', () => {
  const svcC1: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  })
  const PG_URL_C1 =
    process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
  let pgC1: Client
  const siteIdsC1: string[] = []

  beforeAll(async () => {
    pgC1 = new Client({ connectionString: PG_URL_C1 })
    await pgC1.connect()
  })

  afterAll(async () => {
    if (siteIdsC1.length) {
      await svcC1.from('instagram_sync_log').delete().in('site_id', siteIdsC1)
      await svcC1.from('instagram_accounts').delete().in('site_id', siteIdsC1)
      await svcC1.from('sites').delete().in('id', siteIdsC1)
    }
    await pgC1.end()
  })

  // ── DML fechado ───────────────────────────────────────────────────────────

  it('anon and authenticated have no INSERT/UPDATE/DELETE on the three instagram tables', async () => {
    for (const table of [
      'public.instagram_accounts',
      'public.instagram_posts',
      'public.instagram_feed_slots',
    ]) {
      for (const role of ['anon', 'authenticated'] as const) {
        for (const priv of ['INSERT', 'UPDATE', 'DELETE'] as const) {
          const { rows } = await pgC1.query<{ ok: boolean }>(
            `select has_table_privilege($1, $2, $3) as ok`,
            [role, table, priv],
          )
          expect({ table, role, priv, ok: rows[0]?.ok }).toEqual({ table, role, priv, ok: false })
        }
      }
    }
  })

  it('an authenticated client gets 42501 when writing instagram_accounts through PostgREST', async () => {
    // Efeito observável do revoke (e não só o catálogo): antes de M1 a escrita
    // chegava à policy *_staff_write e voltava "0 linhas" sem erro; agora ela
    // bate no grant de tabela — que o Postgres checa ANTES da RLS — e volta
    // 42501 para qualquer portador do papel `authenticated`.
    const { siteId } = await seedSite(svcC1)
    siteIdsC1.push(siteId)
    const ins = await svcC1
      .from('instagram_accounts')
      .insert({ site_id: siteId, locale: 'pt', handle: 'dml.gate' })
      .select('id')
      .single()
    expect(ins.error).toBeNull()

    const c = clientFor('00000000-0000-4000-8000-0000000000c1')
    const { error } = await c
      .from('instagram_accounts')
      .update({ sync_enabled: false })
      .eq('id', (ins.data as { id: string }).id)
    expect(error).not.toBeNull()
    expect(error!.code).toBe('42501')
  })

  it('drops the three *_staff_write policies and keeps the read ones', async () => {
    const { rows } = await pgC1.query<{ policyname: string }>(
      `select policyname from pg_policies
        where schemaname = 'public'
          and tablename in ('instagram_accounts','instagram_posts','instagram_feed_slots')
        order by policyname`,
    )
    expect(rows.map(r => r.policyname)).toEqual([
      'instagram_accounts_staff_read',
      'instagram_feed_slots_public_read',
      'instagram_posts_public_read',
    ])
  })

  // ── instagram_deletion_requests ───────────────────────────────────────────

  it('creates instagram_deletion_requests with RLS on, zero policies and no anon/authenticated access', async () => {
    const { rows: cls } = await pgC1.query<{ relrowsecurity: boolean }>(
      `select relrowsecurity from pg_class where oid = 'public.instagram_deletion_requests'::regclass`,
    )
    expect(cls[0]?.relrowsecurity).toBe(true)

    const { rows: pol } = await pgC1.query(
      `select policyname from pg_policies
        where schemaname = 'public' and tablename = 'instagram_deletion_requests'`,
    )
    expect(pol).toEqual([])

    for (const role of ['anon', 'authenticated'] as const) {
      for (const priv of ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] as const) {
        const { rows } = await pgC1.query<{ ok: boolean }>(
          `select has_table_privilege($1, 'public.instagram_deletion_requests', $2) as ok`,
          [role, priv],
        )
        expect({ role, priv, ok: rows[0]?.ok }).toEqual({ role, priv, ok: false })
      }
    }
  })

  it('enforces a UNIQUE confirmation_code and nulls site_id when the site goes away', async () => {
    const { siteId } = await seedSite(svcC1)
    siteIdsC1.push(siteId)
    const code = `code-${Date.now()}`

    const first = await svcC1.from('instagram_deletion_requests')
      .insert({ confirmation_code: code, ig_user_id: '17841400000000000', site_id: siteId })
      .select('id, requested_at, completed_at')
      .single()
    expect(first.error).toBeNull()
    expect(first.data?.requested_at).toBeTruthy()
    expect(first.data?.completed_at).toBeNull()

    const dup = await svcC1.from('instagram_deletion_requests')
      .insert({ confirmation_code: code, ig_user_id: '17841400000000001', site_id: siteId })
    expect(dup.error?.code).toBe('23505')

    await svcC1.from('sites').delete().eq('id', siteId)
    const { data: after } = await svcC1.from('instagram_deletion_requests')
      .select('site_id').eq('confirmation_code', code).single()
    expect(after?.site_id).toBeNull()   // on delete set null: o registro sobrevive 180 dias

    await svcC1.from('instagram_deletion_requests').delete().eq('confirmation_code', code)
    siteIdsC1.splice(siteIdsC1.indexOf(siteId), 1)
  })

  // ── instagram_sync_log ────────────────────────────────────────────────────

  it('accepts the six sync modes, rejects an unknown one and leaves the status CHECK untouched', async () => {
    const { siteId } = await seedSite(svcC1)
    siteIdsC1.push(siteId)

    for (const mode of [
      'daily', 'manual', 'token_refresh', 'deauthorize', 'data_deletion', 'rebind',
    ]) {
      const res = await svcC1.from('instagram_sync_log')
        .insert({ site_id: siteId, mode, status: 'started' })
      expect({ mode, code: res.error?.code ?? null }).toEqual({ mode, code: null })
    }

    const badMode = await svcC1.from('instagram_sync_log')
      .insert({ site_id: siteId, mode: 'oauth', status: 'started' })
    expect(badMode.error?.code).toBe('23514')

    const badStatus = await svcC1.from('instagram_sync_log')
      .insert({ site_id: siteId, mode: 'daily', status: 'token_invalid' })
    expect(badStatus.error?.code).toBe('23514')
  })

  it('creates idx_instagram_sync_log_account_mode over (account_id, mode, started_at desc)', async () => {
    const { rows } = await pgC1.query<{ indexdef: string }>(
      `select indexdef from pg_indexes
        where schemaname = 'public' and indexname = 'idx_instagram_sync_log_account_mode'`,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.indexdef).toContain('(account_id, mode, started_at DESC)')
  })
})
