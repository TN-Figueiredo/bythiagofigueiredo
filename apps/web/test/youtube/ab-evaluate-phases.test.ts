import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── Module mocks (must be before imports) ──────────────────────────────────
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/social/token-refresh', () => ({ ensureFreshToken: vi.fn() }))
vi.mock('@/lib/youtube/ab-statistics', () => ({ calculateBayesianConfidence: vi.fn() }))
vi.mock('@/lib/youtube/ab-youtube', () => ({ setThumbnail: vi.fn(), fetchVariantImageBuffer: vi.fn() }))
vi.mock('@/lib/youtube/ab-metadata', () => ({ updateVideoMetadata: vi.fn() }))
vi.mock('@/lib/youtube/ab-templates', () => ({ resolveTemplates: vi.fn() }))
vi.mock('@/lib/youtube/ab-preflight', () => ({
  preflightTokenCheck: vi.fn(() => ({ ok: true, accessToken: 'token-retry' })),
}))
vi.mock('@/lib/youtube/notification-service', () => ({
  buildNotification: vi.fn(() => ({
    type: 'ab_test_completed', priority: 3, title: 'Test', message: 'Done',
    dedup_key: 'k', video_id: null, action_href: null,
  })),
}))
vi.mock('@/lib/youtube/analytics-sync', () => ({ getIsoWeek: vi.fn(() => '2026-W22') }))
vi.mock('@/lib/youtube/ab-playoff', () => ({
  checkPlayoffEligibility: vi.fn(() => ({ eligible: false })),
  selectPlayoffVariants: vi.fn(() => null),
}))
vi.mock('@/lib/youtube/ab-start', () => ({ startAbTestInternal: vi.fn() }))
vi.mock('@/lib/youtube/thumbnail-library', () => ({ autoImportWinner: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))

import {
  phaseEvaluateActiveTests,
  phaseRetryFailedApplies,
  phaseAutoStartPlayoffs,
} from '@/lib/youtube/ab-evaluate-phases'
import { calculateBayesianConfidence } from '@/lib/youtube/ab-statistics'
import { fetchVariantImageBuffer } from '@/lib/youtube/ab-youtube'
import { ensureFreshToken } from '@/lib/social/token-refresh'
import { resolveTemplates } from '@/lib/youtube/ab-templates'
import { startAbTestInternal } from '@/lib/youtube/ab-start'

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Build a mock active test row matching the shape phaseEvaluateActiveTests expects */
function makeActiveTest(overrides: Record<string, unknown> = {}) {
  const startedAt = new Date(Date.now() - 8 * 24 * 3_600_000).toISOString() // 8 days ago
  return {
    id: 'test-1',
    site_id: 'site-1',
    youtube_video_id: 'vid-1',
    name: 'Test AB',
    status: 'active',
    test_type: 'thumbnail',
    started_at: startedAt,
    created_at: startedAt,
    original_title: 'Original Title',
    original_description: 'Original Description',
    consecutive_confident_evals: 3,
    grace_expires_at: null as string | null,
    winner_variant_id: null as string | null,
    confidence_at_completion: null as number | null,
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
      backfill_status: 'confirmed' as const,
      impressions: 2000,
      clicks: i % 2 === 0 ? 100 : 130,
      ended_at: new Date().toISOString(),
    })),
    ...overrides,
  }
}

/**
 * Build a minimal supabase mock whose `.from()` handles the tables
 * that each phase function queries. Returns tracking arrays for assertions.
 */
function buildSupabaseMock(opts: {
  /** Phase 2: active tests returned by from('ab_tests').select().eq('status','active') */
  activeTests?: unknown[]
  /** Phase 1: draft round-2 playoffs returned by from('ab_tests').select().eq('status','draft') */
  draftPlayoffs?: unknown[]
  /** Phase 3: pending applies returned by from('ab_tests').select().not(...) chain */
  pendingApplies?: unknown[]
} = {}) {
  const updateCalls: { table: string; data: unknown }[] = []
  const rpcCalls: { fn: string; args: unknown }[] = []

  const makeTerminalChain = (resolveWith: unknown): Record<string, unknown> => {
    const chain: Record<string, unknown> = {}
    for (const m of ['eq', 'not', 'lte', 'lt', 'in', 'is']) {
      chain[m] = vi.fn(() => chain)
    }
    chain.then = (resolve: (v: unknown) => void) => resolve(resolveWith)
    return chain
  }

  const fromMock = vi.fn((table: string) => {
    if (table === 'ab_tests') {
      return {
        select: vi.fn().mockImplementation(() => {
          // Return an object whose first method call determines the dataset.
          // Phase 2 starts with .eq('status', 'active')
          // Phase 1 starts with .eq('status', 'draft')
          // Phase 3 starts with .not('grace_expires_at', ...)
          return {
            eq: vi.fn((_col: string, _val: unknown) => {
              if (_col === 'status' && _val === 'active') {
                return Promise.resolve({ data: opts.activeTests ?? [] })
              }
              if (_col === 'status' && _val === 'draft') {
                return makeTerminalChain({ data: opts.draftPlayoffs ?? [] })
              }
              return makeTerminalChain({ data: [] })
            }),
            not: vi.fn(() => makeTerminalChain({ data: opts.pendingApplies ?? [] })),
          }
        }),
        update: vi.fn((data: unknown) => {
          updateCalls.push({ table, data })
          return {
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
              is: vi.fn().mockResolvedValue({ data: null, error: null }),
              then: (r: (v: unknown) => void) => r({ data: null, error: null }),
            }),
          }
        }),
      }
    }
    if (table === 'youtube_videos') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { youtube_video_id: 'YT_123', channel_id: 'ch-1' }, error: null }),
          }),
        }),
      }
    }
    if (table === 'youtube_channels') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { channel_id: 'UCxxx' }, error: null }),
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
    if (table === 'ab_test_variants') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'v2', label: 'variant_b', blob_url: 'https://blob/b.jpg', title_text: 'New Title', description_text: null },
              error: null,
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

  const rpcMock = vi.fn((...args: unknown[]) => {
    rpcCalls.push({ fn: args[0] as string, args: args[1] })
    return Promise.resolve({ data: null, error: null })
  })

  const client = { from: fromMock, rpc: rpcMock } as unknown as ReturnType<typeof import('@/lib/supabase/service').getSupabaseServiceClient>

  return { client, fromMock, updateCalls, rpcCalls }
}

// ─── Setup / Teardown ───────────────────────────────────────────────────────

beforeEach(() => {
  vi.stubEnv('LINKS_SHORT_DOMAIN', 'go.test.com')
  vi.clearAllMocks()
  ;(calculateBayesianConfidence as ReturnType<typeof vi.fn>).mockReturnValue({
    winnerId: 'v2',
    confidence: 0.97,
    probabilities: { v1: 0.03, v2: 0.97 },
  })
  ;(ensureFreshToken as ReturnType<typeof vi.fn>).mockResolvedValue({
    accessToken: 'token-123',
  })
  ;(fetchVariantImageBuffer as ReturnType<typeof vi.fn>).mockResolvedValue({
    buffer: Buffer.from('img'),
    contentType: 'image/jpeg',
  })
  ;(resolveTemplates as ReturnType<typeof vi.fn>).mockImplementation(
    (text: string) => text,
  )
})

afterEach(() => {
  vi.unstubAllEnvs()
})

// ─── Phase 2: phaseEvaluateActiveTests ──────────────────────────────────────

describe('phaseEvaluateActiveTests', () => {
  it('sets grace period on first winner detection', async () => {
    // All gates pass (8 days, 16 confirmed cycles, >1000 impressions, consecutive=3)
    // but grace_expires_at is null → should set grace, NOT apply winner
    const test = makeActiveTest()
    const { client, updateCalls, rpcCalls } = buildSupabaseMock({ activeTests: [test] })

    const result = await phaseEvaluateActiveTests(client)

    // Evaluated but NOT resolved — grace period just started
    expect(result.evaluated).toBe(1)
    expect(result.resolved).toBe(0)
    expect(result.errors).toBe(0)

    // Should set grace_expires_at (~24h from now) + winner_variant_id
    const graceUpdate = updateCalls.find(
      c => c.table === 'ab_tests' && (c.data as Record<string, unknown>).grace_expires_at,
    )
    expect(graceUpdate).toBeDefined()
    const graceData = graceUpdate!.data as Record<string, unknown>
    expect(graceData.winner_variant_id).toBe('v2')
    expect(graceData.confidence_at_completion).toBe(0.97)

    // grace_expires_at should be ~24h from now (within 10s tolerance)
    const graceExpires = new Date(graceData.grace_expires_at as string).getTime()
    const expected24h = Date.now() + 24 * 3_600_000
    expect(Math.abs(graceExpires - expected24h)).toBeLessThan(10_000)

    // Should send winner_pending notification
    const pendingNotif = rpcCalls.find(
      c => c.fn === 'create_yt_notification' && (c.args as Record<string, unknown>).p_type === 'ab_test_winner_pending',
    )
    expect(pendingNotif).toBeDefined()
  })

  it('applies winner when grace expired', async () => {
    // Grace period set to 1 hour ago → should apply winner now
    const test = makeActiveTest({
      grace_expires_at: new Date(Date.now() - 3_600_000).toISOString(),
      winner_variant_id: 'v2',
    })
    const { client, updateCalls } = buildSupabaseMock({ activeTests: [test] })

    const result = await phaseEvaluateActiveTests(client)

    expect(result.resolved).toBe(1)
    expect(result.errors).toBe(0)

    // Test should be marked completed with auto_resolve
    const completionUpdate = updateCalls.find(
      c => c.table === 'ab_tests' && (c.data as Record<string, unknown>).status === 'completed',
    )
    expect(completionUpdate).toBeDefined()
    const completionData = completionUpdate!.data as Record<string, unknown>
    expect(completionData.completed_reason).toBe('auto_resolve')
    expect(completionData.applied_by).toBe('auto')
    expect(completionData.winner_applied_at).toBeDefined()
    expect(completionData.revert_expires_at).toBeDefined()

    // result_metadata should contain CTR lift info
    const meta = completionData.result_metadata as Record<string, unknown>
    expect(meta).toBeDefined()
    expect(meta.winner_label).toBe('variant_b')
    expect(typeof meta.ctr_lift_percent).toBe('number')
    expect(typeof meta.total_impressions).toBe('number')
    expect(typeof meta.estimated_monthly_extra_clicks).toBe('number')

    // Open cycles should be closed
    const cycleClose = updateCalls.find(
      c => c.table === 'ab_test_cycles' && (c.data as Record<string, unknown>).ended_at,
    )
    expect(cycleClose).toBeDefined()
  })
})

// ─── Phase 3: phaseRetryFailedApplies ───────────────────────────────────────

describe('phaseRetryFailedApplies', () => {
  it('respects exponential backoff timing', async () => {
    // Attempt 1 requires 1h delay. Grace expired only 30 min ago → should skip.
    const pending = {
      id: 'test-retry',
      site_id: 'site-1',
      winner_variant_id: 'v2',
      youtube_video_id: 'vid-1',
      test_type: 'thumbnail',
      original_title: null,
      original_description: null,
      apply_attempts: 1, // attempt index 1 → needs 4h delay
      name: 'Retry Test',
      grace_expires_at: new Date(Date.now() - 2 * 3_600_000).toISOString(), // expired 2h ago
    }

    const { client, updateCalls } = buildSupabaseMock({ pendingApplies: [pending] })

    const result = await phaseRetryFailedApplies(client)

    // 2h < 4h required delay for attempt index 1 → should be skipped entirely
    expect(result.processed).toBe(0)
    expect(result.resolved).toBe(0)
    expect(result.errors).toBe(0)
    // No update calls for this test (no apply attempt, no error increment)
    const testUpdates = updateCalls.filter(c => c.table === 'ab_tests')
    expect(testUpdates).toHaveLength(0)
  })

  it('sends notification after 3 failures', async () => {
    // apply_attempts=2 → this will be the 3rd attempt. Grace expired long ago (> 12h).
    // Make the apply fail by providing a pending that will trigger an error.
    const pending = {
      id: 'test-fail-3',
      site_id: 'site-1',
      winner_variant_id: 'v2',
      youtube_video_id: 'vid-1',
      test_type: 'thumbnail',
      original_title: null,
      original_description: null,
      apply_attempts: 2,
      name: 'Failing Test',
      grace_expires_at: new Date(Date.now() - 48 * 3_600_000).toISOString(), // expired 48h ago (>> 12h)
    }

    // Make preflight fail so the apply throws
    const { preflightTokenCheck } = await import('@/lib/youtube/ab-preflight')
    ;(preflightTokenCheck as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      reason: 'token_expired',
    })

    const { client, updateCalls, rpcCalls } = buildSupabaseMock({ pendingApplies: [pending] })

    const result = await phaseRetryFailedApplies(client)

    expect(result.errors).toBe(1)
    expect(result.processed).toBe(0)

    // Should increment apply_attempts to 3
    const attemptsUpdate = updateCalls.find(
      c => c.table === 'ab_tests' && (c.data as Record<string, unknown>).apply_attempts === 3,
    )
    expect(attemptsUpdate).toBeDefined()

    // Should send ab_test_apply_failed notification (attempts >= 3)
    const failNotif = rpcCalls.find(
      c => c.fn === 'create_yt_notification' && (c.args as Record<string, unknown>).p_type === 'ab_test_apply_failed',
    )
    expect(failNotif).toBeDefined()
    expect((failNotif!.args as Record<string, unknown>).p_priority).toBe(4)
  })
})

// ─── Phase 1: phaseAutoStartPlayoffs ────────────────────────────────────────

describe('phaseAutoStartPlayoffs', () => {
  it('starts draft round-2 playoffs past cooldown', async () => {
    const playoff = {
      id: 'playoff-1',
      site_id: 'site-1',
      round_number: 2,
      parent_test_id: 'parent-1',
      playoff_start_after: new Date(Date.now() - 3_600_000).toISOString(), // 1h ago — past cooldown
    }

    ;(startAbTestInternal as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true })

    const { client } = buildSupabaseMock({ draftPlayoffs: [playoff] })

    const result = await phaseAutoStartPlayoffs(client)

    expect(result.processed).toBe(1)
    expect(result.errors).toBe(0)
    expect(startAbTestInternal).toHaveBeenCalledWith('playoff-1', 'site-1')
  })
})
