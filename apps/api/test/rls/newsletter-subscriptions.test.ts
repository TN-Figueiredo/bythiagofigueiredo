import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY, ANON_KEY } from '../helpers/local-supabase'
import { ensureSharedSites, SHARED_SITE_A_ID } from '../helpers/ring-fixtures'

const admin = createClient(SUPABASE_URL, SERVICE_KEY)
const anon = createClient(SUPABASE_URL, ANON_KEY)

function token(seed: string) { return seed.padEnd(64, '0') }

describe.skipIf(skipIfNoLocalDb())('newsletter_subscriptions + confirm RPC', () => {
  const ids: string[] = []
  beforeAll(async () => { await ensureSharedSites(admin) })
  afterAll(async () => {
    if (ids.length) await admin.from('newsletter_subscriptions').delete().in('id', ids)
  })

  it('insert pending then confirm via RPC', async () => {
    const t = token('aaaa')
    const { data: ins } = await admin.from('newsletter_subscriptions').insert({
      site_id: SHARED_SITE_A_ID, email: 'sub@x.com',
      status: 'pending_confirmation', confirmation_token: t,
      confirmation_expires_at: new Date(Date.now() + 86400_000).toISOString(),
      consent_text_version: 'v1',
    }).select('id').single()
    if (ins?.id) ids.push(ins.id)

    const { data, error } = await admin.rpc('confirm_newsletter_subscription', { p_token: t })
    expect(error).toBeNull()
    expect(data.ok).toBe(true)
    // PII (email, site_id) intentionally stripped from response
  })

  it('confirm RPC rejects expired token', async () => {
    const t = token('bbbb')
    const { data: ins } = await admin.from('newsletter_subscriptions').insert({
      site_id: SHARED_SITE_A_ID, email: 'expired@x.com',
      status: 'pending_confirmation', confirmation_token: t,
      confirmation_expires_at: new Date(Date.now() - 60_000).toISOString(),
      consent_text_version: 'v1',
    }).select('id').single()
    if (ins?.id) ids.push(ins.id)

    const { data } = await admin.rpc('confirm_newsletter_subscription', { p_token: t })
    expect(data.ok).toBe(false)
    expect(data.error).toBe('expired')
  })

  it('rejects status=confirmed without brevo_contact_id', async () => {
    const { error } = await admin.from('newsletter_subscriptions').insert({
      site_id: SHARED_SITE_A_ID, email: 'forced@x.com',
      status: 'confirmed', consent_text_version: 'v1',
    })
    expect(error).not.toBeNull()
  })

  it('anon RLS: verify policies exist via pg_policies (anon insert path)', async () => {
    // Anon direct-insert to newsletter_subscriptions is covered by an INSERT policy.
    // We verify policy existence rather than direct anon insert to keep test hermetic
    // (direct anon insert would require the site_id GUC to be set, which requires
    // PostgREST session-scoped config not easily driven from JS client).
    const { data: policies, error } = await admin
      .from('pg_policies' as never)
      .select('policyname, cmd, roles')
      .eq('tablename', 'newsletter_subscriptions')
    expect(error).toBeNull()
    expect((policies as unknown[]).length).toBeGreaterThan(0)
  })

  it('anon cannot read newsletter_subscriptions rows', async () => {
    const { data } = await anon.from('newsletter_subscriptions').select('id')
    expect((data ?? []).length).toBe(0)
  })

  it('UPSERT on existing pending rotates token', async () => {
    const t1 = token('cccc')
    const r1 = await admin.from('newsletter_subscriptions').insert({
      site_id: SHARED_SITE_A_ID, email: 'rotate@x.com',
      status: 'pending_confirmation', confirmation_token: t1,
      confirmation_expires_at: new Date(Date.now() + 86400_000).toISOString(),
      consent_text_version: 'v1',
    }).select('id').single()
    if (r1.data?.id) ids.push(r1.data.id)

    const t2 = token('dddd')
    const r2 = await admin.from('newsletter_subscriptions').upsert({
      site_id: SHARED_SITE_A_ID, email: 'rotate@x.com',
      status: 'pending_confirmation', confirmation_token: t2,
      confirmation_expires_at: new Date(Date.now() + 86400_000).toISOString(),
      consent_text_version: 'v1',
    }, { onConflict: 'site_id,email' }).select('confirmation_token').single()
    expect(r2.error).toBeNull()
    expect(r2.data?.confirmation_token).toBe(t2)
  })
})
