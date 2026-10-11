// @vitest-environment jsdom
// Fase A2, tarefa 1, na tela: chegada pela troca (spec 6.2) e período (spec 6.4).
// jsdom não tem layout: o gráfico tem 1100 px (o padrão do componente) e o ponteiro é fino (alvos de 32 px).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, within } from '@testing-library/react'
import { canalWorld } from './canal-fixture'
import { loadFase4, setThumbs, VID } from './fase4-world'
import { createObservatory } from '@/lib/youtube/observatorio'
import { buildHistoricoView } from '@/app/cms/(authed)/youtube/competitors/_historico/view-model'
import { HistoricoScreen } from '@/app/cms/(authed)/youtube/competitors/_historico/historico-screen'
import { ToastProvider } from '@/app/cms/(authed)/youtube/competitors/_chrome/toasts'

const nav = vi.hoisted(() => ({ replace: vi.fn(), search: 'from=canais' }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: nav.replace, refresh: vi.fn(), push: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors/video/x',
  useSearchParams: () => new URLSearchParams(nav.search),
}))
beforeEach(() => { nav.replace.mockClear(); nav.search = 'from=canais' })
afterEach(() => { document.getElementById('flut')?.remove() })

const { obs } = canalWorld()
const FULL = 'matt-opus55'
const changes = obs.changes.filter(c => c.video === FULL)
const thumb = changes.find(c => c.type === 'thumb' && !c.window)!
const title = changes.find(c => c.type === 'title')!

type Obs = typeof obs
const build = (p: Record<string, string | undefined>, o: Obs = obs, id = FULL) => buildHistoricoView(o, id, p)
function mount(p: Record<string, string | undefined> = {}, o: Obs = obs, id = FULL) {
  const view = build(p, o, id)
  const r = render(<ToastProvider><HistoricoScreen view={view} /></ToastProvider>)
  const root = () => r.container.querySelector<HTMLElement>('[data-obs-screen="historico"]')!
  return { ...r, view, root: root() }
}
const pressed = (root: HTMLElement) => root.querySelector<HTMLElement>('#hv-compare .pair[aria-pressed="true"]')?.dataset.k
const arrive = (root: HTMLElement) => root.querySelector<HTMLElement>('.arrive')

describe('chegada pela troca, na tela', () => {
  it('com arrival: a troca chega selecionada em "Antes e depois" com a linha "Aberta pela aba Trocas do canal: …"', () => {
    const { root, view } = mount({ troca: thumb.id })
    expect(view.arrival).not.toBeNull()
    expect(pressed(root)).toBe(view.arrival!.pairK)
    expect(arrive(root)!.textContent).toBe(view.arrival!.line)
    expect(arrive(root)!.textContent).toMatch(/^Aberta pela aba Trocas do canal: Thumbnail .+ → .+, \d\d\/\d\d \d\d:\d\d\.$/)
    // a linha mora no cartão de "Antes e depois"
    expect(root.querySelector('#hv-compare')!.contains(arrive(root))).toBe(true)
  })
  it('com arrival: o marcador da troca na raia tem o anel (data-arrival) e recebe o foco; o status lê a frase do spec', () => {
    for (const c of [thumb, title]) {
      const { root, view, unmount } = mount({ troca: c.id })
      const ring = root.querySelectorAll<HTMLElement>('[data-arrival]')
      expect(ring.length).toBe(1)
      // o marcador da própria troca, ou o contador do grupo que o guarda
      expect(ring[0]!.matches('.mk, .mkg')).toBe(true)
      expect(ring[0]!.closest('[data-lane]')!.getAttribute('data-lane')).toBe(c.type)
      if (ring[0]!.matches('.mk')) expect(ring[0]!.getAttribute('data-ev')).toBe(c.type + ':' + view.arrival!.markerIdx)
      expect(document.activeElement).toBe(ring[0])
      expect(root.querySelector('#hv-live')!.textContent).toBe(view.arrival!.status)
      expect(view.arrival!.status).toMatch(/^Aberta a troca: .+\. Ela está destacada no gráfico, na faixa e em Antes e depois\.$/)
      unmount()
    }
  })
  it('sem arrival: o foco fica no título e não há linha nem status de chegada', () => {
    for (const p of [{}, { troca: 'abc' }, { troca: obs.changes.find(c => c.video !== FULL)!.id }]) {
      const { root, view, unmount } = mount(p)
      expect(view.arrival).toBeNull()
      expect(document.activeElement).toBe(root.querySelector('.vhead h2'))
      expect(arrive(root)).toBeNull()
      expect(root.querySelector('[data-arrival]')).toBeNull()
      expect(root.querySelector('#hv-live')!.textContent).toBe('')
      unmount()
    }
  })
  it('a seleção é só o estado inicial: escolher outra troca tira a linha de chegada e não muda a URL', () => {
    const { root, view } = mount({ troca: thumb.id })
    const other = [...root.querySelectorAll<HTMLElement>('#hv-compare .pair')].find(b => b.dataset.k !== view.arrival!.pairK)!
    expect(other).toBeDefined()
    fireEvent.click(other)
    expect(pressed(root)).toBe(other.dataset.k)
    expect(arrive(root)).toBeNull()
    expect(nav.replace).not.toHaveBeenCalled()
  })
  it('navegação que só muda a query (rerender com outra view.arrival) ressincroniza a seleção', () => {
    const r = mount({ troca: thumb.id })
    const first = r.view.arrival!
    // o usuário escolhe outra troca à mão…
    const other = [...r.root.querySelectorAll<HTMLElement>('#hv-compare .pair')].find(b => b.dataset.k !== first.pairK)!
    fireEvent.click(other)
    // …e a URL passa a trazer outra troca: o mesmo componente (Next 16 não remonta) lê a nova
    const second = build({ troca: [...changes].reverse().find(c => c.id !== thumb.id && build({ troca: c.id }).arrival!.pairK !== first.pairK)!.id })
    expect(second.arrival!.pairK).not.toBe(first.pairK)
    r.rerender(<ToastProvider><HistoricoScreen view={second} /></ToastProvider>)
    expect(pressed(r.root)).toBe(second.arrival!.pairK)
    expect(arrive(r.root)!.textContent).toBe(second.arrival!.line)
    expect(r.root.querySelectorAll('[data-arrival]').length).toBe(1)
    expect(document.activeElement).toBe(r.root.querySelector('[data-arrival]'))
    // e sem troca na URL: volta ao par padrão, sem linha
    const none = build({})
    r.rerender(<ToastProvider><HistoricoScreen view={none} /></ToastProvider>)
    expect(pressed(r.root)).toBe(none.defaultPair)
    expect(arrive(r.root)).toBeNull()
    expect(r.root.querySelector('[data-arrival]')).toBeNull()
  })
})

describe('período, na tela', () => {
  const countRange = (w: ReturnType<typeof loadFase4>) => w
  it('onRange: 30 tira o parâmetro; tudo grava range=tudo; "Mostrar o vídeo inteiro" leva a range=tudo', () => {
    const btn = (root: HTMLElement, name: string) => within(root.querySelector<HTMLElement>('.rng-ctl')!).getByRole('button', { name })
    nav.search = 'from=mudancas&range=7'
    const a = mount({ range: '7' })
    expect(btn(a.root, '7 d: últimos 7 dias').getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(btn(a.root, '30 d: últimos 30 dias'))
    expect(nav.replace).toHaveBeenLastCalledWith('/cms/youtube/competitors/video/x?from=mudancas', { scroll: false })
    fireEvent.click(btn(a.root, 'tudo: desde a publicação'))
    expect(nav.replace).toHaveBeenLastCalledWith('/cms/youtube/competitors/video/x?from=mudancas&range=tudo', { scroll: false })
    a.unmount()
    // sem range na URL o 30 d vem marcado
    nav.search = 'from=mudancas'
    const b = mount()
    expect(btn(b.root, '30 d: últimos 30 dias').getAttribute('aria-pressed')).toBe('true')
    b.unmount()
    // período sem nenhuma troca, em lista: "Mostrar o vídeo inteiro" leva a range=tudo
    const w = countRange(loadFase4()), t = w.ds.now
    setThumbs(w.ds, VID.closed, [['A'], ...Array.from({ length: 8 }, (_, i): [string, number] => ['ABC'[(i + 1) % 3]!, t - (40 - i) * 864e5])])
    const o = createObservatory(w.ds)
    const c = mount({ range: '7' }, o as unknown as Obs, VID.closed)
    const back = c.root.querySelector<HTMLElement>('#hv-fltclear')!
    expect(back.textContent).toBe('Mostrar o vídeo inteiro')
    fireEvent.click(back)
    expect(nav.replace).toHaveBeenLastCalledWith('/cms/youtube/competitors/video/x?from=mudancas&range=tudo', { scroll: false })
  })
})
