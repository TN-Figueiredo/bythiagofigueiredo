// @vitest-environment jsdom
/** A3 Tarefa 8: o par na URL (hook `usePar`): replaceState sem navegar, ressincronização por valor e popstate. */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'
import { canalDe, pacoteDe } from './par-helpers'
import { usePar } from '@/app/cms/(authed)/youtube/competitors/_comparar/use-par'

vi.mock('next/navigation', () => ({
  useRouter: () => { throw new Error('o hook não pode usar o router') },
  usePathname: () => { throw new Error('o hook não pode usar o pathname') },
  useSearchParams: () => { throw new Error('o hook não pode usar a query do router') },
}))

const mk = (id: string, subs: number, o: Parameters<typeof canalDe>[1] = {}) => canalDe(id, { subs, ...o })
const PACK = pacoteDe([mk('eu', 1000, { own: true }), mk('c1', 5000), mk('c2', 3000), mk('c3', 2000), mk('c4', 500)])

const url = (q = '') => window.history.replaceState(null, '', '/cms/youtube/competitors/comparar' + q)
const busca = () => new URLSearchParams(window.location.search)
let push: ReturnType<typeof vi.spyOn>, replace: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  url('')
  push = vi.spyOn(window.history, 'pushState')
  replace = vi.spyOn(window.history, 'replaceState')
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('usePar', () => {
  it('trocar um lado grava ?a=&b= com replaceState, sem push e sem router', () => {
    url('?a=eu&b=c2'); replace.mockClear()
    const { result } = renderHook(() => usePar(PACK, { a: 'eu', b: 'c2' }))
    expect(replace).not.toHaveBeenCalled() // a URL já é a canônica: nada a reescrever
    act(() => result.current.trocar('b', 'c3'))
    expect(result.current.a).toBe('eu'); expect(result.current.b).toBe('c3')
    expect(busca().get('a')).toBe('eu'); expect(busca().get('b')).toBe('c3')
    expect(replace).toHaveBeenCalledTimes(1)
    expect(push).not.toHaveBeenCalled()
    act(() => result.current.trocar('a', 'c1'))
    expect(busca().get('a')).toBe('c1'); expect(busca().get('b')).toBe('c3')
    expect(push).not.toHaveBeenCalled()
  })
  it('a URL fora do padrão (sem a e b) é reescrita para o par resolvido ao abrir, com replaceState; outros parâmetros ficam', () => {
    url('?x=1'); replace.mockClear()
    renderHook(() => usePar(PACK, { a: 'eu', b: 'c1' }))
    expect(busca().get('a')).toBe('eu'); expect(busca().get('b')).toBe('c1'); expect(busca().get('x')).toBe('1')
    expect(replace).toHaveBeenCalledTimes(1); expect(push).not.toHaveBeenCalled()
  })
  it('escolher no lado A o canal que está no lado B não faz nada (a opção está desabilitada)', () => {
    url('?a=eu&b=c2'); replace.mockClear()
    const { result } = renderHook(() => usePar(PACK, { a: 'eu', b: 'c2' }))
    act(() => result.current.trocar('a', 'c2'))
    act(() => result.current.trocar('b', 'eu'))
    expect(result.current.a).toBe('eu'); expect(result.current.b).toBe('c2')
    expect(replace).not.toHaveBeenCalled()
    act(() => result.current.trocar('a', 'nao-existe'))
    expect(result.current.a).toBe('eu')
  })
  it('inverter troca a e b na URL', () => {
    url('?a=eu&b=c2')
    const { result } = renderHook(() => usePar(PACK, { a: 'eu', b: 'c2' }))
    act(() => result.current.inverter())
    expect([result.current.a, result.current.b]).toEqual(['c2', 'eu'])
    expect(busca().get('a')).toBe('c2'); expect(busca().get('b')).toBe('eu')
    expect(push).not.toHaveBeenCalled()
    act(() => result.current.inverter())
    expect([result.current.a, result.current.b]).toEqual(['eu', 'c2'])
  })
  it('rerender com outro inicial (navegação que só muda a query) ressincroniza; rerender com o mesmo inicial não desfaz a escolha local', () => {
    url('?a=eu&b=c2')
    const { result, rerender } = renderHook(({ i }) => usePar(PACK, i), { initialProps: { i: { a: 'eu', b: 'c2' } } })
    act(() => result.current.trocar('b', 'c3'))
    rerender({ i: { a: 'eu', b: 'c2' } }) // o servidor re-renderiza sem mudar a query (uma ação, por exemplo)
    expect(result.current.b).toBe('c3')
    rerender({ i: { ...{ a: 'eu', b: 'c2' } } }) // objeto novo, mesmo valor
    expect(result.current.b).toBe('c3')
    // uma navegação de verdade: a URL do navegador já é a nova quando o servidor manda o inicial novo
    url('?a=c1&b=c4')
    rerender({ i: { a: 'c1', b: 'c4' } })
    expect([result.current.a, result.current.b]).toEqual(['c1', 'c4'])
  })
  it('a URL manda no ressincronizar: o inicial pode vir velho (Voltar até uma entrada reescrita por replaceState)', () => {
    url('?a=eu&b=c2')
    const { result, rerender } = renderHook(({ i }) => usePar(PACK, i), { initialProps: { i: { a: 'eu', b: 'c2' } } })
    url('?a=c1&b=c3') // o navegador já está na URL da entrada escolhida
    rerender({ i: { a: 'c4', b: 'c2' } }) // RSC de outra entrada
    expect([result.current.a, result.current.b]).toEqual(['c1', 'c3'])
  })
  it('popstate relê a URL; URL com par inválido cai no padrão de resolverPar', () => {
    url('?a=eu&b=c2')
    const { result } = renderHook(() => usePar(PACK, { a: 'eu', b: 'c2' }))
    act(() => { url('?a=c3&b=c1'); window.dispatchEvent(new PopStateEvent('popstate')) })
    expect([result.current.a, result.current.b]).toEqual(['c3', 'c1'])
    act(() => { url('?a=lixo&b=lixo'); window.dispatchEvent(new PopStateEvent('popstate')) })
    expect(result.current.a).toBe('eu') // o canal próprio com vídeos
    expect(result.current.b).not.toBe('eu')
    expect(['c1', 'c2', 'c3', 'c4']).toContain(result.current.b)
    act(() => { url('?a=c1&b=c1'); window.dispatchEvent(new PopStateEvent('popstate')) })
    expect(result.current.a).toBe('c1'); expect(result.current.b).not.toBe('c1')
    act(() => { url(''); window.dispatchEvent(new PopStateEvent('popstate')) })
    expect(result.current.a).toBe('eu')
  })
  it('Voltar para FORA da comparação: o popstate com outro pathname não muda o par e não escreve na URL do destino', () => {
    url('?a=eu&b=c2')
    const { result } = renderHook(() => usePar(PACK, { a: 'eu', b: 'c2' }))
    act(() => result.current.trocar('b', 'c3'))
    replace.mockClear(); push.mockClear()
    // o navegador já está na lista de Canais (sem a nem b) quando o popstate chega, com o hook ainda montado
    act(() => { window.history.replaceState(null, '', '/cms/youtube/competitors?fmt=longos'); replace.mockClear(); window.dispatchEvent(new PopStateEvent('popstate')) })
    expect(replace).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
    expect(window.location.pathname + window.location.search).toBe('/cms/youtube/competitors?fmt=longos')
    expect(busca().has('a')).toBe(false); expect(busca().has('b')).toBe(false)
    expect([result.current.a, result.current.b]).toEqual(['eu', 'c3']) // o par da tela ficou como estava
    // e o Avançar de volta à comparação relê a URL dela
    act(() => { window.history.replaceState(null, '', '/cms/youtube/competitors/comparar?a=c1&b=c4'); replace.mockClear(); window.dispatchEvent(new PopStateEvent('popstate')) })
    expect([result.current.a, result.current.b]).toEqual(['c1', 'c4'])
    expect(replace).not.toHaveBeenCalled()
  })
  it('o popstate só LÊ: nem com a URL inválida ele escreve (o estado cai no padrão, a URL fica como o navegador a pôs)', () => {
    url('?a=eu&b=c2')
    const { result } = renderHook(() => usePar(PACK, { a: 'eu', b: 'c2' }))
    replace.mockClear()
    act(() => { url('?a=lixo&b=lixo'); replace.mockClear(); window.dispatchEvent(new PopStateEvent('popstate')) })
    expect(replace).not.toHaveBeenCalled()
    expect(result.current.a).toBe('eu')
    expect(busca().get('a')).toBe('lixo')
  })
  it('id em maiúsculas não é canal deste pacote: cai no padrão', () => {
    url('?a=EU&b=C2')
    const { result } = renderHook(() => usePar(PACK, { a: 'eu', b: 'c1' }))
    act(() => { window.dispatchEvent(new PopStateEvent('popstate')) })
    expect(result.current.a).toBe('eu'); expect(result.current.b).not.toBe('C2')
  })
  it('history que lança não quebra a tela: o estado muda mesmo assim', () => {
    url('?a=eu&b=c2')
    const { result } = renderHook(() => usePar(PACK, { a: 'eu', b: 'c2' }))
    replace.mockImplementation(() => { throw new Error('SecurityError') })
    act(() => result.current.trocar('b', 'c3'))
    expect(result.current.b).toBe('c3')
    act(() => result.current.inverter())
    expect([result.current.a, result.current.b]).toEqual(['c3', 'eu'])
  })
  it('history que lança já na abertura (reescrita da URL canônica) também não quebra', () => {
    url('?x=1'); replace.mockImplementation(() => { throw new Error('SecurityError') })
    const { result } = renderHook(() => usePar(PACK, { a: 'eu', b: 'c1' }))
    expect([result.current.a, result.current.b]).toEqual(['eu', 'c1'])
  })
})
