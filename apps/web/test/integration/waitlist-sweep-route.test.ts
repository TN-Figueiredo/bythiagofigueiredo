/**
 * Integration tests for GET/POST /api/cron/waitlist-retention-sweep
 *
 * TDD: RED phase — route does not exist yet; all tests will fail with
 * module-not-found until the route is created.
 *
 * withCronLock return-body shape (verified from apps/web/lib/logger.ts):
 *   fn returns { status: 'ok', ...extra } → Response.json({ ...extra }, 200)
 *   i.e. `status` is STRIPPED from the body, so body = { sites: N }
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY, seedSite } from '../helpers/db-seed'

// ─── Mock @sentry/nextjs ────────────────────────────────────────────────────
vi.mock('@sentry/nextjs', () => ({
  addBreadcrumb: vi.fn(),
  captureException: vi.fn(),
}))

// ─── Mock apps/web/lib/logger ────────────────────────────────────────────────
// The route imports relative: ../../../../../lib/logger
// From test/integration/ → apps/web/lib/logger = ../../lib/logger
// We mock withCronLock to faithfully reproduce the real behaviour:
//   status:'ok'  → Response.json({...extra}, 200)   (status key stripped)
//   status:'error' → Response.json({...extra}, 500) (status key stripped)
vi.mock('../../lib/logger', () => ({
  logCron: vi.fn(),
  newRunId: vi.fn(() => 'test-run-id'),
  withCronLock: vi.fn(
    async (
      _supabase: unknown,
      _lockKey: unknown,
      _runId: unknown,
      _job: unknown,
      fn: () => Promise<{ status: 'ok' | 'error'; [k: string]: unknown }>,
    ) => {
      const result = await fn()
      const { status, ...extra } = result
      if (status === 'error') return Response.json(extra, { status: 500 })
      return Response.json(extra, { status: 200 })
    },
  ),
}))

// ─── Mock apps/web/lib/supabase/service ─────────────────────────────────────
vi.mock('../../lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

// ─── Deferred imports (after mocks) ─────────────────────────────────────────
import { GET, POST } from '../../src/app/api/cron/waitlist-retention-sweep/route'
import * as Sentry from '@sentry/nextjs'
import { logCron } from '../../lib/logger'
import { getSupabaseServiceClient } from '../../lib/supabase/service'

// ─── Local DB client (for DB-gated test) ────────────────────────────────────
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

// ─── Helpers ─────────────────────────────────────────────────────────────────
function makeRequest(opts: { authorization?: string } = {}): Request {
  return new Request('http://localhost/api/cron/waitlist-retention-sweep', {
    headers: opts.authorization ? { authorization: opts.authorization } : {},
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('GET /api/cron/waitlist-retention-sweep', () => {
  it('(a) returns 401 when no Authorization header is present', async () => {
    vi.stubEnv('CRON_SECRET', 'secret-abc')
    const req = makeRequest()
    const res = await GET(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body).toMatchObject({ error: 'unauthorized' })
  })

  it('(d) returns 401 when CRON_SECRET is unset and header is "Bearer undefined"', async () => {
    // CRON_SECRET not set; guard must reject because !secret
    const req = makeRequest({ authorization: 'Bearer undefined' })
    const res = await GET(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body).toMatchObject({ error: 'unauthorized' })
  })

  it('(b) returns 200 { skipped: "disabled" } when flag is unset', async () => {
    vi.stubEnv('CRON_SECRET', 's')
    // WAITLIST_RETENTION_SWEEP_ENABLED is NOT set → skipped
    const req = makeRequest({ authorization: 'Bearer s' })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ skipped: 'disabled' })
  })

  it.skipIf(skipIfNoLocalDb())(
    '(c) returns 200 with sites count and calls Sentry.addBreadcrumb (DB-gated)',
    async () => {
      vi.stubEnv('CRON_SECRET', 'test-secret')
      vi.stubEnv('WAITLIST_RETENTION_SWEEP_ENABLED', 'true')

      // Seed a real site so the route finds at least one site
      const { siteId } = await seedSite(db)
      // siteId seeded but not directly used — route queries all sites from the DB
      void siteId

      // Wire up the service client to use the real local DB
      ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(db)

      const req = makeRequest({ authorization: 'Bearer test-secret' })
      const res = await GET(req)
      expect(res.status).toBe(200)

      const body = await res.json()
      // withCronLock strips `status` from fn's return value → body = { sites: N }
      expect(typeof body.sites).toBe('number')
      expect(body.sites).toBeGreaterThanOrEqual(1)

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'cron',
          message: 'waitlist-retention-sweep',
          level: 'info',
        }),
      )
    },
  )
})

describe('POST /api/cron/waitlist-retention-sweep (GET=POST alias)', () => {
  it('POST is identical to GET — 401 without auth', async () => {
    vi.stubEnv('CRON_SECRET', 'x')
    const req = makeRequest()
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('POST returns skipped when flag is off', async () => {
    vi.stubEnv('CRON_SECRET', 's')
    const req = makeRequest({ authorization: 'Bearer s' })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ skipped: 'disabled' })
  })
})

describe('logCron is called for the skipped path', () => {
  it('logCron called with skipped status when flag is off', async () => {
    vi.stubEnv('CRON_SECRET', 's')
    const req = makeRequest({ authorization: 'Bearer s' })
    await GET(req)
    expect(logCron).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'skipped' }),
    )
  })
})

describe('per-site error is soft — loop continues to next site', () => {
  it('excludes the failing site from the count but continues sweeping remaining sites', async () => {
    vi.stubEnv('CRON_SECRET', 'test-secret')
    vi.stubEnv('WAITLIST_RETENTION_SWEEP_ENABLED', 'true')

    const siteIds = ['site-aaa-0000-0000-0000-000000000001', 'site-bbb-0000-0000-0000-000000000002']
    let rpcCallCount = 0

    const stubSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'sites') {
          return {
            select: vi.fn().mockReturnThis(),
            // Return two site IDs
            then: undefined,
            // Simulate the awaited result of supabase.from('sites').select('id')
            [Symbol.iterator]: undefined,
          }
        }
        return {}
      }),
      rpc: vi.fn().mockImplementation((name: string, args: { p_site_id: string }) => {
        if (name === 'waitlist_retention_sweep') {
          rpcCallCount++
          if (args.p_site_id === siteIds[0]) {
            // First site: return an error
            return Promise.resolve({ data: null, error: { code: 'XX500' } })
          }
          // Second site: success
          return Promise.resolve({ data: null, error: null })
        }
        return Promise.resolve({ data: null, error: null })
      }),
    }

    // The route does: supabase.from('sites').select('id').eq('cms_enabled', true) — mock
    // the full chain so .eq() resolves to { data: [{id}, ...], error: null }.
    stubSupabase.from.mockImplementation((table: string) => {
      if (table === 'sites') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: siteIds.map((id) => ({ id })),
              error: null,
            }),
          }),
        }
      }
      return {}
    })

    ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(stubSupabase)

    const req = makeRequest({ authorization: 'Bearer test-secret' })
    const res = await GET(req)
    expect(res.status).toBe(200)

    const body = await res.json() as { sites: number }
    // First site failed → excluded from count; second site succeeded → sites = 1
    expect(body.sites).toBe(1)

    // logCron must have been called with error status for the failing site
    expect(logCron).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'error', err_code: 'XX500' }),
    )
  })
})
