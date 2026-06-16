import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import {
  SUPABASE_URL,
  SERVICE_KEY,
  ANON_KEY,
  seedRbacScenario,
  cleanupRbacScenario,
  signUserJwt,
  type RbacScenario,
} from '../helpers/db-seed'

const svc  = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
const anon = createClient(SUPABASE_URL, ANON_KEY,    { auth: { persistSession: false } })

describe.skipIf(skipIfNoLocalDb())('waitlist RLS', () => {
  let scenario: RbacScenario
  const createdWaitlistIds: string[] = []

  beforeAll(async () => {
    scenario = await seedRbacScenario(svc)
  })

  afterAll(async () => {
    // Delete waitlist rows first (FK: waitlist_signups → waitlists → sites)
    if (createdWaitlistIds.length) {
      await svc.from('waitlist_signups').delete().in('waitlist_id', createdWaitlistIds)
      await svc.from('waitlists').delete().in('id', createdWaitlistIds)
    }
    await cleanupRbacScenario(svc, scenario)
  })

  it('anon cannot SELECT a REAL waitlist_signups row (RLS denial, not empty table)', async () => {
    const { data: wl } = await svc.from('waitlists')
      .insert({ site_id: scenario.siteAId, slug: 'rls-leak', name: 'Leak', status: 'open' })
      .select('id, site_id').single()
    createdWaitlistIds.push(wl!.id)
    await svc.from('waitlist_signups').insert({
      waitlist_id: wl!.id, site_id: wl!.site_id, email: 'seeded@x.com',
      consent_launch_notification: true, consent_text_version: 'v1',
    })
    const { data } = await anon.from('waitlist_signups').select('id').eq('waitlist_id', wl!.id)
    expect((data ?? []).length).toBe(0)
  })

  it('anon cannot INSERT waitlist_signups directly AND no row is created', async () => {
    const { data: wl } = await svc.from('waitlists')
      .insert({ site_id: scenario.siteAId, slug: 'rls-test', name: 'RLS', status: 'open' })
      .select('id, site_id').single()
    createdWaitlistIds.push(wl!.id)
    const res = await anon.from('waitlist_signups').insert({
      waitlist_id: wl!.id, site_id: wl!.site_id, email: 'x@y.com',
      consent_launch_notification: true, consent_text_version: 'v1',
    })
    expect(res.error).not.toBeNull()
    expect(res.error?.code).toBe('42501')
    const { count } = await svc.from('waitlist_signups')
      .select('*', { count: 'exact', head: true }).eq('waitlist_id', wl!.id)
    expect(count).toBe(0)
  })

  it('cross-site: editor of site A cannot SELECT site B signups (multi-ring isolation)', async () => {
    const { jwt } = signUserJwt(scenario.editorAId, 'editor')
    const editorA: SupabaseClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    })
    const { data: wlB } = await svc.from('waitlists')
      .insert({ site_id: scenario.siteBId, slug: 'wl-b', name: 'B', status: 'open' })
      .select('id, site_id').single()
    createdWaitlistIds.push(wlB!.id)
    await svc.from('waitlist_signups').insert({
      waitlist_id: wlB!.id, site_id: wlB!.site_id, email: 'b@x.com',
      consent_launch_notification: true, consent_text_version: 'v1',
    })
    const { data } = await editorA.from('waitlist_signups').select('id').eq('waitlist_id', wlB!.id)
    expect((data ?? []).length).toBe(0)
  })

  it('anon sees a translation ONLY when its parent waitlist is publicly visible (parent-status gate)', async () => {
    const { data: wl } = await svc.from('waitlists')
      .insert({ site_id: scenario.siteAId, slug: 'tx-gate', name: 'TXGate', status: 'draft' })
      .select('id').single()
    createdWaitlistIds.push(wl!.id)
    await svc.from('waitlist_translations').insert({ waitlist_id: wl!.id, locale: 'en', consent_label: 'Notify me' })
    // draft parent => anon must see 0 rows (no leak of unpublished waitlist content)
    const hidden = await anon.from('waitlist_translations').select('id').eq('waitlist_id', wl!.id)
    expect((hidden.data ?? []).length).toBe(0)
    // flip parent to open => anon now sees it
    await svc.from('waitlists').update({ status: 'open' }).eq('id', wl!.id)
    const visible = await anon.from('waitlist_translations').select('id').eq('waitlist_id', wl!.id)
    expect((visible.data ?? []).length).toBe(1)
  })

  it('cross-site: editor of site A cannot UPDATE or DELETE a site B waitlist (write isolation)', async () => {
    const { jwt } = signUserJwt(scenario.editorAId, 'editor')
    const editorA: SupabaseClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    })
    const { data: wlB } = await svc.from('waitlists')
      .insert({ site_id: scenario.siteBId, slug: 'wl-b-write', name: 'BWrite', status: 'open' })
      .select('id').single()
    createdWaitlistIds.push(wlB!.id)
    const upd = await editorA.from('waitlists').update({ name: 'hacked' }).eq('id', wlB!.id).select('id')
    expect((upd.data ?? []).length).toBe(0)
    const del = await editorA.from('waitlists').delete().eq('id', wlB!.id).select('id')
    expect((del.data ?? []).length).toBe(0)
    // re-read via service client: row untouched and still present
    const { data: after } = await svc.from('waitlists').select('name').eq('id', wlB!.id).single()
    expect(after!.name).toBe('BWrite')
  })

  it('editor of site A CAN read site A signups (staff-read policy positive control)', async () => {
    // Positive control: without this, every signups RLS test expects 0 rows, so a
    // policy broken to using(false) would still pass. This proves the policy GRANTS.
    const { jwt } = signUserJwt(scenario.editorAId, 'editor')
    const editorA: SupabaseClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    })
    const { data: wlA } = await svc.from('waitlists')
      .insert({ site_id: scenario.siteAId, slug: 'staff-read-pos', name: 'SR', status: 'open' })
      .select('id, site_id').single()
    createdWaitlistIds.push(wlA!.id)
    await svc.from('waitlist_signups').insert({
      waitlist_id: wlA!.id, site_id: wlA!.site_id, email: 'visible@x.com',
      consent_launch_notification: true, consent_text_version: 'v1',
    })
    const { data } = await editorA.from('waitlist_signups').select('id').eq('waitlist_id', wlA!.id)
    expect((data ?? []).length).toBe(1)
  })

  it('anon CAN read open/closed/launched waitlist rows directly (public-read positive control)', async () => {
    // Direct positive control for waitlists_public_read (the public landing page
    // reads the waitlist row itself, not only via the translations subquery).
    for (const status of ['open', 'closed', 'launched'] as const) {
      const { data: wl } = await svc.from('waitlists')
        .insert({ site_id: scenario.siteAId, slug: `pub-read-${status}`, name: `Pub ${status}`, status })
        .select('id').single()
      createdWaitlistIds.push(wl!.id)
      const { data } = await anon.from('waitlists').select('id').eq('id', wl!.id)
      expect((data ?? []).length, `anon should see ${status} waitlist`).toBe(1)
    }
  })

  it('anon cannot read send-pipeline config columns (sender_email/reply_to/sender_name revoked)', async () => {
    // The row-level public-read policy still grants the ROW, but column SELECT on the
    // send config is revoked from anon (migration 000002). Reading those columns must
    // error (42501), while the public columns stay readable on the same row.
    const { data: wl } = await svc.from('waitlists')
      .insert({
        site_id: scenario.siteAId, slug: 'col-revoke', name: 'ColR', status: 'open',
        sender_email: 'ops@internal.example.com', reply_to: 'ops@internal.example.com', sender_name: 'Ops',
        intro_mdx: 'public copy',
      })
      .select('id').single()
    createdWaitlistIds.push(wl!.id)
    const denied = await anon.from('waitlists').select('sender_email, reply_to, sender_name').eq('id', wl!.id)
    expect(denied.error?.code).toBe('42501')
    // public columns on the SAME row remain readable
    const allowed = await anon.from('waitlists').select('id, slug, name, status, intro_mdx, launched_at').eq('id', wl!.id)
    expect(allowed.error).toBeNull()
    expect((allowed.data ?? []).length).toBe(1)
    expect((allowed.data![0] as { intro_mdx: string }).intro_mdx).toBe('public copy')
  })

  it('anon cannot read draft/launching/failed waitlists', async () => {
    const statusesToTest = ['draft', 'launching', 'failed'] as const
    const wlIds: string[] = []
    for (const status of statusesToTest) {
      const { data: wl } = await svc.from('waitlists')
        .insert({ site_id: scenario.siteAId, slug: `anon-hidden-${status}`, name: `Hidden ${status}`, status })
        .select('id').single()
      wlIds.push(wl!.id)
      createdWaitlistIds.push(wl!.id)
    }
    for (let i = 0; i < statusesToTest.length; i++) {
      const { data } = await anon.from('waitlists').select('id').eq('id', wlIds[i])
      expect((data ?? []).length, `anon should not see ${statusesToTest[i]} waitlist`).toBe(0)
    }
  })
})
