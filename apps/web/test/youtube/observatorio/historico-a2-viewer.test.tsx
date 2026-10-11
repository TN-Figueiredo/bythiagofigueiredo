// @vitest-environment jsdom
// Fase A2, tarefa 6, no Histórico: os quatro gatilhos do visualizador de thumbnail (spec 6.3), a legenda do gráfico e o foco quando o gatilho some.
// jsdom não tem layout: o gráfico tem 1100 px (o padrão do componente) e o ponteiro é fino. A rede de imagens não existe: o diálogo abre e mostra o que a tela já tinha.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, cleanup, screen, within, act } from '@testing-library/react'
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import { canalWorld } from './canal-fixture'
import type { Dataset } from '@/lib/youtube/observatorio/types'
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
afterEach(() => { cleanup(); document.getElementById('flut')?.remove(); document.querySelectorAll('.obs-tv-host').forEach(e => e.remove()); vi.restoreAllMocks() })

// matt-opus55 tem quatro períodos de thumbnail: A, B, A (voltou), C (no ar). O oráculo não traz as imagens arquivadas: aqui todas têm cópia, menos a B.
const FULL = 'matt-opus55'
const BLOB = (i: number) => `https://x.public.blob.vercel-storage.com/t/${i}.jpg`
const comImagens = (ds: Dataset) => {
  const v = ds.videos.find(x => x.id === FULL)!
  v.thumbs.forEach((t, i) => { t.blobUrl = i === 1 ? null : BLOB(i) })
}
const { obs } = canalWorld(comImagens)
const thumbChange = obs.changes.find(c => c.video === FULL && c.type === 'thumb' && !c.window)!
type Obs = typeof obs
const build = (p: Record<string, string | undefined> = {}, o: Obs = obs, id = FULL) => buildHistoricoView(o, id, p)
function mount(p: Record<string, string | undefined> = {}, o: Obs = obs, id = FULL) {
  const view = build(p, o, id)
  const r = render(<ToastProvider><HistoricoScreen view={view} /></ToastProvider>)
  const root = () => r.container.querySelector<HTMLElement>('[data-obs-screen="historico"]')!
  const again = (p2: Record<string, string | undefined>) => r.rerender(<ToastProvider><HistoricoScreen view={build(p2, o, id)} /></ToastProvider>)
  return { ...r, view, root: root(), again }
}
const dialog = () => screen.getByRole('dialog')
const posicao = () => dialog().querySelector('.obs-tv-pos')?.textContent ?? null
const fechar = () => { fireEvent.keyDown(document.body, { key: 'Escape' }) }
const gatilho = (el: Element | null) => el as HTMLElement

describe('o modelo entrega o visualizador', () => {
  it('HistoricoView.viewer traz uma versão por período de thumbnail, a atual é a última, com o id do YouTube só nela', () => {
    const v = build().viewer!
    expect(v.versions.map(x => x.label)).toEqual(['Capa A', 'Capa B', 'Capa A', 'Capa C'])
    expect(v.start).toBe(3)
    expect(v.versions.map(x => x.current)).toEqual([false, false, false, true])
    expect(v.versions.map(x => x.youtubeId != null)).toEqual([false, false, false, true])
    expect(v.versions.map(x => x.archived)).toEqual([BLOB(0), null, BLOB(2), BLOB(3)])
    expect(v.versions.map(x => x.preview)).toEqual([BLOB(0), null, BLOB(2), BLOB(3)])
    expect(v.title).toBe(build().video!.title)
    // a legenda é a do cartão da versão (período e tempo no ar), sem recalcular
    const cards = build().versions!.thumbs.cards
    v.versions.forEach((x, i) => {
      expect(x.caption).toContain(cards[i]!.span)
      expect(x.caption).toContain('no ar por ' + cards[i]!.dur)
    })
    expect(v.versions[3]!.caption.startsWith('Capa C (')).toBe(true)
  })
  it('vídeo sem nenhuma versão de thumbnail: viewer nulo', () => {
    const { obs: o } = canalWorld(ds => { ds.videos.find(x => x.id === FULL)!.thumbs = [] })
    expect(build({}, o).viewer).toBeNull()
  })
})

describe('gatilho 1: a thumbnail do cabeçalho', () => {
  it('abre o visualizador na versão atual, com o título do vídeo', () => {
    const { root, view } = mount()
    const g = gatilho(root.querySelector('.vhead .cur [role="button"]'))
    expect(g).not.toBeNull()
    expect(g.getAttribute('aria-label')).toMatch(/^Ampliar a thumbnail/)
    fireEvent.click(g)
    expect(dialog().querySelector('h2')!.textContent).toBe('Thumbnail: ' + view.video!.title)
    expect(posicao()).toBe('Capa C · 4 de 4')
  })
  it('Enter e espaço abrem, como num botão', () => {
    const { root } = mount()
    const g = gatilho(root.querySelector('.vhead .cur [role="button"]'))
    fireEvent.keyDown(g, { key: 'Enter' })
    expect(screen.queryByRole('dialog')).not.toBeNull()
    fechar()
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.keyDown(g, { key: ' ' })
    expect(screen.queryByRole('dialog')).not.toBeNull()
  })
  it('Esc fecha e o foco volta ao gatilho', () => {
    const { root } = mount()
    const g = gatilho(root.querySelector('.vhead .cur [role="button"]'))
    g.focus()
    fireEvent.click(g)
    expect(document.activeElement).toBe(dialog().querySelector('h2'))
    fechar()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(g)
  })
})

describe('gatilho 2: as thumbnails de "Antes e depois"', () => {
  it('cada lado abre na versão dele', () => {
    const { root, view } = mount({ troca: thumbChange.id })
    const par = view.comparisons.find(c => c.changeId === view.defaultPair)!
    const lados = par.ba!.filter(s => s.thumb)
    expect(lados.length).toBeGreaterThan(1)
    const botoes = [...root.querySelectorAll<HTMLElement>('#hv-compare .ba .side [role="button"]')]
    expect(botoes).toHaveLength(par.ba!.filter(s => s.at != null).length)
    expect(botoes.length).toBeGreaterThan(1)
    const versoes = view.viewer!.versions
    par.ba!.filter(s => s.at != null).forEach((s, k) => {
      fireEvent.click(botoes[k]!)
      expect(posicao(), 'lado ' + k).toBe(`${versoes[s.at!]!.label} · ${s.at! + 1} de 4`)
      fechar()
    })
  })
})

describe('gatilho 3: os cartões de "Thumbnails"', () => {
  const cartoes = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>('.film .fcard')]
  it('cada thumbnail tem a lupa e role="button" com nome acessível, e abre na versão do cartão', () => {
    const { root } = mount()
    const cs = cartoes(root)
    expect(cs).toHaveLength(4)
    cs.forEach((c, i) => {
      const g = gatilho(c.querySelector('[role="button"]'))
      expect(g, 'cartão ' + i).not.toBeNull()
      expect(g.getAttribute('aria-label')).toMatch(/^Ampliar a thumbnail: Capa [ABC]/)
      expect(g.getAttribute('tabindex')).toBe('0')
      expect(g.querySelector('.th-lupa svg')).not.toBeNull()
      expect(g.querySelector('.th-lupa')!.getAttribute('aria-hidden')).toBe('true')
      fireEvent.click(g)
      expect(posicao()).toBe(`${build().viewer!.versions[i]!.label} · ${i + 1} de 4`)
      fechar()
    })
  })
  it('thumbnail sem imagem não vira botão quebrado: abre o visualizador no quadro explicativo', () => {
    const { root } = mount()
    const sem = cartoes(root)[1]!
    expect(sem.querySelector('img')).toBeNull()
    expect(sem.querySelector('.th.missing')).not.toBeNull()
    const g = gatilho(sem.querySelector('[role="button"]'))
    expect(g).not.toBeNull()
    fireEvent.click(g)
    const quadro = dialog().querySelector('.obs-tv-miss')!
    expect(quadro.textContent).toMatch(/^A coleta só guarda a thumbnail a partir do momento em que a vê\./)
    expect(dialog().querySelector('img')).toBeNull()
  })
})

describe('gatilho 4: o clique duplo na miniatura da raia', () => {
  const clip = (root: HTMLElement, i: number) => root.querySelector<HTMLElement>(`.lane[data-lane="thumb"] [data-k="thumb:${i}"]`)
  it('o duplo clique abre o visualizador na versão da miniatura', () => {
    const { root } = mount()
    const c = clip(root, 3)
    expect(c, 'a raia desenha o período').not.toBeNull()
    fireEvent.doubleClick(c!)
    expect(posicao()).toBe('Capa C · 4 de 4')
  })
  it('cada miniatura abre na versão dela', () => {
    const { root } = mount()
    for (const i of [0, 2]) {
      const c = clip(root, i)
      if (!c) continue
      fireEvent.doubleClick(c)
      expect(posicao()).toBe(`${build().viewer!.versions[i]!.label} · ${i + 1} de 4`)
      fechar()
    }
  })
  it('as raias de título e de descrição não abrem o visualizador no clique duplo', () => {
    const { root } = mount()
    const t = root.querySelector<HTMLElement>('.lane[data-lane="title"] [data-k^="title:"]')!
    fireEvent.doubleClick(t)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

// Conserto 1, I1: o clique simples de PONTEIRO só rola ao cartão depois da janela do duplo clique (o alvo é marcado na hora); o segundo clique cancela a rolagem.
// Teclado (`detail === 0`) não espera. Em jsdom `fireEvent.click` sem `detail` é teclado; o ponteiro leva `detail: 1` e `detail: 2`, como o navegador.
describe('I1: o clique simples da raia espera a janela do duplo clique', () => {
  const clip = (root: HTMLElement, i: number) => root.querySelector<HTMLElement>(`.lane[data-lane="thumb"] [data-k="thumb:${i}"]`)!
  const rolagens = vi.fn()
  beforeEach(() => {
    vi.useFakeTimers()
    rolagens.mockReset()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, writable: true, value: rolagens })
  })
  afterEach(() => { vi.useRealTimers(); delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView })
  const aoCartao = (root: HTMLElement, i: number) => root.querySelector<HTMLElement>(`[data-ver="thumb:${i}"]`)!

  it('um clique de ponteiro: o alvo é marcado na hora e a rolagem com o foco vêm depois de 250 ms, uma vez só', () => {
    const { root } = mount()
    const c = clip(root, 3)
    fireEvent.click(c, { detail: 1 })
    expect(rolagens).not.toHaveBeenCalled()
    expect(document.activeElement).not.toBe(aoCartao(root, 3))
    expect(aoCartao(root, 3).classList.contains('target'), 'o alvo está marcado').toBe(true)
    act(() => { vi.advanceTimersByTime(249) })
    expect(rolagens).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(1) })
    expect(rolagens).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(aoCartao(root, 3))
    act(() => { vi.advanceTimersByTime(2000) })
    expect(rolagens).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('dois cliques dentro da janela: o visualizador abre na versão da miniatura e a rolagem nunca acontece', () => {
    const { root } = mount()
    const c = clip(root, 2)
    fireEvent.click(c, { detail: 1 })
    act(() => { vi.advanceTimersByTime(120) })
    fireEvent.click(c, { detail: 2 })
    fireEvent.doubleClick(c)
    expect(posicao()).toBe('Capa A · 3 de 4')
    act(() => { vi.advanceTimersByTime(5000) })
    expect(rolagens).not.toHaveBeenCalled()
    expect(document.activeElement).not.toBe(aoCartao(root, 2))
  })
  it('o segundo clique sozinho (sem o dblclick chegar) também cancela a rolagem', () => {
    const { root } = mount()
    const c = clip(root, 1)
    fireEvent.click(c, { detail: 1 })
    fireEvent.click(c, { detail: 2 })
    act(() => { vi.advanceTimersByTime(5000) })
    expect(rolagens).not.toHaveBeenCalled()
  })
  it('Enter na miniatura (teclado, detail 0) vai ao cartão na hora, sem espera', () => {
    const { root } = mount()
    fireEvent.click(clip(root, 3), { detail: 0 })
    expect(rolagens).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(aoCartao(root, 3))
  })
  it('as raias de título e de descrição não esperam: o clique de ponteiro rola na hora', () => {
    const { root } = mount()
    const t = root.querySelector<HTMLElement>('.lane[data-lane="title"] [data-k^="title:"]')!
    fireEvent.click(t, { detail: 1 })
    expect(rolagens).toHaveBeenCalledTimes(1)
  })
  it('com prefers-reduced-motion vale o mesmo (a espera é de qualquer clique de ponteiro)', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((q: string) => ({ matches: /reduce/.test(q), media: q, onchange: null, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false }) as MediaQueryList)
    const { root } = mount()
    const c = clip(root, 3)
    fireEvent.click(c, { detail: 1 })
    expect(rolagens).not.toHaveBeenCalled()
    fireEvent.click(c, { detail: 2 }); fireEvent.doubleClick(c)
    act(() => { vi.advanceTimersByTime(1000) })
    expect(rolagens).not.toHaveBeenCalled()
    expect(posicao()).toBe('Capa C · 4 de 4')
  })
  it('ao fechar, o foco volta à miniatura da raia', () => {
    const { root } = mount()
    const c = clip(root, 3)
    c.focus()
    fireEvent.click(c, { detail: 1 }); fireEvent.click(c, { detail: 2 }); fireEvent.doubleClick(c)
    expect(screen.queryByRole('dialog')).not.toBeNull()
    fechar()
    expect(document.activeElement).toBe(c)
    expect(rolagens).not.toHaveBeenCalled()
  })
  it('trocar de vídeo (a tela não remonta quando só o vídeo muda) cancela a rolagem pendente do clique na raia', () => {
    // o clique pendente aponta para o cartão `thumb:1`; o outro vídeo também tem um (senão a rolagem tardia não acharia onde cair e o teste passaria à toa)
    const outro = obs.videos.find(v => v.id !== FULL && v.tracked && !obs.channel(v.ch)!.own && v.thumbs.length >= 2)!
    const { root, rerender } = mount()
    fireEvent.click(clip(root, 1), { detail: 1 })
    rerender(<ToastProvider><HistoricoScreen view={build({}, obs, outro.id)} /></ToastProvider>)
    act(() => { vi.advanceTimersByTime(2000) })
    expect(rolagens).not.toHaveBeenCalled()
  })
  it('desmontar com o clique pendente não rola nem estoura', () => {
    const { root, unmount } = mount()
    fireEvent.click(clip(root, 3), { detail: 1 })
    unmount()
    expect(() => act(() => { vi.advanceTimersByTime(1000) })).not.toThrow()
    expect(rolagens).not.toHaveBeenCalled()
  })
})

describe('a legenda do gráfico', () => {
  it('diz que o clique duplo amplia e que o simples leva ao cartão da versão', () => {
    const { root } = mount()
    const leg = root.querySelector('[data-legend]')!.textContent!
    expect(leg).toMatch(/clique duplo numa miniatura da faixa Thumbnail a amplia/)
    expect(leg).toMatch(/o clique simples leva ao cartão da versão/)
  })
  it('sem nenhuma thumbnail a legenda não promete o clique', () => {
    const { obs: o } = canalWorld(ds => { ds.videos.find(x => x.id === FULL)!.thumbs = [] })
    const { root } = mount({}, o)
    expect(root.querySelector('[data-legend]')?.textContent ?? '').not.toMatch(/clique duplo/)
  })
})

describe('vídeo fora dos acompanhados', () => {
  const { obs: o2, ds } = canalWorld(d => {
    const v = d.videos.find(x => x.ch === 'matt-wolfe' && !x.tracked)!
    v.thumbs = v.thumbs.map(t => ({ ...t, blobUrl: BLOB(9) }))
  })
  const fora = ds.videos.find(x => x.ch === 'matt-wolfe' && !x.tracked)!
  it('os gatilhos das versões funcionam igual', () => {
    const { root, view } = mount({}, o2, fora.id)
    expect(view.untracked).not.toBeNull()
    expect(view.viewer).not.toBeNull()
    const cabecalho = gatilho(root.querySelector('.vhead .cur [role="button"]'))
    fireEvent.click(cabecalho)
    expect(dialog()).toBeTruthy()
    fechar()
    const card = gatilho(root.querySelector('.film .fcard [role="button"]'))
    fireEvent.click(card)
    expect(dialog().querySelector('h2')!.textContent).toBe('Thumbnail: ' + view.video!.title)
    expect(view.viewer!.versions).toHaveLength(1)
  })
})

describe('o gatilho some com o diálogo aberto: o foco vai para o título da tela', () => {
  it('trocou de período: o cartão da versão antiga saiu; Esc devolve o foco ao h2 do vídeo, nunca ao body', () => {
    const { root, again } = mount()
    const g = gatilho(root.querySelector('.film .fcard[data-img="A"] [role="button"]'))
    g.focus()
    fireEvent.click(g)
    again({ range: '7' })
    expect(g.isConnected).toBe(false)
    fechar()
    expect(screen.queryByRole('dialog')).toBeNull()
    const h2 = root.querySelector('.vhead h2')
    expect(document.activeElement).toBe(h2)
    expect(document.activeElement).not.toBe(document.body)
  })
})
