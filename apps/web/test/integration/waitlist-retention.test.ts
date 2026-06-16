import { describe, it, expect, afterEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, ANON_KEY, SERVICE_KEY, seedSite, signUserJwt } from '../helpers/db-seed'

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

describe.skipIf(skipIfNoLocalDb())('waitlist retention + lgpd phase1 branch', () => {
  // Track seeded waitlists so cleanup survives a failing assertion (no orphan
  // leak on repeated local re-runs against a non-reset DB). Mirrors the
  // afterEach pattern in waitlist-schema.test.ts.
  const createdWaitlists: string[] = []
  afterEach(async () => {
    if (createdWaitlists.length) {
      await db.from('waitlists').delete().in('id', createdWaitlists)
      createdWaitlists.length = 0
    }
  })

  it('PASS 2 is idempotent — first sweep returns the PASS-2 row count, second returns 0', async () => {
    const { siteId } = await seedSite(db)
    const { data: wl } = await db.from('waitlists')
      .insert({ site_id: siteId, slug: 'ret-test', name: 'Ret', status: 'open' }).select('id, site_id').single()
    createdWaitlists.push(wl!.id)
    const aged = new Date(Date.now() - 31 * 86_400_000).toISOString()
    await db.from('waitlist_signups').insert({
      waitlist_id: wl!.id, site_id: wl!.site_id, email: 'aged@x.com', consent_launch_notification: true,
      consent_text_version: 'v1', status: 'pending', ip: '203.0.113.9', user_agent: 'old', created_at: aged,
    })
    const { data: c1 } = await db.rpc('waitlist_retention_sweep', { p_site_id: wl!.site_id })
    expect(c1).toBeGreaterThanOrEqual(1)
    const { data: after1 } = await db.from('waitlist_signups').select('ip, user_agent, anonymized_at').eq('email', 'aged@x.com').single()
    expect(after1!.ip).toBeNull(); expect(after1!.user_agent).toBeNull()
    expect(after1!.anonymized_at).toBeNull()
    const { data: c2 } = await db.rpc('waitlist_retention_sweep', { p_site_id: wl!.site_id })
    expect(c2).toBe(0)
  })

  it('two anonymized rows on the same waitlist (distinct emails) do not violate the partial unique index', async () => {
    const { siteId } = await seedSite(db)
    const { data: wl } = await db.from('waitlists')
      .insert({ site_id: siteId, slug: 'ret-test2', name: 'Ret2', status: 'closed' }).select('id, site_id').single()
    createdWaitlists.push(wl!.id)
    for (const e of ['one@x.com', 'two@x.com']) {
      await db.from('waitlist_signups').insert({
        waitlist_id: wl!.id, site_id: wl!.site_id, email: e, consent_launch_notification: true,
        consent_text_version: 'v1', created_at: '2020-01-01T00:00:00Z',
      })
    }
    const { error } = await db.rpc('waitlist_retention_sweep', { p_site_id: wl!.site_id })
    expect(error).toBeNull()
    const { count } = await db.from('waitlist_signups')
      .select('*', { count: 'exact', head: true }).eq('waitlist_id', wl!.id).not('anonymized_at', 'is', null)
    expect(count).toBe(2)
  })

  it('lgpd_phase1_cleanup anonymizes waitlist rows via the waitlist_emails pre-capture key', async () => {
    const { siteId } = await seedSite(db)
    const { data: wl } = await db.from('waitlists')
      .insert({ site_id: siteId, slug: 'p1', name: 'P1', status: 'open' }).select('id, site_id').single()
    createdWaitlists.push(wl!.id)
    // Stored email is mixed-case; the erasure request captures a DIFFERENT case.
    // Under search_path='' a bare `=` would be case-sensitive (verified FALSE),
    // skipping anonymization and leaving PII on an LGPD-erased row. This asserts
    // the operator(public.=) citext match in migration 000005 actually fires.
    await db.from('waitlist_signups').insert({
      waitlist_id: wl!.id, site_id: wl!.site_id, email: 'Erase@X.com', consent_launch_notification: true,
      consent_text_version: 'v1', ip: '203.0.113.7', user_agent: 'ua',
    })
    const { error } = await db.rpc('lgpd_phase1_cleanup', {
      p_user_id: '00000000-0000-0000-0000-000000000001',
      p_pre_capture: { waitlist_emails: ['erase@x.com'] },
    })
    expect(error).toBeNull()
    const { data: row } = await db.from('waitlist_signups').select('email, ip, anonymized_at')
      .eq('waitlist_id', wl!.id).not('anonymized_at', 'is', null).single()
    expect(row!.ip).toBeNull()
    expect(row!.email).toMatch(/^[a-f0-9]{64}$/)
  })

  it('waitlist_signup_counts returns per-waitlist pending/suppressed (C3)', async () => {
    const { siteId } = await seedSite(db)
    const { data: wl } = await db.from('waitlists')
      .insert({ site_id: siteId, slug: 'counts', name: 'Counts', status: 'open' }).select('id, site_id').single()
    createdWaitlists.push(wl!.id)
    await db.from('waitlist_signups').insert([
      { waitlist_id: wl!.id, site_id: wl!.site_id, email: 'p1@x.com', consent_launch_notification: true, consent_text_version: 'v1', status: 'pending' },
      { waitlist_id: wl!.id, site_id: wl!.site_id, email: 'p2@x.com', consent_launch_notification: true, consent_text_version: 'v1', status: 'pending' },
      { waitlist_id: wl!.id, site_id: wl!.site_id, email: 's1@x.com', consent_launch_notification: true, consent_text_version: 'v1', status: 'suppressed', suppressed_at: new Date().toISOString(), suppression_reason: 'unsubscribe' },
    ])
    const { data } = await db.rpc('waitlist_signup_counts', { p_site_id: wl!.site_id })
    const row = (data as Array<{ waitlist_id: string; pending: number; suppressed: number }>).find((r) => r.waitlist_id === wl!.id)
    expect(row).toBeTruthy(); expect(row!.pending).toBe(2); expect(row!.suppressed).toBe(1)
  })

  it('waitlist_signup_counts denies a non-staff authenticated caller for a foreign site (no IDOR)', async () => {
    const { siteId } = await seedSite(db)
    // a random authenticated user with NO membership on this site
    const { jwt } = signUserJwt(undefined, 'editor')
    const authed = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${jwt}` } } })
    const { data, error } = await authed.rpc('waitlist_signup_counts', { p_site_id: siteId })
    // The RPC raises 'forbidden' (42501) for a non-staff caller — assert the actual
    // deny contract, not a weak OR whose length-0 branch would be dead.
    expect(error).not.toBeNull()
    expect(error?.code).toBe('42501')
    expect(data).toBeNull()
  })

  it('does NOT anonymize bounce/complaint suppressions even when aged (SES suppression-list integrity)', async () => {
    const { siteId } = await seedSite(db)
    const { data: wl } = await db.from('waitlists')
      .insert({ site_id: siteId, slug: 'sup-keep', name: 'Keep', status: 'open' }).select('id, site_id').single()
    createdWaitlists.push(wl!.id)
    const old = '2020-01-01T00:00:00Z'
    for (const reason of ['bounce', 'complaint'] as const) {
      await db.from('waitlist_signups').insert({
        waitlist_id: wl!.id, site_id: wl!.site_id, email: `${reason}@x.com`, consent_launch_notification: true,
        consent_text_version: 'v1', status: 'suppressed', suppressed_at: old, suppression_reason: reason, created_at: old,
      })
    }
    const { error } = await db.rpc('waitlist_retention_sweep', { p_site_id: wl!.site_id })
    expect(error).toBeNull()
    const { data: rows } = await db.from('waitlist_signups')
      .select('email, anonymized_at, suppression_reason').eq('waitlist_id', wl!.id)
    expect((rows ?? []).length).toBe(2)
    for (const r of rows!) {
      expect(r.anonymized_at).toBeNull()                  // NOT anonymized — pass-1 guard
      expect(r.email).not.toMatch(/^[a-f0-9]{64}$/)       // raw email retained for the suppression list
    }
  })

  it('PASS 1 anonymizes a suppressed-unsubscribe row past the 30-day grace (email hashed, PII nulled)', async () => {
    const { siteId } = await seedSite(db)
    const { data: wl } = await db.from('waitlists')
      .insert({ site_id: siteId, slug: 'unsub-aged', name: 'Unsub', status: 'open' }).select('id, site_id').single()
    createdWaitlists.push(wl!.id)
    const aged = new Date(Date.now() - 31 * 86_400_000).toISOString()
    await db.from('waitlist_signups').insert({
      waitlist_id: wl!.id, site_id: wl!.site_id, email: 'gone@x.com', consent_launch_notification: true,
      consent_text_version: 'v1', status: 'suppressed', suppressed_at: aged, suppression_reason: 'unsubscribe',
      ip: '203.0.113.99', user_agent: 'old-ua', locale: 'pt-BR', created_at: aged,
    })
    const { error } = await db.rpc('waitlist_retention_sweep', { p_site_id: wl!.site_id })
    expect(error).toBeNull()
    const { data: row } = await db.from('waitlist_signups')
      .select('email, ip, user_agent, locale, anonymized_at, consent_text_version')
      .eq('waitlist_id', wl!.id).single()
    expect(row!.anonymized_at).not.toBeNull()
    expect(row!.email).toMatch(/^[a-f0-9]{64}$/)          // hashed
    expect(row!.ip).toBeNull()
    expect(row!.user_agent).toBeNull()
    expect(row!.locale).toBeNull()
    expect(row!.consent_text_version).toBe('v1')          // proof-of-consent retained (Art.15)
  })

  it('PASS 1 anonymizes a pending row on an open list past the 90-day storage cap', async () => {
    // Positive coverage for the pending + draft/open-parent + created_at > 90d
    // branch (migration 000005 lines 153-155). Without this, shrinking the
    // 90-day interval or breaking the pending branch would ship green.
    const { siteId } = await seedSite(db)
    const { data: wl } = await db.from('waitlists')
      .insert({ site_id: siteId, slug: 'pending-aged', name: 'PA', status: 'open' }).select('id, site_id').single()
    createdWaitlists.push(wl!.id)
    const aged = new Date(Date.now() - 91 * 86_400_000).toISOString()
    await db.from('waitlist_signups').insert({
      waitlist_id: wl!.id, site_id: wl!.site_id, email: 'old-pending@x.com',
      consent_launch_notification: true, consent_text_version: 'v1', status: 'pending', created_at: aged,
    })
    const { error } = await db.rpc('waitlist_retention_sweep', { p_site_id: wl!.site_id })
    expect(error).toBeNull()
    const { data: row } = await db.from('waitlist_signups')
      .select('email, anonymized_at').eq('waitlist_id', wl!.id).single()
    expect(row!.anonymized_at).not.toBeNull()
    expect(row!.email).toMatch(/^[a-f0-9]{64}$/)
  })

  it('PASS 1 anonymizes an aged row on a LAUNCHED list past the 7-day cap (branch b, launched variant)', async () => {
    // Branch (b) = parent in ('closed','launched') AND created_at > 7d. The
    // existing 2-row test only exercises 'closed'; this locks the 'launched' arm.
    const { siteId } = await seedSite(db)
    const { data: wl } = await db.from('waitlists')
      .insert({ site_id: siteId, slug: 'launched-aged', name: 'LA', status: 'launched' }).select('id, site_id').single()
    createdWaitlists.push(wl!.id)
    const aged = new Date(Date.now() - 8 * 86_400_000).toISOString()
    await db.from('waitlist_signups').insert({
      waitlist_id: wl!.id, site_id: wl!.site_id, email: 'launched-row@x.com',
      consent_launch_notification: true, consent_text_version: 'v1', status: 'pending', created_at: aged,
    })
    const { error } = await db.rpc('waitlist_retention_sweep', { p_site_id: wl!.site_id })
    expect(error).toBeNull()
    const { data: row } = await db.from('waitlist_signups')
      .select('email, anonymized_at').eq('waitlist_id', wl!.id).single()
    expect(row!.anonymized_at).not.toBeNull()
    expect(row!.email).toMatch(/^[a-f0-9]{64}$/)
  })
})
