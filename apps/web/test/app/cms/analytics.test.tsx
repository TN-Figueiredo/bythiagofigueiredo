import { describe, it, expect, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/cms/analytics',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/components/cms/ui', () => ({
  KpiCard: () => null,
  CmsButton: () => null,
}))

vi.mock('@/components/cms/cms-topbar', () => ({
  CmsTopbar: () => null,
}))

describe('CMS Analytics', () => {
  it('exports AnalyticsTabs component', async () => {
    const mod = await import('../../../src/app/cms/(authed)/analytics/_components/analytics-tabs')
    expect(mod.AnalyticsTabs).toBeDefined()
  })

  it('exports AreaChart component', async () => {
    const mod = await import('../../../src/app/cms/(authed)/analytics/_components/area-chart')
    expect(mod.AreaChart).toBeDefined()
  })
})
