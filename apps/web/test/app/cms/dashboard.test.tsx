import { describe, it, expect, vi } from 'vitest'

vi.mock('../../../lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockResolvedValue({ data: [], count: 0 }),
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [] }),
            }),
          }),
          gte: vi.fn().mockResolvedValue({ data: [], count: 0 }),
        }),
      }),
    }),
  }),
}))

vi.mock('../../../lib/cms/site-context', () => ({
  getSiteContext: () => Promise.resolve({ siteId: 's1', orgId: 'o1', defaultLocale: 'pt-BR' }),
}))

describe('CMS Dashboard', () => {
  it('exports a default server component', async () => {
    const mod = await import('../../../src/app/cms/(authed)/page')
    expect(mod.default).toBeDefined()
    expect(typeof mod.default).toBe('function')
  })

  it('exports DashboardKpis component', async () => {
    const mod = await import('../../../src/app/cms/(authed)/_components/dashboard-kpis')
    expect(typeof mod.DashboardKpis).toBe('function')
  })

  it('exports ComingUp component', async () => {
    const mod = await import('../../../src/app/cms/(authed)/_components/coming-up')
    expect(typeof mod.ComingUp).toBe('function')
  })

  it('exports ContinueEditing component', async () => {
    const mod = await import('../../../src/app/cms/(authed)/_components/continue-editing')
    expect(typeof mod.ContinueEditing).toBe('function')
  })
})
