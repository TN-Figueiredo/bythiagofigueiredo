/**
 * DB-gated integration tests for POST /api/waitlists/[slug]/signup
 *
 * Mocking strategy:
 * - next/headers: injected via vi.mock to provide x-site-id header
 * - turnstile: mocked via resolved module path (two levels up from test/integration
 *   resolves to apps/web/lib/turnstile — the SAME module the route imports via
 *   deep-relative path, because vitest dedupes by resolved module)
 * - @sentry/nextjs: stubbed to avoid network calls
 *
 * Env: vitest NODE_ENV='test', not 'development', so isDev=false in the route.
 * Success/duplicate/closed/rate cases: stub TURNSTILE_SECRET_KEY='test-secret'.
 * 503-missing-secret case: stub TURNSTILE_SECRET_KEY=''.
 */
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  vi,
  beforeEach,
} from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY, seedSite } from '../helpers/db-seed'

// ── Mocks (must be hoisted before any route import) ──────────────────────────

// Mock Sentry to avoid network calls in tests
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))

// Mock turnstile via the lib path — vitest resolves this to the same module
// the route imports via its deep-relative path (../../../../../../lib/turnstile)
vi.mock('../../lib/turnstile', () => ({
  verifyTurnstileToken: vi.fn().mockResolvedValue(true),
}))

// next/headers mock — will be overridden per-test to inject different x-site-id values
let mockSiteId: string | null = null
vi.mock('next/headers', () => ({
  headers: () =>
    Promise.resolve({
      get: (key: string) => {
        if (key === 'x-site-id') return mockSiteId
        return null
      },
    }),
}))

// ── Imports (after mocks) ─────────────────────────────────────────────────────
import { verifyTurnstileToken } from '../../lib/turnstile'
import { POST } from '../../src/app/api/waitlists/[slug]/signup/route'
import { WAITLIST_CONSENT_VERSION } from '../../src/app/api/waitlists/consent'

// ── DB setup ─────────────────────────────────────────────────────────────────
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

describe.skipIf(skipIfNoLocalDb())('POST /api/waitlists/[slug]/signup', () => {
  let siteId: string
  let slug: string
  let waitlistId: string
  const cleanupWaitlistIds: string[] = []

  beforeAll(async () => {
    const s = await seedSite(db)
    siteId = s.siteId
    slug = 'ep-test-' + Math.floor(Date.now() % 100000)
    const { data: wl, error } = await db
      .from('waitlists')
      .insert({ site_id: siteId, slug, name: 'Endpoint Test Waitlist', status: 'open' })
      .select('id')
      .single()
    if (error) throw error
    waitlistId = wl!.id
    cleanupWaitlistIds.push(waitlistId)
  })

  afterAll(async () => {
    if (cleanupWaitlistIds.length) {
      await db.from('waitlists').delete().in('id', cleanupWaitlistIds)
    }
  })

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset turnstile mock to default (returns true)
    vi.mocked(verifyTurnstileToken).mockResolvedValue(true)
    // Default: inject a valid site id
    mockSiteId = siteId
  })

  function makeRequest(body: Record<string, unknown>, headers: Record<string, string> = {}) {
    return new Request('http://localhost/api/waitlists/' + slug + '/signup', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-site-id': siteId,
        ...headers,
      },
      body: JSON.stringify(body),
    })
  }

  function defaultBody(overrides: Record<string, unknown> = {}) {
    return {
      locale: 'en',
      email: `test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`,
      consent_launch_notification: true as const,
      turnstile_token: 'test-token',
      ...overrides,
    }
  }

  // ── Case: 503 when TURNSTILE_SECRET_KEY is missing in non-dev ───────────────
  it('returns 503 when TURNSTILE_SECRET_KEY is empty and not dev', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', '')
    try {
      const req = makeRequest(defaultBody())
      const ctx = { params: Promise.resolve({ slug }) }
      const res = await POST(req, ctx)
      expect(res.status).toBe(503)
      const json = await res.json() as { error: string }
      expect(json.error).toBe('unavailable')
    } finally {
      vi.unstubAllEnvs()
    }
  })

  // ── Case: success → {success:true, duplicate:false} ─────────────────────────
  it('returns 200 with success:true and duplicate:false for a fresh signup', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'test-secret')
    try {
      const body = defaultBody({ email: `fresh-${Date.now()}@example.com` })
      const req = makeRequest(body)
      const ctx = { params: Promise.resolve({ slug }) }
      const res = await POST(req, ctx)
      expect(res.status).toBe(200)
      const json = await res.json() as { success: boolean; duplicate: boolean }
      expect(json.success).toBe(true)
      expect(json.duplicate).toBe(false)
      expect(verifyTurnstileToken).toHaveBeenCalled()
    } finally {
      vi.unstubAllEnvs()
    }
  })

  // ── Case: duplicate signup → {success:true, duplicate:true} ─────────────────
  it('returns duplicate:true on a second identical signup', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'test-secret')
    try {
      const email = `dup-${Date.now()}@example.com`
      const body = defaultBody({ email })
      const ctx = { params: Promise.resolve({ slug }) }
      // First call
      const res1 = await POST(makeRequest(body), ctx)
      expect(res1.status).toBe(200)
      const j1 = await res1.json() as { success: boolean; duplicate: boolean }
      expect(j1.duplicate).toBe(false)
      // Second call (same email)
      const res2 = await POST(makeRequest(body), ctx)
      expect(res2.status).toBe(200)
      const j2 = await res2.json() as { success: boolean; duplicate: boolean }
      expect(j2.success).toBe(true)
      expect(j2.duplicate).toBe(true)
    } finally {
      vi.unstubAllEnvs()
    }
  })

  // ── Case: closed waitlist → 409 waitlist_not_open ───────────────────────────
  it('returns 409 waitlist_not_open when the waitlist is closed', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'test-secret')
    try {
      await db.from('waitlists').update({ status: 'closed' }).eq('id', waitlistId)
      const body = defaultBody({ email: `closed-${Date.now()}@example.com` })
      const ctx = { params: Promise.resolve({ slug }) }
      const res = await POST(makeRequest(body), ctx)
      expect(res.status).toBe(409)
      const json = await res.json() as { error: string }
      expect(json.error).toBe('waitlist_not_open')
    } finally {
      await db.from('waitlists').update({ status: 'open' }).eq('id', waitlistId)
      vi.unstubAllEnvs()
    }
  })

  // ── Case: rate-limited → 429 ────────────────────────────────────────────────
  it('returns 429 when the IP has already hit the rate limit', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'test-secret')
    try {
      const floodIp = '198.51.100.77'
      // Seed 5 signups from the same IP
      for (let i = 0; i < 5; i++) {
        await db.from('waitlist_signups').insert({
          waitlist_id: waitlistId,
          site_id: siteId,
          email: `flood-${i}-${Date.now()}@example.com`,
          consent_launch_notification: true,
          consent_text_version: WAITLIST_CONSENT_VERSION,
          ip: floodIp,
        })
      }
      const body = defaultBody({ email: `new-after-flood-${Date.now()}@example.com` })
      const req = new Request('http://localhost/api/waitlists/' + slug + '/signup', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-site-id': siteId,
          'x-vercel-forwarded-for': floodIp,
        },
        body: JSON.stringify(body),
      })
      const ctx = { params: Promise.resolve({ slug }) }
      const res = await POST(req, ctx)
      expect(res.status).toBe(429)
      const json = await res.json() as { error: string }
      expect(json.error).toBe('rate_limited')
    } finally {
      vi.unstubAllEnvs()
    }
  })
})
