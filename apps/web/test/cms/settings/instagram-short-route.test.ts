// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const redirectMock = vi.fn((href: string) => { throw new Error(`NEXT_REDIRECT:${href}`) })
vi.mock('next/navigation', () => ({ redirect: (href: string) => redirectMock(href) }))

beforeEach(() => { redirectMock.mockClear() })

describe('/cms/settings/instagram', () => {
  it('redireciona para /cms/settings?section=instagram', async () => {
    const mod = await import('@/app/cms/(authed)/settings/instagram/page')
    expect(() => (mod.default as () => unknown)()).toThrow(/NEXT_REDIRECT/)
    expect(redirectMock).toHaveBeenCalledWith('/cms/settings?section=instagram')
  })

  it('o middleware de auth guarda só o pathname, então o next= aponta para a rota curta', () => {
    // create-auth-middleware.js:21,42,51-54 grava `next` sem a query — é por
    // isto que a rota curta existe em vez de o Click apontar para
    // /cms/settings?section=instagram direto.
    expect('/cms/settings/instagram').not.toContain('?')
  })
})
