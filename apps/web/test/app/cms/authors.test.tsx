import { describe, it, expect } from 'vitest'

describe('CMS Authors', () => {
  it('exports AuthorCard component', async () => {
    const mod = await import('@/app/cms/(authed)/authors/_components/author-card')
    expect(mod.AuthorCard).toBeDefined()
  })
})
