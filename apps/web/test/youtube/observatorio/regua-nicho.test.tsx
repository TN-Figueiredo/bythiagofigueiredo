// @vitest-environment jsdom
/** Tarefa 7 (A3): a régua do nicho na tela (jsdom): desenho aria-hidden, teclado, dica na camada flutuante, fala em região viva. */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, fireEvent, cleanup, act } from '@testing-library/react'
import { ReguaNicho } from '@/app/cms/(authed)/youtube/competitors/_chrome/regua/regua-nicho'
import { buildRegua, type ReguaView } from '@/app/cms/(authed)/youtube/competitors/_chrome/regua/regua-model'

// o jsdom 25 não tem PointerEvent: sem ele o fireEvent perde clientX e pointerType
if (typeof window.PointerEvent === 'undefined') {
  class PointerEventDeJsdom extends MouseEvent {
    readonly pointerType: string
    constructor(type: string, init: MouseEventInit & { pointerType?: string } = {}) { super(type, init); this.pointerType = init.pointerType ?? '' }
  }
  Object.defineProperty(window, 'PointerEvent', { value: PointerEventDeJsdom, configurable: true })
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); document.getElementById('flut')?.remove() })

const CORES = { A: 'var(--lado-o)', B: 'var(--lado-b)' }
const O = { numero: 'inscritos', conjunto: 'em Viagem', un: 'inscritos' }
const NOMES = ['Leo Khev', 'Ana Viaja', 'Beto Rota', 'Cris Mala', 'Dani Voo', 'Edu Trilha', 'Fabi Mapa', 'Gui Porto']
const vals = () => NOMES.map((nome, i) => ({ id: 'c' + i, nome, x: (i + 1) * 1000, texto: ((i + 1) * 1.0).toLocaleString('pt-BR') + ' mil' }))
const regua = (marcas: Parameters<typeof buildRegua>[1] = [{ id: 'c1', letra: 'A', nome: 'Ana Viaja', motivo: null }, { id: 'c6', letra: 'B', nome: 'Fabi Mapa', motivo: null }], v = vals(), o = O): ReguaView => buildRegua(v, marcas, o)
const flut = () => document.getElementById('flut')
const grupo = (c: HTMLElement) => c.querySelector<HTMLElement>('[role="group"]')!
const tips = () => [...(flut()?.querySelectorAll('[role="tooltip"]') ?? [])] as HTMLElement[]
const live = (c: HTMLElement) => c.querySelector('[aria-live]')!.textContent

describe('ReguaNicho · desenho e texto', () => {
  it('a régua visual é aria-hidden; o grupo tem o aria-label com as duas posições e o conjunto', () => {
    const r = regua()
    const { container } = render(<ReguaNicho regua={r} cores={CORES} />)
    const g = grupo(container)
    expect(g.getAttribute('aria-label')).toBe(r.aria)
    expect(g.getAttribute('aria-label')).toContain('Lado A, Ana Viaja: 7º de 8 em Viagem')
    expect(g.getAttribute('aria-label')).toContain('Lado B, Fabi Mapa: 2º de 8 em Viagem')
    const desenho = g.querySelector('[aria-hidden="true"]')!
    expect(desenho).not.toBeNull()
    expect(desenho.querySelectorAll('[data-i]').length).toBe(8)
    // nada de informação só no title
    expect(container.querySelector('[title]')).toBeNull()
  })

  it('um traço por canal do conjunto; dois destacados, com a letra A e B embaixo e a cor do lado', () => {
    const { container } = render(<ReguaNicho regua={regua()} cores={CORES} />)
    const ticks = [...container.querySelectorAll<HTMLElement>('[data-i]')]
    expect(ticks).toHaveLength(8)
    const a = container.querySelector<HTMLElement>('[data-marca="A"]')!
    const b = container.querySelector<HTMLElement>('[data-marca="B"]')!
    expect(a.style.getPropertyValue('--c')).toBe('var(--lado-o)')
    expect(b.style.getPropertyValue('--c')).toBe('var(--lado-b)')
    expect(container.querySelectorAll('[data-marca]')).toHaveLength(2)
    const la = container.querySelector<HTMLElement>('[data-letra="A"]')!, lb = container.querySelector<HTMLElement>('[data-letra="B"]')!
    expect(la.textContent).toBe('A'); expect(lb.textContent).toBe('B')
    expect(la.style.getPropertyValue('--c')).toBe('var(--lado-o)')
    expect(lb.style.getPropertyValue('--c')).toBe('var(--lado-b)')
    // a letra fica no mesmo ponto do traço (esquerda em %)
    expect(la.style.getPropertyValue('--x')).toBe(a.style.getPropertyValue('--x'))
    expect(lb.style.getPropertyValue('--x')).toBe(b.style.getPropertyValue('--x'))
  })

  it('os dois lados no mesmo ponto continuam distinguíveis: dois traços, duas letras', () => {
    const v = vals().map(x => (x.id === 'c1' || x.id === 'c6') ? { ...x, x: 5000, texto: '5 mil' } : x)
    const { container } = render(<ReguaNicho regua={regua(undefined, v)} cores={CORES} />)
    expect(container.querySelectorAll('[data-marca]')).toHaveLength(2)
    expect(container.querySelector('[data-letra="A"]')).not.toBeNull(); expect(container.querySelector('[data-letra="B"]')).not.toBeNull()
    const ea = container.querySelector<HTMLElement>('[data-marca="A"]')!.style, eb = container.querySelector<HTMLElement>('[data-marca="B"]')!.style
    expect(ea.getPropertyValue('--x')).toBe(eb.getPropertyValue('--x')) // o mesmo valor...
    expect(ea.getPropertyValue('--dx')).not.toBe(eb.getPropertyValue('--dx')) // ...em lugares que não se cobrem
  })

  it('lado sem valor não ganha traço nem letra, e a tela diz de quem falta e por quê, com o selo de "não medido"', () => {
    const r = regua([{ id: 'c1', letra: 'A', nome: 'Ana Viaja', motivo: null }, { id: 'zz', letra: 'B', nome: 'Gabi Sem Dado', motivo: 'inscritos ocultos pelo canal' }])
    const { container } = render(<ReguaNicho regua={r} cores={CORES} />)
    expect(container.querySelectorAll('[data-marca]')).toHaveLength(1)
    expect(container.querySelector('[data-letra="B"]')).toBeNull()
    expect(container.querySelectorAll('[data-i]')).toHaveLength(8)
    expect(container.textContent).toContain('sem traço de Gabi Sem Dado (lado B): inscritos ocultos pelo canal')
    expect(container.querySelector('.obs-ch-nm')?.textContent).toBe('não medido')
    expect(grupo(container).getAttribute('aria-label')).toContain('sem traço de Gabi Sem Dado (lado B)')
  })

  it('poucos canais: sem régua e sem parada de Tab, só a frase com o conjunto', () => {
    const r = buildRegua([{ id: 'a', nome: 'Ana', x: 1, texto: '1' }, { id: 'b', nome: 'Beto', x: 2, texto: '2' }], [{ id: 'a', letra: 'A', nome: 'Ana', motivo: null }, { id: 'b', letra: 'B', nome: 'Beto', motivo: null }], O)
    const { container } = render(<ReguaNicho regua={r} cores={CORES} />)
    expect(container.querySelector('[role="group"]')).toBeNull()
    expect(container.querySelector('[tabindex]')).toBeNull()
    expect(container.textContent).toContain('poucos canais para comparar em Viagem (2; precisa de 3)')
  })

  it('nenhum texto da régua diz "escala √" nem "raiz", nem com escala comprimida', () => {
    const baixos = [...Array.from({ length: 12 }, (_, i) => ({ id: 'b' + i, nome: 'B' + i, x: 1 + i, texto: String(1 + i) })), { id: 'g', nome: 'Grande', x: 1000, texto: '1000' }]
    const r = buildRegua(baixos, [{ id: 'b0', letra: 'A', nome: 'B0', motivo: null }], O)
    expect(r.comprimida).toBe(true)
    const { container } = render(<ReguaNicho regua={r} cores={CORES} />)
    fireEvent.focus(grupo(container))
    expect(container.textContent).not.toMatch(/√|raiz/i)
    expect(flut()?.textContent ?? '').not.toMatch(/√|raiz/i)
    expect(grupo(container).getAttribute('aria-label')).toMatch(/escala comprimida/i)
  })
})

describe('ReguaNicho · teclado', () => {
  it('uma parada de Tab por régua; o foco mostra a dica do lado A; setas, Home e End andam do menor ao maior; Esc fecha', () => {
    const { container } = render(<ReguaNicho regua={regua()} cores={CORES} />)
    const g = grupo(container)
    expect(g.getAttribute('tabindex')).toBe('0')
    expect(container.querySelectorAll('[tabindex]:not([tabindex="-1"])')).toHaveLength(1) // só o grupo
    expect(tips()).toHaveLength(0)
    act(() => g.focus())
    expect(tips()).toHaveLength(1)
    expect(tips()[0]!.textContent).toContain('Ana Viaja')
    expect(tips()[0]!.textContent).toContain('lado A')
    const on = () => [...container.querySelectorAll<HTMLElement>('[data-i].obs-rg-on')].map(e => e.getAttribute('data-i'))
    expect(on()).toEqual(['1']) // Ana, o 2º menor
    fireEvent.keyDown(g, { key: 'ArrowRight' }); expect(on()).toEqual(['2'])
    fireEvent.keyDown(g, { key: 'ArrowUp' }); expect(on()).toEqual(['3'])
    fireEvent.keyDown(g, { key: 'ArrowLeft' }); expect(on()).toEqual(['2'])
    fireEvent.keyDown(g, { key: 'ArrowDown' }); expect(on()).toEqual(['1'])
    fireEvent.keyDown(g, { key: 'End' }); expect(on()).toEqual(['7'])
    expect(tips()[0]!.textContent).toContain('Gui Porto')
    fireEvent.keyDown(g, { key: 'ArrowRight' }); expect(on()).toEqual(['7']) // não passa do fim
    fireEvent.keyDown(g, { key: 'Home' }); expect(on()).toEqual(['0'])
    fireEvent.keyDown(g, { key: 'ArrowLeft' }); expect(on()).toEqual(['0']) // nem do começo
    expect(tips()[0]!.textContent).toContain('Leo Khev')
    fireEvent.keyDown(g, { key: 'Escape' })
    expect(tips()).toHaveLength(0)
    expect(on()).toEqual([])
    expect(live(container)).toBe('')
    expect(document.activeElement).toBe(g)
    fireEvent.keyDown(g, { key: 'ArrowRight' }) // depois do Esc a seta reabre
    expect(tips()).toHaveLength(1)
  })

  it('sem lado destacado com valor, o foco cai no traço do meio; perder o foco fecha a dica', () => {
    const { container } = render(<ReguaNicho regua={regua([{ id: 'zz', letra: 'A', nome: 'Sem Dado', motivo: 'sem vídeos' }])} cores={CORES} />)
    const g = grupo(container)
    act(() => g.focus())
    expect([...container.querySelectorAll('.obs-rg-on')].map(e => e.getAttribute('data-i'))).toEqual(['4']) // 8 canais: o índice 4
    act(() => g.blur())
    expect(tips()).toHaveLength(0)
  })

  it('cada passo é falado numa região aria-live ("Leo Khev: 1 mil inscritos")', () => {
    const { container } = render(<ReguaNicho regua={regua()} cores={CORES} />)
    const g = grupo(container)
    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull()
    act(() => g.focus())
    expect(live(container)).toBe('Ana Viaja, lado A: 2 mil inscritos')
    fireEvent.keyDown(g, { key: 'Home' })
    expect(live(container)).toBe('Leo Khev: 1 mil inscritos')
    fireEvent.keyDown(g, { key: 'ArrowRight' })
    expect(live(container)).toBe('Ana Viaja, lado A: 2 mil inscritos')
    fireEvent.keyDown(g, { key: 'End' })
    expect(live(container)).toBe('Gui Porto: 8 mil inscritos')
    fireEvent.keyDown(g, { key: 'Escape' })
    expect(live(container)).toBe('')
  })

  it('empate: o passo diz quantos canais têm o mesmo valor e quais', () => {
    const v = vals().map(x => ['c2', 'c3', 'c4'].includes(x.id) ? { ...x, x: 3500, texto: '3,5 mil' } : x)
    const { container } = render(<ReguaNicho regua={regua(undefined, v)} cores={CORES} />)
    const g = grupo(container)
    act(() => g.focus())
    fireEvent.keyDown(g, { key: 'ArrowRight' }) // Beto Rota, no empate
    expect(live(container)).toBe('Beto Rota: 3,5 mil inscritos, 3 canais com 3,5 mil')
    expect(tips()[0]!.textContent).toContain('3 canais com 3,5 mil')
  })
})

describe('ReguaNicho · dica na camada flutuante', () => {
  const rect = (l: number, w = 2) => ({ left: l, right: l + w, top: 10, bottom: 22, width: w, height: 12, x: l, y: 10, toJSON: () => ({}) }) as DOMRect
  const dispor = (container: HTMLElement) => {
    // jsdom não tem layout: cada traço ganha um lugar, de 40 em 40 px
    container.querySelectorAll<HTMLElement>('[data-i]').forEach(t => { t.getBoundingClientRect = () => rect(100 + Number(t.getAttribute('data-i')) * 40) })
  }

  it('a dica mora em #flut (HoverTip), nunca dentro da célula; passar o mouse mostra a do traço mais perto', () => {
    const { container } = render(<ReguaNicho regua={regua()} cores={CORES} />)
    dispor(container)
    const g = grupo(container)
    expect(tips()).toHaveLength(0)
    fireEvent.pointerMove(g, { clientX: 100 + 5 * 40 + 3, clientY: 16, pointerType: 'mouse' }) // perto do traço 5 (Edu Trilha)
    expect(tips()).toHaveLength(1)
    const tip = tips()[0]!
    expect(tip.parentElement).toBe(flut())
    expect(container.contains(tip)).toBe(false)
    expect(tip.textContent).toContain('Edu Trilha')
    expect(tip.textContent).toContain('6 mil')
    fireEvent.pointerMove(g, { clientX: 100 + 1 * 40 - 4, clientY: 16, pointerType: 'mouse' })
    expect(tips()).toHaveLength(1)
    expect(tips()[0]!.textContent).toContain('Ana Viaja')
    expect(tips()[0]!.textContent).toContain('lado A')
    fireEvent.pointerLeave(g, { pointerType: 'mouse' })
    expect(tips()).toHaveLength(0)
  })

  it('mouse sobre um empate mostra "5 canais com 50" e os nomes (com o lado de quem é A ou B)', () => {
    const v = vals().map(x => ['c1', 'c2', 'c3', 'c4', 'c5'].includes(x.id) ? { ...x, x: 50000, texto: '50' } : x)
    const { container } = render(<ReguaNicho regua={regua(undefined, v)} cores={CORES} />)
    dispor(container)
    const g = grupo(container)
    // os traços empatados são os índices 1..5 do vetor ordenado; o ponteiro cai sobre o do meio
    fireEvent.pointerMove(g, { clientX: 100 + 3 * 40, clientY: 16, pointerType: 'mouse' })
    const t = tips()[0]!.textContent!
    expect(t).toContain('5 canais com 50')
    expect(t).toContain('Ana Viaja (lado A)')
    expect(t).toContain('Beto Rota')
  })

  it('toque mostra a dica do traço tocado (o foco que o navegador dá depois é coberto em "foco que vem do ponteiro")', () => {
    const { container } = render(<ReguaNicho regua={regua()} cores={CORES} />)
    dispor(container)
    fireEvent.pointerDown(grupo(container), { clientX: 100 + 2 * 40, clientY: 16, pointerType: 'touch' })
    expect(tips()[0]!.textContent).toContain('Beto Rota')
  })

  it('mover o dedo (pointermove de toque) rola a página: não abre dica; o fim do toque não a fecha, um toque fora fecha', () => {
    const { container } = render(<ReguaNicho regua={regua()} cores={CORES} />)
    dispor(container)
    const g = grupo(container)
    fireEvent.pointerMove(g, { clientX: 140, clientY: 16, pointerType: 'touch' })
    expect(tips()).toHaveLength(0)
    fireEvent.pointerDown(g, { clientX: 140, clientY: 16, pointerType: 'touch' })
    expect(tips()).toHaveLength(1)
    fireEvent.pointerLeave(g, { pointerType: 'touch' })
    expect(tips()).toHaveLength(1)
    fireEvent.pointerDown(document.body, { clientX: 5, clientY: 5, pointerType: 'touch' })
    expect(tips()).toHaveLength(0)
  })

  it('pelo mouse a dica aparece, mas nada é falado (só o teclado fala)', () => {
    const { container } = render(<ReguaNicho regua={regua()} cores={CORES} />)
    dispor(container)
    fireEvent.pointerMove(grupo(container), { clientX: 100 + 40, clientY: 16, pointerType: 'mouse' })
    expect(live(container)).toBe('')
  })

  it('a dica usa a unidade do número e o valor escrito, sem palavra interna', () => {
    const { container } = render(<ReguaNicho regua={regua()} cores={CORES} />)
    act(() => grupo(container).focus())
    expect(tips()[0]!.textContent).toMatch(/2 mil inscritos/)
    expect(tips()[0]!.textContent).not.toMatch(/pacote|dataset|ranking|sentinela|motor/i)
  })
})

describe('ReguaNicho · foco que vem do ponteiro (I1)', () => {
  const rect = (l: number, w = 2) => ({ left: l, right: l + w, top: 10, bottom: 22, width: w, height: 12, x: l, y: 10, toJSON: () => ({}) }) as DOMRect
  const dispor = (container: HTMLElement) => {
    container.querySelectorAll<HTMLElement>('[data-i]').forEach(t => { t.getBoundingClientRect = () => rect(100 + Number(t.getAttribute('data-i')) * 40) })
  }
  for (const tipo of ['touch', 'mouse'] as const) {
    it(`${tipo}: tocar/clicar num traço e o grupo ganhar o FOCO não troca a dica do traço apontado pela do lado A, nem fala`, () => {
      const { container } = render(<ReguaNicho regua={regua()} cores={CORES} />)
      dispor(container)
      const g = grupo(container)
      fireEvent.pointerDown(g, { clientX: 100 + 2 * 40, clientY: 16, pointerType: tipo }) // Beto Rota
      expect(tips()[0]!.textContent).toContain('Beto Rota')
      act(() => g.focus()) // o navegador foca o div tabindex=0 depois do pointerdown
      expect(document.activeElement).toBe(g)
      expect(tips()).toHaveLength(1)
      expect(tips()[0]!.textContent).toContain('Beto Rota')
      expect(tips()[0]!.textContent).not.toContain('lado A')
      expect(live(container)).toBe('')
      expect([...container.querySelectorAll<HTMLElement>('[data-i].obs-rg-on')].map(e => e.getAttribute('data-i'))).toEqual(['2'])
    })
  }
  it('depois do foco do ponteiro o teclado continua de onde o ponteiro parou', () => {
    const { container } = render(<ReguaNicho regua={regua()} cores={CORES} />)
    dispor(container)
    const g = grupo(container)
    fireEvent.pointerDown(g, { clientX: 100 + 2 * 40, clientY: 16, pointerType: 'mouse' })
    act(() => g.focus())
    fireEvent.keyDown(g, { key: 'ArrowRight' })
    expect([...container.querySelectorAll<HTMLElement>('[data-i].obs-rg-on')].map(e => e.getAttribute('data-i'))).toEqual(['3'])
    expect(live(container)).toContain('Cris Mala')
  })
  it('foco de teclado (sem ponteiro antes) continua mostrando e falando o lado A', () => {
    const { container } = render(<ReguaNicho regua={regua()} cores={CORES} />)
    act(() => grupo(container).focus())
    expect(tips()[0]!.textContent).toContain('lado A')
    expect(live(container)).toContain('Ana Viaja, lado A')
  })
  it('o foco que vem depois de uma saída e volta por Tab não herda o ponteiro de antes', () => {
    const { container } = render(<ReguaNicho regua={regua()} cores={CORES} />)
    dispor(container)
    const g = grupo(container)
    fireEvent.pointerDown(g, { clientX: 100 + 2 * 40, clientY: 16, pointerType: 'mouse' })
    act(() => g.focus())
    act(() => g.blur())
    expect(tips()).toHaveLength(0)
    act(() => g.focus())
    expect(tips()[0]!.textContent).toContain('lado A')
  })
})

describe('ReguaNicho · toque real: o foco chega depois do levantar do dedo (Q1)', () => {
  const rect = (l: number, w = 2) => ({ left: l, right: l + w, top: 10, bottom: 22, width: w, height: 12, x: l, y: 10, toJSON: () => ({}) }) as DOMRect
  const dispor = (container: HTMLElement) => {
    container.querySelectorAll<HTMLElement>('[data-i]').forEach(t => { t.getBoundingClientRect = () => rect(100 + Number(t.getAttribute('data-i')) * 40) })
  }
  const ligados = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>('[data-i].obs-rg-on')].map(e => e.getAttribute('data-i'))
  afterEach(() => { vi.useRealTimers() })

  it('toque: pointerdown, 150 ms de dedo na tela e SÓ DEPOIS o foco sintetizado: a dica continua a do traço tocado', () => {
    vi.useFakeTimers()
    const { container } = render(<ReguaNicho regua={regua()} cores={CORES} />)
    dispor(container)
    const g = grupo(container)
    fireEvent.pointerDown(g, { clientX: 100 + 2 * 40, clientY: 16, pointerType: 'touch' }) // Beto Rota, que não é o lado A
    act(() => { vi.advanceTimersByTime(150) })
    fireEvent.pointerUp(g, { clientX: 100 + 2 * 40, clientY: 16, pointerType: 'touch' })
    act(() => { vi.advanceTimersByTime(150) })
    act(() => g.focus()) // o mousedown sintetizado depois do touchend
    expect(tips()).toHaveLength(1)
    expect(tips()[0]!.textContent).toContain('Beto Rota')
    expect(tips()[0]!.textContent).not.toContain('lado A')
    expect(live(container)).toBe('')
    expect(ligados(container)).toEqual(['2'])
  })

  it('não há temporizador na marca: nenhum setTimeout é armado pelo pointerdown', () => {
    vi.useFakeTimers()
    const { container } = render(<ReguaNicho regua={regua()} cores={CORES} />)
    dispor(container)
    const antes = vi.getTimerCount()
    fireEvent.pointerDown(grupo(container), { clientX: 140, clientY: 16, pointerType: 'touch' })
    expect(vi.getTimerCount()).toBe(antes)
  })

  it('o toque que vira rolagem (pointercancel) e não dá foco não deixa a marca: o Tab de depois mostra o lado A', () => {
    const { container } = render(<ReguaNicho regua={regua()} cores={CORES} />)
    dispor(container)
    const g = grupo(container)
    fireEvent.pointerDown(g, { clientX: 100 + 2 * 40, clientY: 16, pointerType: 'touch' })
    fireEvent.pointerCancel(g, { pointerType: 'touch' })
    fireEvent.pointerDown(document.body, { clientX: 5, clientY: 5, pointerType: 'touch' }) // um toque fora fecha a dica
    expect(tips()).toHaveLength(0)
    act(() => g.focus())
    expect(tips()[0]!.textContent).toContain('lado A')
    expect(live(container)).toContain('Ana Viaja, lado A')
  })

  it('uma tecla antes do foco (Tab vindo de outro lugar) desfaz a marca do ponteiro', () => {
    const { container } = render(<ReguaNicho regua={regua()} cores={CORES} />)
    dispor(container)
    const g = grupo(container)
    fireEvent.pointerDown(g, { clientX: 100 + 2 * 40, clientY: 16, pointerType: 'mouse' })
    fireEvent.keyDown(document.body, { key: 'Tab' })
    act(() => g.focus())
    expect(tips()[0]!.textContent).toContain('lado A')
  })

  it('Q2: com o grupo já focado, clicar noutro traço leva o teclado a ele (a seta parte do clicado)', () => {
    const { container } = render(<ReguaNicho regua={regua()} cores={CORES} />)
    dispor(container)
    const g = grupo(container)
    act(() => g.focus()) // lado A (índice 1)
    fireEvent.pointerDown(g, { clientX: 100 + 5 * 40, clientY: 16, pointerType: 'mouse' }) // Fabi Mapa? índice 5
    fireEvent.keyDown(g, { key: 'ArrowRight' })
    expect(ligados(container)).toEqual(['6'])
  })

  it('o clique com o grupo já focado não deixa a marca armada para um foco futuro', () => {
    const { container } = render(<ReguaNicho regua={regua()} cores={CORES} />)
    dispor(container)
    const g = grupo(container)
    act(() => g.focus())
    fireEvent.pointerDown(g, { clientX: 140, clientY: 16, pointerType: 'mouse' })
    act(() => g.blur())
    act(() => g.focus())
    expect(tips()[0]!.textContent).toContain('lado A')
  })
})

describe('ReguaNicho · a régua troca com o componente montado (M1, M2)', () => {
  const mk = (n: number) => buildRegua(vals().slice(0, n), [{ id: 'c1', letra: 'A', nome: 'Ana Viaja', motivo: null }, { id: 'c2', letra: 'B', nome: 'Beto Rota', motivo: null }], O)
  it('M2: com a dica aberta num índice alto, uma régua menor não deixa dica vazia nem índice velho', () => {
    const { container, rerender } = render(<ReguaNicho regua={mk(8)} cores={CORES} />)
    const g = grupo(container)
    act(() => g.focus())
    fireEvent.keyDown(g, { key: 'End' })
    expect(tips()[0]!.textContent).toContain('Gui Porto')
    rerender(<ReguaNicho regua={mk(4)} cores={CORES} />)
    // nenhuma caixa vazia flutuando
    for (const t of tips()) expect(t.textContent!.trim()).not.toBe('')
    expect(tips()).toHaveLength(0)
    expect(live(container)).toBe('')
    // e o teclado não ficou preso além do fim: a seta anda do começo
    fireEvent.keyDown(g, { key: 'ArrowRight' })
    expect(tips()).toHaveLength(1)
    expect(tips()[0]!.textContent!.trim()).not.toBe('')
  })
  it('M2: a mesma régua refeita (objeto novo, mesmo conteúdo) não fecha a dica aberta', () => {
    const { container, rerender } = render(<ReguaNicho regua={mk(8)} cores={CORES} />)
    act(() => grupo(container).focus())
    expect(tips()).toHaveLength(1)
    rerender(<ReguaNicho regua={mk(8)} cores={CORES} />)
    expect(tips()).toHaveLength(1)
  })
  it('M1: quando um lado perde o valor o deslocamento da letra que ficou volta a 0', () => {
    class RO { constructor(_f: ResizeObserverCallback) {} observe() {} unobserve() {} disconnect() {} }
    vi.stubGlobal('ResizeObserver', RO)
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const l = this.classList.contains('obs-rg-in') ? 400 : 0
      return { left: 0, right: l, top: 0, bottom: 0, width: l, height: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect
    })
    const empatados = vals().map(x => x.id === 'c3' ? { ...x, x: 3000, texto: '3 mil' } : x)
    const ambos = buildRegua(empatados, [{ id: 'c2', letra: 'A', nome: 'Beto Rota', motivo: null }, { id: 'c3', letra: 'B', nome: 'Cris Mala', motivo: null }], O)
    const soA = buildRegua(empatados.filter(x => x.id !== 'c3'), [{ id: 'c2', letra: 'A', nome: 'Beto Rota', motivo: null }, { id: 'c3', letra: 'B', nome: 'Cris Mala', motivo: 'sem vídeos' }], O)
    const { container, rerender } = render(<ReguaNicho regua={ambos} cores={CORES} />)
    const la = () => container.querySelector<HTMLElement>('[data-letra="A"]')!
    expect(parseFloat(la().style.getPropertyValue('--dx'))).toBeLessThan(0)
    rerender(<ReguaNicho regua={soA} cores={CORES} />)
    expect(container.querySelector('[data-letra="B"]')).toBeNull()
    expect(la().style.getPropertyValue('--dx')).toBe('0px')
  })
})

describe('ReguaNicho · desmontar (M7)', () => {
  it('o ResizeObserver é desconectado e os ouvintes de janela e documento saem', () => {
    const disconnect = vi.fn()
    class RO { constructor(_f: ResizeObserverCallback) {} observe() {} unobserve() {} disconnect() { disconnect() } }
    vi.stubGlobal('ResizeObserver', RO)
    const addW = vi.spyOn(window, 'addEventListener'), remW = vi.spyOn(window, 'removeEventListener')
    const addD = vi.spyOn(document, 'addEventListener'), remD = vi.spyOn(document, 'removeEventListener')
    const { container, unmount } = render(<ReguaNicho regua={regua()} cores={CORES} />)
    const g = grupo(container)
    fireEvent.pointerDown(g, { clientX: 0, clientY: 0, pointerType: 'touch' }) // liga o ouvinte de "toque fora"
    act(() => g.focus()) // liga resize e scroll
    unmount()
    expect(disconnect).toHaveBeenCalled()
    const pares = (add: typeof addW, rem: typeof remW, tipo: string) => ({
      adds: add.mock.calls.filter(c => c[0] === tipo).length, rems: rem.mock.calls.filter(c => c[0] === tipo).length,
    })
    const rs = pares(addW, remW, 'resize'); expect(rs.adds).toBeGreaterThan(0); expect(rs.rems).toBe(rs.adds)
    const sc = pares(addD, remD, 'scroll'); expect(sc.adds).toBeGreaterThan(0); expect(sc.rems).toBe(sc.adds)
    const pd = pares(addD, remD, 'pointerdown'); expect(pd.adds).toBeGreaterThan(0); expect(pd.rems).toBe(pd.adds)
  })
})

describe('ReguaNicho · A e B empatados (M7)', () => {
  it('o texto acessível diz "(empate)" para os dois lados e a dica diz "2 canais com X" com os dois nomes', () => {
    const v = vals().map(x => (x.id === 'c1' || x.id === 'c6') ? { ...x, x: 5500, texto: '5,5 mil' } : x)
    const r = regua(undefined, v)
    expect(r.aria).toContain('Lado A, Ana Viaja: 3º de 8 em Viagem (empate)')
    expect(r.aria).toContain('Lado B, Fabi Mapa: 3º de 8 em Viagem (empate)')
    const { container } = render(<ReguaNicho regua={r} cores={CORES} />)
    act(() => grupo(container).focus())
    expect(tips()[0]!.textContent).toContain('2 canais com 5,5 mil')
    expect(live(container)).toContain('2 canais com 5,5 mil')
  })
})

describe('ReguaNicho · letras que colidem', () => {
  it('o afastamento é medido pela largura real e refeito quando a largura muda (ResizeObserver)', () => {
    let cb: ResizeObserverCallback = () => {}
    class RO { constructor(f: ResizeObserverCallback) { cb = f } observe() {} unobserve() {} disconnect() {} }
    vi.stubGlobal('ResizeObserver', RO)
    let largura = 400
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const l = this.classList.contains('obs-rg-in') ? largura : 0
      return { left: 0, right: l, top: 0, bottom: 0, width: l, height: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect
    })
    // A e B no mesmo valor, numa régua de 400 px
    const v = vals().map(x => x.id === 'c3' ? { ...x, x: 3000, texto: '3 mil' } : x) // B no mesmo valor de A (c2)
    const r = regua([{ id: 'c2', letra: 'A', nome: 'Beto Rota', motivo: null }, { id: 'c3', letra: 'B', nome: 'Cris Mala', motivo: null }], v)
    const { container } = render(<ReguaNicho regua={r} cores={CORES} />)
    const la = container.querySelector<HTMLElement>('[data-letra="A"]')!, lb = container.querySelector<HTMLElement>('[data-letra="B"]')!
    const dx = (e: HTMLElement) => parseFloat(e.style.getPropertyValue('--dx'))
    // as duas no mesmo valor: A para a esquerda, B para a direita, 22 px de distância
    expect(dx(la)).toBeLessThan(0); expect(dx(lb)).toBeGreaterThan(0)
    expect(dx(lb) - dx(la)).toBeGreaterThanOrEqual(20)
    // mais largo: ainda empatadas, continuam afastadas; régua sem largura: zeradas
    largura = 0
    act(() => cb([], {} as ResizeObserver))
    expect(dx(la)).toBe(0); expect(dx(lb)).toBe(0)
    largura = 300
    act(() => cb([], {} as ResizeObserver))
    expect(dx(la)).toBeLessThan(0)
  })

  it('letras com folga ficam em --dx 0', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const l = this.classList.contains('obs-rg-in') ? 400 : 0
      return { left: 0, right: l, top: 0, bottom: 0, width: l, height: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect
    })
    const { container } = render(<ReguaNicho regua={regua()} cores={CORES} />)
    expect(container.querySelector<HTMLElement>('[data-letra="A"]')!.style.getPropertyValue('--dx')).toBe('0px')
    expect(container.querySelector<HTMLElement>('[data-letra="B"]')!.style.getPropertyValue('--dx')).toBe('0px')
  })
})
