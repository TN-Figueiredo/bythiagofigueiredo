import { describe, it, expect, vi } from 'vitest'

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  createServerClient: vi.fn().mockReturnValue({ auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1', email: 'test@test.com' } } }) } }),
  requireSiteScope: () => ({ ok: true, user: { id: 'u1' } }),
}))
vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: () => ({ siteId: 'site-1' }),
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: (table: string) => {
      if (table === 'sites') {
        return {
          select: () => ({
            eq: () => ({
              single: () => ({
                data: { social_defaults: { best_times: { youtube: ['10:00', '15:00'] } } },
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'social_connections') {
        return {
          select: () => ({
            in: () => ({
              data: [{ id: 'c1', provider: 'youtube' }, { id: 'c2', provider: 'facebook' }],
              error: null,
            }),
          }),
        }
      }
      return {}
    },
  }),
}))

describe('getBestTimes', () => {
  it('returns configured best times for known providers', async () => {
    const { getBestTimes } = await import('@/lib/social/actions/content')
    const result = await getBestTimes(['c1', 'c2'])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.youtube).toEqual(['10:00', '15:00'])
    expect(result.data.facebook).toEqual(['09:00', '12:00', '18:00'])
  })
})

describe('generateAICaption', () => {
  it('returns error when pipeline key is not set', async () => {
    delete process.env.PIPELINE_COWORK_KEY
    const { generateAICaption } = await import('@/lib/social/actions/content')
    const result = await generateAICaption('ig_story', 'pt')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('Pipeline key not configured')
  })
})

describe('translateCaption', () => {
  it('returns error when pipeline key is not set', async () => {
    delete process.env.PIPELINE_COWORK_KEY
    const { translateCaption } = await import('@/lib/social/actions/content')
    const result = await translateCaption('Hello', 'en', 'pt')
    expect(result.ok).toBe(false)
  })
})

describe('getBestTimes edge cases', () => {
  it('returns default times for unknown provider', async () => {
    // Already tested implicitly via facebook, but let's be explicit
    const { getBestTimes } = await import('@/lib/social/actions/content')
    const result = await getBestTimes(['c2']) // facebook connection
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.facebook).toEqual(['09:00', '12:00', '18:00'])
  })
})
