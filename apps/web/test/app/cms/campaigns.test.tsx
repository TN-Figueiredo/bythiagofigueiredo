import { describe, it, expect } from 'vitest'

describe('CMS Campaigns', () => {
  it('exports CampaignKpis component', async () => {
    const mod = await import('@/app/cms/(authed)/campaigns/_components/campaign-kpis')
    expect(mod.CampaignKpis).toBeDefined()
  })

  it('exports CampaignTable component', async () => {
    const mod = await import('@/app/cms/(authed)/campaigns/_components/campaign-table')
    expect(mod.CampaignTable).toBeDefined()
  })
})
