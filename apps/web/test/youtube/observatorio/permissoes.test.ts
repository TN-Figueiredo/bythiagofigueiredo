// apps/web/test/youtube/observatorio/permissoes.test.ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const requireSiteScope = vi.fn(); const canAdminSiteUsers = vi.fn()
vi.mock('server-only', () => ({}))
vi.mock('react', () => ({ cache: <T,>(f: T) => f }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: (a: unknown) => requireSiteScope(a) }))
vi.mock('@/lib/youtube/competitor-admin', () => ({ canAdminSiteUsers: (s: string) => canAdminSiteUsers(s) }))
const SITE = '00000000-0000-0000-0000-00000000a3b0'

describe('permissoesDoSite (módulo real)', () => {
  beforeEach(() => { vi.resetModules(); requireSiteScope.mockReset(); canAdminSiteUsers.mockReset() })
  it('pede o direito de EDITAR no cms do site, nunca view', async () => {
    requireSiteScope.mockResolvedValue({ ok: true }); canAdminSiteUsers.mockResolvedValue(false)
    await (await import('@/app/cms/(authed)/youtube/competitors/_chrome/permissoes')).permissoesDoSite(SITE)
    expect(requireSiteScope).toHaveBeenCalledWith({ area: 'cms', siteId: SITE, mode: 'edit' })
  })
  it('recusado: nada de edição e canAdminSiteUsers nem é chamado', async () => {
    requireSiteScope.mockResolvedValue({ ok: false })
    expect(await (await import('@/app/cms/(authed)/youtube/competitors/_chrome/permissoes')).permissoesDoSite(SITE)).toEqual({ canUnlock: false, podeEditar: false })
    expect(canAdminSiteUsers).not.toHaveBeenCalled()
  })
  it('edita e administra: os dois verdadeiros; edita sem administrar: canUnlock falso', async () => {
    requireSiteScope.mockResolvedValue({ ok: true })
    const { permissoesDoSite } = await import('@/app/cms/(authed)/youtube/competitors/_chrome/permissoes')
    canAdminSiteUsers.mockResolvedValueOnce(true)
    expect(await permissoesDoSite(SITE)).toEqual({ canUnlock: true, podeEditar: true })
    vi.resetModules(); canAdminSiteUsers.mockResolvedValueOnce(false)
    expect(await (await import('@/app/cms/(authed)/youtube/competitors/_chrome/permissoes')).permissoesDoSite(SITE)).toEqual({ canUnlock: false, podeEditar: true })
  })
  it('podeEditarSite sozinho não toca canAdminSiteUsers (o chrome não paga a segunda ida)', async () => {
    requireSiteScope.mockResolvedValue({ ok: true })
    expect(await (await import('@/app/cms/(authed)/youtube/competitors/_chrome/permissoes')).podeEditarSite(SITE)).toBe(true)
    expect(canAdminSiteUsers).not.toHaveBeenCalled()
  })
})
