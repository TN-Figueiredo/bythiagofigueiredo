import { describe, it, expect } from 'vitest'

describe('sprint-4.5 package pin smoke', () => {
  it('resolves @tn-figueiredo/auth-nextjs/actions', async () => {
    const mod = await import('@tn-figueiredo/auth-nextjs/actions')
    expect(typeof mod.signInWithPassword).toBe('function')
    expect(typeof mod.signOutAction).toBe('function')
  })

  it('resolves @tn-figueiredo/auth-nextjs/safe-redirect', async () => {
    const { safeRedirect } = await import('@tn-figueiredo/auth-nextjs/safe-redirect')
    expect(safeRedirect('/admin', '/', { areaPrefix: '/admin' })).toBe('/admin')
    expect(safeRedirect('/cms/x', '/', { areaPrefix: '/admin' })).toBe('/')
  })

  it('resolves @tn-figueiredo/auth-nextjs/server requireArea + pre-existing requireRole', async () => {
    const mod = await import('@tn-figueiredo/auth-nextjs/server')
    expect(typeof mod.requireArea).toBe('function')
    expect(typeof mod.requireRole).toBe('function') // pre-existing, must coexist
    expect(typeof mod.requireUser).toBe('function')
  })

  it('resolves @tn-figueiredo/admin/login', async () => {
    const mod = await import('@tn-figueiredo/admin/login')
    expect(typeof mod.AdminLogin).toBe('function')
    expect(typeof mod.AdminForgotPassword).toBe('function')
    expect(typeof mod.AdminResetPassword).toBe('function')
  })

  it('resolves @tn-figueiredo/cms/login', async () => {
    const mod = await import('@tn-figueiredo/cms/login')
    expect(typeof mod.CmsLogin).toBe('function')
  })
})
