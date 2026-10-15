// @vitest-environment node
/**
 * A5 · E17 degrau 1, Tarefa 9: as duas funções puras de `_contexto-ia/index.ts`. A consulta da URL vira parâmetros planos com a regra das páginas
 * (primeira ocorrência de cada chave); o estado do registro leva só chave conhecida e valor curto, e nunca texto cru.
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({ redirect: () => { throw new Error('REDIRECT') }, notFound: () => { throw new Error('NOT_FOUND') } }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

import { estadoDoRegistro, parametrosPlanos, EMPACOTAR } from '@/app/cms/(authed)/youtube/competitors/_contexto-ia'
import { TELAS_IA } from '@/lib/youtube/observatorio/contexto-ia/telas'

describe('parametrosPlanos', () => {
  it('"?fmt=a&fmt=b" vale a primeira ocorrência; sem "?" também funciona; vazio dá objeto vazio', () => {
    expect(parametrosPlanos('?fmt=a&fmt=b&tab=x')).toEqual({ fmt: 'a', tab: 'x' })
    expect(parametrosPlanos('fmt=a')).toEqual({ fmt: 'a' })
    expect(parametrosPlanos('')).toEqual({})
  })
  it('chaves herdadas de objeto não viram propriedade', () => {
    const p = parametrosPlanos('?__proto__=x&constructor=y&prototype=z&ok=1')
    expect(p).toEqual({ ok: '1' })
    expect(Object.getPrototypeOf(p)).toBe(Object.prototype)
    expect(({} as Record<string, unknown>).x).toBeUndefined()
  })
  it('valor decodificado como a página o recebe; valor vazio permanece texto vazio', () => {
    expect(parametrosPlanos('?q=a%20b&niche=')).toEqual({ q: 'a b', niche: '' })
  })
})

describe('estadoDoRegistro', () => {
  it('só chaves conhecidas, só valores curtos e sem espaço, em ordem estável', () => {
    expect(estadoDoRegistro({ sort: 'recent', niche: 'viagem', q: 'busca livre', desconhecida: 'x', topic: 'com espaço', fmt: 'x'.repeat(80) }))
      .toEqual(['niche=viagem', 'sort=recent'])
  })
  it('estado vazio dá lista vazia', () => { expect(estadoDoRegistro({})).toEqual([]) })
})

describe('EMPACOTAR', () => {
  it('toda tela em existe tem entrada, e nenhuma tela em espera_a_tela tem', () => {
    for (const [tela, t] of Object.entries(TELAS_IA)) {
      expect(Object.prototype.hasOwnProperty.call(EMPACOTAR, tela), tela).toBe(t.estado === 'existe')
    }
  })
})
