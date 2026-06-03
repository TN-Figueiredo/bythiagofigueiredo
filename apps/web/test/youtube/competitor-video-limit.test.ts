import { describe, it, expect, vi, beforeEach } from 'vitest'

/* ─── Mock chain: .update({ ... }).eq('id', x).eq('site_id', y) ─── */

const mockUpdateEq2 = vi.fn()
const mockUpdateEq1 = vi.fn(() => ({ eq: mockUpdateEq2 }))
const mockUpdate = vi.fn(() => ({ eq: mockUpdateEq1 }))

const mockFrom = vi.fn(() => ({
  update: mockUpdate,
}))

const mockSupabase = { from: mockFrom }

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
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/youtube/competitor-sync', () => ({
  syncCompetitorChannel: vi.fn(),
}))

import { updateVideoLimit } from '../../src/app/cms/(authed)/youtube/competitors/actions'

const CHANNEL_ROW_ID = '00000000-0000-0000-0000-000000000001'

describe('updateVideoLimit — tier clamping', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('limit 50 is valid — clamped to 50', async () => {
    const result = await updateVideoLimit(CHANNEL_ROW_ID, 50)

    expect(result).toEqual({ ok: true })
    expect(mockUpdate).toHaveBeenCalledWith({ video_limit: 50 })
  })

  it('limit 200 is valid — clamped to 200', async () => {
    const result = await updateVideoLimit(CHANNEL_ROW_ID, 200)

    expect(result).toEqual({ ok: true })
    expect(mockUpdate).toHaveBeenCalledWith({ video_limit: 200 })
  })

  it('limit 100 clamps to 50 — no intermediate tier', async () => {
    const result = await updateVideoLimit(CHANNEL_ROW_ID, 100)

    expect(result).toEqual({ ok: true })
    expect(mockUpdate).toHaveBeenCalledWith({ video_limit: 50 })
  })

  it('limit 75 clamps to 50 — anything below 200 becomes 50', async () => {
    const result = await updateVideoLimit(CHANNEL_ROW_ID, 75)

    expect(result).toEqual({ ok: true })
    expect(mockUpdate).toHaveBeenCalledWith({ video_limit: 50 })
  })

  it('limit 300 clamps to 200 — cap at 200', async () => {
    const result = await updateVideoLimit(CHANNEL_ROW_ID, 300)

    expect(result).toEqual({ ok: true })
    expect(mockUpdate).toHaveBeenCalledWith({ video_limit: 200 })
  })

  it('limit 0 clamps to 50 — minimum is 50', async () => {
    const result = await updateVideoLimit(CHANNEL_ROW_ID, 0)

    expect(result).toEqual({ ok: true })
    expect(mockUpdate).toHaveBeenCalledWith({ video_limit: 50 })
  })

  it('negative values clamp to 50 — safety', async () => {
    const result = await updateVideoLimit(CHANNEL_ROW_ID, -10)

    expect(result).toEqual({ ok: true })
    expect(mockUpdate).toHaveBeenCalledWith({ video_limit: 50 })
  })

  it('passes correct channelRowId and siteId to Supabase', async () => {
    await updateVideoLimit(CHANNEL_ROW_ID, 50)

    expect(mockFrom).toHaveBeenCalledWith('competitor_channels')
    expect(mockUpdateEq1).toHaveBeenCalledWith('id', CHANNEL_ROW_ID)
    expect(mockUpdateEq2).toHaveBeenCalledWith('site_id', 'site-1')
  })
})
