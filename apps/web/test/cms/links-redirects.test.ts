import { describe, it, expect, beforeAll } from 'vitest'

describe('Links redesign redirects', () => {
  let redirects: Array<{ source: string; destination: string; permanent: boolean }>

  beforeAll(async () => {
    redirects = [
      { source: '/cms/link-in-bio', destination: '/cms/links?tab=tree', permanent: true },
      { source: '/cms/linktree', destination: '/cms/links?tab=tree', permanent: true },
      { source: '/cms/linktree/analytics', destination: '/cms/links?tab=analytics', permanent: true },
    ]
  })

  it('/cms/link-in-bio redirects to /cms/links?tab=tree', () => {
    const rule = redirects.find(r => r.source === '/cms/link-in-bio')
    expect(rule).toBeDefined()
    expect(rule!.destination).toBe('/cms/links?tab=tree')
    expect(rule!.permanent).toBe(true)
  })

  it('/cms/linktree redirects to /cms/links?tab=tree', () => {
    const rule = redirects.find(r => r.source === '/cms/linktree')
    expect(rule).toBeDefined()
    expect(rule!.destination).toBe('/cms/links?tab=tree')
    expect(rule!.permanent).toBe(true)
  })

  it('/cms/linktree/analytics redirects to /cms/links?tab=analytics', () => {
    const rule = redirects.find(r => r.source === '/cms/linktree/analytics')
    expect(rule).toBeDefined()
    expect(rule!.destination).toBe('/cms/links?tab=analytics')
    expect(rule!.permanent).toBe(true)
  })
})
