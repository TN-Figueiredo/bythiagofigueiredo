import { describe, it, expect } from 'vitest'

describe('links/actions.ts — unified action exports', () => {
  it('re-exports saveLinktreeConfig from linktree actions', async () => {
    const mod = await import('../../src/app/cms/(authed)/links/actions')
    expect(typeof mod.saveLinktreeConfig).toBe('function')
  })

  it('re-exports loadLinktreeConfig from linktree actions', async () => {
    const mod = await import('../../src/app/cms/(authed)/links/actions')
    expect(typeof mod.loadLinktreeConfig).toBe('function')
  })

  it('exports existing createLink action', async () => {
    const mod = await import('../../src/app/cms/(authed)/links/actions')
    expect(typeof mod.createLink).toBe('function')
  })

  it('exports existing deleteLink action', async () => {
    const mod = await import('../../src/app/cms/(authed)/links/actions')
    expect(typeof mod.deleteLink).toBe('function')
  })

  it('exports existing toggleLinkActive action', async () => {
    const mod = await import('../../src/app/cms/(authed)/links/actions')
    expect(typeof mod.toggleLinkActive).toBe('function')
  })
})
