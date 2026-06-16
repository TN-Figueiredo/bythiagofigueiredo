import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY, seedSite } from '../helpers/db-seed'

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

describe.skipIf(skipIfNoLocalDb())('waitlist_signup RPC', () => {
  let siteId: string, slug: string
  const seededSiteIds: string[] = []

  beforeAll(async () => {
    const s = await seedSite(db)
    siteId = s.siteId
    seededSiteIds.push(siteId)
    slug = 'rpc-test-' + Math.floor(Date.now() % 100000)
    await db.from('waitlists').insert({ site_id: siteId, slug, name: 'RPC', status: 'open' })
  })

  afterAll(async () => {
    if (seededSiteIds.length > 0) {
      await db.from('waitlists').delete().in('site_id', seededSiteIds)
    }
  })
  const call = (email: string) => db.rpc('waitlist_signup', {
    p_site_id: siteId, p_slug: slug, p_email: email, p_locale: 'pt-BR',
    p_consent_version: 'launch-notification-v1-2026-06',
    p_consent_text_snapshot: 'Quero ser avisado…', p_source_surface: 'landing',
    p_ip: '203.0.113.5', p_user_agent: 'vitest',
  })

  it('fresh signup returns duplicate:false and writes a consent_granted audit row WITHOUT raw email', async () => {
    const { data, error } = await call('fresh@x.com')
    expect(error).toBeNull()
    expect((data as { duplicate: boolean }).duplicate).toBe(false)
    const wlId = (await db.from('waitlists').select('id').eq('slug', slug).eq('site_id', siteId).single()).data!.id
    const { data: sup } = await db.from('waitlist_signups').select('id')
      .eq('waitlist_id', wlId).eq('email', 'fresh@x.com').single()
    const { data: aud } = await db.from('audit_log').select('action, after_data')
      .eq('resource_type', 'waitlist_signup').eq('resource_id', sup!.id).single()
    expect(aud!.action).toBe('consent_granted')
    expect(JSON.stringify(aud!.after_data)).not.toContain('fresh@x.com')
    expect((aud!.after_data as { email_hash?: string }).email_hash).toMatch(/^[a-f0-9]{64}$/)
  })
  it('repeat pending signup returns duplicate:true', async () => {
    await call('again@x.com')
    const { data } = await call('again@x.com')
    expect((data as { duplicate: boolean }).duplicate).toBe(true)
  })
  it('closed list rejects with waitlist_not_open', async () => {
    await db.from('waitlists').update({ status: 'closed' }).eq('slug', slug).eq('site_id', siteId)
    try {
      const { data } = await call('late@x.com')
      expect((data as { error?: string }).error).toBe('waitlist_not_open')
    } finally {
      await db.from('waitlists').update({ status: 'open' }).eq('slug', slug).eq('site_id', siteId)
    }
  })
  it('concurrent fresh signups for the same email do not 500 (one wins, one duplicate)', async () => {
    const email = 'race@x.com'
    const [a, b] = await Promise.all([call(email), call(email)])
    expect((a.data as { error?: string } | null)?.error).toBeUndefined()
    expect((b.data as { error?: string } | null)?.error).toBeUndefined()
    const wlId = (await db.from('waitlists').select('id').eq('slug', slug).eq('site_id', siteId).single()).data!.id
    const { count } = await db.from('waitlist_signups').select('*', { count: 'exact', head: true })
      .eq('waitlist_id', wlId).eq('email', email)
    expect(count).toBe(1)
  })

  it('resolves the waitlist ONLY within the passed site_id (cross-site isolation)', async () => {
    const b = await seedSite(db)
    seededSiteIds.push(b.siteId)
    await db.from('waitlists').insert({ site_id: b.siteId, slug, name: 'RPC-B', status: 'open' })
    const { data } = await db.rpc('waitlist_signup', {
      p_site_id: siteId, p_slug: slug, p_email: 'iso@x.com', p_locale: 'en',
      p_consent_version: 'launch-notification-v1-2026-06', p_consent_text_snapshot: 'x',
      p_source_surface: 'landing', p_ip: null, p_user_agent: 'vitest',
    })
    expect((data as { duplicate: boolean }).duplicate).toBe(false)
    const { count: onB } = await db.from('waitlist_signups')
      .select('*', { count: 'exact', head: true }).eq('site_id', b.siteId).eq('email', 'iso@x.com')
    expect(onB).toBe(0)
    const { count: onA } = await db.from('waitlist_signups')
      .select('*', { count: 'exact', head: true }).eq('site_id', siteId).eq('email', 'iso@x.com')
    expect(onA).toBe(1)
  })
})
