// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({ ler: vi.fn(), msg: vi.fn(), svc: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => ({ captureMessage: h.msg }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: h.svc }))
vi.mock('@/lib/youtube/observatorio/acesso-ia/estado-da-pessoa', () => ({ lerEstadoDaPessoa: h.ler }))

import { estadoDaSessao } from '@/lib/youtube/observatorio/acesso-ia/estado-da-sessao'

beforeEach(() => { h.ler.mockReset(); h.msg.mockReset(); h.svc.mockReset(); h.svc.mockReturnValue({ id: 'sb' }) })

describe('estadoDaSessao (única exceção do service client)', () => {
  it('lê com o userId e o siteId recebidos', async () => {
    h.ler.mockResolvedValue({ tipo: 'nunca' })
    expect(await estadoDaSessao('u1', 's1')).toEqual({ tipo: 'nunca' })
    expect(h.ler).toHaveBeenCalledWith({ id: 'sb' }, expect.objectContaining({ userId: 'u1', siteId: 's1' }))
    expect(h.msg).not.toHaveBeenCalled()
  })
  it('M1: getSupabaseServiceClient lançando síncrono vira erro, sem derrubar', async () => {
    h.svc.mockImplementation(() => { throw new Error('sem chave') })
    expect(await estadoDaSessao('u2', 's1')).toEqual({ tipo: 'erro' })
  })
  it('M5: erro manda aviso ao Sentry sem userId nem e-mail', async () => {
    h.ler.mockResolvedValue({ tipo: 'erro' })
    expect(await estadoDaSessao('u3', 's1')).toEqual({ tipo: 'erro' })
    expect(h.msg).toHaveBeenCalledTimes(1)
    expect(h.msg).toHaveBeenCalledWith('conectar-ia: estado ilegível', 'warning')
  })
})
