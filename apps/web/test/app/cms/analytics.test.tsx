import { describe, it, expect, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/cms/analytics',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@tn-figueiredo/cms-ui/client', () => ({
  KpiCard: () => null,
  CmsButton: () => null,
  CmsTopbar: () => null,
}))

describe('CMS Analytics', () => {
  it('exports AnalyticsTabs component from package', async () => {
    const mod = await import('@tn-figueiredo/cms-admin/analytics/client')
    expect(mod.AnalyticsTabs).toBeDefined()
  })

  it('exports AreaChart component from package', async () => {
    const mod = await import('@tn-figueiredo/cms-admin/analytics/client')
    expect(mod.AreaChart).toBeDefined()
  })
})
