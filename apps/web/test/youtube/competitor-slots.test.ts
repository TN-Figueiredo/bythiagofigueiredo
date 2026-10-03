import { describe, it, expect, vi } from 'vitest'
import { computeSlots, DEFAULT_CHANNEL_LIMIT } from '@/lib/youtube/competitor-slots'

describe('computeSlots', () => {
  it('defaults to 75', () => expect(computeSlots(14, null)).toEqual({ used: 14, limit: DEFAULT_CHANNEL_LIMIT, free: 61 }))
  it('never negative (the "-1 vagas" bug)', () => expect(computeSlots(16, 15)).toEqual({ used: 16, limit: 15, free: 0 }))
  it('full', () => expect(computeSlots(75, 75).free).toBe(0))
})

describe('unlockMoreChannels', () => {
  it('refuses an editor (only super_admin/org_admin unlock)', async () => {
    vi.resetModules()
    vi.doMock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 's1' }) }))
    vi.doMock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: async () => ({ ok: true, user: { id: 'u1' } }) }))
    vi.doMock('next/cache', () => ({ revalidatePath: vi.fn() }))
    vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role: 'editor' } }) }) }) }) }) }) }))
    const { unlockMoreChannels } = await import('@/app/cms/(authed)/youtube/competitors/actions')
    expect(await unlockMoreChannels()).toEqual({ ok: false, error: 'forbidden' })
  })
})
