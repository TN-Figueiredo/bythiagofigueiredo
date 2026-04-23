import { describe, it, expect } from 'vitest'

describe('CMS Blog List', () => {
  it('exports PostsFilters component', async () => {
    const mod = await import('@/app/cms/(authed)/blog/_components/posts-filters')
    expect(mod.PostsFilters).toBeDefined()
  })

  it('exports PostsTable component', async () => {
    const mod = await import('@/app/cms/(authed)/blog/_components/posts-table')
    expect(mod.PostsTable).toBeDefined()
  })
})
