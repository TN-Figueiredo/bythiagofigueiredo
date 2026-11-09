// @vitest-environment node
// A1c: pela ferramenta (`estrito`), um id que não é canal do site não vira outro canal em silêncio: o empacotador devolve null ("não encontrado").
import { describe, expect, it, vi } from 'vitest'
import { canalDe, pacoteDe } from './par-helpers'

vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))

const pack = pacoteDe([
  canalDe('meu', { own: true, subs: 100 }),
  canalDe('c1', { subs: 5000 }),
  canalDe('c2', { subs: 9000 }),
])
const montar = vi.hoisted(() => vi.fn())
vi.mock('@/app/cms/(authed)/youtube/competitors/_comparar/montar', () => ({ montarComparar: montar }))

import { resolverPar } from '@/app/cms/(authed)/youtube/competitors/_comparar/par-model'
import { EMPACOTAR } from '@/app/cms/(authed)/youtube/competitors/_contexto-ia'

const abrirFalso = { observatorio: async () => { throw new Error('não deveria abrir') } } as never

async function chama(sp: Record<string, string | undefined>) {
  montar.mockImplementation(async (s: Record<string, string | undefined>) => {
    const inicial = resolverPar(pack, s.a, s.b)
    return { pagina: { siteId: 'x', obs: {} }, pack, inicial, recente: null, estado: inicial, privado: { acessoPorCanal: {}, negativa: null } }
  })
  return EMPACOTAR.comparar!({ sp }, abrirFalso)
}

describe('comparar estrito (ferramenta)', () => {
  it('id inventado em b: null, nunca o concorrente "logo acima"', async () => {
    expect(await chama({ a: 'meu', b: 'inventado', estrito: '1' })).toBeNull()
  })
  it('id inventado em a: null, nunca o canal próprio', async () => {
    expect(await chama({ a: 'inventado', b: 'c1', estrito: '1' })).toBeNull()
  })
  it('UC… que não está no pacote: null', async () => {
    expect(await chama({ a: 'UCaaaaaaaaaaaaaaaaaaaaaaaa', b: 'c1', estrito: '1' })).toBeNull()
  })
})
