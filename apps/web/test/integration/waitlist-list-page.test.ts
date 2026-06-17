import { describe, it, expect, afterEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY, seedSite } from '../helpers/db-seed'
import { listWaitlistsForSite } from '../../src/app/cms/(authed)/waitlists/queries'

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

describe.skipIf(skipIfNoLocalDb())('listWaitlistsForSite (CMS list query + KPIs)', () => {
  const createdWaitlists: string[] = []
  afterEach(async () => {
    if (createdWaitlists.length) {
      // signups cascade via waitlist_signups_parent_fk (on delete cascade)
      await db.from('waitlists').delete().in('id', createdWaitlists)
      createdWaitlists.length = 0
    }
  })

  it('scopes to the site and computes open/total/suppressed KPIs', async () => {
    const { siteId: siteA } = await seedSite(db)
    const { siteId: siteB } = await seedSite(db)

    const { data: wlA } = await db
      .from('waitlists')
      .insert({ site_id: siteA, slug: 'launch-a', name: 'Launch A', status: 'open' })
      .select('id, site_id')
      .single()
    createdWaitlists.push(wlA!.id)

    // 2 signups on site A's open waitlist — one pending, one suppressed.
    await db.from('waitlist_signups').insert({
      waitlist_id: wlA!.id,
      site_id: wlA!.site_id,
      email: 'pending@a.com',
      consent_launch_notification: true,
      consent_text_version: 'v1',
      status: 'pending',
    })
    await db.from('waitlist_signups').insert({
      waitlist_id: wlA!.id,
      site_id: wlA!.site_id,
      email: 'suppressed@a.com',
      consent_launch_notification: true,
      consent_text_version: 'v1',
      status: 'suppressed',
      suppressed_at: new Date(Date.now()).toISOString(),
      suppression_reason: 'unsubscribe',
    })

    // A closed waitlist on a DIFFERENT site — must not leak into site A's results.
    const { data: wlB } = await db
      .from('waitlists')
      .insert({ site_id: siteB, slug: 'launch-b', name: 'Launch B', status: 'closed' })
      .select('id')
      .single()
    createdWaitlists.push(wlB!.id)

    const { rows, kpis } = await listWaitlistsForSite(siteA)

    // cross-site scoping: only site A's waitlist
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe(wlA!.id)
    expect(rows[0].status).toBe('open')
    expect(rows[0].signups).toBe(2)
    expect(rows[0].suppressed).toBe(1)

    expect(kpis.total).toBe(1)
    expect(kpis.open).toBe(1)
    expect(kpis.totalSignups).toBe(2)
    expect(kpis.suppressed).toBe(1)
  })
})
