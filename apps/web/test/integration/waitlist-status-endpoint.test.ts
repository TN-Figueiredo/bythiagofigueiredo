// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY, seedSite } from '../helpers/db-seed'

// ─── Mutable header holder — set per-test ────────────────────────────────────
const _headers: Record<string, string | null> = {}

vi.mock('next/headers', () => ({
  headers: async () => ({
    get: (k: string) => _headers[k] ?? null,
  }),
}))

// ─── Import route AFTER mocks are declared ───────────────────────────────────
import { GET } from '../../src/app/api/waitlists/[slug]/route'

// ─── DB client (service role — RLS bypass for seed/cleanup) ──────────────────
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

// ─── Helpers ─────────────────────────────────────────────────────────────────
function makeCtx(slug: string) {
  return { params: Promise.resolve({ slug }) }
}

function setHeaders(siteId: string | null, locale?: string) {
  _headers['x-site-id'] = siteId
  _headers['x-default-locale'] = locale ?? null
}

// ─── Suite ───────────────────────────────────────────────────────────────────
describe.skipIf(skipIfNoLocalDb())('GET /api/waitlists/[slug]', () => {
  let siteAId: string
  let siteBId: string
  const createdWaitlistIds: string[] = []

  beforeAll(async () => {
    const a = await seedSite(db)
    const b = await seedSite(db)
    siteAId = a.siteId
    siteBId = b.siteId
  })

  afterAll(async () => {
    if (createdWaitlistIds.length) {
      await db.from('waitlist_translations').delete().in('waitlist_id', createdWaitlistIds)
      await db.from('waitlists').delete().in('id', createdWaitlistIds)
    }
  })

  async function seedWaitlist(opts: {
    siteId: string
    slug: string
    name: string
    status: string
    translations?: Array<{
      locale: string
      headline?: string
      subheadline?: string
      consent_label?: string
    }>
  }): Promise<string> {
    const { data: wl, error } = await db
      .from('waitlists')
      .insert({ site_id: opts.siteId, slug: opts.slug, name: opts.name, status: opts.status })
      .select('id')
      .single()
    if (error || !wl) throw new Error(`seed waitlist failed: ${error?.message}`)
    createdWaitlistIds.push(wl.id)
    if (opts.translations?.length) {
      for (const tx of opts.translations) {
        const { error: txErr } = await db.from('waitlist_translations').insert({
          waitlist_id: wl.id,
          locale: tx.locale,
          headline: tx.headline ?? `Headline ${tx.locale}`,
          subheadline: tx.subheadline ?? null,
          consent_label: tx.consent_label ?? 'I agree',
        })
        if (txErr) throw new Error(`seed translation failed: ${txErr.message}`)
      }
    }
    return wl.id
  }

  // ── Case 1: site isolation ────────────────────────────────────────────────
  describe('site isolation', () => {
    const SHARED_SLUG = 'isolation-test-slug'

    beforeAll(async () => {
      await seedWaitlist({
        siteId: siteAId,
        slug: SHARED_SLUG,
        name: 'Waitlist Site A',
        status: 'open',
        translations: [{ locale: 'pt-BR', headline: 'Entrar na lista A' }],
      })
      await seedWaitlist({
        siteId: siteBId,
        slug: SHARED_SLUG,
        name: 'Waitlist Site B',
        status: 'open',
        translations: [{ locale: 'en', headline: 'Join list B' }],
      })
    })

    it('returns site A waitlist when x-site-id=A', async () => {
      setHeaders(siteAId, 'pt-BR')
      const res = await GET(new Request('http://localhost'), makeCtx(SHARED_SLUG))
      expect(res.status).toBe(200)
      const body = await res.json() as { status: string; name: string; tx: unknown }
      expect(body.status).toBe('open')
      expect(body.name).toBe('Waitlist Site A')
    })

    it('returns site B waitlist when x-site-id=B', async () => {
      setHeaders(siteBId, 'en')
      const res = await GET(new Request('http://localhost'), makeCtx(SHARED_SLUG))
      expect(res.status).toBe(200)
      const body = await res.json() as { status: string; name: string; tx: { headline: string } | null }
      expect(body.status).toBe('open')
      expect(body.name).toBe('Waitlist Site B')
    })

    it('returns 404 for slug only on site B when x-site-id=A (cross-site isolation)', async () => {
      // 'isolation-test-slug' exists on both, but let's use a B-only slug
      const bOnlySlug = 'site-b-only-' + Date.now()
      await seedWaitlist({ siteId: siteBId, slug: bOnlySlug, name: 'B Only', status: 'open' })
      setHeaders(siteAId)
      const res = await GET(new Request('http://localhost'), makeCtx(bOnlySlug))
      expect(res.status).toBe(404)
    })
  })

  // ── Case 2: non-public status → 404 ─────────────────────────────────────
  describe('non-public status → 404', () => {
    it.each(['draft', 'launching', 'failed'] as const)(
      'status=%s returns 404',
      async (status) => {
        const slug = `status-${status}-${Date.now()}`
        await seedWaitlist({ siteId: siteAId, slug, name: `Status ${status}`, status })
        setHeaders(siteAId)
        const res = await GET(new Request('http://localhost'), makeCtx(slug))
        expect(res.status).toBe(404)
      },
    )

    it.each(['open', 'closed', 'launched'] as const)(
      'status=%s returns 200',
      async (status) => {
        const slug = `status-${status}-${Date.now()}`
        await seedWaitlist({ siteId: siteAId, slug, name: `Status ${status}`, status })
        setHeaders(siteAId)
        const res = await GET(new Request('http://localhost'), makeCtx(slug))
        expect(res.status).toBe(200)
      },
    )
  })

  // ── Case 3: no x-site-id → 404 'no_site' ────────────────────────────────
  describe('missing x-site-id', () => {
    it('returns 404 with error=no_site when x-site-id header is absent', async () => {
      setHeaders(null)
      const res = await GET(new Request('http://localhost'), makeCtx('anything'))
      expect(res.status).toBe(404)
      const body = await res.json() as { error: string }
      expect(body.error).toBe('no_site')
    })
  })

  // ── Case 4: WL-SEC-1 — the public route must NOT expose the localized block ──
  // This route was hardened to return only { status, name, description }; the full
  // translations block (headline/consent/button/success copy) is deliberately withheld
  // from anonymous clients. These tests lock that contract against regression.
  describe('response shape (WL-SEC-1: no translations leak)', () => {
    it('returns only status+name+description, never a tx/translations block — even when translations exist', async () => {
      const slug = 'shape-test-' + Date.now()
      await seedWaitlist({
        siteId: siteAId,
        slug,
        name: 'Shape Test',
        status: 'open',
        translations: [
          { locale: 'en', headline: 'English Headline' },
          { locale: 'pt-BR', headline: 'Manchete em Português' },
        ],
      })
      setHeaders(siteAId, 'en')
      const res = await GET(new Request('http://localhost'), makeCtx(slug))
      expect(res.status).toBe(200)
      const body = await res.json() as Record<string, unknown>
      // Exact key set — additive leakage of the localized block fails here.
      expect(Object.keys(body).sort()).toEqual(['description', 'name', 'status'])
      expect(body).not.toHaveProperty('tx')
      expect(body.status).toBe('open')
      expect(body.name).toBe('Shape Test')
      // No localized copy leaks into the public payload.
      expect(JSON.stringify(body)).not.toContain('English Headline')
      expect(JSON.stringify(body)).not.toContain('Manchete em Português')
    })

    it('keeps the same shape when no translations exist', async () => {
      const slug = 'shape-no-tx-' + Date.now()
      await seedWaitlist({ siteId: siteAId, slug, name: 'No TX', status: 'open' })
      setHeaders(siteAId, 'en')
      const res = await GET(new Request('http://localhost'), makeCtx(slug))
      expect(res.status).toBe(200)
      const body = await res.json() as Record<string, unknown>
      expect(Object.keys(body).sort()).toEqual(['description', 'name', 'status'])
      expect(body).not.toHaveProperty('tx')
    })
  })
})
