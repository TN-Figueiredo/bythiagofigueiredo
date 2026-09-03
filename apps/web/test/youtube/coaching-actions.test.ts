import { describe, it, expect, vi, beforeEach } from 'vitest'

/* ─── Mock chain builders ─── */

const mockMaybeSingle = vi.fn()
const mockLimit = vi.fn(() => ({ maybeSingle: mockMaybeSingle }))
const mockOrder = vi.fn(() => ({ limit: mockLimit }))
const mockEqD = vi.fn(() => ({ order: mockOrder }))
const mockEqC = vi.fn(() => ({ eq: mockEqD }))
const mockIs = vi.fn(() => ({ eq: mockEqC }))
const mockEqB = vi.fn(() => ({ is: mockIs }))
const mockEqA = vi.fn(() => ({ eq: mockEqB }))
const mockSelect = vi.fn(() => ({ eq: mockEqA }))

const mockFrom = vi.fn((table: string) => {
  if (table === 'youtube_intelligence') {
    return { select: mockSelect }
  }
  return { select: vi.fn(() => ({ eq: vi.fn() })) }
})

const mockSupabase = { from: mockFrom }

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn().mockResolvedValue({ siteId: 'site-1' }),
}))

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireSiteScope: vi.fn().mockResolvedValue({
    ok: true,
    user: { id: 'test-user-id' },
  }),
}))

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => mockSupabase,
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

import { fetchChannelCoaching } from '../../src/app/cms/(authed)/youtube/analytics/actions'

const VALID_CHANNEL = '00000000-0000-0000-0000-000000000002'

describe('fetchChannelCoaching', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the channel coaching row when it exists', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: {
        coaching: {
          summary: 'Canal em boa forma geral',
          priorities: [
            { axis: 'ctr', score: 4, diagnosis: 'CTR baixo', action: 'Testar thumbnails' },
          ],
        },
        generated_at: '2026-08-01T12:00:00Z',
      },
    })

    const result = await fetchChannelCoaching(VALID_CHANNEL)

    expect(result).toEqual({
      coaching: {
        summary: 'Canal em boa forma geral',
        priorities: [
          { axis: 'ctr', score: 4, diagnosis: 'CTR baixo', action: 'Testar thumbnails' },
        ],
      },
      generatedAt: '2026-08-01T12:00:00Z',
    })
  })

  it('returns null when no channel coaching row exists', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null })

    const result = await fetchChannelCoaching(VALID_CHANNEL)

    expect(result).toBeNull()
  })

  it('rejects invalid channelId (non-UUID)', async () => {
    await expect(fetchChannelCoaching('not-a-uuid')).rejects.toThrow('invalid_input')
  })
})
