import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock modules before imports
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/youtube/ab-preflight', () => ({ preflightTokenCheck: vi.fn() }))
vi.mock('@/lib/youtube/ab-youtube', () => ({
  setThumbnail: vi.fn().mockResolvedValue({ highUrl: 'https://i.ytimg.com/vi/test/hqdefault.jpg' }),
  fetchVariantImageBuffer: vi.fn(),
}))
vi.mock('@/lib/youtube/ab-metadata', () => ({ updateVideoMetadata: vi.fn(), captureOriginalMetadata: vi.fn() }))
vi.mock('@/lib/youtube/ab-templates', () => ({ parseTemplateTokens: vi.fn() }))
vi.mock('@/lib/youtube/ab-rotation', () => ({ getNextVariantIndex: vi.fn(), getVariantForCycle: vi.fn() }))
vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn().mockResolvedValue({ siteId: 'site-1' }),
}))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  createServerClient: vi.fn().mockReturnValue({ auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1', email: 'test@test.com' } } }) } }),
  requireSiteScope: vi.fn().mockResolvedValue({ ok: true }),
}))
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))
vi.mock('@vercel/blob', () => ({ put: vi.fn() }))
vi.mock('@/lib/youtube/ab-types', () => ({
  AB_TEST_CONFIG_DEFAULTS: {},
  VARIANT_LABELS: ['A', 'B', 'C', 'D'],
  DRIFT_STATUS_NOTE: 'Thumbnail alterado externamente',
}))
vi.mock('@/lib/social/token-refresh', () => ({ ensureFreshToken: vi.fn() }))
vi.mock('@/lib/youtube/ab-start', () => ({ startAbTestInternal: vi.fn() }))
vi.mock('@/lib/links/auto-link', () => ({ ensureTrackedLink: vi.fn() }))
vi.mock('@/lib/youtube/scoring', () => ({ getChannelTier: vi.fn() }))
vi.mock('@/lib/youtube/prompt-scoring', () => ({ scoreForPrompt: vi.fn() }))
vi.mock('@/lib/youtube/thumbnail-library', () => ({ autoImportWinner: vi.fn() }))
vi.mock('@/lib/youtube/ab-apply', () => ({ applyVariantToYouTube: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), startSpan: vi.fn((_, cb) => cb()) }))

import { acknowledgeAbTestDrift } from '@/app/cms/(authed)/youtube/ab-lab/actions'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { revalidatePath, revalidateTag } from 'next/cache'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'

// ---------------------------------------------------------------------------
// Supabase mock builder
// ---------------------------------------------------------------------------

interface UpdateCall {
  table: string
  data: Record<string, unknown>
  filters: { column: string; value: unknown }[]
}

function buildSupabaseMock(updateError: { message: string } | null = null) {
  const updateCalls: UpdateCall[] = []

  const fromMock = vi.fn((table: string) => {
    const filters: { column: string; value: unknown }[] = []
    let capturedData: Record<string, unknown> = {}

    const eqChain = {
      eq: vi.fn((col: string, val: unknown) => {
        filters.push({ column: col, value: val })
        // The chain is .update().eq().eq().eq() — 3 eq calls total.
        // After the 3rd eq, the promise-like resolves.
        if (filters.length >= 3) {
          updateCalls.push({ table, data: capturedData, filters: [...filters] })
          return Promise.resolve({ error: updateError })
        }
        return eqChain
      }),
    }

    return {
      update: vi.fn((data: Record<string, unknown>) => {
        capturedData = data
        return eqChain
      }),
      // Fallback stubs so other from() calls don't blow up
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      }),
    }
  })

  const mock = { from: fromMock }
  vi.mocked(getSupabaseServiceClient).mockReturnValue(mock as never)
  return { mock, updateCalls }
}

// ---------------------------------------------------------------------------

describe('acknowledgeAbTestDrift', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireSiteScope).mockResolvedValue({ ok: true } as never)
  })

  it('sets drift_acknowledged_at and clears status_note on paused test', async () => {
    const before = Date.now()
    const { updateCalls } = buildSupabaseMock()

    const result = await acknowledgeAbTestDrift('test-42')

    expect(result).toEqual({ ok: true })
    expect(updateCalls).toHaveLength(1)

    const call = updateCalls[0]
    expect(call.table).toBe('ab_tests')
    expect(call.data.status_note).toBeNull()

    // drift_acknowledged_at should be a recent ISO timestamp
    const ts = new Date(call.data.drift_acknowledged_at as string).getTime()
    expect(ts).toBeGreaterThanOrEqual(before)
    expect(ts).toBeLessThanOrEqual(Date.now())
  })

  it('only updates tests matching site_id and status=paused', async () => {
    const { updateCalls } = buildSupabaseMock()

    await acknowledgeAbTestDrift('test-99')

    expect(updateCalls).toHaveLength(1)
    const filters = updateCalls[0].filters

    expect(filters).toEqual(
      expect.arrayContaining([
        { column: 'id', value: 'test-99' },
        { column: 'site_id', value: 'site-1' },
        { column: 'status', value: 'paused' },
      ]),
    )
  })

  it('revalidates cache after success', async () => {
    buildSupabaseMock()

    await acknowledgeAbTestDrift('test-1')

    expect(revalidateTag).toHaveBeenCalledWith('youtube')
    expect(revalidatePath).toHaveBeenCalledWith('/cms/youtube/ab-lab')
  })

  it('returns error when auth fails', async () => {
    vi.mocked(requireSiteScope).mockResolvedValue({
      ok: false,
      reason: 'unauthenticated',
    } as never)
    buildSupabaseMock()

    const result = await acknowledgeAbTestDrift('test-1')

    expect(result).toEqual({ ok: false, error: 'unauthenticated' })
    // Should not have called revalidate
    expect(revalidateTag).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
