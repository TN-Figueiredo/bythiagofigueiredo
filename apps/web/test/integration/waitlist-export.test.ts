/**
 * DB-gated test for exportWaitlistSignups. Auth/site-context mocked; the real
 * service-client query runs against local Supabase. Covers: cross-site IDOR (404),
 * anonymized-row omission, and formula-injection neutralization via escapeCsv.
 *
 * Run: npm run db:reset && HAS_LOCAL_DB=1 npx vitest run test/integration/waitlist-export.test.ts
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY, seedSite } from '../helpers/db-seed'

let _mockSiteId = 'unset'
vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn(async () => ({ siteId: _mockSiteId, orgId: 'org-mock', defaultLocale: 'en' })),
}))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireSiteScope: vi.fn(async () => ({ ok: true, user: { id: 'user-mock' } })),
}))
vi.mock('@vercel/blob', () => ({ put: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), setTag: vi.fn(), addBreadcrumb: vi.fn() }))

import { exportWaitlistSignups } from '../../src/app/cms/(authed)/waitlists/actions'

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
const slug = (p: string) => `${p}-${Math.random().toString(36).slice(2, 6)}`

describe.skipIf(skipIfNoLocalDb())('exportWaitlistSignups', () => {
  const created: string[] = []
  afterEach(async () => {
    if (created.length) {
      await db.from('waitlists').delete().in('id', created)
      created.length = 0
    }
  })

  it('(a) cross-site export → not_found (IDOR closed)', async () => {
    const { siteId: siteA } = await seedSite(db)
    const { siteId: siteB } = await seedSite(db)
    const { data: wlB } = await db
      .from('waitlists')
      .insert({ site_id: siteB, slug: slug('b'), name: 'B', status: 'open' })
      .select('id')
      .single()
    created.push(wlB!.id)

    _mockSiteId = siteA
    const res = await exportWaitlistSignups(wlB!.id)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toBe('not_found')
  })

  it('(b) omits anonymized rows and (c) neutralizes a formula-injection cell', async () => {
    const { siteId } = await seedSite(db)
    _mockSiteId = siteId
    const { data: wl } = await db
      .from('waitlists')
      .insert({ site_id: siteId, slug: slug('a'), name: 'A', status: 'open' })
      .select('id, site_id')
      .single()
    created.push(wl!.id)
    const base = { waitlist_id: wl!.id, site_id: wl!.site_id, consent_launch_notification: true, consent_text_version: 'v1', status: 'pending' as const }
    await db.from('waitlist_signups').insert([
      { ...base, email: '=2+5@x.com', source_surface: 'landing' }, // formula-injection target
      { ...base, email: 'gone@x.com', source_surface: 'landing', anonymized_at: new Date().toISOString() }, // must be omitted
    ])

    const res = await exportWaitlistSignups(wl!.id)
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.csv).not.toContain('gone@x.com') // anonymized omitted
      expect(res.csv).toContain("'=2+5@x.com") // leading ' neutralizes the formula
      expect(res.filename).toMatch(/^waitlist-.*-\d{4}-\d{2}-\d{2}\.csv$/)
    }
  })
})
