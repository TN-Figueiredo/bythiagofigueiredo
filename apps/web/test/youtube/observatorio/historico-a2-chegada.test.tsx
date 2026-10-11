// @vitest-environment jsdom
// Fase A2, tarefa 1, na tela: chegada pela troca (spec 6.2) e período (spec 6.4).
// jsdom não tem layout: o gráfico tem 1100 px (o padrão do componente) e o ponteiro é fino (alvos de 32 px).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, within, cleanup } from '@testing-library/react'
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import { canalWorld } from './canal-fixture'
import { loadFase4, setThumbs, setTitles, VID } from './fase4-world'
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
vi.mock('next/link', () => ({
  default: ({ href, replace, prefetch: _prefetch, onClick, children, ...rest }: { href: string; replace?: boolean; prefetch?: boolean; onClick?: (e: ReactMouseEvent<HTMLAnchorElement>) => void; children?: ReactNode } & Record<string, unknown>) => (
    <a href={href} data-replace={replace ? 'true' : 'false'} onClick={e => { e.preventDefault(); onClick?.(e) }} {...rest}>{children}</a>
  ),
}))
beforeEach(() => { nav.replace.mockClear(); nav.search = 'from=canais' })
afterEach(() => { cleanup(); document.getElementById('flut')?.remove() })

const { obs } = canalWorld()
const FULL = 'matt-opus55'
const changes = obs.changes.filter(c => c.video === FULL)
const thumb = changes.find(c => c.type === 'thumb' && !c.window)!
const title = changes.find(c => c.type === 'title')!
const HIDDEN = 'luke-hidden-village', STREET = 'luke-food-street'
const old52 = obs.changes.find(c => c.video === HIDDEN)!

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
  it('a precisão do <quando> segue a troca: minuto exato na thumbnail, janela de 6 h no título e na descrição (a forma, não o dado do modelo)', () => {
    const desc = changes.find(c => c.type === 'desc')!
    const forma: Array<[typeof thumb, RegExp]> = [
      [thumb, /^Aberta pela aba Trocas do canal: Thumbnail \w+ → \w+, \d\d\/\d\d \d\d:\d\d\.$/],
      [title, /^Aberta pela aba Trocas do canal: Título T\d+ → T\d+, entre \d\d\/\d\d \d\dh e \d\dh\.$/],
      [desc, /^Aberta pela aba Trocas do canal: Descrição D\d+ → D\d+, entre \d\d\/\d\d \d\dh e \d\dh\.$/],
    ]
    for (const [c, re] of forma) {
      const { root, unmount } = mount({ troca: c.id })
      expect(arrive(root)!.textContent).toMatch(re)
      unmount()
    }
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

describe('um só dono do foco', () => {
  const view = (p: Record<string, string | undefined>, id = HIDDEN, o: Obs = obs) => buildHistoricoView(o, id, p)
  const Scr = ({ v }: { v: ReturnType<typeof view> }) => <ToastProvider><HistoricoScreen view={v} /></ToastProvider>
  it('rerender com o MESMO vídeo e a MESMA chegada (troca de período, router.refresh) não move o foco', () => {
    const first = view({ troca: old52.id })
    const r = render(<Scr v={first} />)
    const root = r.container.querySelector<HTMLElement>('[data-obs-screen="historico"]')!
    expect(document.activeElement).toBe(root.querySelector('[data-arrival]'))
    const all = root.querySelector<HTMLElement>('button[data-range="tudo"]')!
    all.focus()
    // outro período (a URL ganhou range=tudo): a chegada continua a mesma
    r.rerender(<Scr v={view({ troca: old52.id, range: 'tudo' })} />)
    expect(document.activeElement).toBe(root.querySelector('button[data-range="tudo"]'))
    // router.refresh(): a mesma vista, reconstruída
    const pair = root.querySelector<HTMLElement>('#hv-compare .pair')!
    pair.focus()
    r.rerender(<Scr v={view({ troca: old52.id, range: 'tudo' })} />)
    expect(document.activeElement).toBe(root.querySelector('#hv-compare .pair'))
    expect(root.querySelector('#hv-live')!.textContent).toBe(first.arrival!.status)
  })
  it('a chegada que some por um período explícito menor (clicar 30 d) não leva o foco ao título', () => {
    const r = render(<Scr v={view({ troca: old52.id })} />)
    const root = r.container.querySelector<HTMLElement>('[data-obs-screen="historico"]')!
    root.querySelector<HTMLElement>('button[data-range="30"]')!.focus()
    r.rerender(<Scr v={view({ troca: old52.id, range: '30' })} />)
    expect(view({ troca: old52.id, range: '30' }).arrival).toBeNull()
    expect(document.activeElement).toBe(root.querySelector('button[data-range="30"]'))
    expect(root.querySelector('[data-arrival]')).toBeNull()
  })
  it('sem chegada, um rerender com o mesmo vídeo (período, refresh) não leva o foco ao título', () => {
    const r = render(<Scr v={view({ range: '7' })} />)
    const root = r.container.querySelector<HTMLElement>('[data-obs-screen="historico"]')!
    expect(document.activeElement).toBe(root.querySelector('.vhead h2'))
    root.querySelector<HTMLElement>('button[data-range="90"]')!.focus()
    r.rerender(<Scr v={view({ range: '90' })} />)
    expect(document.activeElement).toBe(root.querySelector('button[data-range="90"]'))
    r.rerender(<Scr v={view({ range: '90' })} />)
    expect(document.activeElement).toBe(root.querySelector('button[data-range="90"]'))
  })
  it('Anterior/Próximo para um vídeo que também tem chegada: o foco é o do botão do pager, não o do marcador', () => {
    const ids = [FULL, HIDDEN, STREET].join(',')
    const from = view({ from: 'mudancas', ids }, FULL)
    const r = render(<Scr v={from} />)
    const root = r.container.querySelector<HTMLElement>('[data-obs-screen="historico"]')!
    fireEvent.click(root.querySelector('[data-pager-next]')!)
    const to = view({ from: 'mudancas', ids, troca: old52.id }, HIDDEN)
    expect(to.arrival).not.toBeNull()
    r.rerender(<Scr v={to} />)
    expect(document.activeElement).toBe(root.querySelector('[data-pager-next]'))
    expect(root.querySelector('#hv-live')!.textContent).toBe(to.pager!.status)
    // a chegada continua desenhada (anel e linha), só o foco não é dela
    expect(root.querySelector('[data-arrival]')).not.toBeNull()
    expect(arrive(root)).not.toBeNull()
  })
  it('F2: chegada pela troca de um marcador que virou contador de grupo: o foco vai ao contador que a contém e o status continua verdadeiro', () => {
    // duas trocas de título no mesmo dia: os marcadores ficam colados e viram um contador
    const w = canalWorld(ds => setTitles(ds, STREET, [ds.now - 6 * 864e5, ds.now - 6 * 864e5 + 36e5, ds.now - 6 * 864e5 + 72e5]))
    const cs = w.obs.changes.filter(c => c.video === STREET && c.type === 'title')
    expect(cs.length).toBeGreaterThanOrEqual(3)
    const v = view({ troca: cs[1]!.id }, STREET, w.obs)
    expect(v.arrival?.changeId).toBe(cs[1]!.id)
    const r = render(<Scr v={v} />)
    const root = r.container.querySelector<HTMLElement>('[data-obs-screen="historico"]')!
    const ring = root.querySelectorAll<HTMLElement>('[data-arrival]')
    expect(ring.length).toBe(1)
    expect(ring[0]!.matches('.mkg')).toBe(true)
    expect(ring[0]!.getAttribute('data-pairs')!.split(' ')).toContain(cs[1]!.id)
    expect(document.activeElement).toBe(ring[0])
    expect(pressed(root)).toBe(v.arrival!.pairK)
    expect(root.querySelector('#hv-live')!.textContent).toBe(v.arrival!.status)
  })
  it('F2: o status de chegada só existe com a troca selecionada e marcada (troca fora do período: nada é dito)', () => {
    nav.search = 'from=mudancas&troca=x&range=7'
    const { root, view: vw } = mount({ troca: old52.id, range: '7' }, obs, HIDDEN)
    expect(vw.arrival).toBeNull()
    expect(root.querySelector('#hv-live')!.textContent).toBe('')
    expect(root.textContent).not.toContain('Ela está destacada')
  })
})

describe('período, na tela', () => {
  const btn = (root: HTMLElement, name: string) => within(root.querySelector<HTMLElement>('.rng-ctl')!).getByRole('button', { name })
  const B30 = '30 d: últimos 30 dias', B7 = '7 d: últimos 7 dias', BALL = 'tudo: desde a publicação'
  it('sem chegada: 30 d tira o parâmetro e tudo grava range=tudo', () => {
    nav.search = 'from=mudancas&range=7'
    const a = mount({ range: '7' })
    expect(btn(a.root, B7).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(btn(a.root, B30))
    expect(nav.replace).toHaveBeenLastCalledWith('/cms/youtube/competitors/video/x?from=mudancas', { scroll: false })
    fireEvent.click(btn(a.root, BALL))
    expect(nav.replace).toHaveBeenLastCalledWith('/cms/youtube/competitors/video/x?from=mudancas&range=tudo', { scroll: false })
    a.unmount()
    // sem range na URL o 30 d vem marcado
    nav.search = 'from=mudancas'
    const b = mount()
    expect(btn(b.root, B30).getAttribute('aria-pressed')).toBe('true')
  })
  it('período sem nenhuma troca, em lista: "Mostrar o vídeo inteiro" leva a range=tudo', () => {
    nav.search = 'from=mudancas'
    const w = loadFase4(), t = w.ds.now
    setThumbs(w.ds, VID.closed, [['A'], ...Array.from({ length: 8 }, (_, i): [string, number] => ['ABC'[(i + 1) % 3]!, t - (40 - i) * 864e5])])
    const o = createObservatory(w.ds)
    const c = mount({ range: '7' }, o as unknown as Obs, VID.closed)
    const back = c.root.querySelector<HTMLElement>('#hv-fltclear')!
    expect(back.textContent).toBe('Mostrar o vídeo inteiro')
    fireEvent.click(back)
    expect(nav.replace).toHaveBeenLastCalledWith('/cms/youtube/competitors/video/x?from=mudancas&range=tudo', { scroll: false })
  })
  it('F1: com chegada, 30 d grava range=30 EXPLÍCITO (o período foi alargado pela troca; sem o parâmetro o botão não faria nada)', () => {
    nav.search = 'from=mudancas&troca=' + encodeURIComponent(old52.id)
    const a = mount({ troca: old52.id }, obs, HIDDEN)
    expect(a.view.arrival).not.toBeNull()
    expect(a.view.range!.value).toBe('90')
    fireEvent.click(btn(a.root, B30))
    const url = nav.replace.mock.calls.at(-1)![0] as string
    expect(new URLSearchParams(url.split('?')[1]).get('range')).toBe('30')
    // chegada com troca recente: o período já é 30, e o 30 d continua gravando range=30 (a seleção explícita não some)
    const recent = obs.changes.find(c => c.video === STREET)!
    nav.search = 'from=mudancas&troca=' + encodeURIComponent(recent.id)
    const b = mount({ troca: recent.id }, obs, STREET)
    fireEvent.click(btn(b.root, B30))
    expect(new URLSearchParams((nav.replace.mock.calls.at(-1)![0] as string).split('?')[1]).get('range')).toBe('30')
    // 90 d e tudo gravam o que são
    fireEvent.click(btn(b.root, BALL))
    expect(new URLSearchParams((nav.replace.mock.calls.at(-1)![0] as string).split('?')[1]).get('range')).toBe('tudo')
  })
  it('F1/A: com a URL já em range=30 e a troca antiga (fora do período), a tela é a normal: sem chegada, par padrão, 30 d marcado', () => {
    nav.search = 'from=mudancas&troca=' + encodeURIComponent(old52.id) + '&range=30'
    const a = mount({ troca: old52.id, range: '30' }, obs, HIDDEN)
    expect(a.view.arrival).toBeNull()
    expect(btn(a.root, B30).getAttribute('aria-pressed')).toBe('true')
    expect(arrive(a.root)).toBeNull()
    expect(a.root.querySelector('[data-arrival]')).toBeNull()
    expect(a.root.querySelector('#hv-live')!.textContent).toBe('')
    expect(document.activeElement).toBe(a.root.querySelector('.vhead h2'))
    expect(pressed(a.root) ?? null).toBe(a.view.defaultPair)
  })
  it('F: o período que abriu alargado pela troca diz por quê, perto do seletor; sem alargar, nada', () => {
    const a = mount({ troca: old52.id }, obs, HIDDEN)
    const why = a.root.querySelector<HTMLElement>('[data-rng-why]')!
    expect(why.textContent).toBe('Período ampliado para 90 dias para incluir a troca aberta.')
    expect(a.root.querySelector('.timeline')!.contains(why)).toBe(true)
    a.unmount()
    // com range explícito (mesmo igual ao alargado) o texto não aparece: a pessoa escolheu
    expect(mount({ troca: old52.id, range: '90' }, obs, HIDDEN).root.querySelector('[data-rng-why]')).toBeNull()
  })
})
