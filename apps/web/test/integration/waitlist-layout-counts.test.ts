/**
 * DB-gated test for the waitlist nav-badge count (fetchLayoutCountsInner). Actionable =
 * failed + launching-stuck-past-the-6h-watchdog; a fresh (<6h) launching row is excluded.
 *
 * Run: npm run db:reset && HAS_LOCAL_DB=1 npx vitest run test/integration/waitlist-layout-counts.test.ts
 */
import { describe, it, expect, afterEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY, seedSite } from '../helpers/db-seed'
import { fetchLayoutCountsInner } from '../../lib/cms/layout-counts'

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
const slug = (p: string) => `${p}-${Math.random().toString(36).slice(2, 6)}`
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600 * 1000).toISOString()

describe.skipIf(skipIfNoLocalDb())('fetchLayoutCountsInner — waitlistsNeedAttention', () => {
  const created: string[] = []
  afterEach(async () => {
    if (created.length) {
      await db.from('waitlists').delete().in('id', created)
      created.length = 0
    }
  })

  it('counts failed + 6h-stuck launching, excludes a fresh launching row', async () => {
    const { siteId } = await seedSite(db)
    // updated_at is settable on INSERT (the set_updated_at trigger is UPDATE-only). All rows
    // MUST set it: in a bulk insert PostgREST uses the union of keys as the column list, so a
    // row omitting updated_at is sent as an explicit NULL (the column default applies only when
    // the field is omitted for EVERY row) and trips the not-null constraint (23502).
    const { data, error } = await db
      .from('waitlists')
      .insert([
        { site_id: siteId, slug: slug('failed'), name: 'F', status: 'failed', updated_at: hoursAgo(0) },
        { site_id: siteId, slug: slug('stuck'), name: 'S', status: 'launching', updated_at: hoursAgo(7) },
        { site_id: siteId, slug: slug('fresh'), name: 'Fr', status: 'launching', updated_at: hoursAgo(1) },
      ])
      .select('id')
    if (error) throw error
    for (const r of data ?? []) created.push(r.id)

    const counts = await fetchLayoutCountsInner(siteId)
    expect(counts.waitlistsNeedAttention).toBe(2) // failed + 7h-stuck, NOT the fresh 1h launching
  })
})
