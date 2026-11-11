// @vitest-environment node
/**
 * A5 F2b T10 (K10): `empacotarCanalOuProprio` lê o canal UMA vez (`montarCanal`) e escolhe o ramo por `m.tipo`; com `semComentarios` o leitor de comentários
 * do canal não é chamado. Antes, `serie` por `canal_id` de um canal próprio chamava `montarCanal` duas vezes (`canal` e depois `canal-proprio`).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  montarCanal: vi.fn(),
  comentarios: vi.fn(async () => ({ lidos: 1 })),
  projetar: vi.fn(() => ({ medidas: true })),
}))
vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({ redirect: () => { throw new Error('REDIRECT') }, notFound: () => { throw new Error('NOT_FOUND') } }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_canal/montar', async (orig) => ({ ...(await orig<object>()), montarCanal: h.montarCanal, assistidoDoCanal: vi.fn(async () => null), origemDoCanal: vi.fn(async () => null) }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_canal/medidas/contexto-do-canal', async (orig) => ({
  ...(await orig<object>()), contextoDoCanal: vi.fn(() => ({})), lerMedidasDoCanal: vi.fn(), lerComentariosDoCanalParaOPacote: h.comentarios,
}))
vi.mock('@/app/cms/(authed)/youtube/competitors/_contexto-ia/empacotar-canal-medidas', async (orig) => ({ ...(await orig<object>()), projetarMedidas: h.projetar }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_contexto-ia/empacotar-canal', async (orig) => ({ ...(await orig<object>()), empacotarCanal: vi.fn(() => ({ tela: 'canal', tabelas: [], foco: [], avisos: [], definicoes: [], naoMede: [], citados: [] })), modeloDeCanal: vi.fn(() => ({})) }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_contexto-ia/empacotar-canal-proprio', async (orig) => ({ ...(await orig<object>()), empacotarCanalProprio: vi.fn(() => ({ tela: 'canal-proprio', tabelas: [], foco: [], avisos: [], definicoes: [], naoMede: [], citados: [] })), modeloDeCanalProprio: vi.fn(() => ({})) }))
vi.mock('@/lib/youtube/observatorio/contexto-ia/mascarar', () => ({ mascararCrus: (m: unknown) => m }))

import { empacotarCanalOuProprio, EMPACOTAR, resolverProprio } from '@/app/cms/(authed)/youtube/competitors/_contexto-ia'
import { responder } from '@/app/cms/(authed)/youtube/competitors/_acesso-ia/responder'
import { ABRIDOR_DE_SESSAO } from '@/app/cms/(authed)/youtube/competitors/_chrome/abridor'

const ID = '11111111-1111-4111-8111-111111111111'
const obs = { channels: [] }
const concorrente = { tipo: 'concorrente', pagina: { now: 1, siteId: 's', leitura: null, negativa: null }, obs, view: {}, leituraMv: {}, recente: null, estado: {}, medidas: Promise.resolve({}) }
const proprio = { tipo: 'proprio', pagina: { now: 1, siteId: 's' }, obs, pv: {}, comoEsta: {}, periodosProps: null, origemProps: {}, recente: null, estado: {}, privado: { estado: 'na' } }

beforeEach(() => { h.montarCanal.mockReset(); h.comentarios.mockClear(); h.projetar.mockClear() })

describe('empacotarCanalOuProprio (uma leitura)', () => {
  it('canal próprio: montarCanal é chamado 1 vez (antes eram 2) e o ramo é o do canal próprio', async () => {
    h.montarCanal.mockResolvedValue(proprio)
    const r = await empacotarCanalOuProprio({ id: ID, sp: { niche: 'todos' } }, ABRIDOR_DE_SESSAO)
    expect(h.montarCanal).toHaveBeenCalledTimes(1)
    expect(r?.modelo.tela).toBe('canal-proprio')
  })
  it('concorrente: 1 chamada; sem opcoes o leitor de comentários roda 1 vez', async () => {
    h.montarCanal.mockResolvedValue(concorrente)
    const r = await empacotarCanalOuProprio({ id: ID, sp: {} }, ABRIDOR_DE_SESSAO)
    expect(h.montarCanal).toHaveBeenCalledTimes(1)
    expect(r?.modelo.tela).toBe('canal')
    expect(h.comentarios).toHaveBeenCalledTimes(1)
  })
  it('semComentarios: o leitor de comentários é chamado 0 vezes e o projetor recebe comentários nulo', async () => {
    h.montarCanal.mockResolvedValue(concorrente)
    await empacotarCanalOuProprio({ id: ID, sp: {}, opcoes: { semComentarios: true } }, ABRIDOR_DE_SESSAO)
    expect(h.comentarios).toHaveBeenCalledTimes(0)
    expect(h.projetar.mock.calls[0]![2]).toBeNull()
  })
  it('id que não é canal (nem concorrente nem próprio) ou vazio: null, nunca outro canal', async () => {
    h.montarCanal.mockResolvedValue({ tipo: 'nao_encontrado', pagina: {}, recente: null })
    expect(await empacotarCanalOuProprio({ id: ID, sp: {} }, ABRIDOR_DE_SESSAO)).toBeNull()
    expect(await empacotarCanalOuProprio({ sp: {} }, ABRIDOR_DE_SESSAO)).toBeNull()
  })
  it("o registro tem a entrada 'canal?' (é por ela que o responder lê o canal uma vez)", () => {
    expect(typeof EMPACOTAR['canal?']).toBe('function')
  })
})

describe('Yannis m-2: resolverProprio não engole o erro', () => {
  it('a leitura do observatório que falha chega a quem chamou (antes virava "não há canal próprio")', async () => {
    const falha = { observatorio: async () => { throw new Error('banco fora') } } as never
    await expect(resolverProprio(falha)).rejects.toThrow('banco fora')
  })
})

describe('pela serie (responder): o canal é lido uma vez e sem comentários', () => {
  const AGORA = Date.UTC(2026, 10, 10, 15, 0, 0)
  const pedido = { acao: 'serie', canal_id: ID, de: '2026-11-01', ate: '2026-11-07' }
  it('serie por canal_id de um canal próprio: montarCanal 1 vez (hoje 2)', async () => {
    h.montarCanal.mockResolvedValue(proprio)
    await responder(pedido, ABRIDOR_DE_SESSAO, AGORA)
    expect(h.montarCanal).toHaveBeenCalledTimes(1)
  })
  it('Yannis m-1: id que não existe: montarCanal 1 vez (antes 3, pelo fallback)', async () => {
    h.montarCanal.mockResolvedValue({ tipo: 'nao_encontrado', pagina: {}, recente: null })
    const r = await responder(pedido, ABRIDOR_DE_SESSAO, AGORA)
    expect(r.desfecho).toBe('nao_encontrado')
    expect(h.montarCanal).toHaveBeenCalledTimes(1)
  })
  it('serie de um concorrente: leitor de comentários 0 vezes', async () => {
    h.montarCanal.mockResolvedValue(concorrente)
    await responder(pedido, ABRIDOR_DE_SESSAO, AGORA)
    expect(h.montarCanal).toHaveBeenCalledTimes(1)
    expect(h.comentarios).toHaveBeenCalledTimes(0)
  })
  it('o canal (não a serie) segue lendo os comentários', async () => {
    h.montarCanal.mockResolvedValue(concorrente)
    await responder({ acao: 'canal', canal_id: ID }, ABRIDOR_DE_SESSAO, AGORA)
    expect(h.comentarios).toHaveBeenCalledTimes(1)
  })
})
