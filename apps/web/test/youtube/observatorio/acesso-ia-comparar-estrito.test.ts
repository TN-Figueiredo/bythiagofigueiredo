// @vitest-environment node
// A1c: pela ferramenta (`estrito`), um id que não é canal do site não vira outro canal em silêncio: o empacotador devolve null ("não encontrado").
import { afterEach, describe, expect, it, vi } from 'vitest'
import { canalDe, pacoteDe } from './par-helpers'

vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))

let pack = pacoteDe([
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
  describe('proprio (a ausente) com estrito', () => {
    const original = pack
    afterEach(() => { pack = original })
    it('controle: o próprio com vídeo vira o lado A', async () => {
      // o pacote de mentira não monta o modelo inteiro: o que se prova é que a guarda NÃO recusou (sem `faltou`)
      const faltou: { lado?: string } = {}
      montar.mockImplementation(async (s: Record<string, string | undefined>) => {
        const inicial = resolverPar(pack, s.a, s.b)
        return { pagina: { siteId: 'x', obs: {} }, pack, inicial, recente: null, estado: inicial, privado: { acessoPorCanal: {}, negativa: null } }
      })
      await EMPACOTAR.comparar!({ sp: { b: 'c1', estrito: '1', proprio: '1' }, faltou }, abrirFalso).catch(() => 'seguiu')
      expect(faltou.lado).toBeUndefined()
      expect(resolverPar(pack, undefined, 'c1')?.a).toBe('meu')
    })
    it('pacote sem canal próprio: null (nunca o maior concorrente no lado A)', async () => {
      pack = pacoteDe([canalDe('c1', { subs: 5000 }), canalDe('c2', { subs: 9000 })])
      expect(await chama({ b: 'c1', estrito: '1', proprio: '1' })).toBeNull()
    })
    it('canal próprio sem vídeos: null', async () => {
      pack = pacoteDe([canalDe('meu', { own: true, subs: 100, semVideos: true }), canalDe('c1', { subs: 5000 }), canalDe('c2', { subs: 9000 })])
      expect(await chama({ b: 'c1', estrito: '1', proprio: '1' })).toBeNull()
    })
    it('b é o próprio: null', async () => {
      expect(await chama({ b: 'meu', estrito: '1', proprio: '1' })).toBeNull()
    })
    it('diz qual lado faltou (a explícito, b, ou o próprio)', async () => {
      const f1: { lado?: string } = {}
      montar.mockImplementation(async (s: Record<string, string | undefined>) => {
        const inicial = resolverPar(pack, s.a, s.b)
        return { pagina: { siteId: 'x', obs: {} }, pack, inicial, recente: null, estado: inicial, privado: { acessoPorCanal: {}, negativa: null } }
      })
      expect(await EMPACOTAR.comparar!({ sp: { a: 'inventado', b: 'c1', estrito: '1' }, faltou: f1 }, abrirFalso)).toBeNull()
      expect(f1.lado).toBe('a')
      const f2: { lado?: string } = {}
      expect(await EMPACOTAR.comparar!({ sp: { a: 'meu', b: 'inventado', estrito: '1' }, faltou: f2 }, abrirFalso)).toBeNull()
      expect(f2.lado).toBe('b')
      pack = pacoteDe([canalDe('c1', { subs: 5000 }), canalDe('c2', { subs: 9000 })])
      const f3: { lado?: string } = {}
      expect(await EMPACOTAR.comparar!({ sp: { b: 'c1', estrito: '1', proprio: '1' }, faltou: f3 }, abrirFalso)).toBeNull()
      expect(f3.lado).toBe('proprio')
    })
  })
})
