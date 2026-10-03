import { describe, it, expect, vi } from 'vitest'
import { parseNiche } from '@/lib/youtube/observatorio/niche'

describe('parseNiche', () => {
  it('accepts todos|viagem|ia', () => {
    expect(parseNiche('ia')).toBe('ia')
    expect(parseNiche('todos')).toBe('todos')
  })
  it('rejects anything else', () => {
    expect(parseNiche('culinaria')).toBeNull()
    expect(parseNiche(undefined)).toBeNull()
  })
})
describe('getUserNiche', () => {
  it('defaults to todos when there is no row', async () => {
    vi.resetModules()
    vi.doMock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 's1' }) }))
    vi.doMock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: async () => ({ ok: true, user: { id: 'u1' } }) }))
    vi.doMock('next/cache', () => ({ revalidatePath: vi.fn() }))
    vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) }) }) }))
    const { getUserNiche } = await import('@/app/cms/(authed)/youtube/competitors/niche-actions')
    expect(await getUserNiche()).toBe('todos')
  })
})
