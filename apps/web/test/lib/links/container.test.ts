import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => ({ data: null, error: null }) }) }),
      insert: () => ({ error: null }),
      update: () => ({ eq: () => ({ error: null }) }),
    }),
    rpc: () => ({ data: null, error: null }),
  }),
}))

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}))

describe('LinksContainer', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('exports createLinksContainer that returns singleton', async () => {
    const { createLinksContainer } = await import('../../../src/lib/links/container')
    const c1 = createLinksContainer()
    const c2 = createLinksContainer()
    expect(c1).toBe(c2)
  })

  it('container exposes resolver, recorder, cache, and geo modules', async () => {
    const { createLinksContainer, __resetLinksContainerForTests } = await import(
      '../../../src/lib/links/container'
    )
    __resetLinksContainerForTests()
    const container = createLinksContainer()
    expect(container).toHaveProperty('resolver')
    expect(container).toHaveProperty('recorder')
    expect(container).toHaveProperty('cache')
    expect(container).toHaveProperty('geo')
  })

  it('resolver has resolveLink method', async () => {
    const { createLinksContainer, __resetLinksContainerForTests } = await import(
      '../../../src/lib/links/container'
    )
    __resetLinksContainerForTests()
    const container = createLinksContainer()
    expect(typeof container.resolver.resolveLink).toBe('function')
  })

  it('recorder has recordClick method', async () => {
    const { createLinksContainer, __resetLinksContainerForTests } = await import(
      '../../../src/lib/links/container'
    )
    __resetLinksContainerForTests()
    const container = createLinksContainer()
    expect(typeof container.recorder.recordClick).toBe('function')
  })

  it('cache has invalidateLink and invalidateList methods', async () => {
    const { createLinksContainer, __resetLinksContainerForTests } = await import(
      '../../../src/lib/links/container'
    )
    __resetLinksContainerForTests()
    const container = createLinksContainer()
    expect(typeof container.cache.invalidateLink).toBe('function')
    expect(typeof container.cache.invalidateList).toBe('function')
    expect(typeof container.cache.invalidateAnalytics).toBe('function')
  })

  it('__resetLinksContainerForTests clears singleton', async () => {
    const { createLinksContainer, __resetLinksContainerForTests } = await import(
      '../../../src/lib/links/container'
    )
    __resetLinksContainerForTests()
    const c1 = createLinksContainer()
    __resetLinksContainerForTests()
    const c2 = createLinksContainer()
    expect(c1).not.toBe(c2)
  })
})
