// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const requireSiteScope = vi.fn()
const captureException = vi.fn()
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: (...a: unknown[]) => requireSiteScope(...a) }))
vi.mock('@sentry/nextjs', () => ({ captureException: (...a: unknown[]) => captureException(...a), captureMessage: vi.fn() }))

import { provarEdicao, EdicaoDoSite } from '@/lib/youtube/observatorio/proprio/edicao'

beforeEach(() => { requireSiteScope.mockReset(); captureException.mockReset() })

describe('provarEdicao: o token de edição do site', () => {
  it('guarda de edição ok: devolve o token daquele site; a guarda é pedida com mode "edit" e o siteId recebido', async () => {
    requireSiteScope.mockResolvedValue({ ok: true, user: { id: 'u1' } })
    const t = await provarEdicao('site-1')
    expect(t).toBeInstanceOf(EdicaoDoSite)
    expect(t!.siteId).toBe('site-1')
    expect(requireSiteScope).toHaveBeenCalledTimes(1)
    expect(requireSiteScope).toHaveBeenCalledWith({ area: 'cms', siteId: 'site-1', mode: 'edit' })
  })
  it('guarda diz não (só lê o site, sem sessão): null, nada é lançado nem avisado', async () => {
    for (const reason of ['insufficient_access', 'unauthenticated']) {
      requireSiteScope.mockResolvedValue({ ok: false, reason })
      expect(await provarEdicao('site-1')).toBeNull()
    }
    expect(captureException).not.toHaveBeenCalled()
  })
  it('a guarda lançou: null (falha fechada), nunca lança, e o erro vai ao Sentry uma vez', async () => {
    const boom = new Error('boom')
    requireSiteScope.mockRejectedValue(boom)
    expect(await provarEdicao('site-1')).toBeNull()
    expect(captureException).toHaveBeenCalledTimes(1)
    expect(captureException.mock.calls[0]![0]).toBe(boom)
  })
  it('o token não se fabrica fora do módulo: nem literal, nem new (tsc barra; em execução um objeto de fora não é um EdicaoDoSite)', () => {
    // @ts-expect-error objeto literal não é um EdicaoDoSite (campo privado)
    const falso: EdicaoDoSite = { siteId: 'site-1' }
    expect(falso instanceof EdicaoDoSite).toBe(false)
    // @ts-expect-error construtor privado
    const novo = () => new EdicaoDoSite('site-1')
    expect(typeof novo).toBe('function')
  })
  it('o token não serializa o site como dado solto: JSON do token não carrega nada privado', async () => {
    requireSiteScope.mockResolvedValue({ ok: true, user: { id: 'u1' } })
    expect(JSON.stringify(await provarEdicao('site-1'))).toBe('{}')
  })
})
