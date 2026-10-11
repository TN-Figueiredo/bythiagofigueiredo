// @vitest-environment jsdom
// A3 Tarefa 4 (achado I1 da revisão da Tarefa 1): o efeito que grava `fmt` na URL, contra um roteador de teste que ATUALIZA a query
// (o mock dos outros arquivos deixa a query fixa e nunca percorre o ciclo: replace -> query nova -> view nova).
// Cobre: (a) primeira visita sem fmt = UM replace, e depois dele nada mais; (b) com fmt válido nada é gravado; (c) a query muda por outro motivo
// (nicho, busca, ordenação, channel=) e nada é apagado nem regravado; (d) links antigos fmt=short / fmt=long abrem no filtro certo.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const siteAdmin = vi.hoisted(() => ({ value: true }))
vi.mock('@/lib/cms/site-admin-context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/cms/site-admin-context')>()),
  useCanAdminSite: () => siteAdmin.value,
}))
import { render, screen, act } from '@testing-library/react'
import { a3World } from './a3-fixture'
import { buildCanaisView, type CanaisView } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
import { CanaisScreen } from '@/app/cms/(authed)/youtube/competitors/_canais/canais-screen'
import { ToastProvider } from '@/app/cms/(authed)/youtube/competitors/_chrome/toasts'
import { ChromeSyncContext } from '@/app/cms/(authed)/youtube/competitors/_chrome/sync-context'
import type { NicheScope } from '@/lib/youtube/observatorio/types'

const PATH = '/cms/youtube/competitors'
const replace = vi.fn(), push = vi.fn(), refresh = vi.fn(), prefetch = vi.fn()
let search = ''
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh, push, prefetch, back: vi.fn() }),
  usePathname: () => PATH,
  useSearchParams: () => new URLSearchParams(search),
}))

const BASE = a3World()
const ok = async () => ({ ok: true })
/** O que `page.tsx` faz com a URL: lê os parâmetros e monta a view (o nicho inválido cai em Todos). */
function viewDaUrl(qs: string): CanaisView {
  const u = new URLSearchParams(qs)
  const g = (k: string) => u.get(k) ?? undefined
  const n = g('niche')
  const niche: NicheScope = n === 'viagem' || n === 'ia' ? n : 'todos'
  return buildCanaisView(BASE.obs, { niche, nicheExplicit: n != null, limit: 75, channel: g('channel'), scale: g('scale'), fmt: g('fmt'), sort: g('sort'), dir: g('dir'), filter: g('filter') })
}
const tree = (v: CanaisView) => (
  <ToastProvider><ChromeSyncContext.Provider value={{ running: false }}><div data-obs=""><div data-obs-chrome=""><button type="button" aria-label="Mais ações">⋯</button></div>
    <CanaisScreen view={v} canUnlock={false} onAdd={ok} onRemove={ok} onUnlock={ok} onSetNiche={ok} onSetOwnNiche={ok} onSyncOne={ok} />
  </div></ChromeSyncContext.Provider></ToastProvider>
)

/** Um navegador de brinquedo: o `replace` do roteador grava a URL no histórico (troca a entrada atual) e o servidor devolve a view nova. */
let historico: string[] = []
let r: ReturnType<typeof render>
function abrir(qs: string): void {
  historico = [qs]; search = qs
  replace.mockImplementation((url: string) => { historico[historico.length - 1] = new URL('http://x' + url).search.replace(/^\?/, '') })
  push.mockImplementation((url: string) => { historico.push(new URL('http://x' + url).search.replace(/^\?/, '')) })
  r = render(tree(viewDaUrl(qs)))
}
/** O roteador concluiu a navegação: a query é a última do histórico e a página (servidor) entrega a view dela. */
function concluir(): void {
  search = historico.at(-1)!
  act(() => { r.rerender(tree(viewDaUrl(search))) })
}
/** Alguém (link do chrome, voltar, outro efeito) leva a URL para `qs`: push ou replace conforme o caso. */
function irPara(qs: string, modo: 'push' | 'replace' = 'push'): void {
  if (modo === 'push') historico.push(qs); else historico[historico.length - 1] = qs
  concluir()
}
const formatoPressionado = () => screen.getAllByRole('button').filter(b => b.getAttribute('aria-pressed') === 'true' && ['Todos', 'Longos', 'Shorts'].includes(b.textContent ?? '')).map(b => b.textContent)

let store = new Map<string, string>()
const armazenamento = {
  getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v) },
  removeItem: (k: string) => { store.delete(k) }, clear: () => { store.clear() },
}
beforeEach(() => {
  replace.mockReset(); push.mockReset(); refresh.mockReset(); prefetch.mockReset(); search = ''; historico = []
  store = new Map(); vi.stubGlobal('localStorage', armazenamento)
})
afterEach(() => { vi.unstubAllGlobals(); document.getElementById('flut')?.remove() })

describe('A3.1 o fmt entra na URL uma vez e não apaga os outros parâmetros (ciclo real: replace -> query nova -> view nova)', () => {
  it('(a) primeira visita sem fmt: UM replace grava fmt=longos; depois da navegação nada mais é gravado e o histórico não cresce', () => {
    abrir('')
    expect(replace).toHaveBeenCalledTimes(1)
    expect(historico).toEqual(['fmt=longos'])
    concluir() // a query agora traz o fmt e a view diz fmtNaUrl: o efeito sai cedo
    expect(replace).toHaveBeenCalledTimes(1)
    expect(push).not.toHaveBeenCalled()
    expect(historico).toHaveLength(1)
    concluir(); concluir() // re-renders seguintes (a mesma query) também não regravam
    expect(replace).toHaveBeenCalledTimes(1)
    expect(formatoPressionado()).toEqual(['Longos'])
  })
  it('(a) o formato lembrado (Shorts) é o gravado, e a tela passa a mostrar Shorts', () => {
    store.set('obs:canais-fmt', 'shorts')
    abrir('')
    expect(replace).toHaveBeenCalledTimes(1)
    expect(historico).toEqual(['fmt=shorts'])
    concluir()
    expect(replace).toHaveBeenCalledTimes(1)
    expect(formatoPressionado()).toEqual(['Shorts'])
  })
  it('(a) fmt=abc (e fmt= vazio) é reescrito UMA vez para um formato válido, com o resto da query; depois não regrava', () => {
    for (const ruim of ['fmt=abc&sort=subs&niche=viagem', 'fmt=&sort=subs&niche=viagem']) {
      replace.mockReset(); r?.unmount()
      abrir(ruim)
      expect(replace).toHaveBeenCalledTimes(1)
      const u = new URLSearchParams(historico[0])
      expect([u.get('fmt'), u.get('sort'), u.get('niche')]).toEqual(['longos', 'subs', 'viagem'])
      concluir()
      expect(replace).toHaveBeenCalledTimes(1)
    }
  })
  it('(b) com fmt válido (longos, todos, shorts, short, long) nada é gravado, nem na montagem nem depois', () => {
    for (const v of ['longos', 'todos', 'shorts', 'short', 'long']) {
      replace.mockReset(); r?.unmount()
      abrir('fmt=' + v)
      concluir(); concluir()
      expect(replace, 'fmt=' + v).not.toHaveBeenCalled()
      expect(push).not.toHaveBeenCalled()
    }
  })
  it('(c) a query muda por outro motivo (nicho, busca, ordenação, escala, channel=): nada é apagado e nada é regravado', () => {
    abrir('fmt=todos')
    const trocas = ['fmt=todos&niche=viagem', 'fmt=todos&niche=viagem&q=nate', 'fmt=todos&niche=viagem&q=nate&sort=subs', 'fmt=todos&niche=viagem&q=nate&sort=subs&dir=asc&scale=abs',
      'fmt=todos&niche=viagem&q=nate&sort=subs&dir=asc&scale=abs&channel=tnfigueiredo']
    for (const t of trocas) { irPara(t); expect(replace, t).not.toHaveBeenCalled() }
    expect(historico.at(-1)).toBe(trocas.at(-1))
    expect(formatoPressionado()).toEqual(['Todos'])
  })
  it('(c) o chrome leva a URL a uma sem fmt (aba "Canais", filtro por nicho) com os outros parâmetros: o efeito grava o formato lembrado SEM apagar nada, uma vez', () => {
    store.set('obs:canais-fmt', 'todos')
    abrir('fmt=longos&sort=subs')
    irPara('niche=viagem&sort=subs&dir=asc&channel=tnfigueiredo&q=abc&scale=abs')
    expect(replace).toHaveBeenCalledTimes(1)
    const u = new URLSearchParams(historico.at(-1))
    expect(Object.fromEntries(u)).toEqual({ niche: 'viagem', sort: 'subs', dir: 'asc', channel: 'tnfigueiredo', q: 'abc', scale: 'abs', fmt: 'todos' })
    concluir()
    expect(replace).toHaveBeenCalledTimes(1)
    expect(formatoPressionado()).toEqual(['Todos'])
  })
  it('(c) trocar a ordenação (clique) depois da gravação preserva o fmt e não grava outra vez por conta própria', () => {
    abrir('')
    concluir()
    expect(replace).toHaveBeenCalledTimes(1)
    act(() => { document.querySelector<HTMLButtonElement>('th[data-k="outliers"] button')!.click() })
    const u = new URLSearchParams(historico.at(-1))
    expect([u.get('fmt'), u.get('sort')]).toEqual(['longos', 'outliers'])
    const n = replace.mock.calls.length
    concluir()
    expect(replace.mock.calls.length).toBe(n)
  })
  it('(c) o chrome também reescreve a URL (niche inválido some): as duas gravações convergem para uma URL com fmt e sem o nicho ruim', () => {
    abrir('niche=lixo&sort=subs')
    // a primeira gravação (a do fmt) parte da query que viu; a do chrome (tirar o nicho) pode vir logo atrás: o que importa é o estado final
    concluir()
    irPara('sort=subs', 'replace') // o que o chrome grava ao tirar o nicho inválido (parte da query dele, sem fmt)
    const u = () => new URLSearchParams(historico.at(-1))
    expect(replace.mock.calls.length, 'no máximo uma gravação por perda de fmt').toBeLessThanOrEqual(2)
    expect(u().get('fmt')).toBe('longos')
    expect(u().get('sort')).toBe('subs')
    expect(u().get('niche')).toBeNull()
    const n = replace.mock.calls.length
    concluir()
    expect(replace.mock.calls.length).toBe(n)
  })
  it('(c) outra gravação chega antes de o servidor devolver o fmt (a query muda e o fmt continua faltando): o efeito grava de novo, sobre a query nova, sem perdê-la', () => {
    abrir('sort=subs')
    expect(replace).toHaveBeenCalledTimes(1)
    irPara('sort=subs&q=abc', 'replace') // por cima da gravação do fmt, sem passar por uma view com fmt
    expect(replace).toHaveBeenCalledTimes(2)
    expect(Object.fromEntries(new URLSearchParams(historico.at(-1)))).toEqual({ sort: 'subs', q: 'abc', fmt: 'longos' })
    concluir()
    expect(replace).toHaveBeenCalledTimes(2)
    expect(historico).toHaveLength(1)
  })
  it('(d) links antigos: fmt=short abre em Shorts, fmt=long em Longos, sem gravar e sem erro', () => {
    abrir('fmt=short')
    expect(formatoPressionado()).toEqual(['Shorts'])
    expect(replace).not.toHaveBeenCalled()
    r.unmount()
    abrir('fmt=long')
    expect(formatoPressionado()).toEqual(['Longos'])
    expect(replace).not.toHaveBeenCalled()
    expect(document.querySelector('[role="alert"]')).toBeNull()
  })
})
