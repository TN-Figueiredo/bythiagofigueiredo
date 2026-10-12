// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const requireSiteScope = vi.fn()
const captureException = vi.fn()
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: (...a: unknown[]) => requireSiteScope(...a) }))
vi.mock('@sentry/nextjs', () => ({ captureException: (...a: unknown[]) => captureException(...a), captureMessage: vi.fn() }))

import { provarEdicao, edicaoValida, EdicaoDoSite } from '@/lib/youtube/observatorio/proprio/edicao'
import { lerAlcance, lerDiario } from '@/lib/youtube/observatorio/proprio/ler'
import { fakeSupabase } from '../../helpers/fake-supabase'

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
  it('o token não se fabrica fora do módulo: um objeto de fora, forjado de qualquer jeito, não é um token', () => {
    // a prova de TIPO (literal, new, extends) mora em edicao.type-test.ts, que o tsc do web compila; aqui, a de EXECUÇÃO
    expect(edicaoValida({ siteId: 'site-1' })).toBe(false)
    expect(edicaoValida(null)).toBe(false)
    expect(edicaoValida(undefined)).toBe(false)
    expect(edicaoValida('site-1')).toBe(false)
  })
  it('o token real é válido, congelado, e o site dele não se troca', async () => {
    requireSiteScope.mockResolvedValue({ ok: true, user: { id: 'u1' } })
    const t = (await provarEdicao('site-1'))!
    expect(edicaoValida(t)).toBe(true)
    expect(Object.isFrozen(t)).toBe(true)
    expect(() => Object.defineProperty(t, 'siteId', { value: 'outro' })).toThrow()
    expect(t.siteId).toBe('site-1')
  })
  describe('forjados que o instanceof deixava passar: nenhum abre o dado (negado, nenhuma consulta)', () => {
    const forjados: Array<[string, () => unknown]> = [
      ['Object.create(prototype) com o siteId como propriedade própria', () => Object.create(EdicaoDoSite.prototype, { siteId: { value: 'site-1' } })],
      ['Object.create(prototype) puro', () => Object.create(EdicaoDoSite.prototype)],
      ['Reflect.construct do construtor', () => Reflect.construct(EdicaoDoSite, ['site-1'])],
      ['Reflect.construct com a chave inventada', () => Reflect.construct(EdicaoDoSite, ['site-1', Symbol('chave')])],
      ['subclasse que chama super', () => {
        // @ts-expect-error construtor privado: o tsc barra, e esta linha prova que a execução também recusa
        class F extends EdicaoDoSite { constructor() { super('site-1') } }
        return new F()
      }],
    ]
    for (const [nome, fabrica] of forjados) {
      it(nome, async () => {
        let f: unknown
        try { f = fabrica() } catch { return } // recusar na fabricação também vale: ninguém tem um token forjado
        expect(edicaoValida(f)).toBe(false)
        const db = fakeSupabase({ yt_reporting_reports: [], yt_own_video_reach_daily: [], yt_own_video_daily: [] })
        const pedido = { canalId: '3f2b8c1e-5a47-4d0e-9b1c-7e6a2d4f8a10', hoje: '2026-10-10' }
        // o leitor só aceita o que `edicaoValida` aceita; o tipo é a barreira do descuido, a execução é a do forjado
        const edicao = f as EdicaoDoSite
        expect(await lerAlcance(db.client, { ...pedido, edicao })).toEqual({ acesso: 'negado' })
        expect(await lerDiario(db.client, { ...pedido, edicao, ytIds: ['v1'] })).toEqual({ acesso: 'negado' })
        expect(db.trips).toEqual([])
      })
    }
  })
  it('o token não serializa o site como dado solto: JSON do token não carrega nada privado', async () => {
    requireSiteScope.mockResolvedValue({ ok: true, user: { id: 'u1' } })
    expect(JSON.stringify(await provarEdicao('site-1'))).toBe('{}')
  })
})
