import { describe, it, expect } from 'vitest'

describe('CMS Newsletters', () => {
  it('exports TypeCards component', async () => {
    const mod = await import('@/app/cms/(authed)/newsletters/_components/type-cards')
    expect(mod.TypeCards).toBeDefined()
  })

  it('exports EditionsTable component', async () => {
    const mod = await import('@/app/cms/(authed)/newsletters/_components/editions-table')
    expect(mod.EditionsTable).toBeDefined()
  })
})
