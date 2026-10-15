// @vitest-environment node
/** A5 · E17 degrau 1, portão do N3 (Yannis Y4): o canal próprio lê os cartões de período e a Origem EM PARALELO, não em série. */
import { describe, expect, it, vi } from 'vitest'

const ordem = vi.hoisted(() => ({ eventos: [] as string[] }))
vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({ redirect: () => { throw new Error('REDIRECT') }, notFound: () => { throw new Error('NOT_FOUND') } }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_canal/montar', () => ({
  montarCanal: async () => ({ tipo: 'proprio', periodosProps: {}, origemProps: {}, obs: { channels: [] }, pv: {}, comoEsta: {}, privado: {}, recente: null, estado: {} }),
  assistidoDoCanal: async () => { ordem.eventos.push('periodos:inicio'); await new Promise((r) => setTimeout(r, 40)); ordem.eventos.push('periodos:fim'); return null },
  origemDoCanal: async () => { ordem.eventos.push('origem:inicio'); await new Promise((r) => setTimeout(r, 40)); ordem.eventos.push('origem:fim'); return null },
}))
vi.mock('@/app/cms/(authed)/youtube/competitors/_contexto-ia/empacotar-canal-proprio', async (orig) => ({ ...(await orig<Record<string, unknown>>()), modeloDeCanalProprio: () => ({}), empacotarCanalProprio: () => ({}) }))

import { EMPACOTAR } from '@/app/cms/(authed)/youtube/competitors/_contexto-ia'

describe('canal-proprio: leituras independentes em paralelo', () => {
  it('a Origem começa antes de os cartões de período terminarem', async () => {
    await EMPACOTAR['canal-proprio']!({ id: 'abc', sp: {} })
    expect(ordem.eventos.indexOf('origem:inicio')).toBeLessThan(ordem.eventos.indexOf('periodos:fim'))
  })
})
