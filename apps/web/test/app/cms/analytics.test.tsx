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
  it('exports AnalyticsTabs component', async () => {
    const mod = await import('../../../src/app/cms/(authed)/analytics/_components/analytics-tabs')
    expect(mod.AnalyticsTabs).toBeDefined()
  })

  it('exports AreaChart component', async () => {
    const mod = await import('../../../src/app/cms/(authed)/analytics/_components/area-chart')
    expect(mod.AreaChart).toBeDefined()
  })
})
