// @vitest-environment node
/**
 * DB-gated integration tests para M1 (commit C1) — bloco 2:
 * public.ops_alert_state / public.ops_alert_claim (rate limiter, comparação
 * estrita), a CHECK de consents com social_feed_read, o seed de consent_texts e
 * a coexistência das duas UNIQUE de instagram_posts até C4.
 *
 * Rodar com:
 *   npm run db:start && npm run db:reset
 *   cd apps/web && HAS_LOCAL_DB=1 npx vitest run test/integration/ops-alert-claim.test.ts
 *
 * MUST viver em test/integration/ (a CI seleciona DB-gated por path).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { Client, Pool } from 'pg'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY, seedSite } from '../helpers/db-seed'

const PG_URL =
  process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

/** anonymous_id MUST casar consents_anonymous_id_check (uuid v4). */
const ANON_UUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'

/** `set search_path = ''` é serializado pelo catálogo como `search_path=""`. */
const EMPTY_SEARCH_PATH = 'search_path=""'

describe.skipIf(skipIfNoLocalDb())('M1 — ops_alert_claim, consents e as uniques de instagram_posts', () => {
  const svc: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  })
  let pg: Client
  const keys: string[] = []
  const siteIds: string[] = []
  const accountIds: string[] = []
  const consentIds: string[] = []

  function freshKey(label: string): string {
    const key = `test:${label}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`
    keys.push(key)
    return key
  }

  beforeAll(async () => {
    pg = new Client({ connectionString: PG_URL })
    await pg.connect()
  })

  afterAll(async () => {
    if (keys.length) await svc.from('ops_alert_state').delete().in('key', keys)
    if (consentIds.length) await svc.from('consents').delete().in('id', consentIds)
    if (siteIds.length) {
      await svc.from('instagram_posts').delete().in('account_id', accountIds)
      await svc.from('instagram_accounts').delete().in('site_id', siteIds)
      await svc.from('sites').delete().in('id', siteIds)
    }
    await pg.end()
  })

  async function freshAccount(locale: 'pt' | 'en' = 'pt'): Promise<string> {
    const { siteId } = await seedSite(svc)
    siteIds.push(siteId)
    const { data, error } = await svc
      .from('instagram_accounts')
      .insert({ site_id: siteId, locale, handle: 'ops.gate' })
      .select('id')
      .single()
    if (error || !data) throw error ?? new Error('freshAccount: insert failed')
    accountIds.push(data.id as string)
    return data.id as string
  }

  // ── Tabela ────────────────────────────────────────────────────────────────

  it('ops_alert_state has RLS enabled and ZERO policies (service_role only)', async () => {
    const { rows: cls } = await pg.query<{ relrowsecurity: boolean }>(
      `select relrowsecurity from pg_class
        where oid = 'public.ops_alert_state'::regclass`,
    )
    expect(cls[0]?.relrowsecurity).toBe(true)

    const { rows: pol } = await pg.query(
      `select policyname from pg_policies
        where schemaname = 'public' and tablename = 'ops_alert_state'`,
    )
    expect(pol).toEqual([])
  })

  it('denies anon and authenticated every privilege on ops_alert_state', async () => {
    for (const role of ['anon', 'authenticated'] as const) {
      for (const priv of ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] as const) {
        const { rows } = await pg.query<{ ok: boolean }>(
          `select has_table_privilege($1, 'public.ops_alert_state', $2) as ok`,
          [role, priv],
        )
        expect({ role, priv, ok: rows[0]?.ok }).toEqual({ role, priv, ok: false })
      }
    }
  })

  // ── ops_alert_claim ───────────────────────────────────────────────────────

  it('50 concurrent claims on a fresh key produce exactly ONE true', async () => {
    const key = freshKey('concurrency')
    const pool = new Pool({ connectionString: PG_URL, max: 50 })
    try {
      const results = await Promise.all(
        Array.from({ length: 50 }, () =>
          pool.query<{ claimed: boolean }>(
            `select public.ops_alert_claim($1, interval '1 day') as claimed`,
            [key],
          ),
        ),
      )
      expect(results).toHaveLength(50)
      expect(results.filter(r => r.rows[0]?.claimed === true)).toHaveLength(1)
      expect(results.filter(r => r.rows[0]?.claimed === false)).toHaveLength(49)
    } finally {
      await pool.end()
    }
  })

  it('claims again after 25h with the default 1 day interval (via PostgREST/service_role)', async () => {
    const key = freshKey('default-interval')
    const first = await svc.rpc('ops_alert_claim', { p_key: key })
    expect(first.error).toBeNull()
    expect(first.data).toBe(true)

    const second = await svc.rpc('ops_alert_claim', { p_key: key })
    expect(second.data).toBe(false)

    await pg.query(
      `update public.ops_alert_state set last_at = now() - interval '25 hours' where key = $1`,
      [key],
    )
    const third = await svc.rpc('ops_alert_claim', { p_key: key })
    expect(third.data).toBe(true)
  })

  it("a '23 hours' key fires on a daily cron (24h ago ⇒ true, 22h ago ⇒ false)", async () => {
    const key = freshKey('daily-23h')
    expect((await svc.rpc('ops_alert_claim', { p_key: key, p_min_interval: '23:00:00' })).data)
      .toBe(true)

    await pg.query(
      `update public.ops_alert_state set last_at = now() - interval '24 hours' where key = $1`,
      [key],
    )
    expect((await svc.rpc('ops_alert_claim', { p_key: key, p_min_interval: '23:00:00' })).data)
      .toBe(true)

    await pg.query(
      `update public.ops_alert_state set last_at = now() - interval '22 hours' where key = $1`,
      [key],
    )
    expect((await svc.rpc('ops_alert_claim', { p_key: key, p_min_interval: '23:00:00' })).data)
      .toBe(false)
  })

  it('uses a STRICT `<`: last_at exactly now() - p_min_interval does NOT claim', async () => {
    // Numa única transação now() é congelado, então last_at fica EXATAMENTE em
    // now() - 23h e a comparação estrita é o que decide.
    const key = freshKey('strict')
    const c = new Client({ connectionString: PG_URL })
    await c.connect()
    try {
      await c.query('begin')
      await c.query(
        `insert into public.ops_alert_state (key, last_at)
         values ($1, now() - interval '23 hours')
         on conflict (key) do update set last_at = excluded.last_at`,
        [key],
      )
      const res = await c.query<{ claimed: boolean }>(
        `select public.ops_alert_claim($1, interval '23 hours') as claimed`,
        [key],
      )
      expect(res.rows[0]?.claimed).toBe(false)
      await c.query('rollback')
    } finally {
      await c.end()
    }
  })

  it("interval '0' always claims BETWEEN transactions but never twice INSIDE one", async () => {
    const keyAuto = freshKey('zero-autocommit')
    const c = new Client({ connectionString: PG_URL })
    await c.connect()
    try {
      // autocommit: cada statement é sua própria transação ⇒ now() avança
      const a = await c.query<{ claimed: boolean }>(
        `select public.ops_alert_claim($1, interval '0') as claimed`, [keyAuto])
      const b = await c.query<{ claimed: boolean }>(
        `select public.ops_alert_claim($1, interval '0') as claimed`, [keyAuto])
      expect(a.rows[0]?.claimed).toBe(true)
      expect(b.rows[0]?.claimed).toBe(true)

      // dentro de UMA transação now() é congelado ⇒ o segundo claim é false
      const keyTx = freshKey('zero-in-tx')
      await c.query('begin')
      const c1 = await c.query<{ claimed: boolean }>(
        `select public.ops_alert_claim($1, interval '0') as claimed`, [keyTx])
      const c2 = await c.query<{ claimed: boolean }>(
        `select public.ops_alert_claim($1, interval '0') as claimed`, [keyTx])
      expect(c1.rows[0]?.claimed).toBe(true)
      expect(c2.rows[0]?.claimed).toBe(false)
      await c.query('commit')
    } finally {
      await c.end()
    }
  })

  it('exposes read and release as plain select/delete for the service client', async () => {
    const key = freshKey('read-release')
    await svc.rpc('ops_alert_claim', { p_key: key })

    const { data: rows, error } = await svc
      .from('ops_alert_state').select('key, last_at').eq('key', key)
    expect(error).toBeNull()
    expect(rows).toHaveLength(1)
    expect(rows?.[0]?.last_at).toBeTruthy()

    const del = await svc.from('ops_alert_state').delete().eq('key', key)
    expect(del.error).toBeNull()

    const { data: after } = await svc.from('ops_alert_state').select('key').eq('key', key)
    expect(after).toHaveLength(0)

    // liberado ⇒ o próximo claim volta a ser o primeiro do episódio
    expect((await svc.rpc('ops_alert_claim', { p_key: key })).data).toBe(true)
  })

  it('is SECURITY DEFINER with empty search_path and denies EXECUTE to anon/authenticated', async () => {
    const { rows } = await pg.query<{ prosecdef: boolean; proconfig: string[] | null }>(
      `select p.prosecdef, p.proconfig
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'ops_alert_claim'`,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.prosecdef).toBe(true)
    // proconfig chega como text[]; `toContain` num array compara ELEMENTOS.
    expect(rows[0]?.proconfig ?? []).toContain(EMPTY_SEARCH_PATH)

    // Privilégio EFETIVO por catálogo, e não uma chamada como anon: o
    // PostgreSQL 17.6 da imagem local do Supabase CLI 2.98.2 SEGFAULTA ao
    // montar o erro "permission denied for function" (hint do supautils) e
    // derruba o cluster inteiro (ver instagram-token-rpc.test.ts).
    const { rows: priv } = await pg.query<{ role: string; allowed: boolean }>(
      `select r.rolname as role,
              has_function_privilege(r.rolname, 'public.ops_alert_claim(text,interval)', 'EXECUTE')
                as allowed
         from pg_roles r where r.rolname = any($1::text[]) order by r.rolname`,
      [['anon', 'authenticated', 'service_role']],
    )
    expect(priv).toEqual([
      { role: 'anon', allowed: false },
      { role: 'authenticated', allowed: false },
      { role: 'service_role', allowed: true },
    ])
  })

  // ── consents / consent_texts ──────────────────────────────────────────────

  it('seeds exactly two consent_texts rows for social_feed_read (pt-BR + en, v1.0)', async () => {
    const { data, error } = await svc
      .from('consent_texts')
      .select('id, locale, version, text_md, superseded_at')
      .eq('category', 'social_feed_read')
      .order('id')
    expect(error).toBeNull()
    expect(data).toHaveLength(2)
    expect(data?.map(r => r.id)).toEqual(['social_feed_read_v1_en', 'social_feed_read_v1_pt-BR'])
    expect(data?.map(r => r.locale)).toEqual(['en', 'pt-BR'])
    expect(data?.every(r => r.version === '1.0')).toBe(true)
    expect(data?.every(r => r.superseded_at === null)).toBe(true)

    const pt = data?.find(r => r.id === 'social_feed_read_v1_pt-BR')
    expect(pt?.text_md).toContain('Meta Platforms, Inc.')
    expect(pt?.text_md).toContain('cláusulas contratuais-padrão')
    expect(pt?.text_md).toContain('180 dias')
    expect(pt?.text_md).toContain('*Disconnect*')

    const en = data?.find(r => r.id === 'social_feed_read_v1_en')
    expect(en?.text_md).toContain('Meta Platforms, Inc.')
    expect(en?.text_md).toContain('standard contractual clauses')
    expect(en?.text_md).toContain('180 days')
    expect(en?.text_md).toContain('*Disconnect*')
  })

  it('accepts a consents row with category social_feed_read and keeps the older categories', async () => {
    const ok = await svc
      .from('consents')
      .insert({
        anonymous_id: ANON_UUID,
        category: 'social_feed_read',
        consent_text_id: 'social_feed_read_v1_pt-BR',
        granted: true,
      })
      .select('id')
      .single()
    expect(ok.error).toBeNull()
    if (ok.data) consentIds.push(ok.data.id as string)

    // a DDL reescreve a CHECK inteira — este é o ratchet contra perder um valor
    const legacy = await svc
      .from('consents')
      .insert({
        anonymous_id: ANON_UUID,
        category: 'social_integration',
        consent_text_id: 'social_integration_v1_pt-BR',
        granted: true,
      })
      .select('id')
      .single()
    expect(legacy.error).toBeNull()
    if (legacy.data) consentIds.push(legacy.data.id as string)

    const bad = await svc.from('consents').insert({
      anonymous_id: ANON_UUID,
      category: 'instagram_feed',
      consent_text_id: 'social_feed_read_v1_pt-BR',
      granted: true,
    })
    expect(bad.error?.code).toBe('23514')
  })

  it('keeps every consent category the CHECK had before M1 (the DDL rewrites it whole)', async () => {
    // A migration reescreve consents_category_check inteira: se um valor antigo
    // cair fora do array, escrita legítima de outro módulo quebra em produção.
    const { rows } = await pg.query<{ def: string }>(
      `select pg_get_constraintdef(oid) as def from pg_constraint
        where conrelid = 'public.consents'::regclass and conname = 'consents_category_check'`,
    )
    expect(rows).toHaveLength(1)
    const values = [...(rows[0]?.def ?? '').matchAll(/'([a-z_]+)'::text/g)].map(m => m[1]).sort()
    expect(values).toEqual([
      'cookie_analytics', 'cookie_functional', 'cookie_marketing',
      'newsletter', 'newsletter_analytics', 'notification_email', 'notification_push',
      'privacy_policy', 'social_feed_read', 'social_integration', 'terms_of_service',
    ])
  })

  // ── instagram_posts: as duas uniques coexistem até C4 ─────────────────────

  it('keeps BOTH unique constraints on instagram_posts after M1 (C4/M2 drops the global one)', async () => {
    const { rows } = await pg.query<{ conname: string }>(
      `select conname from pg_constraint
        where conrelid = 'public.instagram_posts'::regclass and contype = 'u'
        order by conname`,
    )
    expect(rows.map(r => r.conname)).toEqual([
      'instagram_posts_account_media_key',
      'instagram_posts_ig_media_id_key',
    ])
  })

  it('the composite key allows a second row on the SAME account only for a new ig_media_id, and the global key still blocks two accounts sharing one ig_media_id (until C4)', async () => {
    const accountA = await freshAccount('pt')
    const accountB = await freshAccount('pt')
    const mediaId = `m-${Date.now()}`
    const base = {
      media_type: 'IMAGE' as const,
      permalink: 'https://instagram.com/p/x',
      ig_timestamp: new Date().toISOString(),
    }

    const first = await svc.from('instagram_posts')
      .insert({ ...base, account_id: accountA, ig_media_id: mediaId })
    expect(first.error).toBeNull()

    const sameAccountSameMedia = await svc.from('instagram_posts')
      .insert({ ...base, account_id: accountA, ig_media_id: mediaId })
    expect(sameAccountSameMedia.error?.code).toBe('23505')

    const sameAccountNewMedia = await svc.from('instagram_posts')
      .insert({ ...base, account_id: accountA, ig_media_id: `${mediaId}-b` })
    expect(sameAccountNewMedia.error).toBeNull()

    // C4 (M2) derruba instagram_posts_ig_media_id_key e ESTA asserção vira `toBeNull()`.
    const crossAccount = await svc.from('instagram_posts')
      .insert({ ...base, account_id: accountB, ig_media_id: mediaId })
    expect(crossAccount.error?.code).toBe('23505')
  })
})
