// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const exchange = vi.fn()
vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [], set: vi.fn() }) }))
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { exchangeCodeForSession: exchange } }),
}))

async function call(qs: string) {
  const { GET } = await import('../../src/app/auth/callback/route')
  const res = await GET(new Request(`https://site.test/auth/callback?${qs}`))
  return res.headers.get('location')
}

describe('auth/callback next', () => {
  beforeEach(() => exchange.mockReset().mockResolvedValue({ error: null }))

  it('aceita next relativo', async () => {
    expect(await call('code=x&next=/cms/reset')).toBe('https://site.test/cms/reset')
  })
  it('recusa //evil.com', async () => {
    const loc = await call('code=x&next=//evil.com')
    expect(new URL(loc!).origin).toBe('https://site.test')
    expect(loc).not.toContain('evil.com')
  })
  it('recusa https://evil', async () => {
    const loc = await call(`code=x&next=${encodeURIComponent('https://evil.com/x')}`)
    expect(new URL(loc!).origin).toBe('https://site.test')
    expect(loc).not.toContain('evil.com')
  })
  it('reset do CMS com link vencido vai à tela de reset, não ao login', async () => {
    exchange.mockResolvedValue({ error: new Error('x') })
    expect(await call('code=x&next=/cms/reset')).toBe('https://site.test/cms/reset')
  })
  it('reset do admin com link vencido vai à tela de reset do admin', async () => {
    exchange.mockResolvedValue({ error: new Error('x') })
    expect(await call('code=x&next=/admin/reset')).toBe('https://site.test/admin/reset')
  })
  it('erro do Google no CMS volta ao login do CMS', async () => {
    exchange.mockResolvedValue({ error: new Error('x') })
    expect(await call('code=x&next=/cms')).toBe('https://site.test/cms/login?error=oauth_exchange_failed')
  })
  it('erro do Google no admin volta ao login do admin', async () => {
    exchange.mockResolvedValue({ error: new Error('x') })
    expect(await call('code=x&next=/admin')).toBe('https://site.test/admin/login?error=oauth_exchange_failed')
  })
})
