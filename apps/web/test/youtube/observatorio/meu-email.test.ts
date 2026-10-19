// @vitest-environment node
// F2 do Remover canal, r2 (Yannis I-1): o e-mail do pedido vem da SESSÃO, só para admin, nunca pelo cliente de serviço.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const getUser = vi.fn()
const canAdmin = vi.fn()
const servico = vi.fn()
vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }))
vi.mock('@supabase/ssr', () => ({ createServerClient: () => ({ auth: { getUser } }) }))
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 's1' }) }))
vi.mock('@/lib/youtube/competitor-admin', () => ({ canAdminSiteUsers: (...a: unknown[]) => canAdmin(...a) }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: (...a: unknown[]) => servico(...a) }))

const carregar = async () => (await import('@/app/cms/(authed)/youtube/competitors/_canais/meu-email')).meuEmailDoSite

beforeEach(() => { vi.clearAllMocks(); process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://x'; process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'k' })

describe('meuEmailDoSite', () => {
  it('admin: devolve o e-mail da sessão e não toca o cliente de serviço', async () => {
    canAdmin.mockResolvedValue(true); getUser.mockResolvedValue({ data: { user: { email: 'dono@exemplo.com' } }, error: null })
    expect(await (await carregar())()).toBe('dono@exemplo.com')
    expect(servico).not.toHaveBeenCalled()
  })
  it('quem não administra: null, sem ida ao Auth', async () => {
    canAdmin.mockResolvedValue(false)
    expect(await (await carregar())()).toBeNull()
    expect(getUser).not.toHaveBeenCalled()
    expect(servico).not.toHaveBeenCalled()
  })
  it('usuário sem e-mail, erro do getUser ou exceção: null', async () => {
    canAdmin.mockResolvedValue(true)
    const f = await carregar()
    getUser.mockResolvedValueOnce({ data: { user: { email: null } }, error: null })
    expect(await f()).toBeNull()
    getUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'x' } })
    expect(await f()).toBeNull()
    getUser.mockRejectedValueOnce(new Error('rede'))
    expect(await f()).toBeNull()
  })
})
