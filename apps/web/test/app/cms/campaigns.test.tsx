import { describe, it, expect } from 'vitest'

describe('CMS Campaigns', () => {
  it('exports CampaignKpis component', async () => {
    const mod = await import('@/app/cms/(authed)/campaigns/_components/campaign-kpis')
    expect(mod.CampaignKpis).toBeDefined()
  })

  it('exports CampaignTable component from package', async () => {
    const mod = await import('@tn-figueiredo/cms-admin/campaigns/client')
    expect(mod.CampaignTable).toBeDefined()
  })
})
