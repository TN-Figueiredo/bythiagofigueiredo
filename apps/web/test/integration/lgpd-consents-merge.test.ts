/**
 * DB-gated integration tests for LGPD consent management + anonymous→auth
 * merge flow (Sprint 5a / Track A, migrations 012 + 013 + 007 + 008).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import {
  SUPABASE_URL,
  SERVICE_KEY,
  ANON_KEY,
  seedLgpdScenario,
  cleanupRbacScenario,
  signUserJwt,
} from '../helpers/db-seed'

describe.skipIf(skipIfNoLocalDb())('LGPD consents + merge', () => {
  let admin: SupabaseClient
  let scenario: Awaited<ReturnType<typeof seedLgpdScenario>>

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
    scenario = await seedLgpdScenario(admin)
  })

  afterAll(async () => {
    await cleanupRbacScenario(admin, scenario)
  })

  it('anonymous_id must be UUID v4 (CHECK constraint enforced)', async () => {
    const { error } = await admin.from('consents').insert({
      anonymous_id: 'not-a-uuid',
      category: 'cookie_functional',
      consent_text_id: 'cookie_functional_v1_pt-BR',
      granted: true,
    })
    expect(error).not.toBeNull()
  })

  it('XOR constraint: exactly one of user_id or anonymous_id must be set', async () => {
    const { error: both } = await admin.from('consents').insert({
      user_id: scenario.randomId,
      anonymous_id: randomUUID(),
      category: 'cookie_functional',
      consent_text_id: 'cookie_functional_v1_pt-BR',
      granted: true,
    })
    expect(both).not.toBeNull()

    const { error: neither } = await admin.from('consents').insert({
      category: 'cookie_functional',
      consent_text_id: 'cookie_functional_v1_pt-BR',
      granted: true,
    })
    expect(neither).not.toBeNull()
  })

  it('merge_anonymous_consents transfers rows to authed user', async () => {
    const anonId = randomUUID()
    await admin.from('consents').insert([
      { anonymous_id: anonId, category: 'cookie_functional', consent_text_id: 'cookie_functional_v1_pt-BR', granted: true },
      { anonymous_id: anonId, category: 'cookie_analytics', consent_text_id: 'cookie_analytics_v1_pt-BR', granted: true },
    ])

    const { jwt } = signUserJwt(scenario.randomId)
    const client = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    })
    // Note: merge requires auth.uid() — but randomId is not in auth.users. Use editorAId (exists).
    const { jwt: editorJwt } = signUserJwt(scenario.editorAId)
    const editorClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${editorJwt}` } },
    })
    const { data, error } = await editorClient.rpc('merge_anonymous_consents', { p_anonymous_id: anonId })
    expect(error).toBeNull()
    const parsed = data as { merged_count: number }
    expect(parsed.merged_count).toBe(2)

    const { data: remaining } = await admin.from('consents').select('id').eq('anonymous_id', anonId)
    expect((remaining ?? []).length).toBe(0)

    const { data: merged } = await admin.from('consents').select('id').eq('user_id', scenario.editorAId)
    expect((merged ?? []).length).toBeGreaterThanOrEqual(2)

    await admin.from('consents').delete().eq('user_id', scenario.editorAId)
  })

  it('merge: user consent wins over anon consent for same (category, site_id)', async () => {
    const anonId = randomUUID()
    await admin.from('consents').insert({
      anonymous_id: anonId,
      category: 'cookie_marketing',
      consent_text_id: 'cookie_marketing_v1_pt-BR',
      granted: false, // anon said no
    })
    await admin.from('consents').insert({
      user_id: scenario.reporterAId,
      category: 'cookie_marketing',
      consent_text_id: 'cookie_marketing_v1_pt-BR',
      granted: true, // user said yes
    })

    const { jwt } = signUserJwt(scenario.reporterAId)
    const client = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    })
    await client.rpc('merge_anonymous_consents', { p_anonymous_id: anonId })

    const { data: rows } = await admin
      .from('consents')
      .select('granted')
      .eq('user_id', scenario.reporterAId)
      .eq('category', 'cookie_marketing')
    expect((rows ?? []).length).toBe(1)
    expect((rows ?? [])[0]?.granted).toBe(true) // User consent preserved.

    const { data: anon } = await admin.from('consents').select('id').eq('anonymous_id', anonId)
    expect((anon ?? []).length).toBe(0) // Anon row deleted.

    await admin.from('consents').delete().eq('user_id', scenario.reporterAId)
  })

  it('get_anonymous_consents returns SETOF rows for given anonymous_id', async () => {
    const anonId = randomUUID()
    await admin.from('consents').insert([
      { anonymous_id: anonId, category: 'cookie_functional', consent_text_id: 'cookie_functional_v1_pt-BR', granted: true },
      { anonymous_id: anonId, category: 'cookie_analytics', consent_text_id: 'cookie_analytics_v1_pt-BR', granted: false },
    ])

    const { data, error } = await admin.rpc('get_anonymous_consents', { p_anonymous_id: anonId })
    expect(error).toBeNull()
    expect((data as unknown[] ?? []).length).toBe(2)

    await admin.from('consents').delete().eq('anonymous_id', anonId)
  })

  it('partial unique index blocks duplicate current (category, site_id) per user', async () => {
    const uid = scenario.reporterAId
    const { data: a, error: e1 } = await admin.from('consents').insert({
      user_id: uid,
      category: 'newsletter',
      consent_text_id: 'newsletter_v1_pt-BR',
      granted: true,
    }).select('id').single()
    expect(e1).toBeNull()

    const { error: e2 } = await admin.from('consents').insert({
      user_id: uid,
      category: 'newsletter',
      consent_text_id: 'newsletter_v1_pt-BR',
      granted: false,
    })
    expect(e2).not.toBeNull()

    await admin.from('consents').delete().eq('id', a!.id)
  })

  it('withdrawn_at lets a new consent row supersede the old (idempotent replace)', async () => {
    const uid = scenario.reporterAId
    const { data: a } = await admin.from('consents').insert({
      user_id: uid,
      category: 'cookie_analytics',
      consent_text_id: 'cookie_analytics_v1_pt-BR',
      granted: false,
    }).select('id').single()

    await admin.from('consents').update({ withdrawn_at: new Date().toISOString() }).eq('id', a!.id)

    const { error } = await admin.from('consents').insert({
      user_id: uid,
      category: 'cookie_analytics',
      consent_text_id: 'cookie_analytics_v1_pt-BR',
      granted: true,
    })
    expect(error).toBeNull() // New current consent allowed after old withdrawn.

    await admin.from('consents').delete().eq('user_id', uid).eq('category', 'cookie_analytics')
  })
})
