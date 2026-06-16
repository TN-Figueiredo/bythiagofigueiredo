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
