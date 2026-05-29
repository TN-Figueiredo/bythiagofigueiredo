import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/social/token-refresh', () => ({ ensureFreshToken: vi.fn() }))
vi.mock('@/lib/youtube/ab-youtube', () => ({
  setThumbnail: vi.fn(),
  fetchVariantImageBuffer: vi.fn(),
}))
vi.mock('@/lib/youtube/ab-rotation', () => ({
  getVariantForCycle: vi.fn(),
}))

import { startAbTestInternal } from '@/lib/youtube/ab-start'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { ensureFreshToken } from '@/lib/social/token-refresh'
import { fetchVariantImageBuffer } from '@/lib/youtube/ab-youtube'
import { getVariantForCycle } from '@/lib/youtube/ab-rotation'

beforeEach(() => {
  vi.clearAllMocks()
  ;(ensureFreshToken as ReturnType<typeof vi.fn>).mockResolvedValue({ accessToken: 'tok' })
  ;(fetchVariantImageBuffer as ReturnType<typeof vi.fn>).mockResolvedValue({
    buffer: Buffer.from('img'),
    contentType: 'image/jpeg',
  })
  ;(getVariantForCycle as ReturnType<typeof vi.fn>).mockReturnValue(1)
})

function buildMock(testOverrides: Record<string, unknown> = {}) {
  const updates: { table: string; data: unknown }[] = []
  const inserts: { table: string; data: unknown }[] = []

  const test = {
    id: 'test-1',
    site_id: 'site-1',
    status: 'draft',
    youtube_video_id: 'vid-1',
    ...testOverrides,
  }

  const variants = [
    { id: 'v1', label: 'original', is_original: true, sort_order: 0, blob_url: 'https://blob/a.jpg' },
    { id: 'v2', label: 'B', is_original: false, sort_order: 1, blob_url: 'https://blob/b.jpg' },
  ]

  const fromMock = vi.fn((table: string) => {
    if (table === 'ab_tests') {
      // Build a chainable eq that always returns itself so .eq().eq().single() works
      const singleResult = { data: test, error: null }
      const chainable: Record<string, unknown> = {}
      chainable['single'] = vi.fn().mockResolvedValue(singleResult)
      chainable['eq'] = vi.fn().mockReturnValue(chainable)
      return {
        select: vi.fn().mockReturnValue(chainable),
        update: vi.fn((data: unknown) => {
          updates.push({ table, data })
          const updateChain: Record<string, unknown> = {}
          updateChain['select'] = vi.fn().mockResolvedValue({
            data: testOverrides.status === 'draft' || !('status' in testOverrides)
              ? [{ id: 'test-1' }] : [],
            error: null,
          })
          updateChain['eq'] = vi.fn().mockReturnValue(updateChain)
          return updateChain
        }),
      }
    }
    if (table === 'ab_test_variants') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: variants, error: null }),
          }),
        }),
      }
    }
    if (table === 'ab_test_cycles') {
      return {
        insert: vi.fn((data: unknown) => {
          inserts.push({ table, data })
          return { error: null }
        }),
      }
    }
    if (table === 'youtube_videos') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { youtube_video_id: 'YT_ABC' },
              error: null,
            }),
          }),
        }),
      }
    }
    return {}
  })

  const client = { from: fromMock }
  ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(client)
  return { updates, inserts }
}

describe('startAbTestInternal', () => {
  it('starts a draft test without auth check', async () => {
    const { updates, inserts } = buildMock()
    const result = await startAbTestInternal('test-1', 'site-1')

    expect(result.ok).toBe(true)
    expect(updates.some(u => (u.data as Record<string, unknown>).status === 'active')).toBe(true)
    expect(inserts.some(i => i.table === 'ab_test_cycles')).toBe(true)
  })

  it('returns error if test is not draft', async () => {
    buildMock({ status: 'active' })
    const result = await startAbTestInternal('test-1', 'site-1')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('draft')
  })
})
