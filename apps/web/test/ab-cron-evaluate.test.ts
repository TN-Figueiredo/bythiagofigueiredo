import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/social/token-refresh', () => ({ ensureFreshToken: vi.fn() }))
vi.mock('@/lib/youtube/ab-statistics', () => ({ calculateBayesianConfidence: vi.fn() }))
vi.mock('@/lib/youtube/ab-youtube', () => ({ setThumbnail: vi.fn().mockResolvedValue({ highUrl: 'https://i.ytimg.com/vi/test/hqdefault.jpg' }), fetchVariantImageBuffer: vi.fn() }))
vi.mock('@/lib/youtube/ab-metadata', () => ({ updateVideoMetadata: vi.fn() }))
vi.mock('@/lib/youtube/ab-templates', () => ({ resolveTemplates: vi.fn() }))
vi.mock('@/lib/youtube/ab-preflight', () => ({ preflightTokenCheck: vi.fn(() => ({ ok: true, accessToken: 'token-retry' })) }))
vi.mock('@/lib/youtube/notification-service', () => ({ buildNotification: vi.fn(() => ({ type: 'ab_test_completed', priority: 3, title: 'Test', message: 'Done', dedup_key: 'k', video_id: null, action_href: null })) }))
vi.mock('@/lib/youtube/analytics-sync', () => ({ getIsoWeek: vi.fn(() => '2026-W20') }))
vi.mock('@/lib/youtube/ab-playoff', () => ({ checkPlayoffEligibility: vi.fn(() => ({ eligible: false })), selectPlayoffVariants: vi.fn(() => null) }))
vi.mock('@/lib/youtube/ab-start', () => ({ startAbTestInternal: vi.fn(() => ({ ok: false })) }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/lib/cron-health', () => ({ recordCronSuccess: vi.fn(), recordCronFailure: vi.fn() }))
vi.mock('@/lib/youtube/ab-escalation', () => ({ checkAndEscalate: vi.fn() }))
vi.mock('@/lib/notifications/fan-out-to-admins', () => ({ fanOutToSiteAdmins: vi.fn().mockResolvedValue(1) }))

import { GET } from '@/app/api/cron/ab-evaluate/route'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { fanOutToSiteAdmins } from '@/lib/notifications/fan-out-to-admins'
import { ensureFreshToken } from '@/lib/social/token-refresh'
import { calculateBayesianConfidence } from '@/lib/youtube/ab-statistics'
import { setThumbnail, fetchVariantImageBuffer } from '@/lib/youtube/ab-youtube'
import { updateVideoMetadata } from '@/lib/youtube/ab-metadata'
import { resolveTemplates } from '@/lib/youtube/ab-templates'
import { checkPlayoffEligibility, selectPlayoffVariants } from '@/lib/youtube/ab-playoff'

function createCronRequest(secret: string) {
  return new NextRequest(new URL('http://localhost:3000/api/cron/ab-evaluate'), {
    headers: { authorization: `Bearer ${secret}` },
  })
}

function makeActiveTest(overrides: Record<string, unknown> = {}) {
  const startedAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString() // 8 days ago
  return {
    id: 'test-1',
    site_id: 'site-1',
    youtube_video_id: 'vid-1',
    status: 'active',
    test_type: 'thumbnail',
    started_at: startedAt,
    created_at: startedAt,
    original_title: 'Original Title',
    original_description: 'Original Description',
    consecutive_confident_evals: 3,
    config: {
      confidence_threshold: 0.95,
      burn_in_days: 0,
      auto_apply_winner: true,
      max_duration_days: 14,
      stability_threshold: 3,
    },
    variants: [
      { id: 'v1', label: 'original', is_original: true, sort_order: 0, blob_url: 'https://blob/a.jpg', title_text: null, description_text: null, metadata: {} },
      { id: 'v2', label: 'variant_b', is_original: false, sort_order: 1, blob_url: 'https://blob/b.jpg', title_text: 'New Title', description_text: null, metadata: {} },
    ],
    cycles: Array.from({ length: 16 }, (_, i) => ({
      id: `c${i}`,
      variant_id: i % 2 === 0 ? 'v1' : 'v2',
      cycle_number: i,
      backfill_status: 'confirmed',
      impressions: 2000,
      clicks: i % 2 === 0 ? 100 : 130,
      ended_at: new Date().toISOString(),
    })),
    ...overrides,
  }
}

function buildSupabaseMock(opts: { tests: unknown[]; trackedLinks?: { template_name: string; short_code: string }[] }) {
  const updateCalls: { table: string; data: unknown }[] = []
  const insertCalls: { table: string; data: unknown }[] = []

  const fromMock = vi.fn((table: string) => {
    if (table === 'ab_tests') {
      // Build a chainable proxy that resolves to opts.tests on the first .eq()
      // (active tests query) and to [] for deeper chains (playoff Phase 1, 3, retry).
      const makeChain = (resolveWith: unknown): Record<string, unknown> => {
        const chain: Record<string, unknown> = {}
        for (const method of ['eq', 'not', 'lte', 'lt', 'in', 'is']) {
          chain[method] = vi.fn(() => chain)
        }
        // Make the chain thenable so it resolves when awaited at any depth
        chain.then = (resolve: (v: unknown) => void) => resolve(resolveWith)
        return chain
      }
      const emptyChain = makeChain({ data: [] })
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn((col: string, val: string) => {
            // Active tests query: .eq('status', 'active') — return opts.tests
            if (col === 'status' && val === 'active') {
              return Promise.resolve({ data: opts.tests })
            }
            // Playoff queries: deeper chain, resolve to empty
            return makeChain({ data: [] })
          }),
          // Phase 3 retry query starts with .not() after .select()
          not: vi.fn(() => emptyChain),
        }),
        update: vi.fn((data: unknown) => {
          updateCalls.push({ table, data })
          return {
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }
        }),
      }
    }
    if (table === 'youtube_videos') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { youtube_video_id: 'YT_123' }, error: null }),
          }),
        }),
      }
    }
    if (table === 'ab_test_cycles') {
      return {
        update: vi.fn((data: unknown) => {
          updateCalls.push({ table, data })
          return {
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }
        }),
      }
    }
    if (table === 'ab_test_tracked_links') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: opts.trackedLinks ?? [], error: null }),
        }),
      }
    }
    if (table === 'optimization_cycles') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
        update: vi.fn((data: unknown) => {
          updateCalls.push({ table, data })
          return { eq: vi.fn().mockResolvedValue({ data: null, error: null }) }
        }),
      }
    }
    return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() }
  })

  const rpcMock = vi.fn().mockResolvedValue({ data: null, error: null })
  const client = { from: fromMock, rpc: rpcMock }
  ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(client)

  return { client, fromMock, updateCalls, insertCalls }
}

beforeEach(() => {
  vi.stubEnv('CRON_SECRET', 'test-secret')
  vi.stubEnv('LINKS_SHORT_DOMAIN', 'go.test.com')
  vi.clearAllMocks()
  ;(ensureFreshToken as ReturnType<typeof vi.fn>).mockResolvedValue({
    accessToken: 'token-123',
  })
  ;(fetchVariantImageBuffer as ReturnType<typeof vi.fn>).mockResolvedValue({
    buffer: Buffer.from('img'),
    contentType: 'image/jpeg',
  })
  ;(resolveTemplates as ReturnType<typeof vi.fn>).mockImplementation(
    (text: string) => text
  )
  ;(calculateBayesianConfidence as ReturnType<typeof vi.fn>).mockReturnValue({
    winnerId: 'v2',
    confidence: 0.97,
    probabilities: { v1: 0.03, v2: 0.97 },
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('GET /api/cron/ab-evaluate', () => {
  it('returns 401 without auth header', async () => {
    const req = new NextRequest(new URL('http://localhost:3000/api/cron/ab-evaluate'))
    const res = await GET(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('unauthorized')
  })

  it('returns { evaluated: 0 } with no active tests', async () => {
    buildSupabaseMock({ tests: [] })
    const req = createCronRequest('test-secret')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.evaluated).toBe(0)
  })

  it('skips test when < 2 variants have impressions', async () => {
    const test = makeActiveTest({
      cycles: [
        // Only v1 has impressions, v2 has 0
        { id: 'c0', variant_id: 'v1', cycle_number: 0, backfill_status: 'confirmed', impressions: 2000, clicks: 100, ended_at: new Date().toISOString() },
        { id: 'c1', variant_id: 'v2', cycle_number: 1, backfill_status: 'confirmed', impressions: 0, clicks: 0, ended_at: new Date().toISOString() },
      ],
    })
    buildSupabaseMock({ tests: [test] })
    const req = createCronRequest('test-secret')
    const res = await GET(req)
    const body = await res.json()

    expect(body.evaluated).toBe(1)
    expect(calculateBayesianConfidence).not.toHaveBeenCalled()
  })

  it('updates consecutive_confident_evals when confidence passes threshold', async () => {
    const test = makeActiveTest({
      consecutive_confident_evals: 1,
      // Make gates NOT all pass (too few cycles to auto-resolve)
      cycles: Array.from({ length: 4 }, (_, i) => ({
        id: `c${i}`,
        variant_id: i % 2 === 0 ? 'v1' : 'v2',
        cycle_number: i,
        backfill_status: 'confirmed',
        impressions: 2000,
        clicks: i % 2 === 0 ? 100 : 130,
        ended_at: new Date().toISOString(),
      })),
    })
    ;(calculateBayesianConfidence as ReturnType<typeof vi.fn>).mockReturnValue({
      winnerId: 'v2',
      confidence: 0.97,
      probabilities: { v1: 0.03, v2: 0.97 },
    })

    const { updateCalls } = buildSupabaseMock({ tests: [test] })
    const req = createCronRequest('test-secret')
    await GET(req)

    // Should increment consecutive_confident_evals from 1 to 2
    expect(updateCalls).toContainEqual(
      expect.objectContaining({
        table: 'ab_tests',
        data: { consecutive_confident_evals: 2 },
      })
    )
  })

  it('resets consecutive_confident_evals to 0 when confidence drops below threshold', async () => {
    const test = makeActiveTest({ consecutive_confident_evals: 3 })
    ;(calculateBayesianConfidence as ReturnType<typeof vi.fn>).mockReturnValue({
      winnerId: 'v2',
      confidence: 0.65,
      probabilities: { v1: 0.35, v2: 0.65 },
    })

    const { updateCalls } = buildSupabaseMock({ tests: [test] })
    const req = createCronRequest('test-secret')
    await GET(req)

    expect(updateCalls).toContainEqual(
      expect.objectContaining({
        table: 'ab_tests',
        data: { consecutive_confident_evals: 0 },
      })
    )
  })

  it('starts grace period when all gates pass for the first time', async () => {
    const test = makeActiveTest()
    const { updateCalls, client } = buildSupabaseMock({ tests: [test] })

    const req = createCronRequest('test-secret')
    const res = await GET(req)
    const body = await res.json()

    // Should NOT resolve yet — grace period started
    expect(body.resolved).toBe(0)
    expect(setThumbnail).not.toHaveBeenCalled()

    // Should set grace_expires_at and winner_variant_id
    expect(updateCalls).toContainEqual(
      expect.objectContaining({
        table: 'ab_tests',
        data: expect.objectContaining({
          grace_expires_at: expect.any(String),
          winner_variant_id: 'v2',
          confidence_at_completion: 0.97,
        }),
      })
    )

    // Should send winner_pending notification via fanOutToSiteAdmins
    expect(fanOutToSiteAdmins).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'youtube.ab_test_winner_pending' }),
    )
  })

  it('auto-resolves when grace period has expired (thumbnail test)', async () => {
    // grace_expires_at set to 1 hour ago — should apply now
    const test = makeActiveTest({
      grace_expires_at: new Date(Date.now() - 3600000).toISOString(),
      winner_variant_id: 'v2',
    })
    const { updateCalls } = buildSupabaseMock({ tests: [test] })

    const req = createCronRequest('test-secret')
    const res = await GET(req)
    const body = await res.json()

    expect(body.resolved).toBe(1)
    expect(fetchVariantImageBuffer).toHaveBeenCalledWith('https://blob/b.jpg')
    expect(setThumbnail).toHaveBeenCalledWith('YT_123', expect.any(Buffer), 'image/jpeg', 'token-123')

    // Should close open cycles
    expect(updateCalls).toContainEqual(
      expect.objectContaining({
        table: 'ab_test_cycles',
        data: expect.objectContaining({ ended_at: expect.any(String) }),
      })
    )

    // Should complete the test with revert_expires_at
    expect(updateCalls).toContainEqual(
      expect.objectContaining({
        table: 'ab_tests',
        data: expect.objectContaining({
          status: 'completed',
          completed_reason: 'auto_resolve',
          applied_by: 'auto',
          winner_applied_at: expect.any(String),
          revert_expires_at: expect.any(String),
        }),
      })
    )
  })

  it('does not apply when grace period has not expired yet', async () => {
    // grace_expires_at set 12 hours in the future
    const test = makeActiveTest({
      grace_expires_at: new Date(Date.now() + 12 * 3600000).toISOString(),
      winner_variant_id: 'v2',
    })
    buildSupabaseMock({ tests: [test] })

    const req = createCronRequest('test-secret')
    const res = await GET(req)
    const body = await res.json()

    expect(body.resolved).toBe(0)
    expect(setThumbnail).not.toHaveBeenCalled()
  })

  it('auto-resolves title test with original as winner — calls updateVideoMetadata with original_title', async () => {
    const test = makeActiveTest({
      test_type: 'title',
      grace_expires_at: new Date(Date.now() - 3600000).toISOString(),
      winner_variant_id: 'v1',
      variants: [
        { id: 'v1', label: 'original', is_original: true, sort_order: 0, blob_url: null, title_text: null, description_text: null, metadata: {} },
        { id: 'v2', label: 'variant_b', is_original: false, sort_order: 1, blob_url: null, title_text: 'Challenger', description_text: null, metadata: {} },
      ],
    })
    ;(calculateBayesianConfidence as ReturnType<typeof vi.fn>).mockReturnValue({
      winnerId: 'v1',
      confidence: 0.97,
      probabilities: { v1: 0.97, v2: 0.03 },
    })

    buildSupabaseMock({ tests: [test] })
    const req = createCronRequest('test-secret')
    await GET(req)

    // Original wins, title_text is null, so fallback to test.original_title
    expect(updateVideoMetadata).toHaveBeenCalledWith('YT_123', 'Original Title', null, 'token-123')
    expect(setThumbnail).not.toHaveBeenCalled()
  })

  it('auto-resolves description test — calls resolveTemplates then updateVideoMetadata', async () => {
    const test = makeActiveTest({
      test_type: 'description',
      grace_expires_at: new Date(Date.now() - 3600000).toISOString(),
      winner_variant_id: 'v2',
      variants: [
        { id: 'v1', label: 'original', is_original: true, sort_order: 0, blob_url: null, title_text: null, description_text: null, metadata: {} },
        { id: 'v2', label: 'variant_b', is_original: false, sort_order: 1, blob_url: null, title_text: null, description_text: 'New Desc {{link:promo}}', metadata: {} },
      ],
    })
    const trackedLinks = [{ template_name: 'promo', short_code: 'XyZ789' }]
    ;(resolveTemplates as ReturnType<typeof vi.fn>).mockReturnValue(
      'New Desc https://go.test.com/XyZ789'
    )

    buildSupabaseMock({ tests: [test], trackedLinks })
    const req = createCronRequest('test-secret')
    await GET(req)

    expect(resolveTemplates).toHaveBeenCalledWith(
      'New Desc {{link:promo}}',
      { promo: 'https://go.test.com/XyZ789' }
    )
    expect(updateVideoMetadata).toHaveBeenCalledWith(
      'YT_123',
      null,
      'New Desc https://go.test.com/XyZ789',
      'token-123'
    )
    expect(setThumbnail).not.toHaveBeenCalled()
  })

  it('cancels grace period when confidence drops', async () => {
    const test = makeActiveTest({
      consecutive_confident_evals: 1,
      grace_expires_at: new Date(Date.now() + 12 * 3600000).toISOString(),
      winner_variant_id: 'v2',
    })
    ;(calculateBayesianConfidence as ReturnType<typeof vi.fn>).mockReturnValue({
      winnerId: 'v2',
      confidence: 0.65,
      probabilities: { v1: 0.35, v2: 0.65 },
    })

    const { updateCalls } = buildSupabaseMock({ tests: [test] })
    const req = createCronRequest('test-secret')
    await GET(req)

    // Should clear grace_expires_at
    expect(updateCalls).toContainEqual(
      expect.objectContaining({
        table: 'ab_tests',
        data: expect.objectContaining({
          grace_expires_at: null,
          winner_variant_id: null,
          confidence_at_completion: null,
        }),
      })
    )
  })

  it('marks test as inconclusive when max_duration_days exceeded', async () => {
    const startedAt = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString() // 15 days ago
    const test = makeActiveTest({
      started_at: startedAt,
      created_at: startedAt,
      consecutive_confident_evals: 0,
      config: {
        confidence_threshold: 0.95,
        burn_in_days: 0,
        auto_apply_winner: true,
        max_duration_days: 14,
        stability_threshold: 3,
      },
    })
    // Low confidence — gates won't all pass
    ;(calculateBayesianConfidence as ReturnType<typeof vi.fn>).mockReturnValue({
      winnerId: 'v2',
      confidence: 0.65,
      probabilities: { v1: 0.35, v2: 0.65 },
    })

    const { updateCalls } = buildSupabaseMock({ tests: [test] })
    const req = createCronRequest('test-secret')
    await GET(req)

    expect(updateCalls).toContainEqual(
      expect.objectContaining({
        table: 'ab_tests',
        data: expect.objectContaining({
          status: 'completed',
          completed_reason: 'inconclusive',
        }),
      })
    )
  })

  it('does NOT resolve when gates fail and within duration', async () => {
    const startedAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() // 3 days ago (< 7 min_duration)
    const test = makeActiveTest({
      started_at: startedAt,
      created_at: startedAt,
      consecutive_confident_evals: 0,
      config: {
        confidence_threshold: 0.95,
        burn_in_days: 0,
        auto_apply_winner: true,
        max_duration_days: 14,
        stability_threshold: 3,
      },
    })
    ;(calculateBayesianConfidence as ReturnType<typeof vi.fn>).mockReturnValue({
      winnerId: 'v2',
      confidence: 0.65,
      probabilities: { v1: 0.35, v2: 0.65 },
    })

    const { updateCalls } = buildSupabaseMock({ tests: [test] })
    const req = createCronRequest('test-secret')
    const res = await GET(req)
    const body = await res.json()

    expect(body.resolved).toBe(0)
    // Should only have the consecutive_confident_evals update, no completion
    const completionUpdates = updateCalls.filter(
      c => c.table === 'ab_tests' && (c.data as Record<string, unknown>).status === 'completed'
    )
    expect(completionUpdates).toHaveLength(0)
    expect(setThumbnail).not.toHaveBeenCalled()
    expect(updateVideoMetadata).not.toHaveBeenCalled()
  })

  it('auto-resolves combo test (thumbnail + title) when grace period expired', async () => {
    const test = makeActiveTest({
      test_type: 'combo',
      grace_expires_at: new Date(Date.now() - 3600000).toISOString(),
      winner_variant_id: 'v2',
      variants: [
        { id: 'v1', label: 'original', is_original: true, sort_order: 0, blob_url: 'https://blob/a.jpg', title_text: null, description_text: null, metadata: {} },
        { id: 'v2', label: 'variant_b', is_original: false, sort_order: 1, blob_url: 'https://blob/b.jpg', title_text: 'Combo Title B', description_text: null, metadata: {} },
      ],
    })

    const { updateCalls } = buildSupabaseMock({ tests: [test] })
    const req = createCronRequest('test-secret')
    const res = await GET(req)
    const body = await res.json()

    expect(body.resolved).toBe(1)
    // Thumbnail applied
    expect(fetchVariantImageBuffer).toHaveBeenCalledWith('https://blob/b.jpg')
    expect(setThumbnail).toHaveBeenCalledWith('YT_123', expect.any(Buffer), 'image/jpeg', 'token-123')
    // Metadata (title + description fallback from original) applied
    expect(updateVideoMetadata).toHaveBeenCalledWith('YT_123', 'Combo Title B', 'Original Description', 'token-123')
    // Test marked completed
    expect(updateCalls).toContainEqual(
      expect.objectContaining({
        table: 'ab_tests',
        data: expect.objectContaining({
          status: 'completed',
          completed_reason: 'auto_resolve',
        }),
      })
    )
  })

  it('does not start grace when auto_apply_winner is false', async () => {
    const test = makeActiveTest({
      config: {
        confidence_threshold: 0.95,
        burn_in_days: 0,
        auto_apply_winner: false,
        max_duration_days: 14,
        stability_threshold: 3,
      },
    })
    ;(calculateBayesianConfidence as ReturnType<typeof vi.fn>).mockReturnValue({
      winnerId: 'v2',
      confidence: 0.97,
      probabilities: { v1: 0.03, v2: 0.97 },
    })

    const { updateCalls, client } = buildSupabaseMock({ tests: [test] })
    const req = createCronRequest('test-secret')
    const res = await GET(req)
    const body = await res.json()

    // No grace period set
    const graceUpdates = updateCalls.filter(
      c => c.table === 'ab_tests' && (c.data as Record<string, unknown>).grace_expires_at
    )
    expect(graceUpdates).toHaveLength(0)

    // No thumbnail/title applied
    expect(setThumbnail).not.toHaveBeenCalled()
    expect(updateVideoMetadata).not.toHaveBeenCalled()

    // Not marked completed (stays active, no auto_resolve)
    const completionUpdates = updateCalls.filter(
      c => c.table === 'ab_tests' && (c.data as Record<string, unknown>).status === 'completed'
    )
    expect(completionUpdates).toHaveLength(0)

    // Still evaluated
    expect(body.evaluated).toBe(1)
    expect(body.resolved).toBe(0)
  })

  it('error in one test does not abort evaluation of others', async () => {
    const test1 = makeActiveTest({ id: 'test-bad' })
    const test2 = makeActiveTest({ id: 'test-good', consecutive_confident_evals: 0 })

    // First test throws during confidence calculation, second works normally
    ;(calculateBayesianConfidence as ReturnType<typeof vi.fn>)
      .mockImplementationOnce(() => { throw new Error('stats explosion') })
      .mockReturnValueOnce({
        winnerId: 'v2',
        confidence: 0.65,
        probabilities: { v1: 0.35, v2: 0.65 },
      })

    buildSupabaseMock({ tests: [test1, test2] })
    const req = createCronRequest('test-secret')
    const res = await GET(req)
    const body = await res.json()

    // First test errored, second evaluated successfully
    expect(body.errors).toBe(1)
    expect(body.evaluated).toBe(1)
  })

  it('creates playoff when round 1 test is inconclusive and eligible', async () => {
    // Phase 4 only runs after the active-test loop. We need at least 1 active test
    // to avoid the early return. Use a test with < 2 variants having impressions (quickly skipped).
    const skippableActiveTest = makeActiveTest({
      id: 'active-skip',
      cycles: [
        { id: 'c0', variant_id: 'v1', cycle_number: 0, backfill_status: 'confirmed', impressions: 100, clicks: 5, ended_at: new Date().toISOString() },
        { id: 'c1', variant_id: 'v2', cycle_number: 1, backfill_status: 'confirmed', impressions: 0, clicks: 0, ended_at: new Date().toISOString() },
      ],
    })

    const completedTest = {
      id: 'completed-1',
      site_id: 'site-1',
      youtube_video_id: 'vid-1',
      status: 'completed',
      test_type: 'thumbnail',
      completed_reason: 'inconclusive',
      round_number: 1,
      parent_test_id: null,
      playoff_test_id: null,
      started_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      name: 'Test 1',
      variants: [
        { id: 'pv1', label: 'original', is_original: true, sort_order: 0, blob_url: 'https://blob/a.jpg', title_text: null, description_text: null, metadata: {} },
        { id: 'pv2', label: 'variant_b', is_original: false, sort_order: 1, blob_url: 'https://blob/b.jpg', title_text: null, description_text: null, metadata: {} },
      ],
      cycles: [
        { id: 'pc0', variant_id: 'pv1', cycle_number: 0, backfill_status: 'confirmed', impressions: 3000, clicks: 150, ended_at: new Date().toISOString() },
        { id: 'pc1', variant_id: 'pv2', cycle_number: 1, backfill_status: 'confirmed', impressions: 3000, clicks: 155, ended_at: new Date().toISOString() },
      ],
    }

    // Override playoff eligibility mocks
    ;(checkPlayoffEligibility as ReturnType<typeof vi.fn>).mockReturnValue({ eligible: true, reason: 'close_race' })
    ;(selectPlayoffVariants as ReturnType<typeof vi.fn>).mockReturnValue({ variantIds: ['pv1', 'pv2'], labels: ['original', 'variant_b'] })

    // Custom mock: active tests query returns skippable test,
    // Phase 4 completed query returns completedTest
    const rpcMock = vi.fn().mockResolvedValue({ data: null, error: null })

    let selectCallCount = 0
    const fromMock = vi.fn((table: string) => {
      if (table === 'ab_tests') {
        return {
          select: vi.fn().mockImplementation(() => {
            selectCallCount++
            const call = selectCallCount

            // Call 1: Phase 1 — draft playoffs (.eq('status', 'draft'))
            if (call === 1) {
              const chain: Record<string, unknown> = {}
              for (const m of ['eq', 'not', 'lte', 'lt', 'in', 'is']) chain[m] = vi.fn(() => chain)
              chain.then = (r: (v: unknown) => void) => r({ data: [] })
              return { eq: vi.fn(() => chain), not: vi.fn(() => chain) }
            }

            // Call 2: Phase 2 — active tests query (.eq('status', 'active'))
            if (call === 2) {
              return {
                eq: vi.fn((_col: string, _val: string) => {
                  return Promise.resolve({ data: [skippableActiveTest] })
                }),
                not: vi.fn(() => {
                  const chain: Record<string, unknown> = {}
                  for (const m of ['eq', 'not', 'lte', 'lt', 'in', 'is']) chain[m] = vi.fn(() => chain)
                  chain.then = (r: (v: unknown) => void) => r({ data: [] })
                  return chain
                }),
              }
            }

            // Call 3: Phase 3 — retry applies (.not('grace_expires_at'...))
            if (call === 3) {
              const chain: Record<string, unknown> = {}
              for (const m of ['eq', 'not', 'lte', 'lt', 'in', 'is']) chain[m] = vi.fn(() => chain)
              chain.then = (r: (v: unknown) => void) => r({ data: [] })
              return { eq: vi.fn(() => chain), not: vi.fn(() => chain) }
            }

            // Call 4: Phase 4 — completed inconclusive tests
            if (call === 4) {
              const chain: Record<string, unknown> = {}
              for (const m of ['eq', 'not', 'lte', 'lt', 'in', 'is']) chain[m] = vi.fn(() => chain)
              chain.then = (r: (v: unknown) => void) => r({ data: [completedTest] })
              return { eq: vi.fn(() => chain), not: vi.fn(() => chain) }
            }

            // Fallback
            const chain: Record<string, unknown> = {}
            for (const m of ['eq', 'not', 'lte', 'lt', 'in', 'is']) chain[m] = vi.fn(() => chain)
            chain.then = (r: (v: unknown) => void) => r({ data: [] })
            return { eq: vi.fn(() => chain), not: vi.fn(() => chain) }
          }),
          update: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          })),
        }
      }
      if (table === 'optimization_cycles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
        }
      }
      if (table === 'ab_test_tracked_links') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() }
    })

    const client = { from: fromMock, rpc: rpcMock }
    ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(client)

    const req = createCronRequest('test-secret')
    const res = await GET(req)
    const body = await res.json()

    expect(body.playoffs_created).toBe(1)
    expect(rpcMock).toHaveBeenCalledWith('create_playoff_test', {
      p_parent_test_id: 'completed-1',
      p_variant_ids: ['pv1', 'pv2'],
      p_cooldown_hours: 4,
    })
  })
})
