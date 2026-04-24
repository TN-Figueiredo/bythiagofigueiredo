import { describe, it, expect } from 'vitest'

describe('CMS Schedule', () => {
  it('exports WeekView component from package', async () => {
    const mod = await import('@tn-figueiredo/cms-admin/schedule/client')
    expect(mod.WeekView).toBeDefined()
  })

  it('exports BacklogPanel component from package', async () => {
    const mod = await import('@tn-figueiredo/cms-admin/schedule/client')
    expect(mod.BacklogPanel).toBeDefined()
  })
})
