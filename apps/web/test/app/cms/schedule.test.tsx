import { describe, it, expect } from 'vitest'

describe('CMS Schedule', () => {
  it('exports WeekView component', async () => {
    const mod = await import('@/app/cms/(authed)/schedule/_components/week-view')
    expect(mod.WeekView).toBeDefined()
  })

  it('exports BacklogPanel component', async () => {
    const mod = await import('@/app/cms/(authed)/schedule/_components/backlog-panel')
    expect(mod.BacklogPanel).toBeDefined()
  })
})
