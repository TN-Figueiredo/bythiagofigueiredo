import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSingle = vi.fn()
const mockRpc = vi.fn()
const mockUpdate = vi.fn()
const mockEq3 = vi.fn(() => ({ single: mockSingle }))
const mockEq2 = vi.fn(() => ({ eq: mockEq3 }))
const mockEq1 = vi.fn(() => ({ eq: mockEq2 }))
const mockFrom = vi.fn(() => ({
  select: vi.fn(() => ({ eq: mockEq1 })),
  update: vi.fn(() => ({ eq: mockEq1 })),
}))

const mockSupabase = { from: mockFrom, rpc: mockRpc }

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn().mockResolvedValue({ siteId: 'site-1' }),
}))

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireSiteScope: vi.fn().mockResolvedValue({ ok: true }),
}))

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => mockSupabase,
}))

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}))

import { pinWeeklyPick, unpinWeeklyPick, updateVideo } from '../../src/app/cms/(authed)/youtube/videos/actions'

describe('pinWeeklyPick', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects invalid videoId', async () => {
    const result = await pinWeeklyPick({ videoId: 'not-uuid', channelId: 'not-uuid', durationDays: 7 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBeTruthy()
  })

  it('rejects durationDays > 30', async () => {
    const result = await pinWeeklyPick({
      videoId: '00000000-0000-0000-0000-000000000001',
      channelId: '00000000-0000-0000-0000-000000000002',
      durationDays: 31,
    })
    expect(result.ok).toBe(false)
  })

  it('rejects durationDays < 1', async () => {
    const result = await pinWeeklyPick({
      videoId: '00000000-0000-0000-0000-000000000001',
      channelId: '00000000-0000-0000-0000-000000000002',
      durationDays: 0,
    })
    expect(result.ok).toBe(false)
  })

  it('returns error when video not found in channel', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'not found' } })
    const result = await pinWeeklyPick({
      videoId: '00000000-0000-0000-0000-000000000001',
      channelId: '00000000-0000-0000-0000-000000000002',
      durationDays: 7,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('not found')
  })

  it('calls RPC with correct params on success', async () => {
    mockSingle.mockResolvedValueOnce({ data: { id: '00000000-0000-0000-0000-000000000001' }, error: null })
    mockRpc.mockResolvedValueOnce({ error: null })
    const result = await pinWeeklyPick({
      videoId: '00000000-0000-0000-0000-000000000001',
      channelId: '00000000-0000-0000-0000-000000000002',
      durationDays: 14,
    })
    expect(result.ok).toBe(true)
    expect(mockRpc).toHaveBeenCalledWith('pin_weekly_pick', {
      p_video_id: '00000000-0000-0000-0000-000000000001',
      p_channel_id: '00000000-0000-0000-0000-000000000002',
      p_site_id: 'site-1',
      p_duration_days: 14,
    })
  })
})

describe('unpinWeeklyPick', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects invalid channelId', async () => {
    const result = await unpinWeeklyPick({ channelId: 'bad' })
    expect(result.ok).toBe(false)
  })

  it('calls RPC with correct params', async () => {
    mockRpc.mockResolvedValueOnce({ error: null })
    const result = await unpinWeeklyPick({ channelId: '00000000-0000-0000-0000-000000000002' })
    expect(result.ok).toBe(true)
    expect(mockRpc).toHaveBeenCalledWith('unpin_weekly_pick', {
      p_channel_id: '00000000-0000-0000-0000-000000000002',
      p_site_id: 'site-1',
    })
  })
})

describe('updateVideo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects invalid UUID', async () => {
    const result = await updateVideo({ id: 'not-a-uuid' })
    expect(result.ok).toBe(false)
  })
})
