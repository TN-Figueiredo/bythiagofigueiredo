import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, ANON_KEY, SERVICE_KEY, seedSite, signUserJwt } from '../helpers/db-seed'

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

describe.skipIf(skipIfNoLocalDb())('waitlist retention + lgpd phase1 branch', () => {
  it('PASS 2 is idempotent — first sweep returns the PASS-2 row count, second returns 0', async () => {
    const { siteId } = await seedSite(db)
    const { data: wl } = await db.from('waitlists')
      .insert({ site_id: siteId, slug: 'ret-test', name: 'Ret', status: 'open' }).select('id, site_id').single()
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
    await db.from('waitlists').delete().eq('id', wl!.id)
  })

  it('two anonymized rows on the same waitlist (distinct emails) do not violate the partial unique index', async () => {
    const { siteId } = await seedSite(db)
    const { data: wl } = await db.from('waitlists')
      .insert({ site_id: siteId, slug: 'ret-test2', name: 'Ret2', status: 'closed' }).select('id, site_id').single()
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
    await db.from('waitlists').delete().eq('id', wl!.id)
  })

  it('lgpd_phase1_cleanup anonymizes waitlist rows via the waitlist_emails pre-capture key', async () => {
    const { siteId } = await seedSite(db)
    const { data: wl } = await db.from('waitlists')
      .insert({ site_id: siteId, slug: 'p1', name: 'P1', status: 'open' }).select('id, site_id').single()
    await db.from('waitlist_signups').insert({
      waitlist_id: wl!.id, site_id: wl!.site_id, email: 'erase@x.com', consent_launch_notification: true,
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
    await db.from('waitlists').delete().eq('id', wl!.id)
  })

  it('waitlist_signup_counts returns per-waitlist pending/suppressed (C3)', async () => {
    const { siteId } = await seedSite(db)
    const { data: wl } = await db.from('waitlists')
      .insert({ site_id: siteId, slug: 'counts', name: 'Counts', status: 'open' }).select('id, site_id').single()
    await db.from('waitlist_signups').insert([
      { waitlist_id: wl!.id, site_id: wl!.site_id, email: 'p1@x.com', consent_launch_notification: true, consent_text_version: 'v1', status: 'pending' },
      { waitlist_id: wl!.id, site_id: wl!.site_id, email: 'p2@x.com', consent_launch_notification: true, consent_text_version: 'v1', status: 'pending' },
      { waitlist_id: wl!.id, site_id: wl!.site_id, email: 's1@x.com', consent_launch_notification: true, consent_text_version: 'v1', status: 'suppressed', suppressed_at: new Date().toISOString(), suppression_reason: 'unsubscribe' },
    ])
    const { data } = await db.rpc('waitlist_signup_counts', { p_site_id: wl!.site_id })
    const row = (data as Array<{ waitlist_id: string; pending: number; suppressed: number }>).find((r) => r.waitlist_id === wl!.id)
    expect(row).toBeTruthy(); expect(row!.pending).toBe(2); expect(row!.suppressed).toBe(1)
    await db.from('waitlists').delete().eq('id', wl!.id)
  })

  it('waitlist_signup_counts denies a non-staff authenticated caller for a foreign site (no IDOR)', async () => {
    const { siteId } = await seedSite(db)
    // a random authenticated user with NO membership on this site
    const { jwt } = signUserJwt(undefined, 'editor')
    const authed = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${jwt}` } } })
    const { data, error } = await authed.rpc('waitlist_signup_counts', { p_site_id: siteId })
    // forbidden → error (42501) OR no rows; must NOT return foreign-site data
    expect(error !== null || (data ?? []).length === 0).toBe(true)
  })
})
