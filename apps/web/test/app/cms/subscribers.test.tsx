import { describe, it, expect } from 'vitest'

describe('CMS Subscribers', () => {
  it('exports SubscriberKpis component', async () => {
    const mod = await import('@/app/cms/(authed)/subscribers/_components/subscriber-kpis')
    expect(mod.SubscriberKpis).toBeDefined()
  })

  it('exports SubscriberTable component', async () => {
    const mod = await import('@/app/cms/(authed)/subscribers/_components/subscriber-table')
    expect(mod.SubscriberTable).toBeDefined()
  })

  it('exports GrowthChart component', async () => {
    const mod = await import('@/app/cms/(authed)/subscribers/_components/growth-chart')
    expect(mod.GrowthChart).toBeDefined()
  })
})
