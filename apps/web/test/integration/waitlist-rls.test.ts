import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY, ANON_KEY, seedRbacScenario, signUserJwt } from '../helpers/db-seed'

const svc  = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
const anon = createClient(SUPABASE_URL, ANON_KEY,    { auth: { persistSession: false } })

describe.skipIf(skipIfNoLocalDb())('waitlist RLS', () => {
  it('anon cannot SELECT a REAL waitlist_signups row (RLS denial, not empty table)', async () => {
    const scenario = await seedRbacScenario(svc)
    const { data: wl } = await svc.from('waitlists')
      .insert({ site_id: scenario.siteAId, slug: 'rls-leak', name: 'Leak', status: 'open' })
      .select('id, site_id').single()
    await svc.from('waitlist_signups').insert({
      waitlist_id: wl!.id, site_id: wl!.site_id, email: 'seeded@x.com',
      consent_launch_notification: true, consent_text_version: 'v1',
    })
    const { data } = await anon.from('waitlist_signups').select('id').eq('waitlist_id', wl!.id)
    expect((data ?? []).length).toBe(0)
    await svc.from('waitlists').delete().eq('id', wl!.id)
  })

  it('anon cannot INSERT waitlist_signups directly AND no row is created', async () => {
    const scenario = await seedRbacScenario(svc)
    const siteId = scenario.siteAId
    const { data: wl } = await svc.from('waitlists')
      .insert({ site_id: siteId, slug: 'rls-test', name: 'RLS', status: 'open' })
      .select('id, site_id').single()
    const res = await anon.from('waitlist_signups').insert({
      waitlist_id: wl!.id, site_id: wl!.site_id, email: 'x@y.com',
      consent_launch_notification: true, consent_text_version: 'v1',
    })
    expect(res.error).not.toBeNull()
    const { count } = await svc.from('waitlist_signups')
      .select('*', { count: 'exact', head: true }).eq('waitlist_id', wl!.id)
    expect(count).toBe(0)
    await svc.from('waitlists').delete().eq('id', wl!.id)
  })

  it('cross-site: editor of site A cannot SELECT site B signups (multi-ring isolation)', async () => {
    const scenario = await seedRbacScenario(svc)
    const { jwt } = signUserJwt(scenario.editorAId, 'editor')
    const editorA = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    })
    const { data: wlB } = await svc.from('waitlists')
      .insert({ site_id: scenario.siteBId, slug: 'wl-b', name: 'B', status: 'open' })
      .select('id, site_id').single()
    await svc.from('waitlist_signups').insert({
      waitlist_id: wlB!.id, site_id: wlB!.site_id, email: 'b@x.com',
      consent_launch_notification: true, consent_text_version: 'v1',
    })
    const { data } = await editorA.from('waitlist_signups').select('id').eq('waitlist_id', wlB!.id)
    expect((data ?? []).length).toBe(0)
    await svc.from('waitlists').delete().eq('id', wlB!.id)
  })

  it('anon cannot read draft waitlists', async () => {
    const scenario = await seedRbacScenario(svc)
    const { data: wl } = await svc.from('waitlists')
      .insert({ site_id: scenario.siteAId, slug: 'draft-test', name: 'Draft', status: 'draft' })
      .select('id').single()
    const { data } = await anon.from('waitlists').select('id').eq('id', wl!.id)
    expect((data ?? []).length).toBe(0)
    await svc.from('waitlists').delete().eq('id', wl!.id)
  })
})
