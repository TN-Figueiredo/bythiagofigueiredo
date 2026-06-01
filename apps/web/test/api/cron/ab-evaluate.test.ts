import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

const CRON_SECRET = 'test-cron-secret'
process.env.CRON_SECRET = CRON_SECRET

// ── Supabase mock ────────────────────────────────────────────────────────────
const mockFrom = vi.fn()
const mockRpc = vi.fn().mockResolvedValue({ error: null })

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({ from: mockFrom, rpc: mockRpc }),
}))

// ── Token refresh mock ───────────────────────────────────────────────────────
vi.mock('@/lib/social/token-refresh', () => ({
  ensureFreshToken: vi.fn().mockResolvedValue({ accessToken: 'tok-mock' }),
}))

// ── YouTube mocks ────────────────────────────────────────────────────────────
vi.mock('@/lib/youtube/ab-statistics', () => ({
  calculateBayesianConfidence: vi.fn().mockReturnValue({
    confidence: 0.5,
    winnerId: 'variant-a',
    probabilities: [],
  }),
}))

vi.mock('@/lib/youtube/ab-youtube', () => ({
  setThumbnail: vi.fn().mockResolvedValue(undefined),
  fetchVariantImageBuffer: vi.fn().mockResolvedValue({
    buffer: Buffer.from('img'),
    contentType: 'image/png',
  }),
}))

vi.mock('@/lib/youtube/ab-metadata', () => ({
  updateVideoMetadata: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/youtube/ab-templates', () => ({
  resolveTemplates: vi.fn((text: string) => text),
}))

vi.mock('@/lib/youtube/ab-preflight', () => ({
  preflightTokenCheck: vi.fn().mockResolvedValue({ ok: true, accessToken: 'tok-mock' }),
}))

vi.mock('@/lib/youtube/notification-service', () => ({
  buildNotification: vi.fn().mockReturnValue({
    type: 'ab_test_completed',
    priority: 'high',
    title: 'Test completed',
    message: 'Winner found',
    dedup_key: 'dedup-1',
    video_id: 'vid-1',
    action_href: null,
  }),
}))

vi.mock('@/lib/youtube/analytics-sync', () => ({
  getIsoWeek: vi.fn().mockReturnValue('2026-W21'),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  setTag: vi.fn(),
}))

vi.mock('@/lib/youtube/ab-playoff', () => ({
  checkPlayoffEligibility: vi.fn().mockReturnValue({ eligible: false }),
  selectPlayoffVariants: vi.fn().mockReturnValue(null),
}))

vi.mock('@/lib/youtube/ab-start', () => ({
  startAbTestInternal: vi.fn().mockResolvedValue({ ok: false }),
}))

vi.mock('@/lib/cron-health', () => ({
  recordCronSuccess: vi.fn(),
  recordCronFailure: vi.fn(),
}))

// ── Import after mocks ──────────────────────────────────────────────────────
import { GET } from '@/app/api/cron/ab-evaluate/route'
import { calculateBayesianConfidence } from '@/lib/youtube/ab-statistics'

// ── Helpers ─────────────────────────────────────────────────────────────────
function makeRequest(authHeader?: string): NextRequest {
  return {
    headers: new Headers(authHeader ? { authorization: authHeader } : {}),
  } as unknown as NextRequest
}

function activeTestsQuery(data: unknown[]) {
  // Returns active tests for .eq('status', 'active'), empty array for all
  // other chained queries (Phase 1 playoff drafts, Phase 3 retry, Phase 4 candidates).
  const emptyChain = chainableMock()
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn((col: string, val: string) => {
        if (col === 'status' && val === 'active') {
          return Promise.resolve({ data, error: null })
        }
        return emptyChain
      }),
      // Phase 3 retry query starts with .not() after .select()
      not: vi.fn().mockReturnValue(emptyChain),
    }),
  }
}

/** Builds a deeply chainable Supabase mock that resolves { error: null } at any point. */
function chainableMock(): Record<string, unknown> {
  const resolved = Promise.resolve({ error: null })
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop) {
      if (prop === 'then') return resolved.then.bind(resolved)
      if (prop === 'catch') return resolved.catch.bind(resolved)
      if (prop === 'finally') return (resolved as Promise<unknown>).finally.bind(resolved)
      return vi.fn().mockReturnValue(new Proxy({}, handler))
    },
  }
  return new Proxy({}, handler)
}

function updateQuery() {
  return {
    update: vi.fn().mockReturnValue(chainableMock()),
  }
}

function singleQuery(data: unknown) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data, error: null }),
      }),
    }),
  }
}

function makeTest(overrides: Record<string, unknown> = {}) {
  return {
    id: 'test-1',
    site_id: 'site-1',
    youtube_video_id: 'vid-1',
    status: 'active',
    test_type: 'thumbnail',
    name: 'Test AB',
    started_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    original_title: 'Original Title',
    original_description: 'Original desc',
    consecutive_confident_evals: 0,
    config: {
      burn_in_days: 0,
      confidence_threshold: 0.95,
      stability_threshold: 3,
      auto_apply_winner: true,
      rotation_pattern: 'abba',
      max_duration_days: 14,
    },
    variants: [
      { id: 'variant-a', sort_order: 0, label: 'A', blob_url: 'https://blob/a.png', title_text: null, description_text: null, metadata: {}, is_original: true },
      { id: 'variant-b', sort_order: 1, label: 'B', blob_url: 'https://blob/b.png', title_text: null, description_text: null, metadata: {}, is_original: false },
    ],
    cycles: [
      { id: 'c1', cycle_number: 0, variant_id: 'variant-a', backfill_status: 'confirmed', impressions: 2000, clicks: 100 },
      { id: 'c2', cycle_number: 1, variant_id: 'variant-b', backfill_status: 'confirmed', impressions: 2000, clicks: 120 },
    ],
    ...overrides,
  }
}

// ── Tests ───────────────────────────────────────────────────────────────────
describe('GET /api/cron/ab-evaluate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without Authorization header', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('unauthorized')
  })

  it('returns 401 with wrong CRON_SECRET', async () => {
    const res = await GET(makeRequest('Bearer wrong-secret'))
    expect(res.status).toBe(401)
  })

  it('returns evaluated: 0 when no active tests', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'ab_tests') return activeTestsQuery([])
      return {}
    })

    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.evaluated).toBe(0)
  })

  it('evaluates active tests and updates consecutive confidence counter', async () => {
    const test = makeTest()

    mockFrom.mockImplementation((table: string) => {
      if (table === 'ab_tests') {
        return {
          ...activeTestsQuery([test]),
          ...updateQuery(),
        }
      }
      if (table === 'ab_test_cycles') return updateQuery()
      return {}
    })

    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.evaluated).toBe(1)
    expect(calculateBayesianConfidence).toHaveBeenCalled()
  })

  it('captures Sentry exception when a test evaluation throws', async () => {
    const badTest = makeTest({ variants: 'invalid' })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'ab_tests') return activeTestsQuery([badTest])
      return {}
    })

    const Sentry = await import('@sentry/nextjs')
    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.evaluated).toBe(0)
    expect(Sentry.captureException).toHaveBeenCalled()
  })
})
