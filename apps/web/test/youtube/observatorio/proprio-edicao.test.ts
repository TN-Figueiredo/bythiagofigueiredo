// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const requireSiteScope = vi.fn()
const captureException = vi.fn()
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: (...a: unknown[]) => requireSiteScope(...a) }))
vi.mock('@sentry/nextjs', () => ({ captureException: (...a: unknown[]) => captureException(...a), captureMessage: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))

import { provarEdicao, edicaoValida, EdicaoDoSite } from '@/lib/youtube/observatorio/proprio/edicao'
import { lerAlcance, lerDiario } from '@/lib/youtube/observatorio/proprio/ler'
import { lerRetencao } from '@/lib/youtube/observatorio/proprio/ler-retencao'
import { lerDimensoes } from '@/lib/youtube/observatorio/proprio/ler-dimensoes'
import { LeituraPrivadaDoSite, leituraValida } from '@/lib/youtube/observatorio/proprio/leitura-privada'
import { leituraDe } from './leitura-teste'
import { fakeSupabase } from '../../helpers/fake-supabase'

const SITE = '3f2b8c1e-5a47-4d0e-9b1c-7e6a2d4f8a10'
const CANAL = '3f2b8c1e-5a47-4d0e-9b1c-7e6a2d4f8a11'
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
    // `lanca`: a fabricação já recusa com TypeError (o construtor exige a chave e o new.target); senão o objeto nasce, e o brand check o recusa
    const forjados: Array<{ nome: string; lanca: boolean; fabrica: () => unknown }> = [
      { nome: 'Object.create(prototype) com o siteId como propriedade própria', lanca: false, fabrica: () => Object.create(EdicaoDoSite.prototype, { siteId: { value: 'site-1' } }) },
      { nome: 'Object.create(prototype) puro', lanca: false, fabrica: () => Object.create(EdicaoDoSite.prototype) },
      { nome: 'Reflect.construct do construtor', lanca: true, fabrica: () => Reflect.construct(EdicaoDoSite, ['site-1']) },
      { nome: 'Reflect.construct com a chave inventada', lanca: true, fabrica: () => Reflect.construct(EdicaoDoSite, ['site-1', Symbol('chave')]) },
      { nome: 'subclasse que chama super', lanca: true, fabrica: () => {
        // @ts-expect-error construtor privado: o tsc barra, e esta linha prova que a execução também recusa
        class F extends EdicaoDoSite { constructor() { super('site-1') } }
        return new F()
      } },
    ]
    // o forjado de EdicaoDoSite só se prova contra `edicaoValida`; contra os leitores quem manda é o token de LEITURA (bloco abaixo)
    const naoEhEdicao = (f: unknown) => expect(edicaoValida(f)).toBe(false)
    for (const { nome, lanca, fabrica } of forjados) {
      it(nome, async () => {
        if (lanca) {
          // a fabricação recusa, e recusa pelo motivo certo (não por um erro de digitação da fábrica)
          expect(fabrica).toThrow(TypeError)
          expect(fabrica).toThrow(/EdicaoDoSite só nasce em provarEdicao/)
          return
        }
        naoEhEdicao(fabrica()) // a fabricação NÃO lança: quem recusa é o brand check
      })
    }
    it('o que não tem o campo privado também não é um token de edição', () => {
      naoEhEdicao({ siteId: 'site-1' })
      naoEhEdicao(Object.create(null))
    })
  })
  describe('forjados de LeituraPrivadaDoSite entregues como `leitura:` aos quatro leitores: negado e nenhuma consulta (o brand check, não o instanceof)', () => {
    const fabricasDeLeitura: Array<{ nome: string; fabrica: () => Promise<unknown> | unknown }> = [
      { nome: 'literal com siteId', fabrica: () => ({ siteId: SITE }) },
      { nome: 'Object.create(prototype) puro', fabrica: () => Object.create(LeituraPrivadaDoSite.prototype) },
      { nome: 'Object.create(prototype) com o siteId como propriedade própria (esconde o getter)', fabrica: () => Object.create(LeituraPrivadaDoSite.prototype, { siteId: { value: SITE } }) },
      { nome: 'Reflect.construct do construtor (fabricado com a chave inventada)', fabrica: () => { try { return Reflect.construct(LeituraPrivadaDoSite, [SITE, Symbol('chave')]) } catch { return Object.create(LeituraPrivadaDoSite.prototype, { siteId: { value: SITE } }) } } },
      { nome: 'subclasse', fabrica: () => { class F extends (LeituraPrivadaDoSite as unknown as new () => object) {} ; try { return new F() } catch { return Object.create(F.prototype, { siteId: { value: SITE } }) } } },
      { nome: 'structuredClone de um token de verdade', fabrica: async () => { try { return structuredClone(await leituraDe(SITE)) } catch { return Object.create(LeituraPrivadaDoSite.prototype, { siteId: { value: SITE } }) } } },
      { nome: 'Object.create(null)', fabrica: () => Object.create(null) },
    ]
    const pedido = { canalId: CANAL, hoje: '2026-10-10' }
    const leitores: Array<{ nome: string; chama: (db: ReturnType<typeof fakeSupabase>, leitura: LeituraPrivadaDoSite) => Promise<unknown> }> = [
      { nome: 'lerAlcance', chama: (db, leitura) => lerAlcance(db.client, { ...pedido, leitura }) },
      { nome: 'lerDiario', chama: (db, leitura) => lerDiario(db.client, { ...pedido, leitura, ytIds: ['v1'] }) },
      { nome: 'lerRetencao', chama: (db, leitura) => lerRetencao(db.client, { ...pedido, leitura, ytId: 'v1' }) },
      { nome: 'lerDimensoes', chama: (db, leitura) => lerDimensoes(db.client, { ...pedido, leitura, ytIds: ['v1'], de: '2026-09-01', ate: '2026-10-09' }) },
    ]
    beforeEach(() => requireSiteScope.mockResolvedValue({ ok: true, user: { id: 'u1' } }))
    for (const { nome: nf, fabrica } of fabricasDeLeitura) {
      for (const { nome: nl, chama } of leitores) {
        it(`${nf} -> ${nl}`, async () => {
          const forjado = await fabrica()
          expect(leituraValida(forjado)).toBe(false)
          const db = fakeSupabase({ yt_reporting_reports: [], yt_own_video_reach_daily: [], yt_own_video_daily: [], yt_own_video_retention: [] })
          const r = await chama(db, forjado as LeituraPrivadaDoSite)
          expect(r).toMatchObject({ acesso: 'negado' })
          expect(db.trips).toEqual([])
        })
      }
    }
    it('controle: o token de verdade passa pelo brand check', async () => {
      expect(leituraValida(await leituraDe(SITE))).toBe(true)
    })
  })
  it('a estática do brand check não se regrava: regravá-la ou trocar `provar` não muda o veredito, e a classe está congelada', async () => {
    expect(Object.isFrozen(EdicaoDoSite)).toBe(true)
    // Reflect.set não lança: devolve false quando a classe não aceita a escrita
    expect(Reflect.set(EdicaoDoSite, 'ehEdicao', () => true)).toBe(false)
    expect(Reflect.set(EdicaoDoSite, 'provar', async () => null)).toBe(false)
    expect(Reflect.defineProperty(EdicaoDoSite, 'ehEdicao', { value: () => true })).toBe(false)
    expect(edicaoValida({ siteId: 'S' })).toBe(false)
    expect(edicaoValida(Object.create(EdicaoDoSite.prototype))).toBe(false)
    requireSiteScope.mockResolvedValue({ ok: true, user: { id: 'u1' } })
    expect(edicaoValida(await provarEdicao('site-1'))).toBe(true) // o token real continua válido
  })
  it('o token não serializa o site como dado solto: JSON do token não carrega nada privado', async () => {
    requireSiteScope.mockResolvedValue({ ok: true, user: { id: 'u1' } })
    expect(JSON.stringify(await provarEdicao('site-1'))).toBe('{}')
  })
})
