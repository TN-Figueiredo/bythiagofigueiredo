// @vitest-environment node
/**
 * DB-gated integration tests para M1 (commit C1) — bloco 1:
 * as 9 colunas de saúde do token em public.instagram_accounts e a RPC
 * public.instagram_mark_token_invalid.
 *
 * Rodar com:
 *   npm run db:start && npm run db:reset
 *   cd apps/web && HAS_LOCAL_DB=1 npx vitest run test/integration/instagram-token-rpc.test.ts
 *
 * MUST viver em test/integration/ — a CI seleciona DB-gated por path
 * (.github/workflows/ci.yml:137). Fora daqui o skipIf pula tudo em silêncio.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { Client } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY, seedSite } from '../helpers/db-seed'
import type { InstagramAccountRow, InstagramSyncMode } from '@/lib/instagram/types'

const PG_URL =
  process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const MIGRATIONS_DIR = fileURLToPath(new URL('../../../../supabase/migrations', import.meta.url))

const NEW_COLUMNS = [
  'token_refreshed_at',
  'token_error',
  'token_error_at',
  'token_error_mode',
  'token_alert_sent_at',
  'token_alert_attempt_at',
  'token_reprobe_at',
  'ig_professional_id',
  'ig_user_id_source',
] as const

const RPC_SIG =
  'select * from public.instagram_mark_token_invalid($1::uuid, $2::uuid, $3::text, $4::boolean, $5::boolean, $6::text)'

/** `set search_path = ''` é serializado pelo catálogo como `search_path=""`. */
const EMPTY_SEARCH_PATH = 'search_path=""'

describe.skipIf(skipIfNoLocalDb())('M1 — instagram token health columns + instagram_mark_token_invalid', () => {
  const svc: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  })
  let pg: Client
  const siteIds: string[] = []

  /** Cria um site novo + uma conta de instagram nele. Site novo por conta porque
   *  instagram_accounts tem UNIQUE (site_id, locale). */
  async function freshAccount(handle = 'gate.handle'): Promise<{ siteId: string; accountId: string }> {
    const { siteId } = await seedSite(svc)
    siteIds.push(siteId)
    const { data, error } = await svc
      .from('instagram_accounts')
      .insert({ site_id: siteId, locale: 'pt', handle, access_token: 'plain-token' })
      .select('id')
      .single()
    if (error || !data) throw error ?? new Error('freshAccount: insert failed')
    return { siteId, accountId: data.id as string }
  }

  beforeAll(async () => {
    pg = new Client({ connectionString: PG_URL })
    await pg.connect()
  })

  afterAll(async () => {
    if (siteIds.length) {
      await svc.from('instagram_accounts').delete().in('site_id', siteIds)
      await svc.from('sites').delete().in('id', siteIds)
    }
    await pg.end()
  })

  // ── Colunas ────────────────────────────────────────────────────────────────

  it('adds the 9 token-health columns: 8 nullable + ig_user_id_source NOT NULL DEFAULT legacy', async () => {
    const { rows } = await pg.query<{
      column_name: string
      is_nullable: string
      column_default: string | null
      data_type: string
    }>(
      `select column_name, is_nullable, column_default, data_type
         from information_schema.columns
        where table_schema = 'public' and table_name = 'instagram_accounts'
          and column_name = any($1::text[])
        order by column_name`,
      [[...NEW_COLUMNS]],
    )

    expect(rows.map(r => r.column_name).sort()).toEqual([...NEW_COLUMNS].sort())

    const source = rows.find(r => r.column_name === 'ig_user_id_source')
    expect(source?.is_nullable).toBe('NO')
    expect(source?.column_default ?? '').toContain("'legacy'")
    expect(source?.data_type).toBe('text')

    for (const r of rows.filter(r => r.column_name !== 'ig_user_id_source')) {
      expect(r.is_nullable).toBe('YES')
      expect(r.column_default).toBeNull()
    }
    expect(rows.find(r => r.column_name === 'token_refreshed_at')?.data_type)
      .toBe('timestamp with time zone')
    expect(rows.find(r => r.column_name === 'ig_professional_id')?.data_type).toBe('text')
  })

  it('names both new CHECK constraints (a generated name would break re-runs)', async () => {
    // Nomear é o que torna o `drop constraint if exists … / add constraint …`
    // da migration idempotente: com nome gerado a segunda execução duplicaria
    // a CHECK. O nome é, por isso, parte do contrato — asserido aqui.
    const { rows } = await pg.query<{ conname: string; def: string }>(
      `select conname, pg_get_constraintdef(oid) as def
         from pg_constraint
        where conrelid = 'public.instagram_accounts'::regclass
          and contype = 'c'
          and conname in ('instagram_accounts_token_error_mode_check',
                          'instagram_accounts_ig_user_id_source_check')
        order by conname`,
    )
    expect(rows.map(r => r.conname)).toEqual([
      'instagram_accounts_ig_user_id_source_check',
      'instagram_accounts_token_error_mode_check',
    ])
    expect(rows.find(r => r.conname === 'instagram_accounts_ig_user_id_source_check')?.def)
      .toContain('oauth')
    expect(rows.find(r => r.conname === 'instagram_accounts_token_error_mode_check')?.def)
      .toContain('token_refresh')
  })

  it('defaults ig_user_id_source to legacy on a freshly inserted row', async () => {
    const { accountId } = await freshAccount()
    const { data } = await svc
      .from('instagram_accounts')
      .select('ig_user_id_source, token_error, token_error_at, ig_professional_id')
      .eq('id', accountId)
      .single()
    expect(data?.ig_user_id_source).toBe('legacy')
    expect(data?.token_error).toBeNull()
    expect(data?.token_error_at).toBeNull()
    expect(data?.ig_professional_id).toBeNull()
  })

  it('rejects unknown token_error_mode and unknown ig_user_id_source with 23514', async () => {
    const { accountId } = await freshAccount()
    const badMode = await svc
      .from('instagram_accounts')
      .update({ token_error_mode: 'manual' })
      .eq('id', accountId)
    expect(badMode.error?.code).toBe('23514')

    const badSource = await svc
      .from('instagram_accounts')
      .update({ ig_user_id_source: 'meta' })
      .eq('id', accountId)
    expect(badSource.error?.code).toBe('23514')

    const okMode = await svc
      .from('instagram_accounts')
      .update({ token_error_mode: 'daily' })
      .eq('id', accountId)
    expect(okMode.error).toBeNull()
  })

  it('the handle backfill statement SHIPPED IN THE MIGRATION lowercases and is idempotent', async () => {
    // Executa a sentença extraída do PRÓPRIO arquivo de migration (e não uma
    // cópia digitada aqui): se o backfill for removido da migration, o
    // `expect(statement)` abaixo falha em vez de o teste passar vacuamente.
    const files = readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('_instagram_token_health.sql'))
    expect(files).toHaveLength(1)
    const sql = readFileSync(`${MIGRATIONS_DIR}/${files[0]}`, 'utf8')
    const statement = sql
      .split('\n')
      .find(l => l.trim().startsWith('update public.instagram_accounts set handle = lower(handle)'))
    expect(statement).toBeDefined()

    const { accountId } = await freshAccount()
    await pg.query('update public.instagram_accounts set handle = $1 where id = $2', [
      'MixedCase.Handle',
      accountId,
    ])

    const first = await pg.query(statement as string)
    expect(first.rowCount).toBe(1)

    const second = await pg.query(statement as string)
    expect(second.rowCount).toBe(0)

    const { rows } = await pg.query<{ handle: string }>(
      'select handle from public.instagram_accounts where id = $1',
      [accountId],
    )
    expect(rows[0]?.handle).toBe('mixedcase.handle')
  })

  // ── RPC: ramo 1 (fatal:false) ──────────────────────────────────────────────

  it('fatal:false opens an episode with p_mode, clears the pacemakers and never writes the reason', async () => {
    const { siteId, accountId } = await freshAccount()
    await pg.query(
      `update public.instagram_accounts
          set token_reprobe_at = now(), token_alert_sent_at = now(), token_alert_attempt_at = now()
        where id = $1`,
      [accountId],
    )

    const { data, error } = await svc.rpc('instagram_mark_token_invalid', {
      p_account: accountId,
      p_site: siteId,
      p_reason: 'transient',
      p_fatal: false,
      p_force_reason: false,
      p_mode: 'token_refresh',
    })
    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)
    expect(data).toHaveLength(1)
    // O OUT param é `out_token_error_at`, não `token_error_at`: o nome desambigua
    // a coluna dentro do plpgsql (sem ele, `returning token_error_at` colide com
    // o parâmetro de saída). C2 não lê o valor — `markTokenInvalid` só inspeciona
    // `error` —, mas o contrato de 0-ou-1 linha é o que esta suíte trava.
    expect((data as Array<{ out_token_error_at: string | null }>)[0]?.out_token_error_at)
      .not.toBeNull()

    const { data: row } = await svc
      .from('instagram_accounts')
      .select('token_error, token_error_at, token_error_mode, token_alert_sent_at, token_alert_attempt_at, token_reprobe_at')
      .eq('id', accountId)
      .single()
    expect(row?.token_error).toBeNull()
    expect(row?.token_error_at).not.toBeNull()
    expect(row?.token_error_mode).toBe('token_refresh')
    expect(row?.token_alert_sent_at).toBeNull()
    expect(row?.token_alert_attempt_at).toBeNull()
    expect(row?.token_reprobe_at).toBeNull()
  })

  it('fatal:false is a no-op once the episode is open (guard token_error_at is null)', async () => {
    const { siteId, accountId } = await freshAccount()
    const args = {
      p_account: accountId,
      p_site: siteId,
      p_reason: 'transient',
      p_fatal: false,
      p_force_reason: false,
      p_mode: 'daily',
    }
    const first = await svc.rpc('instagram_mark_token_invalid', args)
    expect(first.data).toHaveLength(1)

    const second = await svc.rpc('instagram_mark_token_invalid', {
      ...args,
      p_mode: 'token_refresh',
    })
    expect(second.error).toBeNull()
    expect(second.data).toHaveLength(0)

    const { data: row } = await svc
      .from('instagram_accounts')
      .select('token_error_mode')
      .eq('id', accountId)
      .single()
    expect(row?.token_error_mode).toBe('daily') // o segundo p_mode NÃO sobrescreve
  })

  // ── RPC: ramo 3 (fatal:true, force:false) ─────────────────────────────────

  it('fatal:true writes the reason, preserves the original token_error_at and re-arms the pacemakers', async () => {
    const { siteId, accountId } = await freshAccount()
    const opened = await svc.rpc('instagram_mark_token_invalid', {
      p_account: accountId, p_site: siteId, p_reason: 'transient',
      p_fatal: false, p_force_reason: false, p_mode: 'daily',
    })
    const openedAt = (opened.data as Array<{ out_token_error_at: string }>)[0]?.out_token_error_at
    expect(openedAt).toBeTruthy()

    await pg.query(
      `update public.instagram_accounts
          set token_alert_sent_at = now(), token_alert_attempt_at = now(), token_reprobe_at = now()
        where id = $1`,
      [accountId],
    )

    const marked = await svc.rpc('instagram_mark_token_invalid', {
      p_account: accountId, p_site: siteId, p_reason: 'decrypt_failed',
      p_fatal: true, p_force_reason: false, p_mode: null,
    })
    expect(marked.error).toBeNull()
    expect(marked.data).toHaveLength(1)

    const { data: row } = await svc
      .from('instagram_accounts')
      .select('token_error, token_error_at, token_alert_sent_at, token_alert_attempt_at, token_reprobe_at')
      .eq('id', accountId)
      .single()
    expect(row?.token_error).toBe('decrypt_failed')
    expect(new Date(row!.token_error_at as string).toISOString())
      .toBe(new Date(openedAt as string).toISOString()) // coalesce preservou
    expect(row?.token_alert_sent_at).toBeNull()
    expect(row?.token_alert_attempt_at).toBeNull()
    expect(row?.token_reprobe_at).toBeNull()
  })

  it('fatal:true without force does NOT overwrite an existing reason', async () => {
    const { siteId, accountId } = await freshAccount()
    await svc.rpc('instagram_mark_token_invalid', {
      p_account: accountId, p_site: siteId, p_reason: 'expired',
      p_fatal: true, p_force_reason: false, p_mode: null,
    })
    const second = await svc.rpc('instagram_mark_token_invalid', {
      p_account: accountId, p_site: siteId, p_reason: 'deauthorized',
      p_fatal: true, p_force_reason: false, p_mode: null,
    })
    expect(second.data).toHaveLength(0)

    const { data: row } = await svc
      .from('instagram_accounts').select('token_error').eq('id', accountId).single()
    expect(row?.token_error).toBe('expired')
  })

  // ── RPC: ramo 2 (force_reason:true) ───────────────────────────────────────

  it('force_reason:true overwrites a DISTINCT reason and re-arms; the same reason is a no-op', async () => {
    const { siteId, accountId } = await freshAccount()
    await svc.rpc('instagram_mark_token_invalid', {
      p_account: accountId, p_site: siteId, p_reason: 'expired',
      p_fatal: true, p_force_reason: false, p_mode: null,
    })
    await pg.query(
      `update public.instagram_accounts
          set token_alert_sent_at = now(), token_alert_attempt_at = now(), token_reprobe_at = now()
        where id = $1`,
      [accountId],
    )

    const forced = await svc.rpc('instagram_mark_token_invalid', {
      p_account: accountId, p_site: siteId, p_reason: 'deauthorized',
      p_fatal: true, p_force_reason: true, p_mode: null,
    })
    expect(forced.data).toHaveLength(1)

    const { data: row } = await svc
      .from('instagram_accounts')
      .select('token_error, token_alert_sent_at, token_alert_attempt_at, token_reprobe_at')
      .eq('id', accountId)
      .single()
    expect(row?.token_error).toBe('deauthorized')
    expect(row?.token_alert_sent_at).toBeNull()
    expect(row?.token_alert_attempt_at).toBeNull()
    expect(row?.token_reprobe_at).toBeNull()

    const again = await svc.rpc('instagram_mark_token_invalid', {
      p_account: accountId, p_site: siteId, p_reason: 'deauthorized',
      p_fatal: true, p_force_reason: true, p_mode: null,
    })
    expect(again.data).toHaveLength(0) // `is distinct from left(p_reason,500)`
  })

  it('truncates p_reason to 500 characters', async () => {
    const { siteId, accountId } = await freshAccount()
    const long = 'x'.repeat(600)
    await svc.rpc('instagram_mark_token_invalid', {
      p_account: accountId, p_site: siteId, p_reason: long,
      p_fatal: true, p_force_reason: false, p_mode: null,
    })
    const { rows } = await pg.query<{ len: number }>(
      'select length(token_error) as len from public.instagram_accounts where id = $1',
      [accountId],
    )
    expect(rows[0]?.len).toBe(500)
  })

  it('is scoped by p_site: a wrong site matches 0 rows and writes nothing', async () => {
    const { accountId } = await freshAccount()
    const { siteId: otherSiteId } = await seedSite(svc)
    siteIds.push(otherSiteId)

    const res = await svc.rpc('instagram_mark_token_invalid', {
      p_account: accountId, p_site: otherSiteId, p_reason: 'expired',
      p_fatal: true, p_force_reason: false, p_mode: null,
    })
    expect(res.error).toBeNull()
    expect(res.data).toHaveLength(0)

    const { data: row } = await svc
      .from('instagram_accounts').select('token_error, token_error_at').eq('id', accountId).single()
    expect(row?.token_error).toBeNull()
    expect(row?.token_error_at).toBeNull()
  })

  it('under concurrency exactly one of two sessions opens the episode', async () => {
    const { siteId, accountId } = await freshAccount()
    const c1 = new Client({ connectionString: PG_URL })
    const c2 = new Client({ connectionString: PG_URL })
    await c1.connect()
    await c2.connect()
    try {
      const params = [accountId, siteId, 'transient', false, false, 'daily']
      const [a, b] = await Promise.all([c1.query(RPC_SIG, params), c2.query(RPC_SIG, params)])
      expect((a.rowCount ?? 0) + (b.rowCount ?? 0)).toBe(1)
    } finally {
      await c1.end()
      await c2.end()
    }
  })

  // ── Segurança da função ───────────────────────────────────────────────────

  it('is SECURITY DEFINER with an empty search_path', async () => {
    const { rows } = await pg.query<{ prosecdef: boolean; proconfig: string[] | null }>(
      `select p.prosecdef, p.proconfig
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'instagram_mark_token_invalid'`,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.prosecdef).toBe(true)
    // proconfig chega como text[]; `toContain` num array compara ELEMENTOS —
    // por isso o elemento inteiro, e não o prefixo `search_path=`.
    expect(rows[0]?.proconfig ?? []).toContain(EMPTY_SEARCH_PATH)
  })

  it('denies EXECUTE to anon and authenticated and allows service_role', async () => {
    // NÃO se chama a função como anon/authenticated aqui: o PostgreSQL 17.6 da
    // imagem local do Supabase CLI 2.98.2 SEGFAULTA ao montar a mensagem de
    // "permission denied for function" (hint do supautils) e derruba o cluster
    // inteiro — reproduzível com `set role anon; select public.<qualquer função
    // negada>(…)`, inclusive em funções pré-existentes como
    // purge_used_dsar_tokens. has_function_privilege é o mesmo oráculo EFETIVO
    // que o ratchet de A3 usa para colunas: resolve grant direto, PUBLIC e
    // herança de papel — e falha se a migration esquecer o revoke/grant.
    const { rows } = await pg.query<{ role: string; allowed: boolean }>(
      `select r.rolname as role, has_function_privilege(r.rolname, $1, 'EXECUTE') as allowed
         from pg_roles r where r.rolname = any($2::text[]) order by r.rolname`,
      [
        'public.instagram_mark_token_invalid(uuid,uuid,text,boolean,boolean,text)',
        ['anon', 'authenticated', 'service_role'],
      ],
    )
    expect(rows).toEqual([
      { role: 'anon', allowed: false },
      { role: 'authenticated', allowed: false },
      { role: 'service_role', allowed: true },
    ])

    // O caminho permitido é exercido de verdade (e não só lido do catálogo).
    const { siteId, accountId } = await freshAccount()
    const c = new Client({ connectionString: PG_URL })
    await c.connect()
    try {
      await c.query('set role service_role')
      const res = await c.query(RPC_SIG, [accountId, siteId, 'expired', true, false, null])
      expect(res.rowCount).toBe(1)
    } finally {
      await c.end()
    }
  })

  // ── Schema ↔ tipo (Task 5) ────────────────────────────────────────────────

  it('every M1 column is readable through the InstagramAccountRow shape C2 will consume', async () => {
    const { siteId, accountId } = await freshAccount()
    await svc.rpc('instagram_mark_token_invalid', {
      p_account: accountId, p_site: siteId, p_reason: 'expired',
      p_fatal: true, p_force_reason: false, p_mode: null,
    })
    await pg.query(
      `update public.instagram_accounts
          set token_refreshed_at = now(), token_reprobe_at = now(),
              ig_professional_id = '17841400000000000', ig_user_id_source = 'oauth'
        where id = $1`,
      [accountId],
    )

    const { data, error } = await svc
      .from('instagram_accounts').select('*').eq('id', accountId).single()
    expect(error).toBeNull()

    const row = data as unknown as InstagramAccountRow
    expect(row.token_error).toBe('expired')
    expect(row.token_error_at).not.toBeNull()
    expect(row.token_refreshed_at).not.toBeNull()
    expect(row.token_reprobe_at).not.toBeNull()
    expect(row.token_alert_sent_at).toBeNull()
    expect(row.token_alert_attempt_at).toBeNull()
    expect(row.token_error_mode).toBeNull()
    expect(row.ig_professional_id).toBe('17841400000000000')
    expect(row.ig_user_id_source).toBe('oauth')
  })

  it('InstagramSyncMode enumerates exactly the values of instagram_sync_log_mode_check', async () => {
    // Amarra o tipo TS ao CHECK do banco: a lista abaixo é o tipo (qualquer
    // valor a mais/ a menos não compila em C2), e a comparação é contra a
    // definição viva da constraint — um `mode` novo no banco sem atualizar o
    // tipo (ou vice-versa) derruba este teste.
    const modes: InstagramSyncMode[] = [
      'daily', 'manual', 'token_refresh', 'deauthorize', 'data_deletion', 'rebind',
    ]
    const { rows } = await pg.query<{ def: string }>(
      `select pg_get_constraintdef(oid) as def from pg_constraint
        where conrelid = 'public.instagram_sync_log'::regclass
          and conname = 'instagram_sync_log_mode_check'`,
    )
    expect(rows).toHaveLength(1)
    const fromDb = [...(rows[0]?.def ?? '').matchAll(/'([a-z_]+)'::text/g)].map(m => m[1])
    expect([...fromDb].sort()).toEqual([...modes].sort())
  })
})
