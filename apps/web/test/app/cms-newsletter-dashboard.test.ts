import { describe, it, expect, vi } from 'vitest'

vi.mock('../../lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [] }),
            data: [],
          }),
          lte: vi.fn().mockResolvedValue({ data: [] }),
          data: [],
        }),
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: [] }),
          data: [],
        }),
      }),
    }),
  }),
}))

vi.mock('../../lib/cms/site-context', () => ({
  getSiteContext: () => Promise.resolve({ siteId: 's1', orgId: 'o1', defaultLocale: 'pt-BR' }),
}))

describe('newsletter dashboard page', () => {
  it('exports default function', async () => {
    const mod = await import('../../src/app/cms/(authed)/newsletters/page')
    expect(typeof mod.default).toBe('function')
  })

  it('exports force-dynamic', async () => {
    const mod = await import('../../src/app/cms/(authed)/newsletters/page')
    expect(mod.dynamic).toBe('force-dynamic')
  })
})
