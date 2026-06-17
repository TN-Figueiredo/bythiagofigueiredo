/**
 * DB-gated test for the detail-page data loader (loadWaitlistDetail). Exercises the
 * cross-site IDOR guard (.eq('id').eq('site_id') → null) and the source-surface buckets.
 *
 * Run: npm run db:reset && HAS_LOCAL_DB=1 npx vitest run test/integration/waitlist-detail-page.test.tsx
 */
import { describe, it, expect, afterEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY, seedSite } from '../helpers/db-seed'
import { loadWaitlistDetail } from '../../src/app/cms/(authed)/waitlists/queries'

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
const slug = (p: string) => `${p}-${Math.random().toString(36).slice(2, 6)}`

describe.skipIf(skipIfNoLocalDb())('loadWaitlistDetail (IDOR guard + source buckets)', () => {
  const created: string[] = []
  afterEach(async () => {
    if (created.length) {
      await db.from('waitlists').delete().in('id', created)
      created.length = 0
    }
  })

  it('returns null for a cross-site id (IDOR closed)', async () => {
    const { siteId: siteA } = await seedSite(db)
    const { siteId: siteB } = await seedSite(db)
    const { data: wlB } = await db
      .from('waitlists')
      .insert({ site_id: siteB, slug: slug('b'), name: 'B', status: 'open' })
      .select('id')
      .single()
    created.push(wlB!.id)

    expect(await loadWaitlistDetail(siteA, wlB!.id)).toBeNull()
  })

  it('returns the detail with source buckets for an owned waitlist (landing>0, embed/tiptap=0)', async () => {
    const { siteId } = await seedSite(db)
    const { data: wl } = await db
      .from('waitlists')
      .insert({ site_id: siteId, slug: slug('a'), name: 'A', status: 'open' })
      .select('id, site_id')
      .single()
    created.push(wl!.id)
    await db.from('waitlist_signups').insert({
      waitlist_id: wl!.id,
      site_id: wl!.site_id,
      email: 'p@a.com',
      consent_launch_notification: true,
      consent_text_version: 'v1',
      status: 'pending',
      source_surface: 'landing',
    })

    const res = await loadWaitlistDetail(siteId, wl!.id)
    expect(res).not.toBeNull()
    expect(res!.sourceCounts.landing).toBeGreaterThan(0)
    expect(res!.sourceCounts.embed).toBe(0)
    expect(res!.sourceCounts.tiptap).toBe(0)
    expect(res!.pending).toBeGreaterThan(0)
  })
})
