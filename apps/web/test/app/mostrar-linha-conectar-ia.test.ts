// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({ user: { id: 'user-da-sessao' } as { id: string } | null, err: null as unknown, estado: vi.fn() }))

vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [] }) }))
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 'site-1' }) }))
vi.mock('@tn-figueiredo/auth-nextjs', () => ({
  createServerClient: () => ({ auth: { getUser: async () => ({ data: { user: h.user }, error: h.err }) } }),
}))
vi.mock('@/lib/youtube/observatorio/acesso-ia/estado-da-sessao', () => ({ estadoDaSessao: h.estado }))

import { mostrarLinhaConectarIa } from '@/app/cms/(authed)/youtube/competitors/_chrome/mostrar-linha-conectar-ia'

beforeEach(() => {
  h.user = { id: 'user-da-sessao' }; h.err = null
  h.estado.mockReset(); h.estado.mockResolvedValue({ tipo: 'ativa', ate: null, bloqueadas: [] })
  process.env.OBSERVATORIO_IA_OAUTH = 'on'; process.env.OBSERVATORIO_IA_EXTERNA = 'on'
})

describe('mostrarLinhaConectarIa (q10)', () => {
  it('travas desligadas: false sem ler o estado', async () => {
    process.env.OBSERVATORIO_IA_EXTERNA = 'off'
    expect(await mostrarLinhaConectarIa()).toBe(false)
    process.env.OBSERVATORIO_IA_EXTERNA = 'on'; process.env.OBSERVATORIO_IA_OAUTH = 'off'
    expect(await mostrarLinhaConectarIa()).toBe(false)
    expect(h.estado).not.toHaveBeenCalled()
  })
  it('getUser com erro ou sem usuário: false', async () => {
    h.err = new Error('x'); h.user = null
    expect(await mostrarLinhaConectarIa()).toBe(false)
    expect(h.estado).not.toHaveBeenCalled()
  })
  it('ativa: true', async () => {
    expect(await mostrarLinhaConectarIa()).toBe(true)
  })
  it('vencida e cortada: false', async () => {
    h.estado.mockResolvedValue({ tipo: 'vencida', em: null })
    expect(await mostrarLinhaConectarIa()).toBe(false)
    h.estado.mockResolvedValue({ tipo: 'cortada' })
    expect(await mostrarLinhaConectarIa()).toBe(false)
  })
  it('lê com o id da sessão e o site do contexto', async () => {
    await mostrarLinhaConectarIa()
    expect(h.estado).toHaveBeenCalledWith('user-da-sessao', 'site-1')
  })
})
