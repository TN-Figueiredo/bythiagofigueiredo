// @vitest-environment jsdom
// Fase A2, tarefa 2, na tela: Anterior/Próximo sem crescer o histórico do navegador, o foco no botão usado, `[` e `]`, o último vídeo
// visto do canal (gravado pelo Histórico, lido pela página do canal no Voltar). jsdom não navega: `next/link` vira um `<a>` que
// registra `replace`, e "trocar de vídeo" é re-renderizar a mesma tela com a vista do vizinho (o Next 16 não remonta).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import { canalWorld } from './canal-fixture'
import { link } from '@/lib/youtube/observatorio/links'
import { buildHistoricoView } from '@/app/cms/(authed)/youtube/competitors/_historico/view-model'
import { HistoricoScreen } from '@/app/cms/(authed)/youtube/competitors/_historico/historico-screen'
import { ToastProvider } from '@/app/cms/(authed)/youtube/competitors/_chrome/toasts'
import { lembrarUltimoVideo } from '@/app/cms/(authed)/youtube/competitors/_chrome/ultimo-video'
import { buildCanalVideos } from '@/app/cms/(authed)/youtube/competitors/_canal/videos-model'
import { buildCanalTrocas } from '@/app/cms/(authed)/youtube/competitors/_canal/trocas-model'
import { montarLista } from '@/app/cms/(authed)/youtube/competitors/_canal/lista'
import { LOTE } from '@/app/cms/(authed)/youtube/competitors/_canal/params'
import { mountCanal, comAntigos } from './canal-mount'

const nav = vi.hoisted(() => ({ replace: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: nav.replace, refresh: vi.fn(), push: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors/video/x',
  useSearchParams: () => new URLSearchParams(''),
}))
vi.mock('next/link', () => ({
  default: ({ href, replace, prefetch: _prefetch, onClick, children, ...rest }: { href: string; replace?: boolean; prefetch?: boolean; onClick?: (e: ReactMouseEvent<HTMLAnchorElement>) => void; children?: ReactNode } & Record<string, unknown>) => (
    <a href={href} data-replace={replace ? 'true' : 'false'} onClick={e => { e.preventDefault(); onClick?.(e) }} {...rest}>{children}</a>
  ),
}))

const { obs, chId } = canalWorld()
const todos = buildCanalVideos(obs, chId).videos
const ids = montarLista(todos, { fmt: 'longos', sort: 'recentes', dir: 'desc', q: '', n: 0 }).visiveis
const janela = (i: number) => { const a = Math.max(0, Math.min(i - 50, ids.length - 100)); return ids.slice(a, a + 100) }
const params = (i: number, from = 'canais'): Record<string, string | undefined> => {
  const href = from === 'canais'
    ? link.historico(ids[i]!, { from: 'canais', canal: chId, back: '?fmt=longos', ids: janela(i), pos: i + 1, tot: ids.length })
    : link.historico(ids[i]!, { from: from as 'mudancas', ids: janela(i) })
  return Object.fromEntries(new URL(href, 'http://x').searchParams)
}
const build = (i: number, from = 'canais') => buildHistoricoView(obs, ids[i]!, params(i, from))
const Screen = ({ i, from }: { i: number; from?: string }) => <ToastProvider><HistoricoScreen view={build(i, from)} /></ToastProvider>
const mount = (i: number, from?: string) => {
  const r = render(<Screen i={i} from={from} />)
  const root = r.container.querySelector<HTMLElement>('[data-obs-screen="historico"]')!
  return { ...r, root, to: (j: number) => r.rerender(<Screen i={j} from={from} />) }
}
const prev = (root: HTMLElement) => root.querySelector<HTMLAnchorElement>('[data-pager-prev]')
const next = (root: HTMLElement) => root.querySelector<HTMLAnchorElement>('[data-pager-next]')
const live = (root: HTMLElement) => root.querySelector('#hv-live')!.textContent
const KEY = 'obs:ultimo-video:' + chId

beforeEach(() => { nav.replace.mockClear(); window.sessionStorage.clear() })
afterEach(() => { cleanup(); document.getElementById('flut')?.remove(); vi.restoreAllMocks() })

describe('pager do Histórico', () => {
  it('Anterior e Próximo usam replace (o histórico do navegador não cresce)', () => {
    const { root } = mount(5)
    expect(prev(root)!.dataset.replace).toBe('true')
    expect(next(root)!.dataset.replace).toBe('true')
    // o item do canal e o "Canais" da trilha são navegação comum: o Voltar é deles
    expect([...root.querySelectorAll<HTMLAnchorElement>('nav.crumbs li a')].map(a => a.dataset.replace)).toEqual(['false', 'false'])
  })

  it('depois de trocar de vídeo o foco fica no botão usado e o status lê "Vídeo 8 de 51: <título>"', () => {
    const r = mount(5)
    expect(document.activeElement).toBe(r.root.querySelector('.vhead h2'))
    expect(live(r.root)).toBe('')
    fireEvent.click(next(r.root)!)
    r.to(6)
    expect(document.activeElement).toBe(next(r.root))
    expect(live(r.root)).toBe(`Vídeo 7 de ${ids.length}: ${obs.video(ids[6]!)!.title}`)
    expect(r.root.querySelector('[data-pager-pos]')!.textContent).toMatch(new RegExp(`^vídeo 7 de ${ids.length} de `))
    fireEvent.click(prev(r.root)!)
    r.to(5)
    expect(document.activeElement).toBe(prev(r.root))
    expect(live(r.root)).toBe(`Vídeo 6 de ${ids.length}: ${obs.video(ids[5]!)!.title}`)
    // o foco no título (a regra da Tarefa 1) volta quando a troca de vídeo NÃO veio do pager
    r.to(9)
    expect(document.activeElement).toBe(r.root.querySelector('.vhead h2'))
  })

  it('no último vídeo o botão usado some: o foco vai para o outro botão do pager', () => {
    const r = mount(ids.length - 2)
    fireEvent.click(next(r.root)!)
    r.to(ids.length - 1)
    expect(next(r.root)).toBeNull()
    expect(document.activeElement).toBe(prev(r.root))
  })

  it('um clique que não chegou (a vista não mudou para o vídeo do botão) não rouba o foco depois', () => {
    const r = mount(5)
    fireEvent.click(next(r.root)!)
    r.to(9)   // chegou outro vídeo (Voltar do navegador, link do cartão…), não o que o botão prometia
    expect(document.activeElement).toBe(r.root.querySelector('.vhead h2'))
  })

  it('"[" e "]" andam só com o foco no título ou dentro do pager; em campo de texto e fora dali não fazem nada', () => {
    const r = mount(5)
    const key = (k: string, o: KeyboardEventInit = {}) => fireEvent.keyDown(document.activeElement ?? document.body, { key: k, ...o })
    const h2 = r.root.querySelector<HTMLElement>('.vhead h2')!
    // com o foco no título
    h2.focus(); key(']')
    expect(nav.replace).toHaveBeenLastCalledWith(next(r.root)!.getAttribute('href'))
    key('[')
    expect(nav.replace).toHaveBeenLastCalledWith(prev(r.root)!.getAttribute('href'))
    expect(nav.replace).toHaveBeenCalledTimes(2)
    // dentro do pager
    nav.replace.mockClear()
    next(r.root)!.focus(); key('[')
    expect(nav.replace).toHaveBeenCalledTimes(1)
    // o foco vai para o botão do lado que a tecla usou, quando o vídeo chega
    r.to(4)
    expect(document.activeElement).toBe(prev(r.root))
    // fora dali, em campo de texto e com modificador: nada
    nav.replace.mockClear()
    const campo = document.createElement('input'); document.body.appendChild(campo); campo.focus(); key(']')
    const area = document.createElement('textarea'); document.body.appendChild(area); area.focus(); key(']')
    const edit = document.createElement('div'); edit.contentEditable = 'true'; edit.tabIndex = 0; document.body.appendChild(edit); edit.focus(); key(']')
    r.root.querySelector<HTMLElement>('a.btn[target="_blank"]')!.focus(); key(']')
    ;(document.activeElement as HTMLElement).blur(); key(']')
    h2.focus(); key(']', { ctrlKey: true }); key(']', { metaKey: true }); key(']', { altKey: true })
    expect(nav.replace).not.toHaveBeenCalled()
    for (const el of [campo, area, edit]) el.remove()
  })

  it('"[" no primeiro vídeo e "]" no último não fazem nada', () => {
    const a = mount(0)
    a.root.querySelector<HTMLElement>('.vhead h2')!.focus()
    fireEvent.keyDown(document.activeElement!, { key: '[' })
    expect(nav.replace).not.toHaveBeenCalled()
    a.unmount()
    const b = mount(ids.length - 1)
    b.root.querySelector<HTMLElement>('.vhead h2')!.focus()
    fireEvent.keyDown(document.activeElement!, { key: ']' })
    expect(nav.replace).not.toHaveBeenCalled()
  })

  it('Anterior ausente no primeiro e Próximo no último', () => {
    const a = mount(0)
    expect(prev(a.root)).toBeNull()
    expect(next(a.root)).not.toBeNull()
    a.unmount()
    const b = mount(ids.length - 1)
    expect(next(b.root)).toBeNull()
    expect(prev(b.root)).not.toBeNull()
    // e a frase de posição diz o fim da lista
    expect(b.root.querySelector('[data-pager-pos]')!.textContent).toMatch(new RegExp(`^vídeo ${ids.length} de ${ids.length} `))
  })

  it('lista de origem vazia: sem pager na tela', () => {
    const v = buildHistoricoView(obs, ids[3]!, { ...params(3), ids: undefined })
    const r = render(<ToastProvider><HistoricoScreen view={v} /></ToastProvider>)
    expect(r.container.querySelector('[data-pager]')).toBeNull()
    expect(r.container.querySelector('nav.crumbs')).not.toBeNull()
  })
})

describe('último vídeo visto do canal', () => {
  it('o Histórico grava o último vídeo visto do canal; armazenamento que lança não quebra a tela', () => {
    const r = mount(5)
    expect(window.sessionStorage.getItem(KEY)).toBe(ids[5])
    fireEvent.click(next(r.root)!)
    r.to(6)
    expect(window.sessionStorage.getItem(KEY)).toBe(ids[6])
    r.unmount()
    // vindo de outra origem, o canal não tem o que lembrar
    window.sessionStorage.clear()
    mount(5, 'mudancas').unmount()
    expect(window.sessionStorage.getItem(KEY)).toBeNull()
    // armazenamento bloqueado
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('bloqueado') })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqueado') })
    expect(() => mount(5).unmount()).not.toThrow()
    expect(() => lembrarUltimoVideo(chId, 'x')).not.toThrow()
  })
})

describe('a página do canal, no Voltar', () => {
  // o mundo da página: 120 acompanhados e 82 antigos (o canal do mockup em outra escala)
  const w = canalWorld(comAntigos(82))
  const antigos = buildCanalVideos(w.obs, w.chId).videos.filter(v => v.grupo === 'antigo').sort((a, b) => (b.pub ?? 0) - (a.pub ?? 0))
  const alvo = antigos[50]!
  const nEsperado = Math.ceil((50 + 1) / LOTE) * LOTE
  const urlNow = () => new URL(window.location.href).searchParams
  const popstate = () => window.dispatchEvent(new PopStateEvent('popstate'))
  beforeEach(() => { window.history.replaceState(null, '', '/cms/youtube/competitors/canal/' + w.chId) })

  it('sem registro volta como hoje: nenhum cartão com foco e n intacto', () => {
    popstate()
    mountCanal({ mut: comAntigos(82) })
    expect(document.activeElement).toBe(document.body)
    expect(urlNow().has('n')).toBe(false)
  })

  it('põe o foco no cartão do último vídeo visto e cresce n até incluí-lo', () => {
    expect(nEsperado).toBe(80)
    lembrarUltimoVideo(w.chId, alvo.id)
    popstate()
    mountCanal({ mut: comAntigos(82) })
    expect(urlNow().get('n')).toBe(String(nEsperado))
    expect(document.activeElement?.id).toBe('cv-lnk-' + alvo.id)
    // visto uma vez: o registro é consumido, o próximo Voltar não repete
    expect(window.sessionStorage.getItem(KEY)).toBeNull()
  })

  it('vídeo já na tela: o foco vai para o cartão e n fica como está', () => {
    const acomp = buildCanalVideos(w.obs, w.chId).videos.find(v => v.grupo === 'acompanhado')!
    lembrarUltimoVideo(w.chId, acomp.id)
    popstate()
    mountCanal({ mut: comAntigos(82) })
    expect(document.activeElement?.id).toBe('cv-lnk-' + acomp.id)
    expect(urlNow().has('n')).toBe(false)
  })

  it('na aba Trocas o foco vai para o botão "Abrir histórico do vídeo" do cartão do último vídeo visto', () => {
    const cartao = buildCanalTrocas(w.obs, w.chId).cards[1]!
    lembrarUltimoVideo(w.chId, cartao.videoId)
    popstate()
    mountCanal({ mut: comAntigos(82), sp: { tab: 'trocas' } })
    const em = document.activeElement as HTMLElement
    expect(em.matches('a.ct-go')).toBe(true)
    expect(em.closest<HTMLElement>('li.ct-card')!.dataset.id).toBe(cartao.videoId)
  })

  it('registro de um vídeo que a lista não mostra (outro filtro, outro canal): sem foco, sem erro', () => {
    lembrarUltimoVideo(w.chId, 'nao-existe')
    popstate()
    expect(() => mountCanal({ mut: comAntigos(82) })).not.toThrow()
    expect(document.activeElement).toBe(document.body)
    expect(urlNow().has('n')).toBe(false)
  })

  it('uma visita nova (sem Voltar) não move o foco, mesmo com registro guardado', () => {
    lembrarUltimoVideo(w.chId, alvo.id)
    // o último popstate dos testes acima ficou longe
    const t = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(t + 120_000)
    mountCanal({ mut: comAntigos(82) })
    expect(document.activeElement).toBe(document.body)
    expect(urlNow().has('n')).toBe(false)
  })
})
