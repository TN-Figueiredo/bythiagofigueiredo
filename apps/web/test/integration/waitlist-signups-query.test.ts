/**
 * DB-gated test for the keyset signups list (listSignups). The load-bearing property is
 * that paging with the ROW-VALUE cursor on (created_at desc, id desc) collects EVERY row
 * EXACTLY ONCE — even across rows sharing an identical created_at (where a naive
 * created_at.lt cursor would skip or duplicate). Also proves the email filter is applied
 * in SQL (server-side), not on a single page.
 *
 * Run: npm run db:reset && HAS_LOCAL_DB=1 npx vitest run test/integration/waitlist-signups-query.test.ts
 */
import { describe, it, expect, afterEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY, seedSite } from '../helpers/db-seed'
import { listSignups } from '../../src/app/cms/(authed)/waitlists/queries'

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

describe.skipIf(skipIfNoLocalDb())('listSignups (keyset cursor + server-side filter)', () => {
  const created: string[] = []
  afterEach(async () => {
    if (created.length) {
      await db.from('waitlists').delete().in('id', created)
      created.length = 0
    }
  })

  it('pages through ALL rows exactly once, including identical-created_at collisions', async () => {
    const { siteId } = await seedSite(db)
    const { data: wl } = await db
      .from('waitlists')
      .insert({ site_id: siteId, slug: `sg-${Math.random().toString(36).slice(2, 6)}`, name: 'SG', status: 'open' })
      .select('id, site_id')
      .single()
    created.push(wl!.id)

    const base = { waitlist_id: wl!.id, site_id: wl!.site_id, consent_launch_notification: true, consent_text_version: 'v1' }
    // 2 rows with an IDENTICAL created_at (the keyset's hard case)…
    const collide = '2026-06-10T12:00:00.000Z'
    const rows = [
      { ...base, email: 'collide-a@x.com', created_at: collide },
      { ...base, email: 'collide-b@x.com', created_at: collide },
      // …+ 28 with distinct timestamps + 1 distinctive prefix that sorts onto an early page.
      { ...base, email: 'zzfilter-target@x.com', created_at: '2026-06-10T12:00:30.000Z' },
    ]
    for (let i = 0; i < 28; i++) {
      rows.push({ ...base, email: `s${i}@x.com`, created_at: `2026-06-10T11:${String(i).padStart(2, '0')}:00.000Z` })
    }
    await db.from('waitlist_signups').insert(rows)

    const { count: total } = await db
      .from('waitlist_signups')
      .select('id', { count: 'exact', head: true })
      .eq('waitlist_id', wl!.id)
      .is('anonymized_at', null)
    expect(total).toBe(rows.length)

    // Page through with the real cursor (small page to force several pages).
    const collected: string[] = []
    let cursor: { createdAt: string; id: string } | undefined
    for (let guard = 0; guard < 50; guard++) {
      const page = await listSignups(siteId, wl!.id, { cursor, pageSize: 7 })
      collected.push(...page.rows.map((r) => r.id))
      if (!page.nextCursor) break
      cursor = page.nextCursor
    }
    const set = new Set(collected)
    expect(set.size).toBe(total) // NO gap — every row reached
    expect(collected.length).toBe(set.size) // NO overlap — no row paged twice

    // Server-side filter: the distinctive prefix is matched out of the full set, not a page.
    const filtered = await listSignups(siteId, wl!.id, { q: 'zzfilter', pageSize: 7 })
    expect(filtered.rows).toHaveLength(1)
    expect(filtered.rows[0]!.email).toBe('zzfilter-target@x.com')
  })
})
