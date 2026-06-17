/**
 * DB-gated integration tests for the waitlist CMS create/update actions
 * (apps/web/src/app/cms/(authed)/waitlists/actions.ts).
 *
 * Auth + site-context are mocked at the layer the actions depend on
 * (getSiteContext + requireSiteScope), so the real service-client DB writes
 * run against local Supabase. The load-bearing guarantees under test:
 *   (a) slug uniqueness is decided by the DB unique constraint (23505), NOT a
 *       pre-SELECT — a true concurrent race yields exactly one winner.
 *   (b) sender_email is validated against the site's owned domains at save.
 *   (c) creating a waitlist also persists its default-locale translations row.
 *
 * Run: npm run db:reset && HAS_LOCAL_DB=1 npx vitest run test/integration/waitlist-cms-actions.test.ts
 * CI:  skipped automatically (HAS_LOCAL_DB unset)
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY, seedSite } from '../helpers/db-seed'

// --- Auth + site-context mocks (declared before the actions import) ---------
let _mockSiteId = 'unset'
let _mockLocale = 'en'
vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn(async () => ({
    siteId: _mockSiteId,
    orgId: 'org-mock',
    defaultLocale: _mockLocale,
  })),
}))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireSiteScope: vi.fn(async () => ({ ok: true, user: { id: 'user-mock' } })),
}))
vi.mock('@vercel/blob', () => ({ put: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), setTag: vi.fn(), addBreadcrumb: vi.fn() }))

import { createWaitlist, updateWaitlist } from '../../src/app/cms/(authed)/waitlists/actions'

type CreateResult = Awaited<ReturnType<typeof createWaitlist>>

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

function fd(fields: Record<string, string>): FormData {
  const f = new FormData()
  for (const [k, v] of Object.entries(fields)) f.set(k, v)
  return f
}

const settled = (r: PromiseSettledResult<CreateResult>): CreateResult | null =>
  r.status === 'fulfilled' ? r.value : null

describe.skipIf(skipIfNoLocalDb())('waitlist CMS actions (create/update)', () => {
  const created: string[] = []
  afterEach(async () => {
    if (created.length) {
      // translations cascade via waitlist_translations_waitlist_id_fkey (on delete cascade)
      await db.from('waitlists').delete().in('id', created)
      created.length = 0
    }
  })

  it('(a) concurrent create of the same slug → exactly one ok + one slug_taken', async () => {
    const { siteId } = await seedSite(db, { domains: ['x.test'] })
    _mockSiteId = siteId
    const slug = 'race-' + Math.random().toString(36).slice(2, 6)

    const [a, b] = await Promise.allSettled([
      createWaitlist(fd({ slug, name: 'Race' })),
      createWaitlist(fd({ slug, name: 'Race' })),
    ])
    for (const r of [a, b]) {
      const v = settled(r)
      if (v?.ok) created.push(v.waitlistId)
    }

    const oks = [a, b].filter((r) => settled(r)?.ok === true)
    const taken = [a, b].filter((r) => {
      const v = settled(r)
      return v != null && !v.ok && v.error === 'slug_taken'
    })
    expect(oks).toHaveLength(1)
    expect(taken).toHaveLength(1) // loser's INSERT hits 23505 → slug_taken (constraint, not pre-SELECT)

    // The DB ends with exactly one row for that (site_id, slug).
    const { data } = await db.from('waitlists').select('id').eq('site_id', siteId).eq('slug', slug)
    expect(data).toHaveLength(1)
  })

  it('(b) sender_email on a non-owned domain → field error', async () => {
    const { siteId } = await seedSite(db, { domains: ['x.test'] })
    _mockSiteId = siteId

    const res = await createWaitlist(
      fd({ slug: 'sender-' + Math.floor(Date.now() % 100000), name: 'S', sender_email: 'hi@evil.com' }),
    )
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error).toBe('validation_failed')
      if (res.error === 'validation_failed') expect(res.fields.sender_email).toBeTruthy()
    }
  })

  it('(c) create persists the default-locale translations row', async () => {
    const { siteId } = await seedSite(db, { domains: ['x.test'] })
    _mockSiteId = siteId
    _mockLocale = 'en'

    const res = await createWaitlist(fd({ slug: 'persist-' + Math.floor(Date.now() % 100000), name: 'P' }))
    expect(res.ok).toBe(true)
    if (res.ok) {
      created.push(res.waitlistId)
      const { data } = await db
        .from('waitlist_translations')
        .select('waitlist_id, locale')
        .eq('waitlist_id', res.waitlistId)
      expect(data?.length).toBeGreaterThanOrEqual(1)
      expect(data?.[0]?.locale).toBe('en')
    }
  })

  it('updateWaitlist is IDOR-guarded: a cross-site id is not found', async () => {
    const { siteId: siteA } = await seedSite(db, { domains: ['x.test'] })
    const { siteId: siteB } = await seedSite(db, { domains: ['y.test'] })

    // A waitlist owned by site B.
    const { data: wlB } = await db
      .from('waitlists')
      .insert({ site_id: siteB, slug: 'owned-by-b-' + Math.floor(Date.now() % 100000), name: 'B' })
      .select('id')
      .single()
    created.push(wlB!.id)

    // Caller scoped to site A tries to update site B's waitlist.
    _mockSiteId = siteA
    const res = await updateWaitlist(wlB!.id, fd({ slug: 'hijack', name: 'Hijacked' }))
    // Assert unconditionally: a regression that drops the .eq('site_id', siteId)
    // guard would return ok:true (or a non-forbidden error) and must FAIL here,
    // not slip through an if(!res.ok) guard that simply never runs.
    expect(res.ok).toBe(false)
    expect(res.ok ? undefined : res.error).toBe('forbidden')

    // Row B is untouched.
    const { data: after } = await db.from('waitlists').select('name').eq('id', wlB!.id).single()
    expect(after?.name).toBe('B')
  })
})
