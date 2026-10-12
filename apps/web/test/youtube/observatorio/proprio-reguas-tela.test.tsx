// @vitest-environment jsdom
// A4 13.4: "Este vídeo no canal" na tela (jsdom): tabela de verdade, uma régua por número, teclado, fala em região viva, toque em dois tempos, a base
// sempre ao lado da frase (H17) e as duas linhas novas (views por dia e % assistido). O modelo é o real (`buildReguas`); os traços ganham lugar de 40 em 40 px.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, fireEvent, cleanup, act, within } from '@testing-library/react'
import { Reguas } from '@/app/cms/(authed)/youtube/competitors/_proprio/reguas'
import { buildReguas, type DiarioReguas, type EntradaReguas, type ReguasView } from '@/app/cms/(authed)/youtube/competitors/_proprio/reguas-model'

// o jsdom não tem PointerEvent: sem ele o fireEvent perde clientX e pointerType
if (typeof window.PointerEvent === 'undefined') {
  class PointerEventDeJsdom extends MouseEvent {
    readonly pointerType: string
    constructor(type: string, init: MouseEventInit & { pointerType?: string } = {}) { super(type, init); this.pointerType = init.pointerType ?? '' }
  }
  Object.defineProperty(window, 'PointerEvent', { value: PointerEventDeJsdom, configurable: true })
}

const nav = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: nav.push, replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }) }))

beforeEach(() => { nav.push.mockClear() })
afterEach(() => { cleanup(); document.getElementById('flut')?.remove() })

const videos = Array.from({ length: 6 }, (_, k) => ({ id: 'v' + k, ytId: 'y' + k, titulo: `Vídeo ${k}`, views: (k + 1) * 100, likes: k * 3, comments: k === 5 ? null : 1 + k, dur: 600 + 60 * k }))
const porVideo = new Map([['y0', { imp: 18, cliques: 2, diasComImpressao: 6 }], ['y1', { imp: 8, cliques: 0, diasComImpressao: 4 }], ['y2', { imp: 3, cliques: 0, diasComImpressao: 1 }], ['y3', { imp: 1, cliques: 0, diasComImpressao: 1 }]])
const diario = (o: Partial<DiarioReguas> = {}): DiarioReguas => ({
  vpd: new Map(videos.map((v, k) => [v.id, k + 1.5] as const)), pct: new Map(videos.map((v, k) => [v.id, 40 + 5 * k] as const)),
  naoPosicionaVpd: null, naoPosicionaPct: null, semVpd: 'sem 7 dias de medida', semPct: 'sem views nos 28 dias', ...o,
})
const base = (videoId: string, o: Partial<EntradaReguas> = {}): EntradaReguas => ({
  videoId, videos, porVideo, alcanceLido: true, periodoTexto: 'de 09/09 a 07/10', hrefs: { vistos: '/v', imp: '/i' }, hrefVideo: id => '/video/' + id + '?back=%3Fsort%3Dimp', diario: diario(), ...o,
})
const view = (videoId = 'v2', o: Partial<EntradaReguas> = {}): ReguasView => buildReguas(base(videoId, o))
const montar = (v: ReguasView) => render(<Reguas view={v} />)
const flut = () => document.getElementById('flut')
const tips = () => [...(flut()?.querySelectorAll('[role="tooltip"]') ?? [])] as HTMLElement[]
const linha = (c: HTMLElement, numero: string) => c.querySelector<HTMLElement>(`tr[data-numero="${numero}"]`)!
const regua = (c: HTMLElement, numero: string) => linha(c, numero).querySelector<HTMLElement>('.vb-rg')!
const viva = (c: HTMLElement) => c.querySelector('[role="status"]')!.textContent
const rect = (left: number) => ({ left, right: left + 2, top: 0, bottom: 12, width: 2, height: 12, x: left, y: 0, toJSON: () => ({}) }) as DOMRect
const dispor = (c: HTMLElement) => c.querySelectorAll<HTMLElement>('[data-i]').forEach(t => { t.getBoundingClientRect = () => rect(100 + Number(t.getAttribute('data-i')) * 40) })

describe('13.4 réguas na tela: forma', () => {
  it('é uma tabela de verdade: caption, th scope (coluna, linha e grupo), três grupos', () => {
    const { container } = montar(view())
    const t = container.querySelector('table')!
    expect(t.querySelector('caption')!.textContent).toMatch(/^Onde este vídeo fica entre os vídeos do canal, em cada número/)
    expect([...t.querySelectorAll('thead th')].every(th => th.getAttribute('scope') === 'col')).toBe(true)
    expect([...t.querySelectorAll('tbody')].map(b => b.querySelector('th[scope="rowgroup"]')!.textContent)).toEqual(['Alcance', 'Resposta', 'Formato'])
    expect([...t.querySelectorAll('tbody tr:not(.vb-rg-g) > th')].every(th => th.getAttribute('scope') === 'row')).toBe(true)
    expect([...t.querySelectorAll('tr[data-numero]')].map(r => r.getAttribute('data-numero'))).toEqual(['impressoes', 'views', 'vpd', 'engajamento', 'assistido', 'curtidas', 'comentarios', 'duracao'])
  })

  it('um traço por vídeo do canal; o deste vídeo é o grande, com a cor do terço, e a forma ▲ ● ▼ e a posição escrita acompanham a cor', () => {
    const v = view('v5')
    const { container } = montar(v)
    const traços = regua(container, 'views').querySelectorAll<HTMLElement>('.vb-rg-t')
    expect(traços).toHaveLength(6)
    const meu = [...traços].filter(t => t.hasAttribute('data-este'))
    expect(meu).toHaveLength(1)
    expect(meu[0]!.className).toContain('vb-rg-este')
    expect(meu[0]!.getAttribute('data-terco')).toBe('cima')
    const cel = linha(container, 'views').querySelector('.vb-rg-p')!
    expect(cel.querySelector('.vb-rg-mk.t-cima')!.textContent).toBe('▲')
    expect(cel.textContent).toContain('1º de 6')
  })

  it('a duração não tem cor de terço: nenhum data-terco, nenhuma forma ▲ ● ▼', () => {
    const { container } = montar(view('v5'))
    const l = linha(container, 'duracao')
    expect(l.querySelector('[data-terco]')).toBeNull()
    expect(l.querySelector('.vb-rg-mk[class*="t-"]')).toBeNull()
    expect(l.querySelector('.vb-rg-p')!.textContent).toContain('1º de 6')
  })

  it('a régua visual é aria-hidden e a célula tem o texto para leitor de tela', () => {
    const v = view('v3')
    const { container } = montar(v)
    for (const l of v.linhas.filter(x => x.tracos.length)) {
      const r = linha(container, l.numero)
      expect(r.querySelector('.vb-rg-in')!.getAttribute('aria-hidden'), l.numero).toBe('true')
      expect(r.querySelector('.vb-rg-p .obs-ch-sr')!.textContent, l.numero).toBe(l.sr)
    }
  })

  it('a explicação da escala está num ⓘ só, ao fim da legenda; nenhum "escala √" nem "√" na tela', () => {
    const { container } = montar(view())
    const botoes = container.querySelectorAll('.vb-rg-leg button')
    expect(botoes).toHaveLength(1)
    expect(container.querySelectorAll('button')).toHaveLength(1)
    expect(container.textContent).not.toMatch(/escala\s*√|√|raiz quadrada/)
    act(() => { (botoes[0] as HTMLElement).click() })
    expect(within(flut()!).getByRole('dialog').textContent).toMatch(/raiz quadrada|escala linear/i)
  })

  it('o vídeo sem o dado numa linha: a linha ocupa a largura toda com a frase do motivo, sem régua e sem posição', () => {
    const v = view('v2', { diario: diario({ vpd: new Map(videos.map(x => [x.id, x.id === 'v2' ? null : 3] as const)) }) })
    const { container } = montar(v)
    const l = linha(container, 'vpd')
    expect(l.querySelector('.vb-rg')).toBeNull()
    expect(l.querySelector('td.vb-rg-sem')!.getAttribute('colspan')).toBe('2')
    expect(l.textContent).toContain('sem 7 dias de medida')
    expect(l.querySelector('.obs-ch-nm')!.textContent).toBe('não medido')
    expect(l.textContent).not.toMatch(/\b0\b/)
  })

  it('as linhas novas: "Views por dia" e "% assistido" com a segunda linha do nome e o valor', () => {
    const { container } = montar(view('v2'))
    expect(linha(container, 'vpd').querySelector('th')!.textContent).toBe('Views por diamédia dos últimos 28 dias')
    expect(linha(container, 'assistido').querySelector('th')!.textContent).toBe('% assistidomédia pelas views, 28 dias')
    expect(linha(container, 'vpd').querySelector('.vb-rg-v')!.textContent).toBe('3,5')
    expect(linha(container, 'assistido').querySelector('.vb-rg-v')!.textContent).toBe('50%')
  })

  it('poucas views: o número fica escrito e a frase da trava ocupa o lugar da régua; "% assistido" idem', () => {
    const trava = 'Com 3 views em 28 dias não dá para posicionar este vídeo: 4 dos 5 outros também ficam abaixo de 1 view por dia.'
    const { container } = montar(view('v2', { diario: diario({ naoPosicionaVpd: trava, naoPosicionaPct: 'Com só 4 views não dá para posicionar o % assistido.' }) }))
    expect(linha(container, 'vpd').querySelector('.vb-rg')).toBeNull()
    expect(linha(container, 'vpd').textContent).toContain(trava)
    expect(linha(container, 'vpd').querySelector('.vb-rg-v')!.textContent).toBe('3,5')
    expect(linha(container, 'assistido').textContent).toContain('Com só 4 views não dá para posicionar o % assistido.')
  })
})

describe('13.4 réguas na tela: base sempre ao lado da frase (H17)', () => {
  // o 2º lugar em impressões com pouco volume: "Entre os primeiros" ganha a mesma ressalva
  const segundo = (o: Partial<EntradaReguas> = {}) => view('v1', {
    porVideo: new Map([['y0', 18], ['y1', 8], ['y2', 5], ['y3', 3], ['y4', 2], ['y5', 1]].map(([y, imp]) => [y as string, { imp: imp as number, cliques: 0, diasComImpressao: 1 }] as const)), ...o,
  })
  it('a frase, a base e o aviso de pouco volume aparecem JUNTOS, inclusive no 2º lugar com poucas impressões', () => {
    const v = segundo()
    expect(v.frase).toMatch(/Entre os primeiros em .*impressões/)
    expect(v.base).toMatch(/^Entre 6 vídeos com impressões medidas/)
    expect(v.pouco).toMatch(/^37 impressões no relatório/)
    const { container } = montar(v)
    const txt = container.querySelector('.vb-rg-tudo')!.textContent!
    expect(txt).toContain(v.frase)
    expect(txt).toContain(v.base!)
    expect(txt).toContain(v.pouco!)
    // a base vem logo depois da frase, antes da tabela
    expect(txt.indexOf(v.base!)).toBeGreaterThan(txt.indexOf(v.frase))
    expect(txt.indexOf(v.base!)).toBeLessThan(txt.indexOf('Alcance'))
  })

  it('falha se a base sumir: sem `base` no modelo a tela não a inventa, e com ela a tela a escreve', () => {
    const v = segundo()
    const sem = montar({ ...v, base: null, pouco: null })
    expect(sem.container.querySelector('.vb-rg-base-t')).toBeNull()
    expect(sem.container.querySelector('.vb-rg-pouco')).toBeNull()
    cleanup()
    const com = montar(v)
    expect(com.container.querySelector('.vb-rg-base-t')!.textContent).toBe(v.base)
    expect(com.container.querySelector('.vb-rg-pouco')!.textContent).toBe(v.pouco)
  })

  it('"N sem medida" aparece em toda linha que deixa vídeos de fora, junto da posição', () => {
    const v = view('v2')
    const { container } = montar(v)
    const imp = linha(container, 'impressoes')
    expect(v.linhas.find(l => l.numero === 'impressoes')!.semMedida).toBe('2 sem medida')
    expect(imp.querySelector('.vb-rg-sm')!.textContent).toBe('2 sem medida')
    expect(linha(container, 'comentarios').querySelector('.vb-rg-sm')!.textContent).toBe('1 sem medida')
  })
})

describe('13.4 réguas na tela: teclado, fala e toque', () => {
  it('uma parada de Tab por régua (tabindex 0 no grupo, nenhum nos traços)', () => {
    const { container } = montar(view())
    const grupos = container.querySelectorAll<HTMLElement>('.vb-rg')
    expect(grupos).toHaveLength(8)
    expect([...grupos].every(g => g.getAttribute('tabindex') === '0' && g.getAttribute('role') === 'group')).toBe(true)
    expect(container.querySelectorAll('.vb-rg-t[tabindex]')).toHaveLength(0)
  })

  it('o foco cai neste vídeo e o fala; setas, Home e End andam de vídeo em vídeo pelo valor, e cada passo é falado na região viva', () => {
    const { container } = montar(view('v2'))
    const g = regua(container, 'views')
    act(() => g.focus())
    expect(viva(container)).toBe('Vídeo 2 (este vídeo): 300')
    fireEvent.keyDown(g, { key: 'ArrowRight' })
    expect(viva(container)).toBe('Vídeo 3: 400')
    fireEvent.keyDown(g, { key: 'ArrowLeft' }); fireEvent.keyDown(g, { key: 'ArrowLeft' })
    expect(viva(container)).toBe('Vídeo 1: 200')
    fireEvent.keyDown(g, { key: 'End' })
    expect(viva(container)).toBe('Vídeo 5: 600')
    fireEvent.keyDown(g, { key: 'ArrowRight' })
    expect(viva(container)).toBe('Vídeo 5: 600')
    fireEvent.keyDown(g, { key: 'Home' })
    expect(viva(container)).toBe('Vídeo 0: 100')
    expect(container.querySelector('[role="status"]')!.getAttribute('aria-live')).toBe('polite')
  })

  it('Enter abre o vídeo do traço preservando back=; no traço deste vídeo não abre nada; Esc fecha a dica', () => {
    const { container } = montar(view('v2'))
    dispor(container)
    const g = regua(container, 'views')
    act(() => g.focus())
    expect(tips()).toHaveLength(1)
    fireEvent.keyDown(g, { key: 'Enter' })
    expect(nav.push).not.toHaveBeenCalled()
    fireEvent.keyDown(g, { key: 'ArrowRight' })
    fireEvent.keyDown(g, { key: 'Enter' })
    expect(nav.push).toHaveBeenCalledTimes(1)
    expect(nav.push).toHaveBeenCalledWith('/video/v3?back=%3Fsort%3Dimp')
    fireEvent.keyDown(g, { key: 'Escape' })
    expect(tips()).toHaveLength(0)
  })

  it('toque: o primeiro toque mostra a dica e fala, o segundo no mesmo traço abre', () => {
    const { container } = montar(view('v2'))
    dispor(container)
    const g = regua(container, 'views')
    fireEvent.pointerDown(g, { clientX: 100 + 4 * 40, clientY: 6, pointerType: 'touch' })
    expect(tips()).toHaveLength(1)
    expect(tips()[0]!.textContent).toContain('Vídeo 4')
    expect(nav.push).not.toHaveBeenCalled()
    fireEvent.pointerDown(g, { clientX: 100 + 4 * 40, clientY: 6, pointerType: 'touch' })
    expect(nav.push).toHaveBeenCalledWith('/video/v4?back=%3Fsort%3Dimp')
    // outro traço: volta a ser o primeiro toque
    nav.push.mockClear()
    fireEvent.pointerDown(g, { clientX: 100 + 1 * 40, clientY: 6, pointerType: 'touch' })
    expect(nav.push).not.toHaveBeenCalled()
    expect(tips()[0]!.textContent).toContain('Vídeo 1')
  })

  it('mouse: passar mostra a dica do traço mais perto, e clicar abre', () => {
    const { container } = montar(view('v2'))
    dispor(container)
    const g = regua(container, 'views')
    fireEvent.pointerMove(g, { clientX: 100 + 5 * 40 + 3, clientY: 6, pointerType: 'mouse' })
    expect(tips()[0]!.textContent).toContain('Vídeo 5')
    fireEvent.pointerDown(g, { clientX: 100 + 5 * 40, clientY: 6, pointerType: 'mouse' })
    expect(nav.push).toHaveBeenCalledWith('/video/v5?back=%3Fsort%3Dimp')
  })

  it('empate: o mesmo valor escrito abre 2,6 px para o lado (o primeiro fica no valor); com este vídeo no empate ele fica no valor exato e os outros abrem 4,4 px', () => {
    const dxDe = (c: HTMLElement) => [...regua(c, 'curtidas').querySelectorAll<HTMLElement>('.vb-rg-t')].map(x => ({ este: x.hasAttribute('data-este'), dx: Number(x.style.getPropertyValue('--dx').replace('px', '')) }))
    // três vídeos (v1, v3, v4) empatados em 9 no meio da régua, este vídeo (v2) fora do empate
    const meio = [0, 9, 6, 9, 9, 15].map((likes, k) => ({ ...videos[k]!, likes }))
    const a = montar(buildReguas({ ...base('v2'), videos: meio }))
    expect(dxDe(a.container).map(x => x.dx).filter(x => x !== 0).sort((p, q) => p - q)).toEqual([-2.6, 2.6])
    cleanup()
    // todos empatados, este vídeo no meio do empate
    const iguais = videos.map(v => ({ ...v, likes: 7 }))
    const b = montar(buildReguas({ ...base('v2'), videos: iguais }))
    const t = dxDe(b.container)
    expect(t.find(x => x.este)!.dx).toBe(0)
    expect(t.filter(x => !x.este).map(x => Math.abs(x.dx)).sort((p, q) => p - q).map(x => +x.toFixed(1))).toEqual([4.4, 4.4, 7, 7, 9.6])
  })
})
