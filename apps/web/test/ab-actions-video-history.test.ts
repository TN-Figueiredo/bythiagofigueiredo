import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: vi.fn() }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  createServerClient: vi.fn().mockReturnValue({ auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1', email: 'test@test.com' } } }) } }), requireSiteScope: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/links/auto-link', () => ({ ensureTrackedLink: vi.fn() }))
vi.mock('@/lib/social/token-refresh', () => ({ ensureFreshToken: vi.fn() }))
vi.mock('@/lib/youtube/ab-metadata', () => ({ captureOriginalMetadata: vi.fn() }))
vi.mock('@vercel/blob', () => ({ put: vi.fn() }))
vi.mock('@/lib/youtube/ab-youtube', () => ({
  setThumbnail: vi.fn(),
  fetchVariantImageBuffer: vi.fn(),
}))
vi.mock('@/lib/youtube/ab-rotation', () => ({ getVariantForCycle: vi.fn() }))
vi.mock('@/lib/youtube/ab-statistics', () => ({ calculateBayesianConfidence: vi.fn() }))

import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getVideoTestHistory } from '@/app/cms/(authed)/youtube/ab-lab/actions'

function buildSelectChain(data: unknown[]) {
  const chain: Record<string, unknown> = {}
  const resolved = { data, error: null }
  chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(resolved).then(resolve, reject)
  const fluent = ['select', 'eq', 'in', 'order', 'not', 'is', 'limit']
  for (const m of fluent) {
    chain[m] = vi.fn(() => chain)
  }
  return chain
}

let mockFrom: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getSiteContext).mockResolvedValue({ siteId: 'site-1' } as never)
  vi.mocked(requireSiteScope).mockResolvedValue({ ok: true } as never)

  mockFrom = vi.fn()
  vi.mocked(getSupabaseServiceClient).mockReturnValue({ from: mockFrom } as never)
})

describe('getVideoTestHistory', () => {
  it('returns empty array when no tests exist', async () => {
    mockFrom.mockReturnValue(buildSelectChain([]))

    const result = await getVideoTestHistory('video-123')

    expect(result).toEqual([])
    expect(mockFrom).toHaveBeenCalledWith('ab_tests')
  })

  it('maps test rows to the expected shape', async () => {
    const row = {
      id: 'test-1',
      name: 'Thumb A vs B',
      test_type: 'thumbnail',
      status: 'completed',
      started_at: '2026-05-01T00:00:00Z',
      completed_at: '2026-05-10T00:00:00Z',
      completed_reason: 'auto_resolved',
      confidence_at_completion: 0.97,
      result_metadata: { ctr_lift_percent: 12.5 },
      winner: { label: 'variant_b' },
    }
    mockFrom.mockReturnValue(buildSelectChain([row]))

    const result = await getVideoTestHistory('video-123')

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      id: 'test-1',
      name: 'Thumb A vs B',
      test_type: 'thumbnail',
      status: 'completed',
      started_at: '2026-05-01T00:00:00Z',
      completed_at: '2026-05-10T00:00:00Z',
      completed_reason: 'auto_resolved',
      winner_label: 'variant_b',
      ctr_lift_percent: 12.5,
      confidence_at_completion: 0.97,
    })
  })

  it('handles winner as array (Supabase join format)', async () => {
    const row = {
      id: 'test-2',
      name: 'Title test',
      test_type: 'title',
      status: 'completed',
      started_at: null,
      completed_at: null,
      completed_reason: null,
      confidence_at_completion: null,
      result_metadata: null,
      winner: [{ label: 'original' }],
    }
    mockFrom.mockReturnValue(buildSelectChain([row]))

    const result = await getVideoTestHistory('video-456')

    expect(result[0].winner_label).toBe('original')
    expect(result[0].ctr_lift_percent).toBeNull()
  })

  it('returns null winner_label when no winner', async () => {
    const row = {
      id: 'test-3',
      name: 'Ongoing',
      test_type: 'combo',
      status: 'active',
      started_at: '2026-05-15T00:00:00Z',
      completed_at: null,
      completed_reason: null,
      confidence_at_completion: null,
      result_metadata: null,
      winner: null,
    }
    mockFrom.mockReturnValue(buildSelectChain([row]))

    const result = await getVideoTestHistory('video-789')

    expect(result[0].winner_label).toBeNull()
  })

  it('returns multiple tests ordered by created_at desc', async () => {
    const rows = [
      {
        id: 'test-new', name: 'New', test_type: 'title', status: 'active',
        started_at: null, completed_at: null, completed_reason: null,
        confidence_at_completion: null, result_metadata: null, winner: null,
      },
      {
        id: 'test-old', name: 'Old', test_type: 'thumbnail', status: 'completed',
        started_at: null, completed_at: '2026-04-01T00:00:00Z', completed_reason: 'manual',
        confidence_at_completion: 0.85, result_metadata: { ctr_lift_percent: -3.2 },
        winner: { label: 'original' },
      },
    ]
    mockFrom.mockReturnValue(buildSelectChain(rows))

    const result = await getVideoTestHistory('video-multi')

    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('test-new')
    expect(result[1].id).toBe('test-old')
    expect(result[1].ctr_lift_percent).toBe(-3.2)
  })
})
