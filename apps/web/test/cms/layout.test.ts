import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
    })),
  })),
}))

describe('SIDEBAR_SECTIONS', () => {
  it('OVERVIEW contains Dashboard and Schedule', async () => {
    const { SIDEBAR_SECTIONS } = await import('@/app/cms/(authed)/layout-helpers')
    const overview = SIDEBAR_SECTIONS.find((s) => s.label === 'OVERVIEW')
    expect(overview).toBeDefined()
    const labels = overview!.items.map((i) => i.label)
    expect(labels).toEqual(['Dashboard', 'Schedule'])
  })

  it('CONTENT contains Posts, Newsletters, Campaigns', async () => {
    const { SIDEBAR_SECTIONS } = await import('@/app/cms/(authed)/layout-helpers')
    const content = SIDEBAR_SECTIONS.find((s) => s.label === 'CONTENT')
    const labels = content!.items.map((i) => i.label)
    expect(labels).toEqual(['Posts', 'Newsletters', 'Campaigns'])
  })

  it('PEOPLE contains Authors, Subscribers, Contatos', async () => {
    const { SIDEBAR_SECTIONS } = await import('@/app/cms/(authed)/layout-helpers')
    const people = SIDEBAR_SECTIONS.find((s) => s.label === 'PEOPLE')
    const labels = people!.items.map((i) => i.label)
    expect(labels).toEqual(['Authors', 'Subscribers', 'Contatos'])
  })

  it('INSIGHTS contains Analytics', async () => {
    const { SIDEBAR_SECTIONS } = await import('@/app/cms/(authed)/layout-helpers')
    const insights = SIDEBAR_SECTIONS.find((s) => s.label === 'INSIGHTS')
    const labels = insights!.items.map((i) => i.label)
    expect(labels).toEqual(['Analytics'])
  })

  it('Settings is a standalone section', async () => {
    const { SIDEBAR_SECTIONS } = await import('@/app/cms/(authed)/layout-helpers')
    const settings = SIDEBAR_SECTIONS.find((s) => s.items.some((i) => i.label === 'Settings'))
    expect(settings).toBeDefined()
  })
})
